from fastapi import APIRouter
import logging
from datetime import datetime
from app.services.deriv_connector import deriv_client

router = APIRouter()
logger = logging.getLogger("api_trades")

@router.post("/trade/")
async def execute_trade(request: dict):
    logger.info(f"Manual Trade Request: {request}")
    
    # Extract params with defaults
    symbol = request.get('symbol', 'R_100')
    contract_type = request.get('contract_type', 'CALL')
    amount = float(request.get('amount', 0.35))
    
    duration = int(request.get('duration', 5))
    duration_unit = request.get('duration_unit', 't')
    
    result = await deriv_client.execute_buy(
        symbol=symbol,
        contract_type=contract_type,
        amount=amount,
        duration=duration,
        duration_unit=duration_unit,
        metadata={
            "source": "Manual", 
            "stop_loss": request.get('stop_loss'), 
            "take_profit": request.get('take_profit'),
            "user_request": request
        }
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

@router.get("/history/")
async def get_trade_history(limit: int = 50, offset: int = 0):
    """Returns the closed trade history from Deriv."""
    trades = await deriv_client.get_profit_table(limit=limit, offset=offset)
    
    # Map Deriv profit_table to frontend Trade interface
    formatted_trades = []
    for t in trades:
        buy_price = float(t.get('buy_price', 0))
        sell_price = float(t.get('sell_price', 0))
        # Fallback calculation if profit_loss is missing
        pnl = float(t.get('profit_loss', sell_price - buy_price))
        
        # Robust symbol extraction
        symbol_name = t.get('display_name') or t.get('underlying_symbol')
        if not symbol_name:
            description = t.get('description', '')
            if description:
                symbol_name = description.split(' ')[0]
            else:
                shortcode = t.get('shortcode', '')
                # Try to find something like R_10, R_100, BOOM300N
                if 'R_' in shortcode:
                    parts = shortcode.split('_')
                    symbol_name = next((p for p in parts if p.startswith('R_') or p.isdigit()), '')
                    if symbol_name.isdigit(): # Handle R_10 becoming ['R', '10']
                         idx = parts.index(symbol_name)
                         if idx > 0 and parts[idx-1] == 'R':
                             symbol_name = 'R_' + symbol_name
                
        formatted_trades.append({
            "id": str(t.get('contract_id')),
            "symbol": symbol_name or "Unknown",
            "side": 'buy' if 'Buy' in t.get('longcode', '') or 'Call' in t.get('longcode', '') else 'sell',
            "entryPrice": buy_price,
            "exitPrice": sell_price,
            "lots": buy_price, 
            "pnl": pnl,
            "openTime": datetime.utcfromtimestamp(int(t.get('purchase_time', 0))).isoformat() if t.get('purchase_time') else '',
            "closeTime": datetime.utcfromtimestamp(int(t.get('sell_time', 0))).isoformat() if t.get('sell_time') else '',
            "strategy": t.get('app_id', 'External'),
            "duration": int(t.get('sell_time', 0)) - int(t.get('purchase_time', 0))
        })
    
    return formatted_trades

@router.get("/analytics/")
async def get_performance_analytics():
    """Returns performance analytics derived from statement and profit table."""
    # Fetch recent history - increased limit for better coverage (Deriv max is 500)
    trades = await deriv_client.get_profit_table(limit=500)
    
    if not trades:
        logger.warning("No trades found in profit table for analytics.")
        return []

    # Map to DailyStats
    daily_stats = {}
    
    # 1. Get current balance with active refresh if it seems empty
    current_balance = deriv_client.current_account.get('balance', 0.0)
    
    if (current_balance <= 0 or current_balance == 1000) and deriv_client.is_authorized:
        try:
            resp = await deriv_client.send_request({"balance": 1})
            if 'balance' in resp:
                current_balance = float(resp['balance'].get('balance', current_balance))
                deriv_client.current_account['balance'] = current_balance
        except Exception as e:
            logger.error(f"Failed to refresh balance: {e}")
            
    # 2. Extract stats from trades
    total_captured_pnl = 0
    for t in trades:
        # Robust PnL calculation
        buy_price = float(t.get('buy_price', 0))
        sell_price = float(t.get('sell_price', 0))
        pnl = float(t.get('profit_loss', sell_price - buy_price))
        
        # Use UTC for consistent global date grouping
        dt = datetime.utcfromtimestamp(int(t.get('sell_time', 0)))
        date = dt.strftime('%Y-%m-%d')
        
        logger.debug(f"Aggregation: {date} | Trade: {t.get('contract_id')} | PnL: {pnl}")
        
        if date not in daily_stats:
            daily_stats[date] = {"date": date, "pnl": 0, "trades": 0, "wins": 0, "losses": 0}
        
        daily_stats[date]["pnl"] += pnl
        daily_stats[date]["trades"] += 1
        if pnl > 0: daily_stats[date]["wins"] += 1
        else: daily_stats[date]["losses"] += 1
        total_captured_pnl += pnl

    logger.info(f"Analytics: Processed {len(trades)} trades across {len(daily_stats)} days. Total Captured PnL: {total_captured_pnl}")

    # 3. Build equity curve by working backwards from current balance
    cumulative_equity = current_balance - total_captured_pnl
    
    # Floor equity at a reasonable stake to avoid "minus 35" if balance sync is totally wrong
    # If the user has a real balance, this won't trigger.
    if cumulative_equity < 0:
        first_trade_stake = float(trades[-1].get('buy_price', 10))
        cumulative_equity = first_trade_stake 

    peak_equity = cumulative_equity
    result = []
    
    for date in sorted(daily_stats.keys()):
        stats = daily_stats[date]
        cumulative_equity += stats["pnl"]
        peak_equity = max(peak_equity, cumulative_equity)
        drawdown = ((peak_equity - cumulative_equity) / peak_equity * 100) if peak_equity > 0 else 0
        
        result.append({
            "date": date,
            "equity": round(cumulative_equity, 2),
            "pnl": round(stats["pnl"], 2),
            "trades": stats["trades"],
            "wins": stats["wins"],
            "losses": stats["losses"],
            "winRate": round((stats["wins"] / stats["trades"] * 100), 2) if stats["trades"] > 0 else 0,
            "drawdown": round(drawdown, 2),
            "peakEquity": round(peak_equity, 2)
        })
        
    return result
