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
    def __init__(self, token: str = None, app_id: str = "1089"):
        self.token = token or os.getenv("DERIV_TOKEN")
        self.app_id = app_id or os.getenv("DERIV_APP_ID", "1089")
        if not self.token:
            logger.warning("No DERIV_TOKEN found in environment. Connection may fail.")
        self.ws = None
        self.is_connected = False
        self.active_symbols = ["R_100", "R_75", "R_50"] 
        self.active_requests: Dict[str, asyncio.Future] = {} 
        self.listen_task: Optional[asyncio.Task] = None
        
        self.active_account_id = None
        # Account Data
        self.available_accounts: List[Dict] = []
        self.current_account: Dict = {}
        self.open_positions: List[Dict] = []
        
        self.req_id_counter = 100 # Start higher to avoid collision with builtin reqs
        self.tick_count = 0
        self.target_symbol = "R_100"
        self.processed_contracts = set()
        
        # Session Stats
        self.session_stats = {
            "pnl": 0.0,
            "trades": 0,
            "wins": 0,
            "losses": 0
        }
        
        # Default Config for Engine Initialization
        self.default_config = {
            "grid_size": 10,
            "risk_percent": 1.0,
            "max_lots": 5.0,
            "confidence_threshold": 0.7,
            "stop_loss_points": 50.0,
            "take_profit_points": 100.0,
            "max_open_trades": 5,
            "drawdown_limit": 10.0
        }

    async def connect(self):
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
            
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            self.is_connected = False

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
                EngineWrapper.init_engine(self.default_config)
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
            
        req = {"authorize": target_token}
        resp = await self.send_request(req)
        
        if 'error' in resp:
            error_msg = f"Backend Auth Failed: {resp['error'].get('message', 'Unknown error')}"
            logger.error(error_msg)
            await stream_manager.broadcast_log({
                "id": str(uuid.uuid4()),
                "timestamp": datetime.now().isoformat(),
                "message": error_msg,
                "level": "error",
                "source": "Deriv"
            })
        elif 'authorize' in resp:
            auth_data = resp['authorize']
            msg = f"Backend Authorized as {auth_data.get('fullname')} ({auth_data.get('loginid')})"
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
                "id": auth_data.get("loginid"),
                "balance": float(auth_data.get("balance") if auth_data.get("balance") is not None else 0.0),
                "currency": auth_data.get("currency", "USD"),
                "email": auth_data.get("email")
            }
            self.active_account_id = self.current_account["id"]
            
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
                    "expiry": None,
                    "isActive": acc_id == self.active_account_id,
                    "token": acc.get("token") # Some tokens are provided in list
                })
                
            for acc in self.available_accounts:
                if acc["id"] == self.active_account_id:
                    acc["balance"] = self.current_account["balance"]
                    acc["equity"] = self.current_account["balance"]
                    
            # Set top-level token to the authorized one if not set
            if not self.token:
                self.token = target_token
                
            # Initial Engine Sync
            try:
                EngineWrapper.update_account(
                    balance=self.current_account['balance'],
                    equity=self.current_account['balance'], # Assuming equity ~ balance initially
                    margin_free=self.current_account['balance']
                )
                logger.info(f"Engine Account Synced: Balance=${self.current_account['balance']}")
            except Exception as e:
                logger.error(f"Failed to sync engine account: {e}")

    async def subscribe_ticks(self):
        if not self.ws: return
        req = {
            "ticks": self.active_symbols,
            "subscribe": 1
        }
        await self.ws.send(json.dumps(req))
        logger.info(f"Subscribed to {self.active_symbols}")

    async def subscribe_balance(self):
        if not self.ws: return
        req = {"balance": 1, "subscribe": 1}
        await self.ws.send(json.dumps(req))
        logger.info("Subscribed to Balance updates")

    async def subscribe_portfolio(self):
        if not self.ws: return
        # portfolio: 1 gives us the initial list of open positions and future updates
        req = {"portfolio": 1, "subscribe": 1}
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
                if s.get('market') in ['synthetic_index', 'forex']
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
            await self.ws.send(json.dumps(request))
            response = await asyncio.wait_for(future, timeout=30.0) 
            return response
        except asyncio.TimeoutError:
            logger.error(f"Request {req_id} timed out")
            return {"error": {"code": "Timeout", "message": "Request timed out"}}
        finally:
            self.active_requests.pop(req_id, None)

    async def listen(self):
        while self.is_connected and self.ws:
            try:
                message = await self.ws.recv()
                data = json.loads(message)
                
                # Check for req_id match in both top-level and echo_req
                req_id = data.get('req_id')
                if not req_id and 'echo_req' in data:
                    req_id = data['echo_req'].get('req_id')
                
                # Try to cast to int for matching if it was sent as int
                try:
                    if req_id is not None:
                         req_id_int = int(req_id)
                         if req_id_int in self.active_requests:
                             if not self.active_requests[req_id_int].done():
                                 self.active_requests[req_id_int].set_result(data)
                except (ValueError, TypeError):
                    # Fallback to string matching if it's a UUID
                    if req_id in self.active_requests:
                         if not self.active_requests[req_id].done():
                             self.active_requests[req_id].set_result(data)
                else:
                    logger.debug(f"Unmatched message: {data.get('msg_type', 'unknown')} (req_id: {req_id})")
                
                if 'tick' in data:
                    asyncio.create_task(self.handle_tick(data['tick']))
                
                if 'balance' in data:
                     asyncio.create_task(self.handle_balance(data['balance']))

                if 'portfolio' in data:
                    asyncio.create_task(self.handle_portfolio(data['portfolio']))

                if 'proposal_open_contract' in data:
                    asyncio.create_task(self.handle_position_update(data['proposal_open_contract']))
                    
            except websockets.ConnectionClosed:
                logger.warning("Connection closed")
                self.is_connected = False
                break
            except Exception as e:
                logger.error(f"Error in listener: {e}")

    async def handle_tick(self, tick):
        symbol = tick['symbol']
        bid = tick['quote']
        ask = tick['quote']
        epoch = tick['epoch']
        
        tick_data = {
            "symbol": symbol,
            "bid": float(bid),
            "ask": float(ask),
            "timestamp": datetime.fromtimestamp(epoch).isoformat(),
            "spread": 0
        }
        
        self.tick_count += 1
        symbol = tick_data.get('symbol')
        
        # Filter: Only trade on target symbol
        if symbol != self.target_symbol:
            return

        if self.tick_count % 50 == 0:
            logger.info(f"Received 50 ticks for {symbol}. Last price: {tick_data.get('bid')}")
        
        await stream_manager.broadcast_tick(tick_data)
        
        try:
            # Pass REAL open positions to the engine
            signal = EngineWrapper.process_tick(tick_data, self.open_positions)
            
            # DEBUG: Trace Engine Signal
            if self.tick_count % 10 == 0:
                is_running = EngineWrapper.get_bot_state()['is_running']
                logger.info(f"Engine Signal: {signal['action']} | Bot Running: {is_running}")
            
            if signal['action'] != 0:
                logger.info(f"Signal from Engine: {signal}")
                await stream_manager.broadcast_log({
                    "id": str(uuid.uuid4()),
                    "timestamp": datetime.now().isoformat(),
                    "message": f"ML Signal: {signal['action']} | Confidence: {signal.get('confidence', 0)}%",
                    "level": "info",
                    "source": "Engine"
                })
                
                # Execute automated trade
                conf_threshold = self.default_config.get('confidence_threshold', 0.0) * 100
                if signal['confidence'] < conf_threshold:
                    logger.warning(f"Trade Ignored: Confidence {signal['confidence']}% below threshold {conf_threshold}%")
                    return

                await self.execute_buy(
                    symbol=symbol,
                    contract_type="CALL" if signal['action'] == 1 else "PUT",
                    amount=signal.get('lots', 0.35),
                    metadata={"source": "Engine", "signal": signal}
                )
            
            elif signal['action'] == 5: 
                 logger.critical("PANIC STOP")
                 
        except Exception as e:
             logger.error(f"Engine/Trade Error: {e}")

    async def execute_buy(self, symbol: str, contract_type: str, amount: float, metadata: dict = None):
        """
        Executes a real trade on Deriv with FIFO validation.
        """
        logger.info(f"Initiating Trade: {contract_type} on {symbol} for {amount}. Metadata: {metadata}")
        
        try:
            # 1. FIFO Refresh (Get available contracts)
            contracts_req = {"contracts_for": symbol}
            contracts_resp = await self.send_request(contracts_req)
            
            if 'error' in contracts_resp:
                from app.services.audit_logger import audit_logger
                audit_logger.log_error("FIFO_REFRESH_FAILED", contracts_resp['error'])
                logger.error(f"FIFO Refresh Failed: {contracts_resp['error']}")
                return {"status": "error", "message": "FIFO Refresh Failed"}
                
            contracts = contracts_resp.get('contracts_for', {}).get('available', [])
            
            # 2. Validation & Clamping
            mock_signal = {"symbol": symbol, "action": 1 if contract_type == "CALL" else 2, "lots": amount}
            validated_params = TradeManager.validate_and_clamp(mock_signal, contracts)
            
            if not validated_params:
                logger.warning("Trade Rejected by FIFO Validation Guard")
                return {"status": "error", "message": "FIFO Validation Rejected"}
                
            # 3. Create Proposal
            proposal_req = TradeManager.create_proposal_payload(validated_params)
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
                await stream_manager.broadcast_log({
                    "id": str(uuid.uuid4()),
                    "timestamp": datetime.now().isoformat(),
                    "message": f"Successfully placed {contract_type} on {symbol} (Stake: {validated_params['amount']})",
                    "level": "success",
                    "source": "Execution"
                })
                
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
            pos = {
                "id": str(c.get('contract_id')),
                "symbol": c.get('symbol'),
                "side": 'buy' if 'CALL' in c.get('contract_type', '').upper() else 'sell',
                "lots": float(c.get('buy_price', 0)),
                "entryPrice": float(c.get('entry_tick', 0)),
                "currentPrice": float(c.get('bid_price', 0)),
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
        else:
            # Update or Add position
            pos = {
                "id": cid,
                "symbol": contract.get('underlying'),
                "side": 'buy' if 'CALL' in contract.get('contract_type', '').upper() else 'sell',
                "lots": float(contract.get('buy_price', 0)),
                "entryPrice": float(contract.get('entry_tick', 0)),
                "currentPrice": float(contract.get('current_spot', 0)),
                "pnl": float(contract.get('profit', 0)),
                "openTime": datetime.fromtimestamp(contract.get('purchase_time', 0)).isoformat()
            }
            
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
        
        # Broadcast log
        await stream_manager.broadcast_log({
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "message": f"Trading symbol switched to: {new_symbol}",
            "level": "info",
            "source": "System"
        })
        
        self.target_symbol = new_symbol
        
        # Subscriptions
        if new_symbol not in self.active_symbols:
            self.active_symbols.append(new_symbol)
            await self.subscribe_ticks()

# Global Singleton Instance
deriv_client = DerivConnector()
