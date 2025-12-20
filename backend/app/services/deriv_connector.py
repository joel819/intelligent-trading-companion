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
        self.active_symbols = ["R_100", "R_50"] 
        self.active_requests: Dict[str, asyncio.Future] = {} 
        self.listen_task: Optional[asyncio.Task] = None
        
        # Account Data
        self.available_accounts: List[Dict] = []
        self.current_account: Dict = {}
        
        # ID Counter
        self.req_id_counter = 1

    async def connect(self):
        try:
            url = f"{DERIV_WS_BASE_URL}?app_id={self.app_id}"
            logger.info(f"Connecting to {url}")
            self.ws = await websockets.connect(url)
            self.is_connected = True
            logger.info("Connected to Deriv WebSocket")
            
            await self.authorize()
            await self.subscribe_ticks()
            
            if self.listen_task:
                self.listen_task.cancel()
            self.listen_task = asyncio.create_task(self.listen())
            
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            self.is_connected = False

    async def authorize(self):
        req = {"authorize": self.token}
        resp = await self.send_request(req)
        
        if 'error' in resp:
            error_msg = f"Backend Auth Failed: {resp['error'].get('message', 'Unknown error')}"
            logger.error(error_msg)
            await stream_manager.broadcast_log({
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "message": error_msg,
                "type": "error"
            })
        elif 'authorize' in resp:
            auth_data = resp['authorize']
            msg = f"Backend Authorized as {auth_data.get('fullname')} ({auth_data.get('loginid')})"
            logger.info(msg)
            await stream_manager.broadcast_log({
                "timestamp": datetime.now().strftime("%H:%M:%S"),
                "message": msg,
                "type": "success"
            })
            self.current_account = auth_data
            self.current_account = {
                "id": auth_data.get("loginid"),
                "balance": float(auth_data.get("balance", 0)),
                "currency": auth_data.get("currency"),
                "email": auth_data.get("email")
            }
            
            # Parse Account List
            raw_list = auth_data.get("account_list", [])
            self.available_accounts = []
            
            for acc in raw_list:
                self.available_accounts.append({
                    "id": acc.get("loginid"),
                    "name": f"Deriv {acc.get('currency')} {'Demo' if acc.get('is_virtual') else 'Real'}",
                    "type": "demo" if acc.get("is_virtual") else "real",
                    "currency": acc.get("currency"),
                    "balance": 0.0, 
                    "expiry": None,
                    "isActive": acc.get("loginid") == self.current_account["id"]
                })
                
            for acc in self.available_accounts:
                if acc["id"] == self.current_account["id"]:
                    acc["balance"] = self.current_account["balance"]
                    acc["equity"] = self.current_account["balance"] 

    async def subscribe_ticks(self):
        if not self.ws: return
        req = {
            "ticks": self.active_symbols,
            "subscribe": 1
        }
        await self.ws.send(json.dumps(req))
        logger.info(f"Subscribed to {self.active_symbols}")

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
                
                if req_id and req_id in self.active_requests:
                    if not self.active_requests[req_id].done():
                        self.active_requests[req_id].set_result(data)
                
                if 'tick' in data:
                    asyncio.create_task(self.handle_tick(data['tick']))
                    
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
            "epoch": int(epoch)
        }
        
        # Diagnostic Log
        logger.debug(f"Tick received for {symbol}: {bid}")
        
        await stream_manager.broadcast_tick(tick_data)
        
        try:
            signal = EngineWrapper.process_tick(tick_data, [])
            
            if signal['action'] != 0:
                logger.info(f"Signal from Engine: {signal}")
                await stream_manager.broadcast_log({
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "message": f"ML Signal: {signal['action']} | Confidence: {signal.get('confidence', 0)}%",
                    "type": "info"
                })
                logger.info(f"Signal Received: {signal}. Initiating FIFO Refresh...")
                
                # Perform FIFO Refresh
                contracts_req = {"contracts_for": symbol}
                contracts_resp = await self.send_request(contracts_req)
                
                if 'error' in contracts_resp:
                    from app.services.audit_logger import audit_logger
                    audit_logger.log_error("FIFO_REFRESH_FAILED", contracts_resp['error'])
                    logger.error(f"FIFO Refresh Failed: {contracts_resp['error']}")
                    return
                    
                contracts = contracts_resp.get('contracts_for', {}).get('available', [])
                validated_params = TradeManager.validate_and_clamp(signal, contracts)
                
                if not validated_params:
                    logger.warning("Signal Rejected by FIFO Validation Guard")
                    return
                    
                proposal_req = TradeManager.create_proposal_payload(validated_params)
                proposal_resp = await self.send_request(proposal_req)
                
                if 'proposal' in proposal_resp:
                    from app.services.audit_logger import audit_logger
                    proposal_id = proposal_resp['proposal']['id']
                    
                    # Execution
                    buy_req = {"buy": proposal_id, "price": 10000} 
                    buy_resp = await self.send_request(buy_req)
                    
                    # Log to Audit
                    audit_logger.log_trade(
                        signal=signal,
                        validation=validated_params['validation_metadata'],
                        response=buy_resp
                    )
                    logger.info(f"Trade Execution Result: {buy_resp}")
                else:
                    from app.services.audit_logger import audit_logger
                    audit_logger.log_error("PROPOSAL_FAILED", proposal_resp.get('error'))
                    logger.error(f"Proposal Failed: {proposal_resp}")
            
            elif signal['action'] == 5: 
                 logger.critical("PANIC STOP")
                 
        except Exception as e:
             logger.error(f"Engine/Trade Error: {e}")

    async def disconnect(self):
        self.is_connected = False
        if self.listen_task:
            self.listen_task.cancel()
            self.listen_task = None
        if self.ws:
            await self.ws.close()
            self.ws = None

# Global Singleton Instance
deriv_client = DerivConnector()
