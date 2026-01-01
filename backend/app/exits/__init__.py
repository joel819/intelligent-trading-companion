"""
Exits Module
Provides advanced exit logic including Smart SL, Dynamic TP, Trailing Stops, and Scalper Exits.
"""

from .smart_stops import SmartStopLoss
from .dynamic_tp import DynamicTakeProfit
from .scalper_exit import ScalperExitModule
from .scalper_tpsl import ScalperTPSL

__all__ = ['SmartStopLoss', 'DynamicTakeProfit', 'ScalperExitModule', 'ScalperTPSL']

