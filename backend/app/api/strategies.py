from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any, Optional
from app.strategies import strategy_manager

router = APIRouter()


@router.get("/list", response_model=List[str])
async def list_strategies():
    """List all available strategies."""
    return strategy_manager.list_strategies()


@router.get("/active")
async def get_active_strategy():
    """Get the currently active strategy name."""
    return {"active_strategy": strategy_manager.get_active_strategy_name()}


@router.post("/select")
async def select_strategy(request: Dict[str, str]):
    """Select a strategy to activate."""
    strategy_name = request.get("strategy")
    if not strategy_name:
        raise HTTPException(status_code=400, detail="Strategy name required")

    success = strategy_manager.select_strategy(strategy_name)
    if not success:
        raise HTTPException(
            status_code=404, detail=f"Strategy '{strategy_name}' not found"
        )

    return {"status": "success", "active_strategy": strategy_name}


@router.get("/config")
async def get_strategy_config():
    """Get configuration of the active strategy."""
    if not strategy_manager.active_strategy:
        raise HTTPException(status_code=404, detail="No active strategy")

    return strategy_manager.active_strategy.get_config()


@router.post("/config")
async def update_strategy_config(config: Dict[str, Any]):
    """Update configuration of the active strategy."""
    if not strategy_manager.active_strategy:
        raise HTTPException(status_code=404, detail="No active strategy")

    try:
        strategy_manager.active_strategy.update_config(config)
        return {
            "status": "success",
            "config": strategy_manager.active_strategy.get_config(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run")
async def run_strategy_pipeline(payload: Dict[str, Any]):
    """
    Run the active strategy's analysis pipeline once and return the raw signal.

    This is primarily a diagnostics / backtesting helper – in live trading the
    full pipeline is driven by the DerivConnector tick loop.
    """
    if not strategy_manager.active_strategy:
        raise HTTPException(status_code=404, detail="No active strategy")

    tick_data: Dict[str, Any] = payload.get("tick", {})
    regime_data: Dict[str, Any] = payload.get("regime", {})
    structure_data: Dict[str, Any] = payload.get("structure", {})
    indicator_data: Dict[str, Any] = payload.get("indicators", {})

    signal: Optional[Dict[str, Any]] = strategy_manager.run_strategy(
        tick_data, regime_data, structure_data, indicator_data
    )
    return {"signal": signal}
