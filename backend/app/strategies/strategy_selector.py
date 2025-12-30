"""
Strategy Selector
Central registry for symbol-to-strategy mapping.
Provides clean, scalable multi-pair strategy selection.
"""

from typing import Type, Dict
from .base_strategy import BaseStrategy
from .strategy_v10_super_safe import V10SuperSafeStrategy
from .boom300_safe_strategy import Boom300SafeStrategy
from .crash300_safe_strategy import Crash300SafeStrategy

# Symbol to Strategy Class Mapping
STRATEGY_MAP: Dict[str, Type[BaseStrategy]] = {
    "VOLATILITY_10": V10SuperSafeStrategy,
    "1HZ10V": V10SuperSafeStrategy,  # Alternative symbol format
    "V10": V10SuperSafeStrategy,      # Short format
    "R_10": V10SuperSafeStrategy,     # Common trading symbol
    "R10": V10SuperSafeStrategy,      # No underscore
    
    "BOOM300": Boom300SafeStrategy,
    "BOOM300N": Boom300SafeStrategy, # Official symbol
    "boom_300_safe": Boom300SafeStrategy, # Explicit key
    
    "CRASH_300": Crash300SafeStrategy,
    "CRASH300": Crash300SafeStrategy,
    "CRASH300N": Crash300SafeStrategy,
    "crash_300_safe": Crash300SafeStrategy, # Explicit key

    # Additional Volatility Indices
    "R_10": V10SuperSafeStrategy,
    "R_25": V10SuperSafeStrategy, "R25": V10SuperSafeStrategy,
    "R_50": V10SuperSafeStrategy, "R50": V10SuperSafeStrategy,
    "R_75": V10SuperSafeStrategy, "R75": V10SuperSafeStrategy,
    "R_100": V10SuperSafeStrategy, "R100": V10SuperSafeStrategy,
    
    # Boom/Crash 500
    "BOOM_500": Boom300SafeStrategy, "BOOM500": Boom300SafeStrategy,
    "CRASH_500": Crash300SafeStrategy, "CRASH500": Crash300SafeStrategy,
    
    # Forex Pairs
    "FRXEURUSD": V10SuperSafeStrategy,
}

# Friendly names for UI display
STRATEGY_DISPLAY_NAMES: Dict[str, str] = {
    "VOLATILITY_10": "V10 Super Safe",
    "BOOM300": "Boom 300 Safe",
    "BOOM300N": "Boom 300 Safe",
    "CRASH_300": "Crash 300 Safe",
    "CRASH300N": "Crash 300 Safe",
    "R_10": "Volatility 10 Safe",
    "R_25": "Volatility 25 Safe",
    "R_50": "Volatility 50 Safe",
    "R_75": "Volatility 75 Safe",
    "R_100": "Volatility 100 Safe",
    "BOOM_500": "Boom 500 Safe",
    "BOOM500": "Boom 500 Safe",
    "CRASH_500": "Crash 500 Safe",
    "CRASH500": "Crash 500 Safe",
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
            "symbol": "R_75",
            "name": "Volatility 75 Safe",
            "description": "Trend-following strategy for R_75",
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
            "symbol": "BOOM300N",
            "name": "Boom 300 Safe",
            "description": "SELL-only Safe Mode for Boom 300",
            "direction": "SELL ONLY",
            "type": "pullback"
        },
        {
            "symbol": "CRASH300N",
            "name": "Crash 300 Safe",
            "description": "BUY-only Safe Mode for Crash 300",
            "direction": "BUY ONLY",
            "type": "pullback"
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
