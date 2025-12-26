"""
Breakout Strategy
Trading breakouts from consolidation ranges.
"""

from typing import Dict, Optional
from .base_strategy import BaseStrategy


class BreakoutStrategy(BaseStrategy):
    """Breakout trading strategy."""
    
    def __init__(self):
        super().__init__("breakout", {
            "breakout_threshold": 0.002,
            "min_confidence": 0.8
        })
        
    def analyze(self, tick_data, regime_data, structure_data, indicator_data) -> Optional[Dict]:
        regime = regime_data.get('regime')
        
        # Only trade breakouts if we detected a Breakout regime
        if regime != "breakout":
            return None
            
        # Direction determined by Market Structure
        trend = structure_data.get('trend', 'neutral')
        
        if trend == "bullish":
            return {
                "action": "BUY",
                "confidence": 0.9,
                "strategy": self.name
            }
        elif trend == "bearish":
            return {
                "action": "SELL",
                "confidence": 0.9,
                "strategy": self.name
            }
            
        return None
