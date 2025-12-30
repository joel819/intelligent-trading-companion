"""
Base Strategy
Abstract base class for all trading strategies.
"""

from typing import Dict, Optional, Any, List
from abc import ABC, abstractmethod


class BaseStrategy(ABC):
    """Abstract base class for trading strategies."""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        
    @abstractmethod
    def analyze(self, 
                tick_data: Dict, 
                engine: Any, # MasterEngine
                structure_data: Dict, 
                indicator_data: Dict,
                h1_candles: List[Dict] = None) -> Optional[Dict]:
        """
        Analyze markets and generate a signal.
        
        Args:
            tick_data: Current market data
            regime_data: Market regime info
            structure_data: Market structure analysis
            indicator_data: Technical indicators
            
        Returns:
            Dict with action/confidence or None
        """
        pass
        
    def get_config(self) -> Dict:
        return self.config
        
    def update_config(self, new_config: Dict):
        self.config.update(new_config)

    def calculate_sl_tp(self, price: float, atr: float, direction: str, rr_ratio: float = 1.5) -> tuple[float, float]:
        """
        Calculate Dynamic Stop Loss and Take Profit based on ATR.
        
        Args:
            price: Current price
            atr: Current ATR(14) or similar volatility metric
            direction: "BUY" or "SELL"
            rr_ratio: Target Risk:Reward Ratio
            
        Returns:
            Tuple (sl_dist, tp_dist) in POINTS/PRICE DELTA
        """
        # Default Multipliers
        atr_sl_mult = self.config.get("atr_sl_multiplier", 2.0)
        min_sl = self.config.get("sl_points_min", 5.0)
        max_sl = self.config.get("sl_points_max", 50.0)
        
        # SL Distance = ATR * Multiplier
        # If ATR is 0 (no history), fallback to safe default (max_sl / 2)
        if atr <= 0:
            sl_dist = min_sl * 2
        else:
            sl_dist = atr * atr_sl_mult
            
        # Clamp SL
        sl_dist = max(min_sl, min(sl_dist, max_sl))
        
        # TP Distance based on RR
        tp_dist = sl_dist * rr_ratio
        
        # Round to 2 decimals for cleaner output
        return round(sl_dist, 2), round(tp_dist, 2)

