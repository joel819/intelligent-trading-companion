"""
Exits Module
Provides advanced exit logic including Smart SL, Dynamic TP, and Trailing Stops.
"""

from .smart_stops import SmartStopLoss
from .dynamic_tp import DynamicTakeProfit

__all__ = ['SmartStopLoss', 'DynamicTakeProfit']
