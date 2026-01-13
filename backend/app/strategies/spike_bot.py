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
        
    def analyze(self, tick_data, engine, structure_data, indicator_data, **kwargs) -> Optional[Dict]:
        # Use MasterEngine methods to get volatility
        # get_volatility returns float (e.g. 15.5), we need to check if it's 'high' or check value
        # But the original code checked for string "extreme". 
        # MasterEngine.detect_market_mode might return 'chaotic' or 'trending'.
        
        # Let's use structure_data for trend as before.
        # For volatility, let's look at structure_data regime or engine.
        
        # If 'volatility' key exists in structure_data, use that.
        vol_state = structure_data.get('regime', 'neutral') 
        
        # Or simplified: if ATR is high?
        # The user wants "Spike" bot. Let's assume it wants to trade high volatility.
        
        if vol_state in ["volatile", "extreme", "breakout"]:
            # Determine direction from structure
            trend = structure_data.get('trend', 'neutral')
            if trend == "bullish":
                return {"action": "BUY", "confidence": 0.8, "strategy": self.name}
            elif trend == "bearish":
                return {"action": "SELL", "confidence": 0.8, "strategy": self.name}
                
        return None
                
        return None
