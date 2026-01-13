"""
Strategy Selector
Central registry for symbol-to-strategy mapping.
Provides clean, scalable multi-pair strategy selection.
"""

from typing import Type, Dict
from .base_strategy import BaseStrategy
from .strategy_v10_super_safe import V10SuperSafeStrategy
from .strategy_v75_super_safe import V75SuperSafeStrategy
from .boom300_safe_strategy import Boom300SafeStrategy
from .crash300_safe_strategy import Crash300SafeStrategy
from .spike_bot import SpikeBotStrategy

# Symbol to Strategy Class Mapping
# Optimized based on 30-day backtest results (2026-01-10)
STRATEGY_MAP: Dict[str, Type[BaseStrategy]] = {
    # V75 (1s) - V75 Super Safe: $792.25 profit, 39.9% WR
    "1HZ75V": V75SuperSafeStrategy,
    
    # V75 - Spike Bot: $453.70 profit, 40.2% WR
    "R_75": SpikeBotStrategy,
    "R75": SpikeBotStrategy,
    
    # V10 - Breakout (Default SMA): $148.00 profit, 56.0% WR
    "VOLATILITY_10": V10SuperSafeStrategy,
    "1HZ10V": V10SuperSafeStrategy, 
    "V10": V10SuperSafeStrategy,      
    "R_10": V10SuperSafeStrategy,    
    "R10": V10SuperSafeStrategy,      
    
    # V50 - Crash300 Safe: $310.60 profit, 48.8% WR
    "R_50": Crash300SafeStrategy,
    "R50": Crash300SafeStrategy,
    
    # V100 - V10 Safe: $813.78 profit, 34.6% WR
    "R_100": V10SuperSafeStrategy,
    "R100": V10SuperSafeStrategy,
    
    # BOOM 300 - Boom300 Safe: $722.10 profit, 42.0% WR
    "BOOM300": Boom300SafeStrategy,
    "BOOM300N": Boom300SafeStrategy,
    "boom_300_safe": Boom300SafeStrategy,
    
    # CRASH 300 - Crash300 Safe: $235.84 profit, 37.5% WR
    "CRASH_300": Crash300SafeStrategy,
    "CRASH300": Crash300SafeStrategy,
    "CRASH300N": Crash300SafeStrategy,
    "crash_300_safe": Crash300SafeStrategy,

    # BOOM 500 - Boom300 Safe: $659.90 profit, 64.8% WR
    "BOOM_500": Boom300SafeStrategy, 
    "BOOM500": Boom300SafeStrategy,
    
    # CRASH 500 - Spike Bot: $120.92 profit, 49.4% WR
    "CRASH_500": SpikeBotStrategy, 
    "CRASH500": SpikeBotStrategy,
    
    # Forex Pairs
    "FRXEURUSD": V10SuperSafeStrategy,
}

# Friendly names for UI display (based on backtest optimization)
STRATEGY_DISPLAY_NAMES: Dict[str, str] = {
    "1HZ75V": "V75 Super Safe (Best)",
    "VOLATILITY_10": "V10 Safe",
    "R_10": "V10 Safe",
    "R_25": "V10 Safe",
    "R_50": "Crash300 Safe (Best)",
    "R_75": "Spike Bot (Best)",
    "R_100": "V10 Safe (Best)",
    "BOOM300": "Boom300 Safe (Best)",
    "BOOM300N": "Boom300 Safe (Best)",
    "CRASH_300": "Crash300 Safe (Best)",
    "CRASH300N": "Crash300 Safe (Best)",
    "BOOM_500": "Boom300 Safe (Best)",
    "BOOM500": "Boom300 Safe (Best)",
    "CRASH_500": "Spike Bot (Best)",
    "CRASH500": "Spike Bot (Best)",
    "FRXEURUSD": "Forex EUR/USD Safe",
}

def get_strategy(symbol: str) -> BaseStrategy:
    """
    Returns a strategy instance for the given symbol.
    
    Args:
        symbol: Trading symbol (e.g., "VOLATILITY_10", "BOOM_300")
        
    Returns:
        Instantiated strategy object
        
    Raises:
        ValueError: If symbol is not registered
    """
    # Normalize symbol (uppercase, remove spaces)
    normalized_symbol = symbol.upper().strip().replace(" ", "_")
    
    strategy_class = STRATEGY_MAP.get(normalized_symbol)
    
    if not strategy_class:
        available = ", ".join(sorted(set(STRATEGY_MAP.keys())))
        raise ValueError(
            f"No strategy found for symbol: '{symbol}'. "
            f"Available symbols: {available}"
        )
    
    return strategy_class()


def get_strategy_name(symbol: str) -> str:
    """
    Get the friendly display name for a symbol's strategy.
    
    Args:
        symbol: Trading symbol
        
    Returns:
        Friendly strategy name for UI display
    """
    normalized_symbol = symbol.upper().strip().replace(" ", "_")
    
    # Try exact match first
    if normalized_symbol in STRATEGY_DISPLAY_NAMES:
        return STRATEGY_DISPLAY_NAMES[normalized_symbol]
    
    # Try to find in map and get display name
    for key, strategy_class in STRATEGY_MAP.items():
        if key == normalized_symbol:
            # Extract strategy name from class
            return strategy_class.__name__.replace("Strategy", "").replace("SuperSafe", " Super Safe")
    
    return symbol


def list_available_symbols() -> list:
    """
    Get list of all available trading symbols.
    
    Returns:
        List of primary symbol names
    """
    return ["VOLATILITY_10", "BOOM_300", "CRASH_300"]


def list_strategies_for_ui() -> list:
    """
    Get list of strategies formatted for UI selection.
    
    Returns:
        List of dicts with symbol, name, and description
    """
    return [
        # Spike Bot Strategies (User's pairs)
        {
            "symbol": "1HZ75V",
            "name": "Spike Bot (V75 1s)",
            "description": "Volatility spike trading for V75 (1s)",
            "direction": "BUY & SELL",
            "type": "spike"
        },
        {
            "symbol": "R_75",
            "name": "Spike Bot (R75)",
            "description": "Volatility spike trading for R_75",
            "direction": "BUY & SELL",
            "type": "spike"
        },
        {
            "symbol": "BOOM300N",
            "name": "Spike Bot (Boom 300)",
            "description": "Spike trading for Boom 300",
            "direction": "SELL ONLY",
            "type": "spike"
        },
        {
            "symbol": "CRASH300N",
            "name": "Spike Bot (Crash 300)",
            "description": "Spike trading for Crash 300",
            "direction": "BUY ONLY",
            "type": "spike"
        },
        # Original Safe Strategies
        {
            "symbol": "R_10",
            "name": "Volatility 10 Safe",
            "description": "Trend-following strategy for R_10",
            "direction": "BUY & SELL",
            "type": "breakout"
        },
        {
            "symbol": "R_25",
            "name": "Volatility 25 Safe",
            "description": "Trend-following strategy for R_25",
            "direction": "BUY & SELL",
            "type": "breakout"
        },
        {
            "symbol": "R_50",
            "name": "Volatility 50 Safe",
            "description": "Trend-following strategy for R_50",
            "direction": "BUY & SELL",
            "type": "breakout"
        },
        {
            "symbol": "R_100",
            "name": "Volatility 100 Safe",
            "description": "Trend-following strategy for R_100",
            "direction": "BUY & SELL",
            "type": "breakout"
        },
        {
            "symbol": "BOOM500",
            "name": "Boom 500 Safe",
            "description": "SELL-only Safe Mode for Boom 500",
            "direction": "SELL ONLY",
            "type": "pullback"
        },
         {
            "symbol": "CRASH500",
            "name": "Crash 500 Safe",
            "description": "BUY-only Safe Mode for Crash 500",
            "direction": "BUY ONLY",
            "type": "pullback"
        }
    ]



