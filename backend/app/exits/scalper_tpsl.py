"""
Scalper TP/SL Module
Fast, simple TP/SL logic for scalping strategies.
No trailing stops, no multi-step exits - just quick in/out.
"""

import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class ScalperTPSL:
    """
    Scalper-specific TP/SL calculation.
    
    Rules:
    - TP = candle_range(1m) * 0.5 (small, fast target)
    - SL = candle_range(1m) * 0.8 (slightly wider than TP)
    - Breakeven: Move SL to entry when 60% toward TP
    
    For Boom/Crash indices:
    - TP = 2 to 4 ticks max
    - SL = 3 to 6 ticks max
    """
    
    # Boom/Crash specific limits (in ticks/points)
    BOOM_CRASH_TP_MIN = 2
    BOOM_CRASH_TP_MAX = 4
    BOOM_CRASH_SL_MIN = 3
    BOOM_CRASH_SL_MAX = 6
    
    # Breakeven trigger
    BREAKEVEN_TRIGGER_PCT = 0.60  # 60% toward TP
    
    def __init__(self):
        self.entry_price: Optional[float] = None
        self.tp_distance: Optional[float] = None
        self.sl_distance: Optional[float] = None
        self.trade_direction: Optional[str] = None
        self.is_boom_crash: bool = False
        self.breakeven_triggered: bool = False
    
    def is_boom_crash_symbol(self, symbol: str) -> bool:
        """Check if symbol is a Boom or Crash index."""
        if not symbol:
            return False
        symbol_upper = symbol.upper()
        return "BOOM" in symbol_upper or "CRASH" in symbol_upper
    
    def calculate_candle_range(self, candles: list) -> float:
        """
        Calculate average candle range from recent 1m candles.
        
        Args:
            candles: List of candle dicts with 'high' and 'low' keys
            
        Returns:
            Average candle range
        """
        if not candles or len(candles) < 1:
            return 0.0
        
        # Use last 5 candles for average range
        recent_candles = candles[-5:] if len(candles) >= 5 else candles
        
        ranges = []
        for candle in recent_candles:
            try:
                high = float(candle.get('high', 0))
                low = float(candle.get('low', 0))
                candle_range = high - low
                if candle_range > 0:
                    ranges.append(candle_range)
            except (TypeError, ValueError):
                continue
        
        if not ranges:
            return 0.0
        
        return sum(ranges) / len(ranges)
    
    def get_scalper_tp_sl(
        self,
        candles: list,
        symbol: str = None,
        direction: str = "BUY",
        entry_price: float = None
    ) -> dict:
        """
        Calculate scalper TP/SL distances.
        
        Args:
            candles: List of 1m candle dicts
            symbol: Trading symbol (to detect Boom/Crash)
            direction: "BUY" or "SELL"
            entry_price: Entry price for breakeven tracking
            
        Returns:
            dict with tp, sl, use_breakeven
        """
        self.is_boom_crash = self.is_boom_crash_symbol(symbol) if symbol else False
        self.trade_direction = direction.upper() if direction else "BUY"
        self.entry_price = entry_price
        self.breakeven_triggered = False
        
        candle_range = self.calculate_candle_range(candles)
        
        if self.is_boom_crash:
            # Boom/Crash: Use tick-based limits
            # TP = 2 to 4 ticks, SL = 3 to 6 ticks
            if candle_range > 0:
                # Scale within limits based on candle range
                tp = max(self.BOOM_CRASH_TP_MIN, min(self.BOOM_CRASH_TP_MAX, candle_range * 0.5))
                sl = max(self.BOOM_CRASH_SL_MIN, min(self.BOOM_CRASH_SL_MAX, candle_range * 0.8))
            else:
                # Default to middle of range
                tp = (self.BOOM_CRASH_TP_MIN + self.BOOM_CRASH_TP_MAX) / 2
                sl = (self.BOOM_CRASH_SL_MIN + self.BOOM_CRASH_SL_MAX) / 2
        else:
            # Standard: TP = candle_range * 0.5, SL = candle_range * 0.8
            if candle_range > 0:
                tp = candle_range * 0.5
                sl = candle_range * 0.8
            else:
                # Fallback minimum values
                tp = 0.5
                sl = 0.8
        
        self.tp_distance = tp
        self.sl_distance = sl
        
        logger.info(
            f"[ScalperTPSL] {symbol or 'Unknown'} | "
            f"Range={candle_range:.4f} → TP={tp:.4f}, SL={sl:.4f} | "
            f"Type={'Boom/Crash' if self.is_boom_crash else 'Standard'}"
        )
        
        return {
            "tp": tp,
            "sl": sl,
            "use_breakeven": True,
            "breakeven_trigger_pct": self.BREAKEVEN_TRIGGER_PCT,
            "is_boom_crash": self.is_boom_crash
        }
    
    def check_breakeven(self, current_price: float) -> dict:
        """
        Check if breakeven should be triggered.
        Move SL to entry when price moves 60% toward TP.
        
        Args:
            current_price: Current market price
            
        Returns:
            dict with should_move_sl, new_sl_price
        """
        if not self.entry_price or not self.tp_distance or self.breakeven_triggered:
            return {
                "should_move_sl": False,
                "new_sl_price": None,
                "reason": "Not applicable"
            }
        
        # Calculate how far price has moved toward TP
        if self.trade_direction == "BUY":
            price_move = current_price - self.entry_price
            required_move = self.tp_distance * self.BREAKEVEN_TRIGGER_PCT
            
            if price_move >= required_move:
                self.breakeven_triggered = True
                logger.info(
                    f"[ScalperTPSL] BREAKEVEN triggered: "
                    f"Price moved {price_move:.4f} (>= {required_move:.4f})"
                )
                return {
                    "should_move_sl": True,
                    "new_sl_price": self.entry_price,
                    "reason": f"Price moved {(price_move/self.tp_distance)*100:.1f}% toward TP"
                }
        
        elif self.trade_direction == "SELL":
            price_move = self.entry_price - current_price
            required_move = self.tp_distance * self.BREAKEVEN_TRIGGER_PCT
            
            if price_move >= required_move:
                self.breakeven_triggered = True
                logger.info(
                    f"[ScalperTPSL] BREAKEVEN triggered: "
                    f"Price moved {price_move:.4f} (>= {required_move:.4f})"
                )
                return {
                    "should_move_sl": True,
                    "new_sl_price": self.entry_price,
                    "reason": f"Price moved {(price_move/self.tp_distance)*100:.1f}% toward TP"
                }
        
        return {
            "should_move_sl": False,
            "new_sl_price": None,
            "reason": "Not yet at 60% toward TP"
        }
    
    def reset(self) -> None:
        """Reset module state for new trade."""
        self.entry_price = None
        self.tp_distance = None
        self.sl_distance = None
        self.trade_direction = None
        self.is_boom_crash = False
        self.breakeven_triggered = False


# Removed singleton instance to support multi-symbol instantiation
