import asyncio
import json
import websockets
import logging
import uuid
from typing import Callable, Optional, Dict, Any, List
from datetime import datetime
from app.core.engine_wrapper import EngineWrapper
from app.services.trade_manager import TradeManager
from app.services.stream_manager import stream_manager

# Deriv API Endpoint
DERIV_WS_BASE_URL = "wss://ws.derivws.com/websockets/v3"

logger = logging.getLogger("deriv_connector")

import os
from dotenv import load_dotenv

load_dotenv()

class DerivConnector:
    def __init__(self, token: str = None, app_id: str = "118420"):
        self.token = token or os.getenv("DERIV_TOKEN")
        self.app_id = app_id or os.getenv("DERIV_APP_ID", "118420")
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
        self.target_symbol = "R_10" # Defaulting to R_10 per user request
        self.processed_contracts = set()
        
        # Session Stats
        self.session_stats = {
            "pnl": 0.0,
            "trades": 0,
            "wins": 0,
            "losses": 0
        }

        # --- ZONE UPGRADES INITIALIZATION ---
        from app.intelligence import RegimeDetector, VolatilityFilter
        from app.signals import MarketStructure, IndicatorLayer, EntryValidator
        from app.exits import SmartStopLoss, DynamicTakeProfit
        from app.risk import WeightedLotCalculator, RiskGuard, CooldownManager
        from app.strategies import strategy_manager
        
        # Intelligence
        self.regime_detector = RegimeDetector()
        # More permissive volatility settings for increased trade frequency
        self.volatility_filter = VolatilityFilter(
            min_atr_threshold=0.0,     # Allow zero ATR for startup period
            max_atr_threshold=0.02,     # Higher maximum ATR
            min_candle_body_pips=0.0,  # Allow zero candle body for synthetic indices
            atr_spike_multiplier=10.0   # Much higher spike tolerance
        )
        
        # Signals
        self.market_structure = MarketStructure()
        self.indicator_layer = IndicatorLayer()
        self.entry_validator = EntryValidator()
        
        # Exits
        self.smart_sl = SmartStopLoss()
        self.dynamic_tp = DynamicTakeProfit()
        
        # Risk
        self.lot_calculator = WeightedLotCalculator()
        self.risk_guard = RiskGuard()
        # Reduced cooldown for increased trade frequency (30 seconds instead of 60)
        self.cooldown_manager = CooldownManager(default_cooldown_seconds=30)
        
        # Strategy
        self.strategy_manager = strategy_manager
        
        # Local Contract Memory (SL/TP Tracking)
        self.contract_metadata: Dict[str, Dict] = {}
        
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
        
        # Apply initial config
        self.apply_config_updates(self.default_config)

    def apply_config_updates(self, config: Dict[str, Any]):
        """Apply dynamic configuration updates to sub-services."""
        # Update Volatility Filter
        if hasattr(self.volatility_filter, 'update_params'):
            self.volatility_filter.update_params(
                min_atr = config.get("min_atr"),
                max_atr = config.get("max_atr"),
                min_pips = config.get("min_pips"),
                spike_multiplier = config.get("atr_spike_multiplier")
            )
            
        # Update Risk Guard
        if hasattr(self.risk_guard, 'update_params'):
            self.risk_guard.update_params(
                max_daily_loss_percent = config.get("max_daily_loss"),
                max_sl_hits = config.get("max_sl_hits"),
                max_active_trades = config.get("max_open_trades")
            )
            
        # Update Indicator Layer (RSI levels)
        if hasattr(self.indicator_layer, 'update_params'):
            self.indicator_layer.update_params(
                rsi_oversold = config.get("rsi_oversold"),
                rsi_overbought = config.get("rsi_overbought")
            )
            
        logger.info("Dynamic configuration applied to sub-services.")

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
                    self.available_accounts.append({
                        "id": acc_id,
                        "name": f"Deriv {acc.get('currency')} {'Demo' if acc.get('is_virtual') else 'Real'}",
                        "type": "demo" if acc.get("is_virtual") else "real",
                        "currency": acc.get("currency"),
                        "balance": 0.0,
                        "equity": 0.0,
                        "isActive": acc_id == self.active_account_id
                    })
                
                # Map balance for active
                for acc in self.available_accounts:
                    if acc["id"] == self.active_account_id:
                        acc["balance"] = self.current_account["balance"]
                        acc["equity"] = self.current_account["balance"]
                
                if not self.token:
                    self.token = target_token
                    
                return
        
        print(">>> ALL AUTH ATTEMPTS FAILED")


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
        
        # Broadcast ALL ticks for live feed (before symbol filtering)
        await stream_manager.broadcast_tick(tick_data)
        
        # Only process ticks for target symbol
        if symbol != self.target_symbol:
            return

        self.tick_count += 1

        if self.tick_count % 10 == 0:
            logger.info(f"[PROCESS] Tick {self.tick_count} for {symbol} @ {bid} | Vol: {self.regime_detector.current_regime.get('volatility')} | Regime: {self.regime_detector.current_regime.get('regime')}")
        
        skip_reason = None
        current_regime = 'unknown'
        current_volatility = 'unknown'
        atr_val = 0.0
        final_confidence = 0.0
        
        try:
            # --- PHASE 1: MARKET INTELLIGENCE ---
            # 1. Update Market Data Once
            tick_for_algo = {'quote': float(bid), 'epoch': epoch}
            regime_data = self.regime_detector.update(tick_for_algo)
            
            current_regime = regime_data.get('regime', 'unknown')
            current_volatility = regime_data.get('volatility', 'unknown')
            atr_val = regime_data.get('atr', 0.0)
            
            # --- BROADCAST MARKET STATUS (Throttled) ---
            if self.tick_count % 5 == 0:
                strategy_info = self.strategy_manager.get_active_strategy_info()
                await stream_manager.broadcast_event('market_status', {
                    "regime": current_regime,
                    "volatility": current_volatility,
                    "active_strategy": strategy_info.get("name", "None"),
                    "symbol": symbol
                })

            # 2. Filter Volatility (DISABLED)
            is_vol_valid, block_reason = self.volatility_filter.is_valid(tick_for_algo, atr_val)
            
            if not is_vol_valid:
                skip_reason = f"Volatility Filter Blocked: {block_reason}"
                # pass # Bypass

            # 3. Analyze Market Structure & Indicators
            structure_data = self.market_structure.analyze(tick_for_algo)
            indicator_data = self.indicator_layer.analyze(tick_for_algo)
            
            # 4. Run Active Strategy
            strategy_signal = self.strategy_manager.run_strategy(
                symbol, tick_for_algo, regime_data, structure_data, indicator_data
            )
            

            
            # Detailed Signal Logic (For Visibility)
            is_safe = False
            action = None
            
            if strategy_signal:
                strategy_action = strategy_signal['action']  # Strategy determines direction
                strategy_confidence = strategy_signal.get('confidence', 0.5)
                s_score = structure_data.get('score', 50)
                i_score = indicator_data.get('score', 50)
                
                # Validate entry with structure and indicators (validator checks quality, not direction)
                entry_signal = self.entry_validator.validate(
                    structure_data, indicator_data, is_vol_valid
                )
                
                if not entry_signal:
                    skip_reason = f"EntryValidator Rejected: Structure={s_score}, Indicators={i_score} (Needs more alignment/strength)"
                    action = None
                else:
                    validator_action = entry_signal['action']
                    validator_confidence = entry_signal['confidence']
                    
                    # Use strategy's confidence (it knows the market better), but validate direction alignment
                    # For direction-specific strategies (Boom300=SELL, Crash300=BUY), strategy takes precedence
                    # For general strategies (V10), require alignment
                    
                    # Check if directions align (unless strategy is direction-specific)
                    strategy_config = self.strategy_manager.current_strategy.config if self.strategy_manager.current_strategy else {}
                    is_direction_specific = strategy_config.get('direction') in ['SELL_ONLY', 'BUY_ONLY']
                    
                    if is_direction_specific:
                        # For direction-specific strategies, use strategy action and confidence
                        action = strategy_action
                        final_confidence = strategy_confidence
                    else:
                        if strategy_action != validator_action:
                            skip_reason = f"Signal Conflict: Strategy={strategy_action} vs Validator={validator_action}"
                            action = None
                        else:
                            action = strategy_action
                        final_confidence = strategy_confidence # Use raw strategy confidence (e.g. 50 from test mode)
                    
                    logger.info(f"DEBUG TRACE 1: Action={action}, Conf={final_confidence}, StrategyConf={strategy_confidence}")
                    if action:
                        # Reasonable confidence thresholds for production
                        if current_volatility == "extreme":
                            threshold = 0.4  # Moderate threshold for extreme volatility
                        elif current_volatility == "high":
                            threshold = 0.3  # Lower threshold for high volatility
                        else:
                            threshold = 0.2  # Even lower for normal conditions
                            
                        if final_confidence < threshold:
                            skip_reason = f"Low Confidence: {final_confidence:.2f} < {threshold} (Scores: S={s_score}, I={i_score})"
                            action = None
                        else:
                            # --- PHASE 3: RISK MANAGEMENT ---
                            # 6. Check Risk Guards (Daily Loss, etc.)
                            start_bal = getattr(self, 'start_balance', self.current_account.get('balance', 1000.0))
                            is_safe, guard_msg = self.risk_guard.check_trade_allowed(
                                self.current_account.get('balance', 0.0),
                                start_bal,
                                len(self.open_positions),
                                current_volatility,
                                self.is_authorized
                            )
                            
                            if not is_safe:
                                skip_reason = f"Risk Guard Blocked: {guard_msg}"
                                action = None
                            else:
                                # 7. Check Cooldown
                                if not self.cooldown_manager.can_trade():
                                    skip_reason = "Cooldown Manager: Interval Active"
                                    action = None
            else:
                if not skip_reason: skip_reason = "No Strategy Signal (RSI/Momentum not met)"

            # Enhanced logging for all skipped signals - more visibility
            if skip_reason:
                # Log every skip with detailed information
                logger.warning(f"[SIGNAL SKIPPED] Tick {self.tick_count}: {skip_reason}")
                logger.info(f"[SIGNAL DETAILS] Symbol: {symbol}, ATR: {atr_val:.6f}, Confidence: {final_confidence:.2f}, Regime: {current_regime}")
                
                # Broadcast skipped signal to frontend for visibility
                await stream_manager.broadcast_event('signal_skipped', {
                    "tick_count": self.tick_count,
                    "reason": skip_reason,
                    "symbol": symbol,
                    "atr": atr_val,
                    "confidence": final_confidence,
                    "regime": current_regime,
                    "volatility": current_volatility,
                    "timestamp": datetime.now().isoformat()
                })
                
                # Throttle return to avoid blocking, but log everything
                if self.tick_count % 5 == 0:
                    return
                else:
                    return


            # --- PHASE 4: EXECUTION SETUP ---
            # Guard: If no valid action (skipped signal), do not proceed
            if not action:
                 if not skip_reason:
                     skip_reason = "No Valid Action Determined"
                 # Skip execution for this tick
                 return

            # 8. Smart Exits
            momentum_factor = 1.0
            if action == "BUY":
                momentum_factor = max(0.5, indicator_data.get('score', 50) / 50.0)
            else: # SELL
                momentum_factor = max(0.5, (100 - indicator_data.get('score', 50)) / 50.0)
            
            sl_price = self.smart_sl.calculate_sl_price(float(bid), action, atr_val)
            tp_price = self.dynamic_tp.calculate_tp_price(float(bid), sl_price, action, momentum_factor=momentum_factor)
            
            # 9. Weighted Lot Sizing
            risk_pct = self.default_config.get('riskPercent', 0.5)
            risk_amount = self.lot_calculator.calculate_lot_size(
                self.current_account.get('balance', 0.0),
                risk_pct,
                final_confidence,
                current_regime,
                volatility=current_volatility,
                symbol=symbol
            )
            
            stake = max(0.35, risk_amount) # Min stake

            # --- PHASE 5: EXECUTION (C++ Engine Validation) ---
            trade_params = {
                "symbol": symbol,
                "action": action,
                "stake": stake,
                "active_trades": len(self.open_positions)
            }
            
            # Verify with C++ Engine (Safety Layer)
            execution_result_json = EngineWrapper.execute_trade(json.dumps(trade_params))
            result = json.loads(execution_result_json)
            
            logger.info(f"DEBUG: C++ Engine Says: {result}")
            if result.get("status") == "approved":
                # Execute Real Trade
                strategy_info = self.strategy_manager.get_active_strategy_info()
                metadata = {
                    "strategy": strategy_info.get("name", "Unknown"),
                    "regime": current_regime,
                    "confidence": final_confidence,
                    "stop_loss": sl_price,
                    "take_profit": tp_price
                }
                
                await self.execute_buy(
                    symbol=symbol,
                    contract_type="CALL" if action == "BUY" else "PUT",
                    amount=stake,
                    metadata=metadata
                )
                
                # Record cooldown
                self.cooldown_manager.record_trade()
            else:
                logger.warning(f"C++ Engine Rejected: {result.get('reason')}")
            
        except Exception as e:
            logger.error(f"Error in handle_tick: {e}")
            import traceback
            logger.error(traceback.format_exc())

    async def execute_buy(self, symbol: str, contract_type: str, amount: float, duration: int = 5, duration_unit: str = 't', metadata: dict = None):
        """
        Executes a real trade on Deriv with FIFO validation.
        """
        logger.info(f"Initiating Trade: {contract_type} on {symbol} for {amount} ({duration}{duration_unit}). Metadata: {metadata}")
        
        try:
            # Map symbols to API format
            api_symbol = symbol
            if symbol == "BOOM300": api_symbol = "BOOM300N"
            elif symbol == "CRASH300": api_symbol = "CRASH300N"
            
            # 1. FIFO Refresh (Get available contracts)
            contracts_req = {"contracts_for": api_symbol}
            contracts_resp = await self.send_request(contracts_req)
            
            if 'error' in contracts_resp:
                from app.services.audit_logger import audit_logger
                audit_logger.log_error("FIFO_REFRESH_FAILED", contracts_resp['error'])
                logger.error(f"FIFO Refresh Failed: {contracts_resp['error']}")
                return {"status": "error", "message": "FIFO Refresh Failed"}
                
            contracts = contracts_resp.get('contracts_for', {}).get('available', [])
            
            # DEBUG: Log available contract types for this symbol
            logger.info(f"Available Contracts for {symbol} (API: {api_symbol}): {[c['contract_type'] for c in contracts[:10]]}")
            
            # --- AUTO-SWITCH FOR BOOM/CRASH (Multipliers Only) ---
            # If standard CALL/PUT is requested but not available, switch to MULTUP/MULTDOWN
            effective_contract_type = contract_type
            effective_duration = duration
            effective_duration_unit = duration_unit
            multiplier = None
            
            is_boom_crash = "BOOM" in api_symbol or "CRASH" in api_symbol
            
            if is_boom_crash:
                # Boom/Crash often only supports Multipliers or Accumulators
                if contract_type == "CALL":
                    effective_contract_type = "MULTUP"
                elif contract_type == "PUT":
                    effective_contract_type = "MULTDOWN"
                
                # Multipliers don't use duration, they use 'multiplier' param
                # We need to find valid multipliers from contracts
                valid_multipliers = [c.get('multiplier') for c in contracts if c['contract_type'] == effective_contract_type]
                if valid_multipliers:
                     # Flatten list of lists if needed, or just pick first available options
                     # Usually distinct contracts return list of allowed multipliers
                     # We'll default to the lowest valid multiplier for safety (usually 10, 20, etc.)
                     # But contracts response structure for multipliers is complex.
                     # Simplified: Force multiplier=10 or 20
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
            # Extract SL/TP from metadata if available
            sl_price = metadata.get('stop_loss') if metadata else None
            tp_price = metadata.get('take_profit') if metadata else None
            
            # Log SL/TP values for verification
            if sl_price or tp_price:
                logger.info(f"Trade will include native Deriv SL/TP: SL={sl_price}, TP={tp_price}")
            
            proposal_req = TradeManager.create_proposal_payload(validated_params, sl_price, tp_price)
            proposal_resp = await self.send_request(proposal_req)
            
            if 'proposal' in proposal_resp:
                from app.services.audit_logger import audit_logger
                proposal_id = proposal_resp['proposal']['id']
                
                # 4. Execution (Buy)
                buy_req = {"buy": proposal_id, "price": 10000} 
                buy_resp = await self.send_request(buy_req)
                
                # Log to Audit
                audit_logger.log_trade(
                    signal=metadata.get('signal', mock_signal) if metadata else mock_signal,
                    validation=validated_params['validation_metadata'],
                    response=buy_resp
                )
                logger.info(f"Trade Execution Result: {buy_resp}")
                
                if 'error' in buy_resp:
                    return {"status": "error", "message": buy_resp['error'].get('message', 'Trade Execution Failed')}
                
                # Broadcast success log
                # We do NOT trigger immediate portfolio refresh here to avoid race condition 
                # where API returns old state and wipes our optimistic update.
                # We rely on periodic sync or proposal_open_contract streams.
                # await self.send_request({"portfolio": 1})
                
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
                        "entry_price": float(buy_resp['buy']['buy_price']),
                        "stop_loss": metadata.get('stop_loss'),
                        "take_profit": metadata.get('take_profit'),
                        "strategy": metadata.get('strategy')
                    }
                
                # OPTIMISTIC UI UPDATE: Add to local positions immediately
                new_pos_id = str(buy_resp['buy']['contract_id'])
                entry_price = float(buy_resp['buy']['buy_price'])
                current_price = entry_price # Initially same
                
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
                
                # Avoid duplicates
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
            return {"status": "error", "message": str(e)}

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
        
        if is_sold:
            # Remove from active positions
            self.open_positions = [p for p in self.open_positions if p['id'] != cid]
            # Cleanup metadata
            self.contract_metadata.pop(cid, None)
        else:
            # Update or Add position
            contract_type = contract.get('contract_type', '').upper()
            # Correct price mapping for different contract states
            entry_price = float(contract.get('entry_tick') or contract.get('entry_spot') or contract.get('buy_price') or 0)
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
                        # Check Trailing Update
                        new_sl = self.dynamic_tp.check_trailing_update(
                            current_price, entry_price, current_sl, direction
                        )
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
        
        if is_sold and cid not in self.processed_contracts:
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
        """Closes an open contract at market price."""
        if not self.ws or not self.is_connected: return
        
        logger.info(f"Closing Contract {contract_id}. Reason: {reason}")
        req = {
            "sell": int(contract_id) if str(contract_id).isdigit() else contract_id,
            "price": 0 # 0 means market price
        }
        
        resp = await self.send_request(req)
        if 'error' in resp:
            logger.error(f"Failed to close contract {contract_id}: {resp['error']}")
            await stream_manager.broadcast_log({
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "message": f"Exit Failed for {contract_id}: {resp['error'].get('message', 'Unknown Error')}",
                "level": "error",
                "source": "Execution"
            })
            return False
            
        logger.info(f"Contract {contract_id} closed successfully ({reason}).")
        return True

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
        if new_symbol == self.target_symbol:
            return
            
        logger.info(f"Switching target symbol from {self.target_symbol} to {new_symbol}")
        
        # Map user-friendly symbols to API format
        api_symbol = new_symbol
        if new_symbol in ["BOOM300", "BOOM_300"]: api_symbol = "BOOM300N"
        elif new_symbol in ["CRASH300", "CRASH_300", "CRASH300S"]: api_symbol = "CRASH300N"
        elif new_symbol == "R100": api_symbol = "R_100"
        elif new_symbol == "R75": api_symbol = "R_75"
        elif new_symbol == "R50": api_symbol = "R_50"
        elif new_symbol == "R25": api_symbol = "R_25"
        elif new_symbol == "R10": api_symbol = "R_10"
        
        # Broadcast log
        await stream_manager.broadcast_log({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "message": f"Trading symbol switched to: {api_symbol} ({new_symbol})",
            "level": "info",
            "source": "System"
        })
        
        self.target_symbol = api_symbol
        
        # Subscriptions
        if new_symbol not in self.active_symbols:
            self.active_symbols.append(new_symbol)
            await self.subscribe_ticks()

# Global Singleton Instance
deriv_client = DerivConnector()
