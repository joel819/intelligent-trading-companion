"""
Crash 300 Super Safe Strategy
Specialized BUY-only strategy for Crash 300 Index spike-catching.

This strategy is the inverse of Boom 300:
- Catches pullbacks after downward crashes
- Bullish rejection candle detection (long lower wicks)
- Uptrend confirmation
- Safe BUY entries near MA support levels
"""

from typing import Dict, Optional
from .base_strategy import BaseStrategy
import logging

logger = logging.getLogger(__name__)


class Crash300SuperSafeStrategy(BaseStrategy):
    """Crash 300 Super Safe Strategy - BUY-only spike-catching."""
    
    def __init__(self):
        super().__init__("crash300_super_safe", {
            # Market Settings
            "symbol": "CRASH300N",
            "direction": "BUY_ONLY",
            "timeframe": "1m",
            "confirm_timeframe": "5m",
            "max_active_positions": 1,
            "min_pause_minutes": 10,
            "max_pause_minutes": 15,
            
            # Volatility & Noise Filters
            "min_volatility": 0.20,
            "max_volatility": 1.60,
            "noise_threshold": 0.22,
            "max_lower_wick_pct": 0.70,  # Bullish rejection threshold
            
            # Trend Filter (Uptrend for BUY)
            "use_ma_trend": True,
            "ma_fast": 20,
            "ma_slow": 50,
            "require_uptrend": True,  # MA20 > MA50
            "min_ma_slope": 0.02,  # Avoid ranging
            "adx_threshold": 14,
            "rsi_min": 44,
            "rsi_max": 60,
            
            # Entry Logic (Pullback + Bullish Rejection)
            "rsi_period": 14,
            "rsi_buy_min": 44,
            "rsi_buy_max": 60,
            "require_macd_upward": True,
            "require_rejection_candle": True,
            "pullback_to_ma": True,  # Entry near MA20 or MA50
            
            # Risk Management
            "sl_points_min": 6,
            "sl_points_max": 9,
            "tp_points_min": 10,
            "tp_points_max": 18,
            "breakeven_trigger_points": 7,
            "trailing_trigger_points": 10,
            
            # Lot Sizing
            "stake_low_balance": 0.35,
            "stake_default": 0.70,
            "stake_high_balance": 1.2,
            "balance_threshold_low": 20,
            "balance_threshold_high": 50,
            
            # Cooldown
            "cooldown_win": 720,  # 12 minutes
            "cooldown_loss": 1200,  # 20 minutes
            "cooldown_consecutive_losses": 2700,  # 45 minutes
        })
        
    def analyze(self, tick_data, regime_data, structure_data, indicator_data) -> Optional[Dict]:
        """
        Analyze market for Crash 300 spike-catch opportunities.
        
        BUY-ONLY strategy focusing on:
        1. Pullback into MA levels after crash
        2. Bullish rejection candle formation (long lower wick)
        3. Uptrend confirmation
        4. Safe entry conditions
        
        Args:
            tick_data: Current tick information
            regime_data: Market regime data
            structure_data: Market structure analysis
            indicator_data: Technical indicators
            
        Returns:
            BUY signal or None
        """
        # Extract key metrics
        rsi = indicator_data.get('rsi', 50)
        macd_hist = indicator_data.get('macd_hist', 0)
        macd_line = indicator_data.get('macd_line', 0)
        macd_signal = indicator_data.get('macd_signal', 0)
        ma_trend = indicator_data.get('ma_trend', 'neutral')
        ma_slope = indicator_data.get('ma_slope', 0)
        adx = indicator_data.get('adx', 0)
        
        structure_trend = structure_data.get('trend', 'neutral')
        structure_score = structure_data.get('score', 50)
        
        price = float(tick_data.get('quote', 0))
        high = float(tick_data.get('high', price))
        low = float(tick_data.get('low', price))
        open_price = float(tick_data.get('open', price))
        
        # Calculate candle metrics
        candle_range = high - low
        candle_body = abs(price - open_price)
        upper_wick = high - max(price, open_price)
        lower_wick = min(price, open_price) - low
        
        # === FILTER 1: BUY-ONLY Strategy ===
        # We NEVER take SELL positions on Crash 300
        if ma_trend == "bearish":
            logger.debug(f"[CRASH300] Trade rejected: Bearish trend (only BUY allowed)")
            return None
        
        # === FILTER 2: Uptrend Confirmation ===
        # Require MA20 > MA50 for spike-catch opportunities
        if self.config["require_uptrend"] and ma_trend != "bullish":
            logger.debug(f"[CRASH300] Trade rejected: Not in uptrend (MA trend: {ma_trend})")
            return None
        
        # === FILTER 3: Avoid Ranging Markets ===
        if abs(ma_slope) < self.config["min_ma_slope"]:
            logger.debug(f"[CRASH300] Trade rejected: Ranging market (MA slope: {ma_slope:.5f})")
            return None
        
        # === FILTER 4: ADX Trend Strength ===
        if adx < self.config["adx_threshold"]:
            logger.debug(f"[CRASH300] Trade rejected: Weak trend (ADX: {adx:.1f})")
            return None
        
        # === FILTER 5: RSI Range Check ===
        if not (self.config["rsi_min"] <= rsi <= self.config["rsi_max"]):
            logger.debug(f"[CRASH300] Trade rejected: RSI out of range ({rsi:.1f}, need {self.config['rsi_min']}-{self.config['rsi_max']})")
            return None
        
        # === FILTER 6: Bullish Rejection Candle Detection ===
        if self.config["require_rejection_candle"] and candle_range > 0:
            body_pct = candle_body / candle_range if candle_range > 0 else 0
            lower_wick_pct = lower_wick / candle_range if candle_range > 0 else 0
            
            # Bullish rejection candle = small body + long lower wick
            # Lower wick should be >70% of candle
            if lower_wick_pct < self.config["max_lower_wick_pct"]:
                logger.debug(
                    f"[CRASH300] Trade rejected: No bullish rejection candle "
                    f"(lower wick: {lower_wick_pct:.1%}, need >{self.config['max_lower_wick_pct']:.1%})"
                )
                return None
                
            # Body should be small (indicating rejection, not strong bullish)
            if body_pct > 0.40:  # Body >40% is too large for rejection
                logger.debug(f"[CRASH300] Trade rejected: Candle body too large ({body_pct:.1%})")
                return None
        
        # === FILTER 7: Pullback to MA Levels ===
        if self.config["pullback_to_ma"]:
            # Check if price is near MA20 or MA50
            # We use structure_score as proxy (higher = near resistance)
            if structure_score < 55:  # Not near resistance/support
                logger.debug(f"[CRASH300] Trade rejected: Not near MA support (structure: {structure_score:.1f})")
                return None
        
        # === ENTRY LOGIC: BUY CONDITIONS ===
        if (ma_trend == "bullish" and 
            ma_slope > self.config["min_ma_slope"]):
            
            # Check RSI range for BUY (already checked above but explicit here)
            if not (self.config["rsi_buy_min"] <= rsi <= self.config["rsi_buy_max"]):
                logger.debug(f"[CRASH300] BUY rejected: RSI out of range ({rsi:.1f})")
                return None
            
            # Check MACD upward cross
            if self.config["require_macd_upward"]:
                # MACD histogram should be positive or turning positive
                if macd_hist < 0:
                    logger.debug(f"[CRASH300] BUY rejected: MACD not bullish ({macd_hist:.6f})")
                    return None
                
                # MACD line should be crossing up through signal
                if macd_line < macd_signal:
                    logger.debug(f"[CRASH300] BUY rejected: MACD not crossed up")
                    return None
            
            # All conditions met for BUY
            confidence = self._calculate_confidence(
                structure_score, rsi, macd_hist, lower_wick_pct if candle_range > 0 else 0
            )
            
            logger.info(
                f"[CRASH300_SUPER_SAFE] BUY Signal | "
                f"Trend: bullish | MA Slope: {ma_slope:.5f} | ADX: {adx:.1f} | "
                f"RSI: {rsi:.1f} | MACD: {macd_hist:+.6f} | "
                f"Rejection Wick: {(lower_wick_pct if candle_range > 0 else 0):.1%} | "
                f"Structure: {structure_score:.1f} | Confidence: {confidence:.2f}"
            )
            
            return {
                "action": "BUY",
                "confidence": confidence,
                "strategy": self.name,
                "details": {
                    "trend": "bullish",
                    "ma_slope": ma_slope,
                    "adx": adx,
                    "rsi": rsi,
                    "macd_hist": macd_hist,
                    "structure_score": structure_score,
                    "lower_wick_pct": lower_wick_pct if candle_range > 0 else 0,
                    "entry_type": "crash_pullback_rejection"
                }
            }
        
        # No signal
        logger.debug(f"[CRASH300] No valid BUY setup found")
        return None
    
    def _calculate_confidence(
        self, structure_score: float, rsi: float, macd_hist: float, lower_wick_pct: float
    ) -> float:
        """
        Calculate signal confidence for Crash 300 BUY entries.
        
        Returns:
            Confidence score between 0.0 and 1.0
        """
        confidence = 0.5  # Base confidence
        
        # Higher structure score (near resistance turned support) = higher confidence
        if structure_score > 70:
            confidence += 0.25
        elif structure_score > 60:
            confidence += 0.15
        
        # RSI in sweet spot (not too high, not oversold)
        if 50 <= rsi <= 56:
            confidence += 0.15
        elif 44 <= rsi <= 60:
            confidence += 0.05
        
        # Strong MACD bullish signal
        if macd_hist > 0.0001:
            confidence += 0.15
        elif macd_hist > 0:
            confidence += 0.05
        
        # Rejection candle quality (bigger lower wick = better)
        if lower_wick_pct > 0.80:  # 80%+ wick
            confidence += 0.20
        elif lower_wick_pct > 0.70:  # 70%+ wick
            confidence += 0.10
        
        return min(0.95, max(0.20, confidence))
