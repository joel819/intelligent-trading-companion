"""
Strategy Manager
Manages trading strategies with symbol-based selection.
Simplified to use strategy_selector for multi-pair support.
"""

from typing import Dict, Optional, List
import logging
from .strategy_selector import get_strategy, list_available_symbols, get_strategy_name

logger = logging.getLogger(__name__)


class StrategyManager:
    """Manages trading strategies with dynamic symbol-based routing."""
    
    def __init__(self):
        self.current_symbol: Optional[str] = None
        self.current_strategy = None
        
    def select_strategy_by_symbol(self, symbol: str) -> bool:
        """
        Select strategy based on trading symbol.
        
        Args:
            symbol: Trading symbol (e.g., "VOLATILITY_10", "BOOM_300")
            
        Returns:
            True if strategy was successfully selected
        """
        try:
            self.current_strategy = get_strategy(symbol)
            self.current_symbol = symbol
            strategy_name = get_strategy_name(symbol)
            logger.info(f"Selected strategy: {strategy_name} for symbol: {symbol}")
            return True
        except ValueError as e:
            logger.error(f"Failed to select strategy: {e}")
            return False
    
    def get_active_strategy_info(self) -> Dict:
        """Get information about the currently active strategy."""
        if not self.current_strategy or not self.current_symbol:
            return {
                "symbol": None,
                "strategy": None,
                "name": None
            }
        
        return {
            "symbol": self.current_symbol,
            "strategy": self.current_strategy.name,
            "name": get_strategy_name(self.current_symbol),
            "config": self.current_strategy.config
        }
    
    def run_strategy(self, 
                    symbol: str,
                    tick_data: Dict, 
                    regime_data: Dict, 
                    structure_data: Dict, 
                    indicator_data: Dict) -> Optional[Dict]:
        """
        Run strategy analysis for the given symbol.
        
        Args:
            symbol: Trading symbol
            tick_data: Current market data
            regime_data: Market regime info
            structure_data: Market structure analysis
            indicator_data: Technical indicators
            
        Returns:
            Signal dictionary with action/confidence or None
        """
        # Auto-select strategy if symbol changed
        if symbol != self.current_symbol:
            if not self.select_strategy_by_symbol(symbol):
                logger.error(f"Cannot run strategy - failed to select for symbol: {symbol}")
                return None
        
        if not self.current_strategy:
            logger.error("No strategy selected")
            return None
        
        try:
            return self.current_strategy.analyze(
                tick_data, 
                regime_data, 
                structure_data, 
                indicator_data
            )
        except Exception as e:
            logger.error(f"Strategy execution error: {e}", exc_info=True)
            return None
    
    def list_available_symbols(self) -> List[str]:
        """Get list of all available trading symbols."""
        return list_available_symbols()
