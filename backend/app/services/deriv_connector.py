import asyncio
import time
import json
import websockets
import logging
import numpy as np
import uuid
from typing import Callable, Optional, Dict, Any, List
from datetime import datetime
from app.core.engine_wrapper import EngineWrapper
from app.services.trade_manager import TradeManager
from app.services.stream_manager import stream_manager
from app.signals.market_structure import MarketStructure
from app.signals.indicator_layer import IndicatorLayer
from app.signals.entry_validator import EntryValidator
from app.exits.smart_stops import SmartStopLoss
from app.exits.dynamic_tp import DynamicTakeProfit
from app.exits.scalper_exit import ScalperExitModule
from app.exits.scalper_tpsl import ScalperTPSL
from app.risk.weighted_lots import WeightedLotCalculator
from app.risk.risk_guard import RiskGuard
from app.risk.cooldown_manager import CooldownManager
from app.strategies.master_engine import MasterEngine
from app.strategies.strategy_manager import StrategyManager

class SymbolProcessor:
    """Manages the full analysis stack for a single symbol."""
    def __init__(self, symbol: str, config: Dict[str, Any] = None):
        self.symbol = symbol
        self.engine = MasterEngine()
        self.market_structure = MarketStructure()
        self.indicator_layer = IndicatorLayer()
        self.entry_validator = EntryValidator()
        self.strategy_manager = StrategyManager()
        self.strategy_manager.select_strategy_by_symbol(symbol)
        self.tick_count = 0
        self.candle_counts = {"1m": 0, "5m": 0, "15m": 0, "1h": 0}
        
        # Apply config if provided
        if config and hasattr(self.indicator_layer, 'update_params'):
            self.indicator_layer.update_params(
                rsi_oversold = config.get("rsi_oversold"),
                rsi_overbought = config.get("rsi_overbought")
            )
        
        # Link for RSI Hybrid Mode
        self.engine.indicator_layer = self.indicator_layer
        
        # Exits
        self.smart_sl = SmartStopLoss()
        self.dynamic_tp = DynamicTakeProfit()

# Deriv API Endpoint
DERIV_WS_BASE_URL = "wss://ws.derivws.com/websockets/v3"

logger = logging.getLogger("deriv_connector")

import os
from dotenv import load_dotenv

load_dotenv()

class DerivConnector:
    def __init__(self, token: str = None, app_id: str = "65395"):
        self.token = token or os.getenv("DERIV_TOKEN")
        self.app_id = app_id or os.getenv("DERIV_APP_ID", "65395")
        if not self.token:
            logger.warning("No DERIV_TOKEN found in environment. Connection may fail.")
        self.ws = None
        self.ws = None
        self.is_connected = False
        self.is_authorized = False
        self.active_symbols = ["R_10", "R_100", "R_75", "R_50"] 
        self.active_requests: Dict[str, asyncio.Future] = {} 
        self.listen_task: Optional[asyncio.Task] = None
        
        self.active_account_id = None
        # Account Data
        self.available_accounts: List[Dict] = []
        self.current_account: Dict = {}
        self.open_positions: List[Dict] = []
        
        self.req_id_counter = 100 
        self.tick_count = 0
        self.processed_contracts = set()
        
        # Session Stats
        self.session_stats = {
            "pnl": 0.0,
            "trades": 0,
            "wins": 0,
            "losses": 0
        }

        # Symbol Processing Units
        self.processors: Dict[str, SymbolProcessor] = {}
        self.enabled_symbols = ["R_10", "R_75"] # Both enabled by default
        
        # Risk & Shared Services (Shared across all pairs)
        self.lot_calculator = WeightedLotCalculator()
        self.risk_guard = RiskGuard()
        self.cooldown_manager = CooldownManager(default_cooldown_seconds=30)
        
        # Local Contract Memory (SL/TP Tracking)
        # Local Contract Memory (SL/TP Tracking)
        self.contract_metadata: Dict[str, Dict] = {}
        
        # Multi-Timeframe Storage (1H Candles)
        self.candles_1h: Dict[str, deque] = {}
        
        # Performance & Rate Limit Guards
        self.contracts_cache: Dict[str, Dict] = {} # {symbol: {"data": [...], "timestamp": float}}
        self.trade_lock = asyncio.Lock()
        
        # Initialize C++ Engine with new JSON config
        try:
            EngineWrapper.init_engine(json.dumps({
                "cooldown_seconds": 60,
                "max_active_trades": 10
            }))
            logger.info("C++ Engine Initialized via Wrapper")
        except Exception as e:
            logger.error(f"Failed to init C++ Engine: {e}")

        # Default Config
        self.default_config = {
            "grid_size": 10,
            "risk_percent": 1.0,
            "max_lots": 5.0,
            "confidence_threshold": 0.4,
            "stop_loss_points": 50.0,
            "take_profit_points": 100.0,
            "max_open_trades": 5,
            "drawdown_limit": 10.0,
            # Advanced Settings - Wider ATR range for R_10 compatibility
            "min_atr": 0.0,
            "max_atr": 1.0,
            "min_pips": 0.0,
            "atr_spike_multiplier": 20.0,
            "rsi_oversold": 30.0,
            "rsi_overbought": 70.0,
            "max_daily_loss": 5.0,
            "max_sl_hits": 3
        }
        self.last_skipped_data = {}
        
        # Apply initial config
        self.apply_config_updates(self.default_config)

    def apply_config_updates(self, config: Dict[str, Any]):
        """Apply dynamic configuration updates to sub-services."""
        # Update internal defaults for future processors
        self.default_config.update(config)
            
        # Update Risk Guard
        if hasattr(self.risk_guard, 'update_params'):
            self.risk_guard.update_params(
                max_daily_loss_percent = config.get("max_daily_loss"),
                max_sl_hits = config.get("max_sl_hits"),
                max_active_trades = config.get("max_open_trades")
            )
            
        # Update all active processors
        for symbol, p in self.processors.items():
            if hasattr(p.indicator_layer, 'update_params'):
                p.indicator_layer.update_params(
                    rsi_oversold = config.get("rsi_oversold"),
                    rsi_overbought = config.get("rsi_overbought")
                )
            
        logger.info("Dynamic configuration applied to active processors.")

    async def connect(self):
        while True:
            try:
                url = f"{DERIV_WS_BASE_URL}?app_id={self.app_id}"
                logger.info(f"Connecting to {url}")
                self.ws = await websockets.connect(url)
                self.is_connected = True
                logger.info("Connected to Deriv WebSocket")
                
                # Start listener
                if self.listen_task:
                    self.listen_task.cancel()
                self.listen_task = asyncio.create_task(self.listen())
                
                # Non-blocking initialization
                asyncio.create_task(self.initialize_session())
                
                # If we successfully connected and started listener, break the retry loop
                break
                
            except Exception as e:
                logger.error(f"Connection failed: {e}. Retrying in 5 seconds...")
                await stream_manager.broadcast_notification(
                    "Connection Lost",
                    f"Connection to Deriv failed. Retrying... Error: {e}",
                    "error"
                )
                self.is_connected = False
                await asyncio.sleep(5)

    async def initialize_session(self):
        """Perform authorization and subscriptions in background."""
        try:
            # Small delay to ensure listener is ready
            await asyncio.sleep(0.5)
            
            await stream_manager.broadcast_log({
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "message": "Connecting to Deriv API...",
                "level": "info",
                "source": "System"
            })
            
            await self.authorize()
            
            # Subscriptions
            await stream_manager.broadcast_log({
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "message": "Subscribing to live data feeds...",
                "level": "info",
                "source": "System"
            })
            
            await asyncio.gather(
                self.subscribe_ticks(),
                self.subscribe_candles_1h(), # MTF Sub
                self.subscribe_balance(),
                self.subscribe_portfolio(),
                self.subscribe_contracts(),
                return_exceptions=True
            )
            logger.info("Session initialization complete")
            
            # Bootstrap Engine with Default Config
            try:
                EngineWrapper.init_engine(json.dumps(self.default_config))
                logger.info("Trading Engine Initialized with Default Config")
            except Exception as e:
                logger.error(f"Failed to initialize trading engine: {e}")
                
        except Exception as e:
            logger.error(f"Session initialization failed: {e}")

    async def authorize(self, token: str = None):
        target_token = token or self.token
        if not target_token:
            logger.error("No token provided for authorization")
            return
            
        for attempt in range(1, 4):
            req = {"authorize": target_token}
            resp = await self.send_request(req)
            
            if 'error' in resp:
                await asyncio.sleep(2)
                continue
            
            if 'authorize' in resp:
                auth_data = resp['authorize']
                loginid = auth_data.get('loginid')
                fullname = auth_data.get('fullname')
                msg = f"Backend Authorized as {fullname} ({loginid})"
                self.is_authorized = True
                logger.info(msg)
                
                await stream_manager.broadcast_log({
                    "id": str(uuid.uuid4()),
                    "timestamp": datetime.now().isoformat(),
                    "message": msg,
                    "level": "success",
                    "source": "Deriv"
                })
                
                # Setup current account
                self.current_account = {
                    "id": loginid,
                    "balance": float(auth_data.get("balance") if auth_data.get("balance") is not None else 0.0),
                    "currency": auth_data.get("currency", "USD"),
                    "email": auth_data.get("email")
                }
                self.active_account_id = self.current_account["id"]
                
                # Initialize Start Balance for Risk Guard
                if not hasattr(self, 'start_balance') or self.start_balance is None:
                    self.start_balance = self.current_account["balance"]
                    logger.info(f"Bot Session Start Balance Initialized: ${self.start_balance}")
                
                # Parse Account List
                raw_list = auth_data.get("account_list", [])
                self.available_accounts = []
                for acc in raw_list:
                    acc_id = acc.get("loginid")
                    is_virtual = acc.get("is_virtual")
                    
                    # Determine type explicitly
                    if is_virtual:
                        acc_type = "demo"
                    elif acc_id.startswith("CR"): # Standard Deriv Real Account prefix
                        acc_type = "real"
                    elif acc_id.startswith("VR"): # Standard Deriv Virtual Account prefix
                        acc_type = "demo"
                    else:
                         acc_type = "real" # Default to real for unknown prefixes if not virtual

                    self.available_accounts.append({
                        "id": acc_id,
                        "name": f"Deriv {acc.get('currency')} {acc_type.capitalize()}",
                        "type": acc_type,
                        "currency": acc.get("currency"),
                        "balance": 0.0, # Balance is not provided in account_list, requires individual auth
                        "equity": 0.0,
                        "isActive": acc_id == self.active_account_id
                    })
                
                # Update the active account's balance in the list
                for acc in self.available_accounts:
                    if acc["id"] == self.active_account_id:
                        acc["balance"] = self.current_account["balance"]
                        acc["equity"] = self.current_account["balance"]
                        acc["isActive"] = True

                
                if not self.token:
                    self.token = target_token
                    
                return
        
        if not self.token:
             msg = ">>> ALL AUTH ATTEMPTS FAILED. PLEASE RE-LOGIN."
             print(msg)
             await stream_manager.broadcast_notification(
                 "Authorization Failed",
                 "Bot could not authorize. Please re-login in Dashboard.",
                 "critical"
             )


    async def subscribe_ticks(self):
        if not self.ws: return
        for symbol in self.active_symbols:
            req = {
                "ticks": symbol,
                "subscribe": 1
            }
            await self.ws.send(json.dumps(req))
            logger.info(f"Subscribed to tick feed: {symbol}")

    async def subscribe_balance(self):
        if not self.ws: return
        req = {"balance": 1, "subscribe": 1}
        await self.ws.send(json.dumps(req))
        logger.info("Subscribed to Balance updates")

    async def subscribe_portfolio(self):
        if not self.ws: return
        # portfolio: 1 gives us the initial list of open positions and future updates
        req = {"portfolio": 1} 
        await self.ws.send(json.dumps(req))
        logger.info("Subscribed to Portfolio (Open Positions)")

    async def subscribe_contracts(self):
        if not self.ws: return
        # proposal_open_contract: 1 without contract_id subscribes to ALL open contracts
        req = {"proposal_open_contract": 1, "subscribe": 1}
        await self.ws.send(json.dumps(req))
        logger.info("Subscribed to global Contract Updates")

    async def subscribe_candles_1h(self):
        """Subscribe to 1-Hour candles for active symbols for MTF analysis."""
        for symbol in self.active_symbols:
            # Initialize storage
            if symbol not in self.candles_1h:
                self.candles_1h[symbol] = deque(maxlen=20)
                
            logger.info(f"Subscribing to 1H candles: {symbol}")
            req = {
                "ticks_history": symbol,
                "style": "candles",
                "granularity": 3600, # 1 Hour
                "end": "latest",
                "count": 20,
                "subscribe": 1
            }
            await self.send_request(req)

    async def get_active_symbols(self):
        """Fetches active symbols from Deriv if not already cached/set."""
        req = {
            "active_symbols": "brief",
            "product_type": "basic"
        }
        resp = await self.send_request(req)
        if 'active_symbols' in resp:
            # Filter for Synthetic Indices as they are common for bots
            symbols = [
                {
                    "symbol": s['symbol'],
                    "display_name": s['display_name'],
                    "market": s['market_display_name']
                }
                for s in resp['active_symbols']
                if s.get('market') in ['synthetic_index', 'forex', 'derived']
            ]
            return symbols
        return []

    async def get_candles(self, symbol: str, granularity: int = 60, count: int = 100):
        """Fetches historical candles for a symbol."""
        req = {
            "ticks_history": symbol,
            "style": "candles",
            "granularity": granularity,
            "count": count,
            "end": "latest"
        }
        resp = await self.send_request(req)
        if 'candles' in resp:
            return [
                {
                    "time": datetime.fromtimestamp(c['epoch']).strftime('%H:%M'),
                    "epoch": c['epoch'],
                    "open": float(c['open']),
                    "high": float(c['high']),
                    "low": float(c['low']),
                    "close": float(c['close']),
                    "volume": 0 # Deriv doesn't always provide volume for all indices
                }
                for c in resp['candles']
            ]
        return []

    async def send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        if not self.ws or not self.is_connected:
            raise ConnectionError("WebSocket not connected")

        if 'req_id' not in request:
            self.req_id_counter += 1
            request['req_id'] = self.req_id_counter
            
        req_id = request['req_id']
        future = asyncio.get_running_loop().create_future()
        self.active_requests[req_id] = future
        
        try:
            logger.info(f">>> SENDING: {request}")
            await self.ws.send(json.dumps(request))
            response = await asyncio.wait_for(future, timeout=60.0) 
            logger.info(f">>> GOT RESPONSE FOR {req_id}")
            return response
        except asyncio.TimeoutError:
            logger.error(f"Request {req_id} timed out")
            return {"error": {"code": "Timeout", "message": "Request timed out"}}
        finally:
            self.active_requests.pop(req_id, None)

    async def listen(self):
        logger.info("Listener Process Started")
        while self.is_connected and self.ws:
            try:
                message = await self.ws.recv()
                logger.info(f"RECVD: {message}")
                data = json.loads(message)
                # Check for req_id match in both top-level and echo_req
                req_id = data.get('req_id')
                if not req_id and 'echo_req' in data:
                    req_id = data['echo_req'].get('req_id')
                
                # logger.debug is enough for production
                if data.get('msg_type') not in ['tick', 'ohlc']:
                    logger.debug(f"Deriv WebSocket Received: {data.get('msg_type')} (req_id: {req_id})")
                
                # Try matching by req_id
                if req_id is not None:
                    # Try as provided type, then as int, then as string
                    match_found = False
                    keys_to_try = [req_id]
                    try:
                        keys_to_try.append(int(req_id))
                    except: pass
                    keys_to_try.append(str(req_id))
                    
                    for k in keys_to_try:
                        if k in self.active_requests:
                            logger.info(f"MATCHED req_id {k}")
                            future = self.active_requests[k]
                            if not future.done():
                                future.set_result(data)
                            match_found = True
                            break
                    
                    if not match_found and data.get('msg_type') not in ['tick', 'ohlc']:
                        logger.warning(f"req_id {req_id} NOT found in active_requests: {list(self.active_requests.keys())}")
                
                if 'tick' in data:
                    asyncio.create_task(self.handle_tick(data['tick']))
                
                if 'ohlc' in data:
                    # Async update of 1h candles
                    symbol = data['ohlc']['symbol']
                    if symbol in self.candles_1h:
                        c_data = data['ohlc']
                        candle = {
                            "open": float(c_data['open']),
                            "high": float(c_data['high']),
                            "low": float(c_data['low']),
                            "close": float(c_data['close']),
                            "epoch": int(c_data['open_time'])
                        }
                        # Deque update logic
                        q = self.candles_1h[symbol]
                        if not q: q.append(candle)
                        elif q[-1]['epoch'] == candle['epoch']: q[-1] = candle
                        else: q.append(candle)
                        
                        # Sync with Engine
                        if symbol in self.processors:
                             self.processors[symbol].engine.inject_external_candles("1h", list(q))
                
                if 'balance' in data:
                     asyncio.create_task(self.handle_balance(data['balance']))

                if 'portfolio' in data:
                    asyncio.create_task(self.handle_portfolio(data['portfolio']))

                if 'proposal_open_contract' in data:
                    asyncio.create_task(self.handle_position_update(data['proposal_open_contract']))
                    
            except websockets.ConnectionClosed:
                logger.warning("Deriv WebSocket connection closed. Attempting reconnect...")
                self.is_connected = False
                asyncio.create_task(self.connect()) # Attempt reconnect
                break
            except Exception as e:
                logger.error(f"Error in Deriv listener: {e}")
                # Don't break on generic errors, just continue listening if possible
                if not self.ws or not self.is_connected:
                    logger.warning("Listener lost connection, attempting reconnect...")
                    asyncio.create_task(self.connect())
                    break

    async def handle_tick(self, tick):
        symbol = tick['symbol']
        bid = tick['quote']
        epoch = tick['epoch']
        
        tick_data = {
            "symbol": symbol,
            "bid": float(bid),
            "ask": float(bid), # Simplified for synthetic
            "timestamp": datetime.fromtimestamp(epoch).isoformat(),
        }
        
        # Broadcast ALL ticks
        await stream_manager.broadcast_tick(tick_data)
        
        # Monitor positions
        await self.monitor_positions_for_sl_tp(float(bid), symbol)
        
        # Get Processor (Universal: We process ALL symbols for ML Insights)
        if symbol not in self.processors:
             self.processors[symbol] = SymbolProcessor(symbol, self.default_config)
        
        p = self.processors[symbol]
        p.tick_count += 1

        # 1. Update Engine (Universal)
        p.engine.update_tick(symbol, float(bid), epoch)

        # 2. Synchronize MTF Indicators (Only on candle close to preserve momentum slope)
        current_counts = {
            "1m": len(p.engine.candles_1m),
            "5m": len(p.engine.candles_5m),
            "15m": len(p.engine.candles_15m),
            "1h": len(p.engine.candles_1h)
        }
        
        for tf, count in current_counts.items():
            if count > p.candle_counts[tf]:
                rsi_val = p.engine.get_momentum(tf)
                p.indicator_layer.update_rsi_timeframe(tf, rsi_val)
                p.candle_counts[tf] = count

        # 3. Analyze Indicators (Universal for ML Predictions)
        tick_for_algo = {
            "symbol": symbol,
            "quote": float(bid),
            "high": float(tick.get('ask', bid)),
            "low": float(tick.get('bid', bid)),
            "open": float(bid),
            "epoch": epoch
        }
        indicator_data = p.indicator_layer.analyze(tick_for_algo, engine=p.engine)
        structure_data = p.market_structure.analyze(tick_for_algo)

        # Only process trading logic for enabled symbols
        if symbol not in self.enabled_symbols:
            return

        try:
            # 4. Strategy Analysis
            candles_1m_list = list(p.engine.candles_1m)
            market_mode = p.engine.detect_market_mode(candles_1m_list)
            
            # Run strategy
            strategy_signal = p.strategy_manager.run_strategy(
                symbol,
                tick_for_algo,
                p.engine,
                structure_data,
                indicator_data
            )
            
            # 4. Final Validation & Execution
            action = strategy_signal.get('action') if strategy_signal else None
            final_confidence = strategy_signal.get('confidence', 0) if strategy_signal else 0
            volatility_state = p.engine.get_volatility("1m")
            
            # Broadcast Skip if reason provided (Optimized: Throttled)
            if strategy_signal and not action and strategy_signal.get('reason'):
                now = time.time()
                last_data = self.last_skipped_data.get(symbol, {"reason": "", "timestamp": 0})
                
                # Only broadcast if reason changed OR 10 seconds passed
                if strategy_signal['reason'] != last_data['reason'] or (now - last_data['timestamp']) > 10.0:
                    await stream_manager.broadcast_skipped_signal({
                        "tick_count": p.tick_count,
                        "reason": strategy_signal['reason'],
                        "symbol": symbol,
                        "atr": p.engine.get_atr("1m"),
                        "confidence": final_confidence,
                        "regime": market_mode,
                        "volatility": volatility_state,
                        "timestamp": datetime.now().isoformat()
                    })
                    self.last_skipped_data[symbol] = {"reason": strategy_signal['reason'], "timestamp": now}
            
            if action:
                # 1. Cooldown Check
                if not self.cooldown_manager.can_trade():
                    logger.warning(f"[SIGNAL SKIPPED] {symbol}: Cooldown Active")
                    await stream_manager.broadcast_skipped_signal({
                        "tick_count": p.tick_count,
                        "reason": "Cooldown Active",
                        "symbol": symbol,
                        "atr": 0, # Not relevant for cooldown
                        "confidence": final_confidence,
                        "regime": market_mode,
                        "volatility": volatility_state,
                        "timestamp": datetime.now().isoformat()
                    })
                    return

                # 2. Risk Guard Check
                start_bal = getattr(self, 'start_balance', self.current_account.get('balance', 1000.0))
                is_safe, guard_msg = self.risk_guard.check_trade_allowed(
                    self.current_account.get('balance', 0.0),
                    start_bal,
                    len(self.open_positions),
                    volatility_state,
                    self.is_authorized
                )
                
                if not is_safe:
                    logger.warning(f"[SIGNAL SKIPPED] {symbol}: Risk Guard Blocked: {guard_msg}")
                    await stream_manager.broadcast_skipped_signal({
                        "tick_count": p.tick_count,
                        "reason": f"Risk Guard: {guard_msg}",
                        "symbol": symbol,
                        "atr": p.engine.get_atr("1m"),
                        "confidence": final_confidence,
                        "regime": market_mode,
                        "volatility": volatility_state,
                        "timestamp": datetime.now().isoformat()
                    })
                    return

                sl_price = strategy_signal.get('sl')
                tp_price = strategy_signal.get('tp')
                
                # Convert distances to prices if needed
                if sl_price is not None and sl_price < (float(bid) * 0.5):
                     sl_price = float(bid) - sl_price if action == "BUY" else float(bid) + sl_price
                if tp_price is not None and tp_price < (float(bid) * 0.5):
                     tp_price = float(bid) + tp_price if action == "BUY" else float(bid) - tp_price
                
                # Weighted lot size
                risk_pct = 0.5
                stake = self.lot_calculator.calculate_lot_size(
                    self.current_account.get('balance', 0.0),
                    risk_pct,
                    final_confidence,
                    market_mode,
                    volatility=volatility_state,
                    symbol=symbol
                )
                
                # Min stake check
                stake = max(0.35, stake)

                # Execution
                await self.execute_order(symbol, action, stake, sl_price, tp_price, final_confidence, market_mode)
                
            # 5. Broadcast Market Status (Always, even if no action)
            strategy_info = p.strategy_manager.get_active_strategy_info()
            await stream_manager.broadcast_event('market_status', {
                "symbol": symbol,
                "regime": market_mode,
                "volatility": volatility_state,
                "active_strategy": strategy_info.get("name", "Unknown")
            })

            # 6. Check for Scalper Exits
            rsi_hybrid = p.indicator_layer.get_multi_rsi_confirmation()
            await self.monitor_positions_for_sl_tp(
                float(bid), 
                symbol, 
                momentum_up=rsi_hybrid.get("momentum_up"),
                momentum_down=rsi_hybrid.get("momentum_down"),
                slope_value=rsi_hybrid.get("slope_value", 0.0), # Added slope
                volatility_state=volatility_state
            )
                
        except Exception as e:
            logger.error(f"Error in handle_tick: {e}")
            import traceback
            logger.error(traceback.format_exc())

    async def execute_order(self, symbol, action, stake, sl, tp, confidence, market_mode):
        """Unified order execution with C++ safety check."""
        try:
            # Get processor for strategy info
            p = self.processors.get(symbol)
            strategy_info = p.strategy_manager.get_active_strategy_info() if p else {"name": "V10_V75_Scalper"}
            
            # 1. C++ Engine Validation
            trade_params = {
                "symbol": symbol,
                "action": action,
                "stake": stake,
                "active_trades": len(self.open_positions)
            }
            
            execution_result_json = EngineWrapper.execute_trade(json.dumps(trade_params))
            result = json.loads(execution_result_json)
            
            if result.get("status") != "approved":
                reason = result.get('reason', 'C++ Engine Blocked')
                logger.warning(f"C++ Engine Blocked {symbol} {action}: {reason}")
                
                # Broadcast for UI transparency
                await stream_manager.broadcast_skipped_signal({
                    "tick_count": p.tick_count if p else 0,
                    "reason": f"Safety Layer: {reason}",
                    "symbol": symbol,
                    "atr": p.engine.get_atr("1m") if p else 0,
                    "confidence": confidence,
                    "regime": market_mode,
                    "volatility": "N/A",
                    "timestamp": datetime.now().isoformat()
                })
                return

            # 2. metadata for tracking & isolation
            metadata = {
                "strategy": strategy_info.get("name", "V10_V75_Scalper"),
                "regime": market_mode,
                "confidence": confidence,
                "stop_loss": sl,
                "take_profit": tp,
                "scalper_exit": ScalperExitModule(),
                "scalper_tpsl": ScalperTPSL()
            }
            
            # 3. Placement
            contract_type = "CALL" if action == "BUY" else "PUT"
            buy_resp = await self.execute_buy(
                symbol=symbol,
                contract_type=contract_type,
                amount=stake,
                metadata=metadata
            )
            
            # Record cooldown after successful execution
            self.cooldown_manager.record_trade()
            
            # Activate Scalper Monitors for this specific trade
            if buy_resp and 'buy' in buy_resp and symbol in self.processors:
                p = self.processors[symbol]
                volatility_state = p.engine.get_volatility("1m")
                entry_price = float(buy_resp.get('buy', {}).get('buy_price', 0))
                
                # Retrieve from metadata we just passed
                s_exit = metadata.get("scalper_exit")
                s_tpsl = metadata.get("scalper_tpsl")
                
                if s_exit:
                    s_exit.activate(
                        trade_direction="BUY" if contract_type in ["CALL", "MULTUP"] else "SELL",
                        initial_volatility_state=volatility_state
                    )
                if s_tpsl:
                    s_tpsl.get_scalper_tp_sl(
                        candles=list(p.engine.candles_1m),
                        symbol=symbol,
                        direction="BUY" if contract_type in ["CALL", "MULTUP"] else "SELL",
                        entry_price=entry_price
                    )
        except Exception as e:
            logger.error(f"Error in execute_order for {symbol}: {e}")

    async def execute_buy(self, symbol: str, contract_type: str, amount: float, duration: int = 5, duration_unit: str = 't', metadata: dict = None):
        """
        Executes a real trade on Deriv with FIFO validation.
        """
        logger.info(f"Initiating Trade: {contract_type} on {symbol} for {amount} ({duration}{duration_unit}). Metadata: {metadata}")
        
        async with self.trade_lock:
            try:
                # Map symbols to API format
                api_symbol = symbol
                if symbol == "BOOM300": api_symbol = "BOOM300N"
                elif symbol == "CRASH300": api_symbol = "CRASH300N"
                
                # 1. FIFO Refresh (Get available contracts with 5-minute cache)
                now = time.time()
                contracts = []
                
                if api_symbol in self.contracts_cache and (now - self.contracts_cache[api_symbol]['timestamp']) < 300:
                    contracts = self.contracts_cache[api_symbol]['data']
                    logger.info(f"Using cached contracts for {api_symbol}")
                else:
                    # Add a tiny jitter if multiple manual trades are spammed
                    if metadata and metadata.get("source") == "Manual":
                        await asyncio.sleep(0.1) # 100ms debounce
                        
                    contracts_req = {"contracts_for": api_symbol}
                    contracts_resp = await self.send_request(contracts_req)
                    
                    if 'error' in contracts_resp:
                        from app.services.audit_logger import audit_logger
                        audit_logger.log_error("FIFO_REFRESH_FAILED", contracts_resp['error'])
                        logger.error(f"FIFO Refresh Failed: {contracts_resp['error']}")
                        return {"status": "error", "message": "FIFO Refresh Failed"}
                        
                    contracts = contracts_resp.get('contracts_for', {}).get('available', [])
                    self.contracts_cache[api_symbol] = {"data": contracts, "timestamp": time.time()}
                
                # DEBUG: Log available contract types for this symbol
                logger.info(f"Available Contracts for {symbol} (API: {api_symbol}): {[c['contract_type'] for c in contracts[:5]]}")
                
                # --- AUTO-SWITCH FOR BOOM/CRASH (Multipliers Only) ---
                effective_contract_type = contract_type
                effective_duration = duration
                effective_duration_unit = duration_unit
                multiplier = None
                
                is_boom_crash = "BOOM" in api_symbol or "CRASH" in api_symbol
                
                if is_boom_crash:
                    if contract_type == "CALL":
                        effective_contract_type = "MULTUP"
                    elif contract_type == "PUT":
                        effective_contract_type = "MULTDOWN"
                    
                    valid_multipliers = [c.get('multiplier') for c in contracts if c['contract_type'] == effective_contract_type]
                    if valid_multipliers:
                         multiplier = 20 
                    
                    logger.info(f"Auto-Switched Contract for {symbol}: {contract_type} -> {effective_contract_type} (Mult: {multiplier})")

                # 2. Validation & Clamping
                action_code = 1 if effective_contract_type in ["CALL", "MULTUP"] else 2
                mock_signal = {
                    "symbol": api_symbol,
                    "action": action_code,
                    "lots": amount,
                    "duration": effective_duration,
                    "duration_unit": effective_duration_unit,
                    "contract_type": effective_contract_type,
                    "multiplier": multiplier
                }
                validated_params = TradeManager.validate_and_clamp(mock_signal, contracts)
                
                if not validated_params:
                    logger.warning("Trade Rejected by FIFO Validation Guard")
                    return {"status": "error", "message": "FIFO Validation Rejected"}
                    
                # 3. Create Proposal with SL/TP
                sl_price = metadata.get('stop_loss') if metadata else None
                tp_price = metadata.get('take_profit') if metadata else None
                
                if sl_price or tp_price:
                    logger.info(f"Trade will include native Deriv SL/TP: SL={sl_price}, TP={tp_price}")
                
                proposal_req = TradeManager.create_proposal_payload(validated_params, sl_price, tp_price)
                proposal_resp = await self.send_request(proposal_req)
                
                if 'proposal' in proposal_resp:
                    from app.services.audit_logger import audit_logger
                    proposal_data = proposal_resp['proposal']
                    proposal_id = proposal_data['id']
                    
                    logger.info(f"Proposal Successful: ID={proposal_id}, Spot={proposal_data.get('spot')}, Payout={proposal_data.get('payout')}")
                    
                    # 4. Execution (Buy)
                    buy_req = {"buy": proposal_id, "price": 10000} 
                    logger.info(f"Sending FINAL Buy Request: {buy_req}")
                    buy_resp = await self.send_request(buy_req)
                    
                    logger.info(f"RAW BUY RESPONSE from Deriv: {buy_resp}")
                    
                    # Broadcast trade execution
                    await stream_manager.broadcast_event('trade_execution', {
                        "symbol": symbol,
                        "contract_type": effective_contract_type,
                        "buy_price": float(buy_resp.get('buy', {}).get('buy_price', 0)),
                        "timestamp": datetime.now().isoformat(),
                        "id": buy_resp.get('buy', {}).get('contract_id')
                    })
                    
                    # Log to Audit
                    audit_logger.log_trade(
                        signal=metadata.get('signal', mock_signal) if metadata else mock_signal,
                        validation=validated_params['validation_metadata'],
                        response=buy_resp
                    )
                    
                    if 'error' in buy_resp:
                        err_msg = buy_resp['error'].get('message', 'Trade Execution Failed')
                        await stream_manager.broadcast_notification(
                            "Trade Failed",
                            f"Failed to place trade on {symbol}: {err_msg}",
                            "error"
                        )
                        return {"status": "error", "message": err_msg}
                    
                    await stream_manager.broadcast_notification(
                        "Trade Executed",
                        f"Placed {contract_type} on {symbol} (Stake: {validated_params['amount']})",
                        "success"
                    )
                    
                    await stream_manager.broadcast_log({
                        "id": str(uuid.uuid4()),
                        "timestamp": datetime.now().isoformat(),
                        "message": f"Successfully placed {contract_type} on {symbol} (Stake: {validated_params['amount']})",
                        "level": "success",
                        "source": "Execution"
                    })
                    
                    # Record for tracking
                    if metadata:
                        cid = str(buy_resp['buy']['contract_id'])
                        self.contract_metadata[cid] = {
                            "contract_id": cid,
                            "symbol": symbol,
                            "action": "BUY" if action_code == 1 else "SELL",
                            "entry_price": None,
                            "stop_loss": metadata.get('stop_loss'),
                            "take_profit": metadata.get('take_profit'),
                            "strategy": metadata.get('strategy'),
                            "scalper_exit": metadata.get('scalper_exit'),
                            "scalper_tpsl": metadata.get('scalper_tpsl')
                        }
                    
                    # OPTIMISTIC UI UPDATE
                    new_pos_id = str(buy_resp['buy']['contract_id'])
                    entry_price = float(buy_resp['buy']['buy_price'])
                    current_price = entry_price
                    
                    optimistic_pos = {
                        "id": new_pos_id,
                        "symbol": symbol,
                        "side": 'buy' if any(kw in contract_type for kw in ['CALL', 'MULTUP', 'ACCU', 'BUY']) else 'sell',
                        "lots": float(amount),
                        "entryPrice": entry_price,
                        "currentPrice": current_price,
                        "pnl": 0.0,
                        "openTime": datetime.now().isoformat()
                    }
                    
                    if not any(p['id'] == new_pos_id for p in self.open_positions):
                        self.open_positions.append(optimistic_pos)
                        await stream_manager.broadcast_event('positions', self.open_positions)
                        logger.info("Optimistic UI Update executed for new position.")

                    return {"status": "success", "data": buy_resp['buy']}
                else:
                    from app.services.audit_logger import audit_logger
                    audit_logger.log_error("PROPOSAL_FAILED", proposal_resp.get('error'))
                    logger.error(f"Proposal Failed: {proposal_resp}")
                    return {"status": "error", "message": proposal_resp.get('error', {}).get('message', 'Proposal Failed')}
                    
            except Exception as e:
                logger.error(f"Execution Error: {e}")
                import traceback
                logger.error(traceback.format_exc())
                return {"status": "error", "message": str(e)}

    async def monitor_positions_for_sl_tp(self, current_price: float, symbol: str, 
                                          momentum_up: bool = None, momentum_down: bool = None, 
                                          slope_value: float = 0.0, volatility_state: str = None):
        """
        Monitor open positions and close them if local SL/TP thresholds are hit.
        This also handles Scalper Exits and Breakeven triggers.
        """
        closed_contracts = []
        
        # Get Processor for scalper status
        p = self.processors.get(symbol)
        
        for contract_id, meta in list(self.contract_metadata.items()):
            if meta.get('symbol') != symbol:
                continue
                
            entry_price = float(meta.get('entry_price')) if meta.get('entry_price') is not None else None
            sl_price = float(meta.get('stop_loss')) if meta.get('stop_loss') is not None else None
            tp_price = float(meta.get('take_profit')) if meta.get('take_profit') is not None else None
            action = meta.get('action', 'BUY')
            
            if entry_price is None:
                continue
            
            logger.info(f"Checking SL/TP for {symbol} trade {contract_id}: Price={current_price}, SL={sl_price}, TP={tp_price}, Entry={entry_price}, Action={action}")
            
            should_close = False
            close_reason = ""
            
            # For BUY trades (CALL options)
            if action == "BUY":
                if sl_price is not None and current_price <= sl_price:
                    should_close = True
                    close_reason = f"Stop Loss Hit (Price: {current_price} <= SL: {sl_price})"
                elif tp_price is not None and current_price >= tp_price:
                    should_close = True
                    close_reason = f"Take Profit Hit (Price: {current_price} >= TP: {tp_price})"
            
            # For SELL trades (PUT options)
            else:
                if sl_price and current_price >= sl_price:
                    should_close = True
                    close_reason = f"Stop Loss Hit (Price: {current_price} >= SL: {sl_price})"
                elif tp_price and current_price <= tp_price:
                    should_close = True
                    close_reason = f"Take Profit Hit (Price: {current_price} <= TP: {tp_price})"
            
            if should_close:
                logger.info(f"[LOCAL SL/TP] {close_reason} for Contract {contract_id}")
        
            # --- SCALPER EXTRA EXITS ---
            if not should_close and p:
                # 1. Check for Scalper Exit (RSI Flip, Micro Reversal, etc.)
                candles = list(p.engine.candles_1m)
                current_candle = candles[-1] if candles else None
                
                # Use ISOLATED monitors from metadata
                trade_scalper_exit = meta.get('scalper_exit')
                trade_scalper_tpsl = meta.get('scalper_tpsl')
                
                if trade_scalper_exit:
                    exit_decision = trade_scalper_exit.get_scalper_exit_decision(
                        momentum_up=momentum_up,
                        momentum_down=momentum_down,
                        slope_value=slope_value,
                        candle=current_candle,
                        volatility_state=volatility_state
                    )
                    
                    if exit_decision["exit_now"]:
                        should_close = True
                        close_reason = f"Scalper Exit Triggered: {', '.join(exit_decision['triggers'])}"
                        logger.info(f"[SCALPER EXIT] {close_reason}")
                
                # 2. Check for Breakeven Move
                if not should_close and trade_scalper_tpsl:
                    be_check = trade_scalper_tpsl.check_breakeven(current_price)
                    if be_check["should_move_sl"]:
                        meta['stop_loss'] = be_check["new_sl_price"]
                        logger.info(f"[SCALPER BREAKEVEN] Moved SL to {meta['stop_loss']} for {symbol} (Contract: {contract_id})")
            
            if should_close:
                # Close the position via Deriv API
                try:
                    close_req = {"sell": int(contract_id), "price": 0}
                    close_resp = await self.send_request(close_req)
                    
                    if 'error' in close_resp:
                        logger.error(f"Failed to close contract {contract_id}: {close_resp['error']}")
                    else:
                        logger.info(f"Successfully closed contract {contract_id}")
                        # Isolated monitors handled by metadata cleanup below
                        
                        await stream_manager.broadcast_notification(
                            "Position Closed",
                            close_reason,
                            "info"
                        )
                        await stream_manager.broadcast_log({
                            "id": str(uuid.uuid4()),
                            "timestamp": datetime.now().isoformat(),
                            "message": f"Closed {action} position on {symbol}: {close_reason}",
                            "level": "info",
                            "source": "SL/TP Monitor"
                        })
                        closed_contracts.append(contract_id)
                except Exception as e:
                    logger.error(f"Error closing contract {contract_id}: {e}")
        
        # Remove closed contracts from metadata
        for cid in closed_contracts:
            if cid in self.contract_metadata:
                del self.contract_metadata[cid]


    async def handle_balance(self, balance_data):
        balance = float(balance_data.get('balance', 0))
        currency = balance_data.get('currency', 'USD')
        
        # Update internal state
        self.current_account['balance'] = balance
        self.current_account['currency'] = currency
        
        # Update list
        for acc in self.available_accounts:
            if acc['id'] == self.current_account.get('id'):
                acc['balance'] = balance
                acc['equity'] = balance
        
        # Broadcast
        await stream_manager.broadcast_event('balance', {
            "balance": balance,
            "equity": balance,
            "currency": currency,
            "account_id": self.current_account.get('id')
        })
        logger.info(f"Balance Update: {balance} {currency}")
        
        # Sync Engine
        try:
            EngineWrapper.update_account(balance, balance, balance)
        except Exception:
            pass

    async def handle_portfolio(self, portfolio):
        """Handles initial list and updates of open positions."""
        raw_contracts = portfolio.get('contracts', [])
        new_positions = []
        
        for c in raw_contracts:
            contract_type = c.get('contract_type', '').upper()
            
            # Robust price mapping for initial portfolio state
            entry_price = float(c.get('entry_tick') or c.get('entry_spot') or c.get('buy_price') or 0)
            current_price = float(c.get('bid_price') or c.get('current_spot') or 0)
            
            pos = {
                "id": str(c.get('contract_id')),
                "symbol": c.get('symbol'),
                "side": 'buy' if any(kw in contract_type for kw in ['CALL', 'MULTUP', 'ACCU', 'BUY']) else 'sell',
                "lots": float(c.get('buy_price', 0)),
                "entryPrice": entry_price,
                "currentPrice": current_price,
                "pnl": float(c.get('profit', 0)),
                "openTime": datetime.fromtimestamp(c.get('purchase_time', 0)).isoformat()
            }
            new_positions.append(pos)
            
        self.open_positions = new_positions
        await stream_manager.broadcast_event('positions', self.open_positions)
        logger.info(f"Portfolio Sync: {len(self.open_positions)} positions found")

    async def handle_position_update(self, contract):
        """Handles real-time updates for a specific open contract."""
        cid = str(contract.get('contract_id'))
        is_sold = contract.get('is_sold')
        is_expired = contract.get('is_expired')
        status = contract.get('status', '')
        
        # Remove position if sold, expired, or has a terminal status (won/lost)
        is_settled = is_sold or is_expired or status in ['won', 'lost']
        
        if is_settled:
            # Remove from active positions
            original_count = len(self.open_positions)
            self.open_positions = [p for p in self.open_positions if p['id'] != cid]
            # Cleanup metadata
            self.contract_metadata.pop(cid, None)
            
            # Immediately broadcast removal if anything changed
            if len(self.open_positions) < original_count:
                await stream_manager.broadcast_event('positions', self.open_positions)
                logger.info(f"Position {cid} removed from active list (status: {status}, is_sold: {is_sold}, is_expired: {is_expired})")
        else:
            # Update or Add position
            contract_type = contract.get('contract_type', '').upper()
            # Correct price mapping: Prioritize entry_tick/spot over current_spot.
            # Do NOT use buy_price as it represents the STAKE.
            entry_price = float(contract.get('entry_tick') or contract.get('entry_spot') or contract.get('current_spot') or 0)
            current_price = float(contract.get('current_spot') or contract.get('bid_price') or 0)
            
            pos = {
                "id": cid,
                "symbol": contract.get('underlying'),
                "side": 'buy' if any(kw in contract_type for kw in ['CALL', 'MULTUP', 'ACCU', 'BUY']) else 'sell',
                "lots": float(contract.get('buy_price', 0)),
                "entryPrice": entry_price,
                "currentPrice": current_price,
                "pnl": float(contract.get('profit', 0)),
                "openTime": datetime.fromtimestamp(contract.get('purchase_time', 0)).isoformat()
            }
            
            # Trailing & Exit Enforcement (Wrapped for robustness)
            try:
                metadata = self.contract_metadata.get(cid)
                if metadata:
                    current_sl = metadata.get('stop_loss')
                    current_tp = metadata.get('take_profit')
                    direction = metadata.get('action') # "BUY" or "SELL"
                    
                    if current_sl is not None and direction:
                        # Get processor for symbol
                        sym = contract.get('underlying')
                        p = self.processors.get(sym)
                        
                        if p and hasattr(p, 'dynamic_tp'):
                            # Check Trailing Update
                            new_sl = p.dynamic_tp.check_trailing_update(
                                current_price, entry_price, current_sl, direction
                            )
                        else:
                            new_sl = None
                        if new_sl:
                            logger.info(f"Trailing SL Update for {cid}: {current_sl} -> {new_sl}")
                            metadata['stop_loss'] = new_sl
                            
                        # Local Enforcement (Automatic Exit)
                        should_exit = False
                        exit_reason = ""
                        
                        if direction == "BUY":
                            if current_price <= current_sl:
                                should_exit = True
                                exit_reason = "Stop Loss Hit (Local)"
                            elif current_tp and current_price >= current_tp:
                                should_exit = True
                                exit_reason = "Take Profit Hit (Local)"
                        else: # SELL
                            if current_price >= current_sl:
                                should_exit = True
                                exit_reason = "Stop Loss Hit (Local)"
                            elif current_tp and current_price <= current_tp:
                                should_exit = True
                                exit_reason = "Take Profit Hit (Local)"
                                
                        if should_exit:
                            logger.warning(f"Triggering Local Exit for {cid}: {exit_reason}")
                            asyncio.create_task(self.sell_contract(cid, exit_reason))
            except Exception as e:
                logger.error(f"Error in Exit Guard for {cid}: {e}")
            
            found = False
            for i, p in enumerate(self.open_positions):
                if p['id'] == cid:
                    self.open_positions[i] = pos
                    found = True
                    break
            if not found:
                self.open_positions.append(pos)
        
        # Session Stats & Final Processing for Settled Contracts
        if is_settled and cid not in self.processed_contracts:
            self.processed_contracts.add(cid)
            
            # Limit set size to prevent memory growth (keep last 1000)
            if len(self.processed_contracts) > 1000:
                # Remove oldest half
                to_remove = list(self.processed_contracts)[:500]
                for old_cid in to_remove:
                    self.processed_contracts.discard(old_cid)
            
            # Track P&L for session
            profit = float(contract.get('profit', 0))
            self.session_stats["pnl"] += profit
            self.session_stats["trades"] += 1
            if profit > 0:
                self.session_stats["wins"] += 1
            else:
                self.session_stats["losses"] += 1
                
            # Log completion
            from app.services.audit_logger import audit_logger
            audit_logger.logger.info(f"Trade Closed: {cid} | P&L: {profit}")
            
            await stream_manager.broadcast_log({
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "message": f"Trade Closed: {contract.get('underlying')} | P/L: ${profit:.2f}",
                "level": "success" if profit >= 0 else "error",
                "source": "Execution"
            })
                
        await stream_manager.broadcast_event('positions', self.open_positions)

    async def sell_contract(self, contract_id: str, reason: str = "Manual Exit"):
        """
        Closes an open contract at market price.
        Returns: (bool, Optional[str]) -> (Success, ErrorMessage)
        """
        if not self.ws or not self.is_connected: 
            return False, "Not connected to Deriv"
        
        logger.info(f"Closing Contract {contract_id}. Reason: {reason}")
        req = {
            "sell": int(contract_id) if str(contract_id).isdigit() else contract_id,
            "price": 0 # 0 means market price
        }
        
        resp = await self.send_request(req)
        if 'error' in resp:
            err_msg = resp['error'].get('message', 'Unknown Error')
            logger.error(f"Failed to close contract {contract_id}: {resp['error']}")
            await stream_manager.broadcast_log({
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "message": f"Exit Failed for {contract_id}: {err_msg}",
                "level": "error",
                "source": "Execution"
            })
            return False, err_msg
            
        logger.info(f"Contract {contract_id} closed successfully ({reason}).")
        return True, None

    async def get_profit_table(self, limit: int = 50, offset: int = 0):
        """Fetches the profit table (closed trades history) from Deriv."""
        if not self.ws or not self.is_connected:
            return []
        
        req = {
            "profit_table": 1,
            "description": 1,
            "limit": limit,
            "offset": offset,
            "sort": "DESC"
        }
        resp = await self.send_request(req)
        return resp.get('profit_table', {}).get('transactions', [])

    async def get_statement(self, limit: int = 50, offset: int = 0):
        """Fetches the account statement (balance changes) from Deriv."""
        if not self.ws or not self.is_connected:
            return []
        
        req = {
            "statement": 1,
            "description": 1,
            "limit": limit,
            "offset": offset
        }
        resp = await self.send_request(req)
        return resp.get('statement', {}).get('transactions', [])

    async def get_latest_ml_prediction(self, symbol: str):
        """Returns the latest ML prediction and analysis for a given symbol."""
        p = self.processors.get(symbol)
        if not p:
            return None
        
        # Get latest tick
        candles = list(p.engine.candles_1m)
        last_candle = candles[-1] if candles else None
        
        # We can re-run analysis or just use cached values if we had them.
        # For now, let's derive it from the engine state.
        volatility = p.engine.get_volatility("1m")
        regime = p.engine.detect_market_mode(candles)
        
        # Calculate scores (this is a simplified logic)
        # In a real scenario, the strategy or a dedicated ML model would provide these.
        indicator_data = p.indicator_layer.analyze(last_candle, engine=p.engine) if last_candle else {}
        
        # Mock probabilities for now based on indicators if no signal
        buy_prob = 0.5
        sell_prob = 0.5
        
        if indicator_data.get('rsi'):
            rsi = indicator_data['rsi']
            # Base probability from 1m RSI
            buy_prob = max(0.2, min(0.8, (70 - rsi) / 40))
            sell_prob = max(0.2, min(0.8, (rsi - 30) / 40))
            
            # Enhance with Multi-Timeframe Confirmation
            rsi_hybrid = p.indicator_layer.get_multi_rsi_confirmation()
            if rsi_hybrid.get("allow_buy"):
                buy_prob = max(buy_prob, 0.75 + (rsi_hybrid.get("confidence_modifier", 0)))
                sell_prob = min(sell_prob, 0.25)
            elif rsi_hybrid.get("allow_sell"):
                sell_prob = max(sell_prob, 0.75 + (rsi_hybrid.get("confidence_modifier", 0)))
                buy_prob = min(buy_prob, 0.25)
            
            # Adjust by absolute direction
            if rsi_hybrid.get("flow_1m") == "bullish": buy_prob += 0.05
            if rsi_hybrid.get("flow_1m") == "bearish": sell_prob += 0.05
        else:
            buy_prob = 0.5
            sell_prob = 0.5

        return {
            "symbol": symbol,
            "buyProbability": round(buy_prob, 2),
            "sellProbability": round(sell_prob, 2),
            "confidence": round(max(buy_prob, sell_prob), 2),
            "regime": regime,
            "volatility": volatility,
            "lastUpdated": datetime.now().isoformat()
        }

    async def disconnect(self):
        self.is_connected = False
        if self.listen_task:
            self.listen_task.cancel()
            self.listen_task = None
        if self.ws:
            await self.ws.close()
            self.ws = None
        
        # Ensure Bot Stops on Disconnect
        try:
            EngineWrapper.set_bot_state(False)
        except:
            pass

    async def switch_symbol(self, new_symbol: str):
        """Dynamic symbol switching - adds to enabled list and primes history."""
        # Normalize symbol
        api_symbol = new_symbol
        if new_symbol in ["BOOM300", "BOOM_300"]: api_symbol = "BOOM300N"
        elif new_symbol in ["CRASH300", "CRASH_300", "CRASH300S"]: api_symbol = "CRASH300N"
        elif new_symbol.startswith("R") and "_" not in new_symbol:
            api_symbol = "R_" + new_symbol[1:]
            
        logger.info(f"Targeting new symbol: {api_symbol}")
        
        # Add to enabled if not there
        if api_symbol not in self.enabled_symbols:
            self.enabled_symbols.append(api_symbol)
            # Re-subscribe to all (to include new one)
            await self.subscribe_ticks()
            # Prime history
            await self.warm_up_history()
            
        # Reset engine for clean start on this symbol
        if api_symbol in self.processors:
            self.processors[api_symbol].engine.reset()
            
        # Broadcast log
        await stream_manager.broadcast_log({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "message": f"Trading symbol switched/added: {api_symbol}",
            "level": "info",
            "source": "System"
        })
        
        # self.target_symbol = api_symbol # Retired in multi-symbol refactor
        
        # Subscriptions
        if new_symbol not in self.active_symbols:
            self.active_symbols.append(new_symbol)
            await self.subscribe_ticks()

        # Reset engine and stats for clean start
        if api_symbol in self.processors:
            self.processors[api_symbol].engine.reset()
        self.tick_count = 0

# Global Singleton Instance
deriv_client = DerivConnector()
