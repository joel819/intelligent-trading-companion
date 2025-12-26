"""
Spike Bot Strategy
Trades large volatility spikes.
"""

from typing import Dict, Optional
from .base_strategy import BaseStrategy


class SpikeBotStrategy(BaseStrategy):
    """Volatility spike trading strategy."""
    
    def __init__(self):
        super().__init__("spike_bot", {
            "spike_threshold": 3.0 # ATR multiplier
        })
        
    def analyze(self, tick_data, regime_data, structure_data, indicator_data) -> Optional[Dict]:
        volatility = regime_data.get('volatility')
        
        # Trigger on extreme volatility
        if volatility == "extreme":
            # Determine direction from structure
            trend = structure_data.get('trend', 'neutral')
            if trend == "bullish":
                return {"action": "BUY", "confidence": 0.8, "strategy": self.name}
            elif trend == "bearish":
                return {"action": "SELL", "confidence": 0.8, "strategy": self.name}
                
        return None
