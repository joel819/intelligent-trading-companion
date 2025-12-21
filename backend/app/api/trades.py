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
    
    result = await deriv_client.execute_buy(
        symbol=symbol,
        contract_type=contract_type,
        amount=amount,
        metadata={"source": "Manual", "user_request": request}
    )
    
    if result.get("status") == "success":
        return {"status": "success", "message": f"Real {contract_type} placed on {symbol}!"}
    else:
        return {"status": "error", "message": result.get("message", "Trade failed")}
