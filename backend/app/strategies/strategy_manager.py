"""
Strategy Manager
Manages loading, selecting, and executing trading strategies.
"""

from typing import Dict, Optional, List
import logging
from .base_strategy import BaseStrategy
from .scalper import ScalperStrategy
from .breakout import BreakoutStrategy
from .v75_sniper import V75SniperStrategy
from .grid_recovery import GridRecoveryStrategy
from .spike_bot import SpikeBotStrategy

logger = logging.getLogger(__name__)


class StrategyManager:
    """Manages multiple trading strategies."""
    
    def __init__(self):
        self.strategies: Dict[str, BaseStrategy] = {}
        self.active_strategy: Optional[BaseStrategy] = None
        self._initialize_strategies()
        
    def _initialize_strategies(self):
        """Initialize all available strategies with default configs."""
        self.strategies["scalper"] = ScalperStrategy()
        self.strategies["breakout"] = BreakoutStrategy()
        self.strategies["v75_sniper"] = V75SniperStrategy()
        self.strategies["grid_recovery"] = GridRecoveryStrategy()
        self.strategies["spike_bot"] = SpikeBotStrategy()
        
        # Default active
        self.active_strategy = self.strategies["scalper"]
        
    def select_strategy(self, strategy_name: str) -> bool:
        """Switch the active strategy."""
        if strategy_name in self.strategies:
            self.active_strategy = self.strategies[strategy_name]
            logger.info(f"Switched to strategy: {strategy_name}")
            return True
        return False
        
    def get_active_strategy_name(self) -> str:
        return self.active_strategy.name if self.active_strategy else "None"
        
    def run_strategy(self, 
                    tick_data: Dict, 
                    regime_data: Dict, 
                    structure_data: Dict, 
                    indicator_data: Dict) -> Optional[Dict]:
        """Run the analysis pipeline for the active strategy."""
        if not self.active_strategy:
            return None
            
        return self.active_strategy.analyze(
            tick_data, 
            regime_data, 
            structure_data, 
            indicator_data
        )
        
    def list_strategies(self) -> List[str]:
        return list(self.strategies.keys())
