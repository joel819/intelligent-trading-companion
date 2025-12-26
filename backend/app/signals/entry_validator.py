"""
Entry Validator
Synthesizes signals from Market Structure and Indicators layers.
"""

from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class EntryValidator:
    """Combines multiple signal layers to validate entry."""
    
    def __init__(self):
        pass
        
    def validate(self, 
                 structure_data: Dict, 
                 indicator_data: Dict, 
                 volatility_valid: bool) -> Optional[Dict]:
        """
        Validate entry based on structure and indicators.
        
        Args:
            structure_data: Result from MarketStructure.analyze()
            indicator_data: Result from IndicatorLayer.analyze()
            volatility_valid: Boolean from VolatilityFilter
            
        Returns:
            Dict with action and confidence, or None if no trade.
        """
        if not volatility_valid:
            return None
            
        struct_score = structure_data.get('score', 50)
        ind_score = indicator_data.get('score', 50)
        
        # Alignment check
        # Previously: Both scores should be on the same side of 50 and beyond 40/60
        # Now: Allow if average is strong or if one is extremely strong
        
        is_bullish = (struct_score > 55 and ind_score > 55) or (struct_score > 75) or (ind_score > 75)
        is_bearish = (struct_score < 45 and ind_score < 45) or (struct_score < 25) or (ind_score < 25)
        
        # Guard against contradictory signals
        if (struct_score > 60 and ind_score < 40) or (struct_score < 40 and ind_score > 60):
            return None
            
        if not (is_bullish or is_bearish):
            return None
            
        # Calculate combined confidence
        if is_bullish:
            bias = "BUY"
            # Map 60-100 range to confidence (e.g. 60 -> 0.2, 80 -> 0.6, 100 -> 1.0)
            avg_score = (struct_score + ind_score) / 2
            confidence = (avg_score - 55) / 45 # More sensitive mapping
        else: # Bearish
            bias = "SELL"
            # Map 0-40 range to confidence inverted
            avg_score = (struct_score + ind_score) / 2
            confidence = (45 - avg_score) / 45
            
        # Output
        return {
            "action": bias,
            "confidence": min(0.99, max(0.1, confidence)),
            "details": {
                "structure_score": struct_score,
                "indicator_score": ind_score,
                "structure_trend": structure_data.get('trend'),
                "indicator_bias": indicator_data.get('bias')
            }
        }
