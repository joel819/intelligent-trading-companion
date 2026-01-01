from fastapi import APIRouter
import logging
from app.services.deriv_connector import deriv_client

router = APIRouter()
logger = logging.getLogger("api_trades")

@router.post("/trade/")
async def execute_trade(request: dict):
    logger.info(f"Manual Trade Request: {request}")
    
    # Extract params with defaults
    symbol = request.get('symbol', 'R_100')
    contract_type = request.get('contract_type', 'CALL')
    amount = float(request.get('amount', 0.5))
    
    duration = int(request.get('duration', 5))
    duration_unit = request.get('duration_unit', 't')
    
    result = await deriv_client.execute_buy(
        symbol=symbol,
        contract_type=contract_type,
        amount=amount,
        duration=duration,
        duration_unit=duration_unit,
        metadata={"source": "Manual", "user_request": request}
    )
    
    if result.get("status") == "success":
        return {"status": "success", "message": f"Real {contract_type} placed on {symbol}!"}
    else:
        return {"status": "error", "message": result.get("message", "Trade failed")}
@router.post("/close/")
async def close_trade(request: dict):
    contract_id = request.get('contract_id')
    if not contract_id:
        return {"status": "error", "message": "Contract ID required"}
        
    logger.info(f"Manual Close Request: {contract_id}")
    success, error_msg = await deriv_client.sell_contract(contract_id, reason="User Manual Action")
    
    if success:
        return {"status": "success", "message": f"Position {contract_id} close requested."}
    else:
        # Relay specific broker error (e.g., 'Resale not offered')
        return {"status": "error", "message": error_msg or "Failed to close position."}
