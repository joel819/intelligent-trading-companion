"""
V10 Super Safe Strategy
Specialized strategy for Volatility 10 Index with Super Safe Mode.

This strategy is optimized for V10's smoother price action with:
- Stricter entry conditions (3 confirmations)
- Tighter SL/TP for V10's movement characteristics
- Enhanced trend filtering with MA slope and ADX
- Wick spike rejection for cleaner entries
"""

from typing import Dict, Optional
from .base_strategy import BaseStrategy
import logging

logger = logging.getLogger(__name__)


class V10SuperSafeStrategy(BaseStrategy):
    """V10 Super Safe Strategy optimized for Volatility 10 Index."""
    
    def __init__(self):
        super().__init__("v10_super_safe", {
            # Market Settings
            "symbol": "VOLATILITY_10",
            "timeframe": "1m",
            "confirm_timeframe": "5m",
            "max_trades_per_signal": 1,
            "min_pause_minutes": 8,
            "max_pause_minutes": 12,
            
            # Volatility Filters (V10-specific)
            "min_volatility": 0.25,
            "max_volatility": 1.20,
            "noise_threshold": 0.18,
            "min_candle_body_pct": 0.55,  # 55% of full candle
            "max_wick_pct": 0.65,  # 65% max wick size
            
            # Trend Filter
            "use_ma_trend": True,
            "ma_fast": 20,
            "ma_slow": 50,
            "min_ma_slope": 0.03,  # Absolute slope
            "adx_threshold": 15,
            "sideways_slope_threshold": 0.005,
            
            # Entry Logic
            "rsi_period": 14,
            "rsi_buy_min": 48,
            "rsi_buy_max": 62,
            "rsi_sell_min": 38,
            "rsi_sell_max": 55,
            "require_macd_confirmation": True,
            "reject_wick_spikes": True,
            
            # Risk Management
            "sl_points_min": 7,
            "sl_points_max": 10,
            "tp_points_min": 10,
            "tp_points_max": 18,
            "target_rr": 1.4,
            "breakeven_trigger_points": 6,
            "trailing_trigger_points": 9,
            
            # Lot Sizing
            "stake_default": 1.0,
            "stake_low_balance": 0.5,
            "stake_high_balance": 1.5,
            "balance_threshold_low": 20,
            "balance_threshold_high": 50,
            
            # Cooldown
            "cooldown_win_min": 480,  # 8 minutes
            "cooldown_win_max": 720,  # 12 minutes
            "cooldown_loss_min": 900,  # 15 minutes
            "cooldown_loss_max": 1200,  # 20 minutes
            "cooldown_consecutive_losses": 3000,  # 50 minutes
        })
        
    def analyze(self, tick_data, regime_data, structure_data, indicator_data) -> Optional[Dict]:
        """
        Analyze market conditions and generate V10 Super Safe signals.
        
        Args:
            tick_data: Current tick information
            regime_data: Market regime (volatility, state)
            structure_data: Market structure analysis
            indicator_data: Technical indicators (RSI, MACD, MA)
            
        Returns:
            Signal dictionary with action, confidence, and details, or None
        """
        # Extract key metrics
        rsi = indicator_data.get('rsi', 50)
        macd_hist = indicator_data.get('macd_hist', 0)
        ma_trend = indicator_data.get('ma_trend', 'neutral')
        ma_slope = indicator_data.get('ma_slope', 0)
        adx = indicator_data.get('adx', 0)
        
        structure_trend = structure_data.get('trend', 'neutral')
        structure_score = structure_data.get('score', 50)
        
        price = float(tick_data.get('quote', 0))
        high = float(tick_data.get('high', price))
        low = float(tick_data.get('low', price))
        
        # Calculate candle metrics
        candle_range = high - low
        candle_body = abs(price - tick_data.get('open', price))
        
        # === FILTER 1: Volatility Checks (handled by VolatilityFilter externally) ===
        # We assume volatility_filter.is_valid() has already passed
        
        # === FILTER 2: Trend Validation ===
        # Check if we're in a clear trend (not sideways)
        if abs(ma_slope) < self.config["sideways_slope_threshold"]:
            logger.debug(f"[V10] Trade rejected: Sideways market (MA slope: {ma_slope:.5f})")
            return None
            
        # Check ADX for trend strength
        if adx < self.config["adx_threshold"]:
            logger.debug(f"[V10] Trade rejected: Weak trend (ADX: {adx:.1f})")
            return None
            
        # Check MA slope magnitude
        if abs(ma_slope) < self.config["min_ma_slope"]:
            logger.debug(f"[V10] Trade rejected: MA slope too flat ({ma_slope:.5f})")
            return None
        
        # === FILTER 3: Candle Quality ===
        if self.config["reject_wick_spikes"] and candle_range > 0:
            body_pct = candle_body / candle_range if candle_range > 0 else 0
            
            # Reject if candle body is too small
            if body_pct < self.config["min_candle_body_pct"]:
                logger.debug(f"[V10] Trade rejected: Candle body too small ({body_pct:.1%})")
                return None
                
            # Check for wick spikes
            upper_wick = high - max(price, tick_data.get('open', price))
            lower_wick = min(price, tick_data.get('open', price)) - low
            max_wick = max(upper_wick, lower_wick)
            max_wick_pct = max_wick / candle_range if candle_range > 0 else 0
            
            if max_wick_pct > self.config["max_wick_pct"]:
                logger.debug(f"[V10] Trade rejected: Wick spike detected ({max_wick_pct:.1%})")
                return None
        
        # === ENTRY LOGIC: BUY CONDITIONS ===
        if (ma_trend == "bullish" and 
            structure_trend == "bullish" and 
            ma_slope > self.config["min_ma_slope"]):
            
            # Check RSI range for BUY
            if not (self.config["rsi_buy_min"] <= rsi <= self.config["rsi_buy_max"]):
                logger.debug(f"[V10] BUY rejected: RSI out of range ({rsi:.1f})")
                return None
                
            # Check MACD histogram turning positive
            if self.config["require_macd_confirmation"] and macd_hist <= 0:
                logger.debug(f"[V10] BUY rejected: MACD not positive ({macd_hist:.6f})")
                return None
                
            # Check for upper wick spike on previous candle (additional safety)
            # This would ideally check previous candle data, but we'll check current
            if tick_data.get('open', price) > price:  # Bearish candle
                logger.debug(f"[V10] BUY rejected: Current candle is bearish")
                return None
            
            # All conditions met for BUY
            confidence = self._calculate_confidence(structure_score, rsi, macd_hist, "BUY")
            
            logger.info(
                f"[V10_SUPER_SAFE] BUY Signal | "
                f"Trend: bullish | MA Slope: {ma_slope:.5f} | ADX: {adx:.1f} | "
                f"RSI: {rsi:.1f} | MACD: {macd_hist:+.6f} | "
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
                    "entry_type": "breakout_above_structure"
                }
            }
        
        # === ENTRY LOGIC: SELL CONDITIONS ===
        if (ma_trend == "bearish" and 
            structure_trend == "bearish" and 
            ma_slope < -self.config["min_ma_slope"]):
            
            # Check RSI range for SELL
            if not (self.config["rsi_sell_min"] <= rsi <= self.config["rsi_sell_max"]):
                logger.debug(f"[V10] SELL rejected: RSI out of range ({rsi:.1f})")
                return None
                
            # Check MACD histogram turning negative
            if self.config["require_macd_confirmation"] and macd_hist >= 0:
                logger.debug(f"[V10] SELL rejected: MACD not negative ({macd_hist:.6f})")
                return None
                
            # Check for lower wick spike on previous candle
            if tick_data.get('open', price) < price:  # Bullish candle
                logger.debug(f"[V10] SELL rejected: Current candle is bullish")
                return None
            
            # All conditions met for SELL
            confidence = self._calculate_confidence(structure_score, rsi, macd_hist, "SELL")
            
            logger.info(
                f"[V10_SUPER_SAFE] SELL Signal | "
                f"Trend: bearish | MA Slope: {ma_slope:.5f} | ADX: {adx:.1f} | "
                f"RSI: {rsi:.1f} | MACD: {macd_hist:+.6f} | "
                f"Structure: {structure_score:.1f} | Confidence: {confidence:.2f}"
            )
            
            return {
                "action": "SELL",
                "confidence": confidence,
                "strategy": self.name,
                "details": {
                    "trend": "bearish",
                    "ma_slope": ma_slope,
                    "adx": adx,
                    "rsi": rsi,
                    "macd_hist": macd_hist,
                    "structure_score": structure_score,
                    "entry_type": "breakout_below_structure"
                }
            }
        
        # No clear signal
        return None
    
    def _calculate_confidence(self, structure_score: float, rsi: float, macd_hist: float, direction: str) -> float:
        """
        Calculate signal confidence based on indicator alignment.
        
        Returns:
            Confidence score between 0.0 and 1.0
        """
        confidence = 0.5  # Base confidence
        
        if direction == "BUY":
            # Higher structure score = more confidence
            if structure_score > 70:
                confidence += 0.2
            elif structure_score > 60:
                confidence += 0.1
                
            # RSI in sweet spot
            if 50 <= rsi <= 58:
                confidence += 0.15
                
            # Strong MACD
            if macd_hist > 0.0001:
                confidence += 0.15
                
        else:  # SELL
            # Lower structure score = more confidence
            if structure_score < 30:
                confidence += 0.2
            elif structure_score < 40:
                confidence += 0.1
                
            # RSI in sweet spot
            if 42 <= rsi <= 50:
                confidence += 0.15
                
            # Strong MACD
            if macd_hist < -0.0001:
                confidence += 0.15
        
        return min(0.95, max(0.10, confidence))
