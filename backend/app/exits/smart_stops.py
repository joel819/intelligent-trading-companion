"""
Smart Stop Loss
Calculates dynamic stop loss levels based on volatility and market structure.
"""

import numpy as np
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class SmartStopLoss:
    """Calculates optimal stop loss placement."""
    
    def __init__(self, atr_multiplier: float = 1.5):
        self.atr_multiplier = atr_multiplier
        
    def calculate_sl_price(self, 
                          entry_price: float, 
                          direction: str, 
                          atr: float, 
                          structure_level: float = 0.0) -> float:
        """
        Calculate precise Stop Loss price.
        
        Args:
            entry_price: Entry price
            direction: "BUY" or "SELL"
            atr: Current ATR value
            structure_level: Price of nearest support/resistance (optional)
            
        Returns:
            Stop Loss Price
        """
        # Base SL based on volatility (ATR)
        # Prevent zero ATR issues
        safe_atr = max(atr, entry_price * 0.0005) 
        
        volatility_buffer = safe_atr * self.atr_multiplier
        
        if direction == "BUY":
            # Initial SL below entry
            volatility_sl = entry_price - volatility_buffer
            
            # If valid structure level provided (Support for Buy)
            if structure_level > 0 and structure_level < entry_price:
                # Place SL slightly below structure
                structure_sl = structure_level - (safe_atr * 0.5)
                # Take the lower (safer) one or the one that respects structure?
                # Usually standard practice: wider of the two to avoid wick-outs,
                # or structure-based if within reasonable risk limits.
                # Here we default to the volatility SL but widen if structure is close.
                final_sl = min(volatility_sl, structure_sl)
            else:
                final_sl = volatility_sl
                
        else: # SELL
            # Initial SL above entry
            volatility_sl = entry_price + volatility_buffer
            
            # If valid structure level provided (Resistance for Sell)
            if structure_level > entry_price:
                structure_sl = structure_level + (safe_atr * 0.5)
                final_sl = max(volatility_sl, structure_sl)
            else:
                final_sl = volatility_sl
                
        return float(final_sl)
        
    def calculate_sl_distance(self, entry_price: float, sl_price: float) -> float:
        """Calculate distance in points/pips."""
        return abs(entry_price - sl_price)
