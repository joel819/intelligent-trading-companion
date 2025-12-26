"""
Strategies Module
Collection of trading strategies and the strategy manager.
"""

from .strategy_manager import StrategyManager
from .base_strategy import BaseStrategy
from .scalper import ScalperStrategy
from .breakout import BreakoutStrategy
from .v75_sniper import V75SniperStrategy
from .grid_recovery import GridRecoveryStrategy
from .spike_bot import SpikeBotStrategy

# Global Strategy Manager Instance
strategy_manager = StrategyManager()

__all__ = ['StrategyManager', 'strategy_manager', 'BaseStrategy', 
           'ScalperStrategy', 'BreakoutStrategy', 'V75SniperStrategy', 
           'GridRecoveryStrategy', 'SpikeBotStrategy']
