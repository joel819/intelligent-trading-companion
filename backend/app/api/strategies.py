"""
Strategies API
Endpoints for strategy selection and management with symbol-based routing.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import logging

from app.strategies.strategy_selector import (
    get_strategy,
    list_strategies_for_ui,
    list_strategies_for_ui,
    get_strategy_name,
    STRATEGY_MAP
)
from app.services.deriv_connector import deriv_client

logger = logging.getLogger(__name__)

router = APIRouter()


class StrategySelectionRequest(BaseModel):
    """Request model for strategy selection."""
    symbol: str


class StrategyAnalysisRequest(BaseModel):
    """Request model for running strategy analysis."""
    symbol: str
    market_data: Dict
    regime_data: Optional[Dict] = None
    structure_data: Optional[Dict] = None
    indicator_data: Optional[Dict] = None


@router.get("/list")
async def list_strategies():
    """
    Get list of all available strategies for UI selection.
    
    Returns:
        List of strategy information including symbol, name, description
    """
    try:
        strategies = list_strategies_for_ui()
        return {
            "success": True,
            "strategies": strategies,
            "count": len(strategies)
        }
    except Exception as e:
        logger.error(f"Error listing strategies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/select")
async def select_strategy(request: StrategySelectionRequest):
    """
    Select a strategy by trading symbol.
    
    Args:
        request: Contains symbol name
        
    Returns:
        Strategy information and configuration
    """
    try:
        strategy = get_strategy(request.symbol)
        strategy_name = get_strategy_name(request.symbol)
        
        # Switch trading symbol in connector
        await deriv_client.switch_symbol(request.symbol)
        
        return {
            "success": True,
            "symbol": request.symbol,
            "strategy_name": strategy_name,
            "strategy_id": strategy.name,
            "config": strategy.config
        }
    except ValueError as e:
        logger.error(f"Strategy selection error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error selecting strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_with_strategy(request: StrategyAnalysisRequest):
    """
    Run strategy analysis for a given symbol and market data.
    
    Args:
        request: Contains symbol and market data
        
    Returns:
        Strategy analysis result with signal, confidence, details
    """
    try:
        # Get strategy for symbol
        strategy = get_strategy(request.symbol)
        
        # Prepare data with defaults
        regime_data = request.regime_data or {}
        structure_data = request.structure_data or {"trend": "neutral", "score": 50}
        indicator_data = request.indicator_data or {}
        
        # Run analysis
        result = strategy.analyze(
            request.market_data,
            regime_data,
            structure_data,
            indicator_data
        )
        
        if result is None:
            return {
                "success": True,
                "symbol": request.symbol,
                "signal": None,
                "reason": "No signal generated"
            }
        
        return {
            "success": True,
            "symbol": request.symbol,
            **result
        }
        
    except ValueError as e:
        logger.error(f"Invalid symbol: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Strategy analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/symbols")
async def get_available_symbols():
    """
    Get all available trading symbols.
    
    Returns:
        List of supported symbols
    """
    return {
        "success": True,
        "symbols": list(set(STRATEGY_MAP.keys())),
        "primary_symbols": ["VOLATILITY_10", "BOOM300N", "CRASH300N"]
    }


@router.get("/info/{symbol}")
async def get_strategy_info(symbol: str):
    """
    Get detailed information about a strategy for a specific symbol.
    
    Args:
        symbol: Trading symbol
        
    Returns:
        Detailed strategy configuration and parameters
    """
    try:
        strategy = get_strategy(symbol)
        strategy_name = get_strategy_name(symbol)
        
        return {
            "success": True,
            "symbol": symbol,
            "name": strategy_name,
            "strategy_id": strategy.name,
            "config": strategy.config,
            "description": f"{strategy_name} - Optimized for {symbol}"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error getting strategy info: {e}")
        raise HTTPException(status_code=500, detail=str(e))
