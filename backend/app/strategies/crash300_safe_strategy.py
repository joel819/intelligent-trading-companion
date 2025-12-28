"""
Crash 300 Safe Strategy
Specialized BUY-only strategy for Crash 300 Index.
"""

from typing import Dict, Optional
from collections import deque
from .base_strategy import BaseStrategy
import logging

logger = logging.getLogger(__name__)


class Crash300SafeStrategy(BaseStrategy):
    """Crash 300 Safe Strategy - BUY only."""

    def __init__(self):
        super().__init__("crash_300_safe", {
            "symbol": "CRASH300N",
            "direction": "BUY_ONLY",
            "description": "Safe Mode BUY-only for Crash 300",
            
            # Trend Rules
            "require_uptrend": True,    # EMA50 > EMA200
            "min_slope": 0.0001,        # Must be positive
            
            # RSI Rules (Pullback)
            "rsi_period": 14,
            "rsi_max": 40,              # Pullback area for BUY (oversold)
            "rsi_min": 0,
            
            # ATR Rules
            "atr_period": 14,
            "max_atr_multiplier": 3.0,
            
            # Spike Protection
            "spike_lookback_ticks": 20,
            "spike_threshold_pips": 5.0,
            
            # Output settings
            "tp_points": 60,
            "sl_points": 40,
            "sl_to_be_at": 20
        })
        
        # Internal history
        self.tick_history = deque(maxlen=50)

    def analyze(self, tick_data, regime_data, structure_data, indicator_data) -> Optional[Dict]:
        """
        Analyze logic for Crash 300 Safe Mode.
        """
        # 1. Update Internal History
        price = float(tick_data.get('quote', 0))
        self.tick_history.append(price)
        
        if len(self.tick_history) < 20:
            return None
            
        # Indicators
        rsi = indicator_data.get('rsi', 50)
        ma_trend = indicator_data.get('ma_trend', 'neutral')
        ma_slope = indicator_data.get('ma_slope', 0)
        atr = regime_data.get('atr', 0)
        
        # === RULE 1: Trend Direction (BUY ONLY) ===
        # EMA50 > EMA200 -> Uptrend
        if self.config["require_uptrend"]:
            if ma_trend != "bullish":
                return None
        
        # === RULE 2: Slope Positive ===
        if ma_slope <= self.config["min_slope"]:
             return None

        # === RULE 3: RSI Pullback (RSI < 40) ===
        if rsi >= self.config["rsi_max"]:
            return None
            
        # === RULE 4: ATR Normal ===
        if regime_data.get('volatility') == 'extreme':
            return None

        # === RULE 5: No spike in last 3 candles ===
        # Crash spike is DOWN.
        if self._has_recent_spike(threshold=self.config["spike_threshold_pips"]):
            return None
            
        # === SMART ENGINE INTEGRATION ===
        candles = structure_data.get('candles', [])
        
        # 1. Detect Market Mode
        market_mode = self.smart_engine.detect_market_mode(candles)
        
        # 2. Check Noise / Chaos
        noise_detected = self.smart_engine.detect_noise(candles)
        
        if noise_detected or market_mode == "chaotic":
            # Strategies must STOP and return no trade if noise detected or chaotic
            return None

        # 3. Calculate Confidence via SmartEngine
        filters = {
            "trend_ok": ma_trend == "bullish" if self.config["require_uptrend"] else True,
            "momentum_ok": rsi < 40,  # Pullback condition
            "volatility_ok": regime_data.get('volatility') != 'extreme',
            "candle_ok": not self._has_recent_spike(threshold=self.config["spike_threshold_pips"]),
            "market_mode": market_mode
        }
        
        smart_confidence = self.smart_engine.calculate_confidence(filters)
        
        if smart_confidence < 40:
            return None

        return {
            "action": "buy",
            "tp": self.config["tp_points"],
            "sl": self.config["sl_points"],
            "confidence": smart_confidence,
            "market_mode": market_mode,
            "strategy": self.name
        }

    def _has_recent_spike(self, threshold: float) -> bool:
        """Check if there was a negative price drop > threshold in recent history."""
        history = list(self.tick_history)[-self.config["spike_lookback_ticks"]:]
        if len(history) < 2:
            return False
            
        for i in range(1, len(history)):
            prev = history[i-1]
            curr = history[i]
            delta = curr - prev
            # Crash spike is DOWN (negative delta). Check raw magnitude or just negative value check.
            # Delta is (curr - prev). Drop means negative delta.
            # We check if absolute drop is > threshold.
            if delta < -threshold:
                return True
        return False
