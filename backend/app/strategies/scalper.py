"""
Scalper Strategy
High-frequency scalping logic for quick profits.
"""

from typing import Dict, Optional
from .base_strategy import BaseStrategy


class ScalperStrategy(BaseStrategy):
    """1-minute scalping strategy."""
    
    def __init__(self):
        super().__init__("scalper", {
            "rsi_oversold": 30,  # Strict: true oversold
            "rsi_overbought": 70,  # Strict: true overbought
            "sl_factor": 0.5,
            "tp_factor": 1.0,
            "min_confidence": 0.7
        })
        
    def analyze(self, tick_data, regime_data, structure_data, indicator_data) -> Optional[Dict]:
        # Strict Scalper: Only trade on RSI extremes for quality
        
        regime = regime_data.get('regime', 'unknown')
        rsi = indicator_data.get('rsi', 50)
        
        signal = None
        
        # Long Signal: Strong oversold condition
        if regime in ["trending_up", "ranging"]:
            if rsi < self.config["rsi_oversold"]:  # RSI < 30
                signal = "BUY"
                
        # Short Signal: Strong overbought condition
        if regime in ["trending_down", "ranging"]:
            if rsi > self.config["rsi_overbought"]:  # RSI > 70
                signal = "SELL"
                
        if signal:
            return {
                "action": signal,
                "confidence": 0.85,
                "strategy": self.name,
                "metadata": {"rsi": rsi, "regime": regime}
            }
            
        return None
