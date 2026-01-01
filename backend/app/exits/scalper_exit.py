"""
Scalper Exit Module
Fast, instant exit logic for scalping strategies.
Does NOT override any existing exit logic - works alongside other exits.
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class ScalperExitModule:
    """
    Scalper-specific exit logic for fast exits.
    
    This module provides instant exit signals based on:
    - RSI momentum reversals (fastest exit)
    - Micro reversal candle patterns (wick > 2x body against trade)
    - Volatility collapse (RSI volatility becomes flat)
    
    IMPORTANT: This module does NOT override other exit systems.
    It works as an additional layer for scalping strategies.
    """
    
    def __init__(self, min_flip_delta: float = 0.5):
        self.last_momentum_direction: Optional[str] = None  # "up", "down", None
        self.entry_volatility_state: Optional[str] = None
        self.trade_direction: Optional[str] = None  # "BUY" or "SELL"
        self.min_flip_delta = min_flip_delta
        self.is_active = False
    
    def activate(self, trade_direction: str, initial_volatility_state: str = None) -> None:
        """
        Activate scalper exit monitoring for a new trade.
        
        Args:
            trade_direction: "BUY" or "SELL"
            initial_volatility_state: RSI volatility state at entry
        """
        self.trade_direction = trade_direction.upper()
        self.entry_volatility_state = initial_volatility_state
        self.last_momentum_direction = None
        self.is_active = True
        logger.info(f"[ScalperExit] Activated for {self.trade_direction} trade (Min Flip Delta: {self.min_flip_delta})")
    
    def deactivate(self) -> None:
        """Deactivate scalper exit monitoring."""
        self.is_active = False
        self.trade_direction = None
        self.last_momentum_direction = None
        self.entry_volatility_state = None
        logger.debug("[ScalperExit] Deactivated")
    
    def exit_on_rsi_flip(self, momentum_up: bool, momentum_down: bool, slope_value: float = 0.0) -> dict:
        """
        Exit if RSI(1m) momentum reverses direction (slope changes).
        Now includes a noise filter (min_flip_delta).
        
        Args:
            momentum_up: True if RSI is increasing
            momentum_down: True if RSI is decreasing
            slope_value: Current RSI slope (Current - Previous)
            
        Returns:
            dict with exit_now and reason
        """
        # Determine current momentum direction
        if momentum_up:
            current_direction = "up"
        elif momentum_down:
            current_direction = "down"
        else:
            current_direction = "flat"
        
        exit_now = False
        reason = None
        
        # Check for flip with noise filter
        if self.last_momentum_direction is not None and current_direction != "flat":
            if self.last_momentum_direction != current_direction:
                # Noise Filter: Only exit if the reversal is significant
                if abs(slope_value) >= self.min_flip_delta:
                    exit_now = True
                    reason = f"RSI momentum flipped from {self.last_momentum_direction} to {current_direction} | Δ={slope_value:.2f}"
                    logger.info(f"[ScalperExit] RSI FLIP detected: {reason}")
                else:
                    logger.debug(f"[ScalperExit] RSI flip ignored (noise): {self.last_momentum_direction} -> {current_direction} | Δ={slope_value:.2f}")
        
        # Update last direction for next check
        if current_direction != "flat":
            self.last_momentum_direction = current_direction
        
        return {
            "exit_now": exit_now,
            "trigger": "rsi_flip" if exit_now else None,
            "reason": reason
        }
    
    def exit_on_micro_reversal(self, candle: dict) -> dict:
        """
        Exit if a candle forms a wick > 2x body AGAINST the trade direction.
        
        Args:
            candle: Dict with 'open', 'high', 'low', 'close' keys
            
        Returns:
            dict with exit_now and reason
        """
        if not candle or not self.trade_direction:
            return {"exit_now": False, "trigger": None, "reason": None}
        
        try:
            open_price = float(candle.get('open', 0))
            high = float(candle.get('high', 0))
            low = float(candle.get('low', 0))
            close = float(candle.get('close', 0))
        except (TypeError, ValueError):
            return {"exit_now": False, "trigger": None, "reason": None}
        
        # Calculate body and wicks
        body = abs(close - open_price)
        if body == 0:
            body = 0.0001  # Avoid division by zero
        
        upper_wick = high - max(open_price, close)
        lower_wick = min(open_price, close) - low
        
        exit_now = False
        reason = None
        
        if self.trade_direction == "BUY":
            # For BUY trades, a large lower wick (bearish rejection) is against us
            if lower_wick > 2 * body:
                exit_now = True
                reason = f"Micro reversal: lower wick ({lower_wick:.4f}) > 2x body ({body:.4f})"
                logger.info(f"[ScalperExit] {reason}")
        
        elif self.trade_direction == "SELL":
            # For SELL trades, a large upper wick (bullish rejection) is against us
            if upper_wick > 2 * body:
                exit_now = True
                reason = f"Micro reversal: upper wick ({upper_wick:.4f}) > 2x body ({body:.4f})"
                logger.info(f"[ScalperExit] {reason}")
        
        return {
            "exit_now": exit_now,
            "trigger": "micro_reversal" if exit_now else None,
            "reason": reason
        }
    
    def exit_on_volatility_collapse(self, volatility_state: str) -> dict:
        """
        Exit if RSI(1m) volatility_state becomes "flat" after entry.
        
        Args:
            volatility_state: Current RSI volatility state ("flat", "normal", "expanding")
            
        Returns:
            dict with exit_now and reason
        """
        exit_now = False
        reason = None
        
        # Only trigger if we entered with non-flat volatility and it collapsed to flat
        if self.entry_volatility_state and self.entry_volatility_state != "flat":
            if volatility_state == "flat":
                exit_now = True
                reason = f"Volatility collapsed from {self.entry_volatility_state} to flat"
                logger.info(f"[ScalperExit] {reason}")
        
        return {
            "exit_now": exit_now,
            "trigger": "volatility_collapse" if exit_now else None,
            "reason": reason
        }
    
    def get_scalper_exit_decision(
        self,
        momentum_up: bool = False,
        momentum_down: bool = False,
        slope_value: float = 0.0,
        candle: dict = None,
        volatility_state: str = None
    ) -> dict:
        """
        Combine all scalper exit signals into a single decision.
        
        If ANY exit condition triggers → exit_now = true.
        No trailing, no adjustments, only instant exit.
        
        Args:
            momentum_up: RSI momentum is increasing
            momentum_down: RSI momentum is decreasing
            slope_value: Current RSI slope value
            candle: Current candle data
            volatility_state: Current RSI volatility state
            
        Returns:
            dict with:
                - exit_now: bool
                - triggers: list of triggered exit conditions
                - reasons: list of reasons for exit
        """
        if not self.is_active:
            return {
                "exit_now": False,
                "triggers": [],
                "reasons": [],
                "summary": "Scalper exit not active"
            }
        
        triggers = []
        reasons = []
        
        # Check RSI flip
        rsi_flip = self.exit_on_rsi_flip(momentum_up, momentum_down, slope_value=slope_value)
        if rsi_flip["exit_now"]:
            triggers.append(rsi_flip["trigger"])
            reasons.append(rsi_flip["reason"])
        
        # Check micro reversal
        if candle:
            micro_rev = self.exit_on_micro_reversal(candle)
            if micro_rev["exit_now"]:
                triggers.append(micro_rev["trigger"])
                reasons.append(micro_rev["reason"])
        
        # Check volatility collapse
        if volatility_state:
            vol_collapse = self.exit_on_volatility_collapse(volatility_state)
            if vol_collapse["exit_now"]:
                triggers.append(vol_collapse["trigger"])
                reasons.append(vol_collapse["reason"])
        
        exit_now = len(triggers) > 0
        
        summary = "NO EXIT"
        if exit_now:
            summary = f"EXIT NOW: {', '.join(triggers)}"
            logger.info(f"[ScalperExit] {summary}")
        
        return {
            "exit_now": exit_now,
            "triggers": triggers,
            "reasons": reasons,
            "summary": summary
        }


# Removed singleton instance to support multi-symbol instantiation
