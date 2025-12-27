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
    
    def calculate_v10_sl(self, 
                        entry_price: float, 
                        direction: str, 
                        points_offset: float = 8.5) -> float:
        """
        Calculate V10-specific Stop Loss with fixed point range.
        
        Args:
            entry_price: Entry price
            direction: "BUY" or "SELL"
            points_offset: SL distance in points (default 8.5, range 7-10)
            
        Returns:
            Stop Loss Price
        """
        # V10 uses tighter SL: 7-10 points
        # Convert points to price (for 5-decimal forex, 1 point = 0.0001)
        sl_distance = points_offset * 0.0001
        
        if direction == "BUY":
            sl_price = entry_price - sl_distance
        else:  # SELL
            sl_price = entry_price + sl_distance
            
        logger.debug(f"[V10 SL] {direction} @ {entry_price:.5f} -> SL @ {sl_price:.5f} ({points_offset} points)")
        return float(sl_price)
    
    def calculate_boom300_sl(self, 
                            entry_price: float, 
                            direction: str = "SELL", 
                            points_offset: float = 7.5) -> float:
        """
        Calculate Boom 300-specific Stop Loss with fixed point range.
        
        Args:
            entry_price: Entry price
            direction: "BUY" or "SELL" (default SELL for Boom 300)
            points_offset: SL distance in points (default 7.5, range 6-9)
            
        Returns:
            Stop Loss Price
        """
        # Boom 300 uses tight SL: 6-9 points (above pullback for SELL)
        # Convert points to price (for 5-decimal forex, 1 point = 0.0001)
        sl_distance = points_offset * 0.0001
        
        if direction == "BUY":
            sl_price = entry_price - sl_distance
        else:  # SELL (primary for Boom 300)
            sl_price = entry_price + sl_distance  # Above entry
            
        logger.debug(f"[BOOM300 SL] {direction} @ {entry_price:.5f} -> SL @ {sl_price:.5f} ({points_offset} points)")
        return float(sl_price)
    
    def calculate_crash300_sl(self, 
                             entry_price: float, 
                             direction: str = "BUY", 
                             points_offset: float = 7.5) -> float:
        """
        Calculate Crash 300-specific Stop Loss (inverse of Boom 300).
        
        Args:
            entry_price: Entry price
            direction: "BUY" or "SELL" (default BUY for Crash 300)
            points_offset: SL distance in points (default 7.5, range 6-9)
            
        Returns:
            Stop Loss Price
        """
        # Crash 300 uses tight SL: 6-9 points (below pullback for BUY)
        sl_distance = points_offset * 0.0001
        
        if direction == "BUY":  # Primary for Crash 300
            sl_price = entry_price - sl_distance  # Below entry
        else:  # SELL
            sl_price = entry_price + sl_distance
            
        logger.debug(f"[CRASH300 SL] {direction} @ {entry_price:.5f} -> SL @ {sl_price:.5f} ({points_offset} points)")
        return float(sl_price)
        
    def calculate_sl_distance(self, entry_price: float, sl_price: float) -> float:
        """Calculate distance in points/pips."""
        return abs(entry_price - sl_price)
