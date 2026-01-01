"""
Ultra-Fast Entry Filter
Pre-entry filter designed specifically for scalping.
Runs AFTER RSI confirmation but BEFORE sending trade order.
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class UltraFastEntryFilter:
    """
    Ultra-fast pre-entry filter for scalping strategies.
    
    Rejection Rules:
    1. Indecision candle (body too small)
    2. Overextended candle (body too large)
    3. Spread < 20% of range
    4. Candle momentum disagrees with RSI direction
    5. Opposite wick > 2x body
    """
    
    # Configuration thresholds
    MIN_BODY_PCT = 0.15           # Minimum body as % of range (reject indecision)
    MAX_BODY_PCT = 0.85           # Maximum body as % of range (reject overextended)
    MIN_SPREAD_PCT = 0.20         # Minimum spread (close-open) as % of range
    MAX_OPPOSITE_WICK_RATIO = 2.0 # Maximum opposite wick as multiple of body
    
    def __init__(self):
        pass
    
    def filter_entry(
        self,
        candle: dict,
        direction: str,
        rsi_momentum_up: bool = None,
        rsi_momentum_down: bool = None
    ) -> dict:
        """
        Apply ultra-fast entry filter.
        
        Args:
            candle: Dict with 'open', 'high', 'low', 'close' keys
            direction: "BUY" or "SELL"
            rsi_momentum_up: True if RSI is increasing
            rsi_momentum_down: True if RSI is decreasing
            
        Returns:
            dict with allow_entry and reason
        """
        if not candle:
            return {"allow_entry": False, "reason": "No candle data"}
        
        try:
            open_price = float(candle.get('open', 0))
            high = float(candle.get('high', 0))
            low = float(candle.get('low', 0))
            close = float(candle.get('close', 0))
        except (TypeError, ValueError):
            return {"allow_entry": False, "reason": "Invalid candle data"}
        
        direction = direction.upper() if direction else "BUY"
        
        # Calculate candle metrics
        candle_range = high - low
        if candle_range <= 0:
            return {"allow_entry": False, "reason": "Invalid candle range (zero or negative)"}
        
        body = abs(close - open_price)
        body_pct = body / candle_range
        spread_pct = abs(close - open_price) / candle_range
        
        upper_wick = high - max(open_price, close)
        lower_wick = min(open_price, close) - low
        
        # Determine candle direction
        is_bullish_candle = close > open_price
        is_bearish_candle = close < open_price
        
        # === RULE 1: Reject indecision candle (body too small) ===
        if body_pct < self.MIN_BODY_PCT:
            reason = f"Indecision candle: body {body_pct*100:.1f}% < {self.MIN_BODY_PCT*100:.0f}% of range"
            logger.debug(f"[UltraFastFilter] REJECT: {reason}")
            return {"allow_entry": False, "reason": reason}
        
        # === RULE 2: Reject overextended candle (body too large) ===
        if body_pct > self.MAX_BODY_PCT:
            reason = f"Overextended candle: body {body_pct*100:.1f}% > {self.MAX_BODY_PCT*100:.0f}% of range"
            logger.debug(f"[UltraFastFilter] REJECT: {reason}")
            return {"allow_entry": False, "reason": reason}
        
        # === RULE 3: Reject if spread < 20% of range ===
        if spread_pct < self.MIN_SPREAD_PCT:
            reason = f"Low spread: {spread_pct*100:.1f}% < {self.MIN_SPREAD_PCT*100:.0f}% of range"
            logger.debug(f"[UltraFastFilter] REJECT: {reason}")
            return {"allow_entry": False, "reason": reason}
        
        # === RULE 4: Candle momentum must agree with RSI direction ===
        if direction == "BUY":
            # For BUY: candle should be bullish AND RSI momentum up
            if not is_bullish_candle:
                reason = "BUY rejected: candle is bearish (close < open)"
                logger.debug(f"[UltraFastFilter] REJECT: {reason}")
                return {"allow_entry": False, "reason": reason}
            
            if rsi_momentum_up is not None and not rsi_momentum_up:
                reason = "BUY rejected: RSI momentum is not up"
                logger.debug(f"[UltraFastFilter] REJECT: {reason}")
                return {"allow_entry": False, "reason": reason}
        
        elif direction == "SELL":
            # For SELL: candle should be bearish AND RSI momentum down
            if not is_bearish_candle:
                reason = "SELL rejected: candle is bullish (close > open)"
                logger.debug(f"[UltraFastFilter] REJECT: {reason}")
                return {"allow_entry": False, "reason": reason}
            
            if rsi_momentum_down is not None and not rsi_momentum_down:
                reason = "SELL rejected: RSI momentum is not down"
                logger.debug(f"[UltraFastFilter] REJECT: {reason}")
                return {"allow_entry": False, "reason": reason}
        
        # === RULE 5: Reject if opposite wick > 2x body ===
        if body > 0:
            if direction == "BUY":
                # For BUY: lower wick (bearish rejection) is opposite
                if lower_wick > self.MAX_OPPOSITE_WICK_RATIO * body:
                    reason = f"BUY rejected: lower wick ({lower_wick:.4f}) > 2x body ({body:.4f})"
                    logger.debug(f"[UltraFastFilter] REJECT: {reason}")
                    return {"allow_entry": False, "reason": reason}
            
            elif direction == "SELL":
                # For SELL: upper wick (bullish rejection) is opposite
                if upper_wick > self.MAX_OPPOSITE_WICK_RATIO * body:
                    reason = f"SELL rejected: upper wick ({upper_wick:.4f}) > 2x body ({body:.4f})"
                    logger.debug(f"[UltraFastFilter] REJECT: {reason}")
                    return {"allow_entry": False, "reason": reason}
        
        # All checks passed
        logger.info(f"[UltraFastFilter] {direction} ALLOWED: body={body_pct*100:.1f}%, spread={spread_pct*100:.1f}%")
        return {
            "allow_entry": True,
            "reason": "All ultra-fast filter checks passed",
            "metrics": {
                "body_pct": body_pct,
                "spread_pct": spread_pct,
                "upper_wick": upper_wick,
                "lower_wick": lower_wick,
                "is_bullish": is_bullish_candle
            }
        }


# Singleton instance for easy import
ultra_fast_filter = UltraFastEntryFilter()
