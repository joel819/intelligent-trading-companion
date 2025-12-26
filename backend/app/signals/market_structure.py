"""
Market Structure Analysis
Detects Breaks of Structure (BOS), Internal BOS (iBOS), and Fair Value Gaps (FVG).

This module works on a tick stream, so it approximates candle behaviour using
recent ticks. The goal is to provide a *stable structure score* and clear
boolean flags that downstream components can consume.
"""

from typing import Dict
from collections import deque
import logging

logger = logging.getLogger(__name__)


class MarketStructure:
    """Analyzes price action for structure breaks and patterns."""

    def __init__(self, lookback: int = 5):
        # Number of points around a local extremum when approximating swings
        self.lookback = lookback
        self.highs = deque(maxlen=50)
        self.lows = deque(maxlen=50)
        self.closes = deque(maxlen=50)

        # State
        self.last_bos_high = 0.0
        self.last_bos_low = float("inf")
        self.structure_trend = "neutral"  # bullish, bearish, neutral

    def _detect_swings(self):
        """
        Very lightweight swing-high / swing-low detection on the closes buffer.

        Returns:
            (last_swing_high, last_swing_low)
        """
        closes = list(self.closes)
        if len(closes) < self.lookback * 2 + 3:
            return None, None

        last_high = None
        last_low = None
        window = self.lookback

        for i in range(window, len(closes) - window):
            left = closes[i - window : i]
            right = closes[i + 1 : i + 1 + window]
            pivot = closes[i]

            if pivot == max(left + [pivot] + right):
                last_high = pivot
            if pivot == min(left + [pivot] + right):
                last_low = pivot

        return last_high, last_low

    def _detect_fvg(self) -> bool:
        """
        Fair Value Gap (FVG) approximation using three synthetic "candles"
        built from recent closes. In a pure tick stream this is heuristic,
        but it still gives a useful structural signal.
        """
        closes = list(self.closes)
        if len(closes) < 9:
            return False

        # Build 3 pseudo‑candles (each from small chunk of closes)
        chunk = len(closes) // 3
        c1 = closes[:chunk]
        c2 = closes[chunk : 2 * chunk]
        c3 = closes[2 * chunk :]

        if not c1 or not c2 or not c3:
            return False

        h1, l1 = max(c1), min(c1)
        h2, l2 = max(c2), min(c2)
        h3, l3 = max(c3), min(c3)

        # Bullish FVG: candle1 high < candle3 low (gap up)
        if h1 < l3 and h2 > h1 and h2 > h3:
            return True
        # Bearish FVG: candle1 low > candle3 high (gap down)
        if l1 > h3 and l2 < l1 and l2 < l3:
            return True

        return False

    def analyze(self, tick_data: Dict) -> Dict:
        """
        Analyze new tick data for market structure.

        Returns:
            Dictionary with structure analysis:
            {
              "score": 0‑100,
              "trend": "bullish"/"bearish"/"neutral",
              "bos_bull": bool,
              "bos_bear": bool,
              "ibos_bull": bool,
              "ibos_bear": bool,
              "fvg": bool
            }
        """
        price = float(tick_data.get("quote", 0.0))

        # For simplicity in tick-based system, treat ticks as closes/highs/lows.
        self.closes.append(price)
        self.highs.append(price)
        self.lows.append(price)

        if len(self.closes) < 10:
            return {
                "score": 50,
                "trend": "neutral",
                "bos_bull": False,
                "bos_bear": False,
                "ibos_bull": False,
                "ibos_bear": False,
                "fvg": False,
            }

        score = 50

        # --- 1. Trend via recent ranges ---
        recent_highs = list(self.highs)[-10:]
        recent_lows = list(self.lows)[-10:]

        recent_max = max(recent_highs)
        recent_min = min(recent_lows)

        if len(self.highs) >= 20:
            prev_highs = list(self.highs)[:-10]
            prev_lows = list(self.lows)[:-10]
            prev_max = max(prev_highs)
            prev_min = min(prev_lows)
        else:
            prev_max = recent_max
            prev_min = recent_min

        # --- 2. BOS (external structure) ---
        bos_bullish = False
        bos_bearish = False

        if recent_max > self.last_bos_high and self.last_bos_high > 0:
            bos_bullish = True

        if recent_min < self.last_bos_low and self.last_bos_low < float("inf"):
            bos_bearish = True

        # Update remembered extremes
        if recent_max > self.last_bos_high:
            self.last_bos_high = recent_max

        if recent_min < self.last_bos_low:
            self.last_bos_low = recent_min

        # --- 3. Internal BOS (iBOS) using swing structure ---
        swing_high, swing_low = self._detect_swings()
        ibos_bull = False
        ibos_bear = False

        if swing_high is not None and price > swing_high:
            # Price broke above recent internal swing high
            ibos_bull = True
        if swing_low is not None and price < swing_low:
            # Price broke below recent internal swing low
            ibos_bear = True

        # --- 4. FVG detection ---
        has_fvg = self._detect_fvg()

        # --- 5. Scoring / trend continuation ---
        if price > prev_max:
            score += 20
            self.structure_trend = "bullish"
        elif price < prev_min:
            score -= 20
            self.structure_trend = "bearish"

        if bos_bullish:
            score += 15
        if bos_bearish:
            score -= 15

        if ibos_bull:
            score += 10
        if ibos_bear:
            score -= 10

        if has_fvg:
            # FVG in direction of trend adds weight; opposite trend is a caution signal.
            if self.structure_trend == "bullish":
                score += 5
            elif self.structure_trend == "bearish":
                score -= 5

        score = max(0, min(100, score))

        return {
            "score": score,
            "trend": self.structure_trend,
            "bos_bull": bos_bullish,
            "bos_bear": bos_bearish,
            "ibos_bull": ibos_bull,
            "ibos_bear": ibos_bear,
            "fvg": has_fvg,
        }

    def reset(self):
        self.highs.clear()
        self.lows.clear()
        self.closes.clear()
        self.last_bos_high = 0.0
        self.last_bos_low = float("inf")
