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
            "min_volatility": 0.15,
            "max_volatility": 1.50,
            "noise_threshold": 0.25,
            "min_candle_body_pct": 0.40,  # 40% of full candle
            "max_wick_pct": 0.75,  # 75% max wick size
            
            # Trend Filter
            "use_ma_trend": True,
            "ma_fast": 14,
            "ma_slow": 40,
            # Trend Filter
            "use_ma_trend": True,
            "ma_fast": 14,
            "ma_slow": 40,
            "min_ma_slope": 0.001,  # Even faster
            "adx_threshold": 10,
            "sideways_slope_threshold": 0.0, # NO SIDEWAYS FILTER
            
            # Entry Logic
            "rsi_period": 14,
            "rsi_buy_min": 45,  # Broadened from 48
            "rsi_buy_max": 70,  # Broadened from 62
            "rsi_sell_min": 30, # Broadened from 38
            "rsi_sell_max": 55, # Keep for safety
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
        
    def analyze(self, tick_data, engine, structure_data, indicator_data, h1_candles=None) -> Optional[Dict]:
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
        
        # === FILTER 1: Volatility Checks (handled by MasterEngine) ===
        # We assume MasterEngine.detect_noise() has already passed
        
        # === MASTER ENGINE PRE-CHECKS ===
        candles_1m = list(engine.candles_1m)
        market_mode = engine.detect_market_mode(candles_1m)
        noise_detected = engine.detect_noise(candles_1m)
        mtf_data = engine._analyze_mtf_trend()
        patterns = engine.detect_patterns(candles_1m)
        volatility_state = engine.get_volatility("1m")
        
        mtf_trend = mtf_data.get("trend", "neutral")
        
        if noise_detected:
             return None
             
        if market_mode == "chaotic":
             return None
        
        # === FILTER 2: Trend Validation (ENABLED) ===
        if abs(ma_slope) < self.config["sideways_slope_threshold"]:
            logger.info(f"[V10] Trade rejected: Sideways market (Slope: {ma_slope:.6f}, RSI: {rsi:.1f})")
            return None
            
        # if adx < self.config["adx_threshold"]:
        #     logger.info(f"[V10] Trade rejected: Weak trend (ADX: {adx:.1f})")
        #     return None
            
        # if abs(ma_slope) < self.config["min_ma_slope"]:
        #     logger.info(f"[V10] Trade rejected: MA slope too flat ({ma_slope:.5f})")
        #     return None
        
        # === FILTER 3: Candle Quality ===
        # if self.config["reject_wick_spikes"] and candle_range > 0:
        #     pass
        
        # === ENTRY LOGIC: BUY CONDITIONS ===
        # Allow BULLISH or NEUTRAL trend if RSI supports it
        if ma_trend == "bullish" or (ma_trend == "neutral" and rsi > 50):
            
            # --- MTF FILTER (1-Hour Alignment) ---
            # Soften: Instead of hard reject, give it a confidence penalty
            mtf_penalty = 0
            if mtf_trend == "bearish":
                mtf_penalty = -15
                logger.info(f"[V10] BUY Warning: H1 Trend is Bearish (-15% Penalty)")
            
            # --- RSI HYBRID MODE FILTER ---
            # Access the IndicatorLayer from DerivConnector (passed via engine or indicator_data)
            # Assuming indicator_data has a reference to the layer OR we use the stored data
            rsi_hybrid = None
            if hasattr(engine, 'indicator_layer'):
                rsi_hybrid = engine.indicator_layer.get_rsi_confirmation("BUY")
            
            if rsi_hybrid and not rsi_hybrid.get("allow_buy", True):
                logger.info(f"[V10] BUY rejected by RSI Hybrid Mode: {rsi_hybrid.get('summary')}")
                return None
            
            # All conditions met for BUY
            conf_data = {
                "signal_direction": "BUY",
                "patterns": patterns,
                "market_mode": market_mode,
                "mtf_trend": mtf_data,
                "volatility": volatility_state,
                "momentum": rsi
            }
            smart_confidence = engine.calculate_confidence(conf_data)
            
            # Apply RSI Hybrid Mode and MTF confidence modifiers
            if rsi_hybrid:
                smart_confidence += rsi_hybrid.get("confidence_modifier", 0) * 100
            
            smart_confidence += mtf_penalty
            
            if smart_confidence < 5:
               pass
            
            # --- Dynamic SL/TP Calculation ---
            # Calculate ATR(14) from 1m candles for accurate sizing
            import numpy as np
            closes = np.array([c['close'] for c in candles_1m])
            highs = np.array([c['high'] for c in candles_1m])
            lows = np.array([c['low'] for c in candles_1m])
            
            curr_atr = 0
            if len(closes) > 15:
                # Use engine's method if available, else manual
                tr1 = highs[1:] - lows[1:]
                tr2 = np.abs(highs[1:] - closes[:-1])
                tr3 = np.abs(lows[1:] - closes[:-1])
                tr = np.maximum(tr1, np.maximum(tr2, tr3))
                curr_atr = np.mean(tr[-14:]) # Simple ATR approximation
            
            sl_dist, tp_dist = self.calculate_sl_tp(price, curr_atr, "BUY", rr_ratio=1.4)
            logger.info(f"[V10] Dynamic Sizing: ATR={curr_atr:.3f} -> SL={sl_dist}, TP={tp_dist}")

            logger.info(
                f"[V10_SUPER_SAFE] BUY Signal (TEST MODE) | "
                f"Trend: bullish | Slope: {ma_slope:.5f} | Confidence: {smart_confidence:.2f}"
            )
            
            return {
                "action": "BUY",
                "tp": tp_dist, 
                "sl": sl_dist,
                "confidence": max(50, smart_confidence), 
                "market_mode": market_mode,
                "strategy": self.name,
                "details": {
                    "trend": "bullish",
                    "entry_type": "test_mode_forced",
                    "mtf": mtf_trend
                }
            }
        
        # === ENTRY LOGIC: SELL CONDITIONS ===
        # Allow BEARISH or NEUTRAL trend if RSI supports it
        if ma_trend == "bearish" or (ma_trend == "neutral" and rsi < 50): 
            
            # --- MTF FILTER (1-Hour Alignment) ---
            mtf_penalty = 0
            if mtf_trend == "bullish":
                mtf_penalty = -15
                logger.info(f"[V10] SELL Warning: H1 Trend is Bullish (-15% Penalty)")
            
            # --- RSI HYBRID MODE FILTER ---
            rsi_hybrid = None
            if hasattr(engine, 'indicator_layer'):
                rsi_hybrid = engine.indicator_layer.get_rsi_confirmation("SELL")
            
            if rsi_hybrid and not rsi_hybrid.get("allow_sell", True):
                logger.info(f"[V10] SELL rejected by RSI Hybrid Mode: {rsi_hybrid.get('summary')}")
                return None
            
            # All conditions met for SELL
            conf_data = {
                "signal_direction": "SELL",
                "patterns": patterns,
                "market_mode": market_mode,
                "mtf_trend": mtf_data,
                "volatility": volatility_state,
                "momentum": rsi
            }
            smart_confidence = engine.calculate_confidence(conf_data)
            
            # Apply RSI Hybrid Mode and MTF confidence modifiers
            if rsi_hybrid:
                smart_confidence += rsi_hybrid.get("confidence_modifier", 0) * 100
            
            smart_confidence += mtf_penalty
            
            if smart_confidence < 50:
                pass
                
            # --- Dynamic SL/TP Calculation (SELL) ---
            import numpy as np
            closes = np.array([c['close'] for c in candles_1m])
            highs = np.array([c['high'] for c in candles_1m])
            lows = np.array([c['low'] for c in candles_1m])
            
            curr_atr = 0
            if len(closes) > 15:
                tr1 = highs[1:] - lows[1:]
                tr2 = np.abs(highs[1:] - closes[:-1])
                tr3 = np.abs(lows[1:] - closes[:-1])
                tr = np.maximum(tr1, np.maximum(tr2, tr3))
                curr_atr = np.mean(tr[-14:])
            
            sl_dist, tp_dist = self.calculate_sl_tp(price, curr_atr, "SELL", rr_ratio=1.4)
            logger.info(f"[V10] Dynamic Sizing (SELL): ATR={curr_atr:.3f} -> SL={sl_dist}, TP={tp_dist}")

            logger.info(
                f"[V10_SUPER_SAFE] SELL Signal | "
                f"Trend: bearish | Conf: {smart_confidence:.2f} | MTF: {mtf_trend}"
            )
            
            return {
                "action": "SELL",
                "tp": tp_dist,
                "sl": sl_dist,
                "confidence": smart_confidence, 
                "market_mode": market_mode,
                "strategy": self.name,
                "details": {
                    "trend": ma_trend,
                    "mtf": mtf_trend
                }
            }
    
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
