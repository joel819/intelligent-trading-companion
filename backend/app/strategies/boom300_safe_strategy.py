"""
Boom 300 Safe Strategy
Specialized SELL-only strategy for Boom 300 Index.
"""

from typing import Dict, Optional
from collections import deque
from .base_strategy import BaseStrategy
from ..signals.ultra_fast_filter import ultra_fast_filter
import logging

logger = logging.getLogger(__name__)


class Boom300SafeStrategy(BaseStrategy):
    """Boom 300 Safe Strategy - SELL only."""

    def __init__(self):
        super().__init__("boom_300_safe", {
            "symbol": "BOOM300N",
            "direction": "SELL_ONLY",
            "description": "Safe Mode SELL-only for Boom 300",
            
            # Trend Rules
            "require_downtrend": True,  # EMA50 < EMA200
            "min_slope": -0.0001,       # Must be negative
            
            # RSI Rules (Pullback)
            "rsi_period": 14,
            "rsi_min": 60,              # Pullback area for SELL
            "rsi_max": 100,
            
            # ATR Rules
            "atr_period": 14,
            "max_atr_multiplier": 3.0,  # Avoid extreme volatility
            
            # Spike Protection
            "spike_lookback_ticks": 20, # Approx 3-4 candles
            "spike_threshold_pips": 5.0, # Sensitivity for spike detection
            
            # Output settings
            "tp_points": 60,
            "sl_points": 40,
            "sl_to_be_at": 20
        })
        
        # Internal history for spike checking
        # Store (price, timestamp)
        self.tick_history = deque(maxlen=50)

    def analyze(self, tick_data, engine, structure_data, indicator_data, h1_candles=None) -> Optional[Dict]:
        """
        Analyze logic for Boom 300 Safe Mode using MasterEngine.
        """
        # 1. Update Internal History
        price = float(tick_data.get('quote', 0))
        self.tick_history.append(price)
        
        if len(self.tick_history) < 20:
            return None
            
        rsi = indicator_data.get('rsi', 50)
        ma_trend = indicator_data.get('ma_trend', 'neutral')
        ma_slope = indicator_data.get('ma_slope', 0)
        
        # MasterEngine status
        volatility_state = engine.get_volatility("1m")
        candles_1m = list(engine.candles_1m)
        market_mode = engine.detect_market_mode(candles_1m)
        noise_detected = engine.detect_noise(candles_1m)
        
        # === PRE-CHECKS ===
        if noise_detected or market_mode == "chaotic":
            return None
        
        # === RULE 1: Trend Direction (SELL ONLY) ===
        if self.config["require_downtrend"]:
            if ma_trend != "bearish":
                return None
        
        # === RULE 2: Slope Negative ===
        if ma_slope >= self.config["min_slope"]:
             return None

        # === RULE 3: RSI HYBRID MODE FILTER (Replaces old RSI check) ===
        rsi_hybrid = None
        if hasattr(engine, 'indicator_layer'):
            rsi_hybrid = engine.indicator_layer.get_multi_rsi_confirmation("SELL")
        
        if rsi_hybrid and not rsi_hybrid.get("allow_sell", True):
            return None
            
        # === ULTRA-FAST ENTRY FILTER ===
        current_candle = candles_1m[-1] if candles_1m else None
        if current_candle:
            fast_filter = ultra_fast_filter.filter_entry(
                current_candle, 
                "SELL", 
                rsi_momentum_down=rsi_hybrid.get("momentum_down") if rsi_hybrid else None
            )
            if not fast_filter["allow_entry"]:
                logger.info(f"[BOOM300] SELL rejected by UltraFastFilter: {fast_filter['reason']}")
                return None
            
        # === RULE 4: Volatility ===
        if volatility_state == 'extreme':
            return None

        # === RULE 5: No spike in last 3 candles ===
        if self._has_recent_spike(threshold=self.config["spike_threshold_pips"]):
            return None
            
        # 3. Calculate Confidence via MasterEngine
        mtf_data = engine._analyze_mtf_trend()
        patterns = engine.detect_patterns(candles_1m)

        conf_data = {
            "signal_direction": "SELL",
            "patterns": patterns,
            "market_mode": market_mode,
            "mtf_trend": mtf_data,
            "volatility": volatility_state,
            "momentum": rsi
        }
        
        smart_confidence = engine.calculate_confidence(conf_data)
        
        # Apply RSI Hybrid Mode confidence modifier
        if rsi_hybrid:
            smart_confidence += rsi_hybrid.get("confidence_modifier", 0) * 100
        
        if smart_confidence < 40:
            return None

        # --- Dynamic SL/TP Calculation ---
        import numpy as np
        closes = np.array([c['close'] for c in candles_1m])
        highs = np.array([c['high'] for c in candles_1m])
        lows = np.array([c['low'] for c in candles_1m])
        
        curr_atr = 0.0
        if len(closes) > 15:
            tr1 = highs[1:] - lows[1:]
            tr2 = np.abs(highs[1:] - closes[:-1])
            tr3 = np.abs(lows[1:] - closes[:-1])
            tr = np.maximum(tr1, np.maximum(tr2, tr3))
            curr_atr = np.mean(tr[-14:])
            
        sl_dist, tp_dist = self.calculate_sl_tp(price, curr_atr, "SELL", rr_ratio=1.5)
        logger.info(f"[BOOM300] Dynamic Sizing: ATR={curr_atr:.3f} -> SL={sl_dist}, TP={tp_dist}")

        return {
            "action": "SELL",
            "tp": tp_dist,
            "sl": sl_dist,
            "confidence": smart_confidence,
            "market_mode": market_mode,
            "strategy": self.name
        }

    def _has_recent_spike(self, threshold: float) -> bool:
        """Check if there was a positive price jump > threshold in recent history."""
        # Look back approx 20 ticks
        history = list(self.tick_history)[-self.config["spike_lookback_ticks"]:]
        if len(history) < 2:
            return False
            
        for i in range(1, len(history)):
            prev = history[i-1]
            curr = history[i]
            delta = curr - prev
            # Boom spike is UP (positive delta)
            if delta > threshold:
                return True
        return False
