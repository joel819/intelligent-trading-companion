"""
Volatility Filter
Filters out trading opportunities during unfavorable volatility conditions.

This covers:
- ATR based min / max thresholds
- ATR spike detection
- Micro‑consolidation
- Optional session timing filter (avoid dead periods)
"""

import numpy as np
from typing import Dict, Optional, Tuple
from collections import deque
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class VolatilityFilter:
    """Filters trades based on volatility and session conditions."""

    def __init__(
        self,
        min_atr_threshold: float = 0.0003,
        max_atr_threshold: float = 0.01,
        min_candle_body_pips: float = 5,
        atr_spike_multiplier: float = 3.0,
        history_size: int = 50,
        session_window: Optional[Tuple[int, int]] = None,
    ):
        """
        Initialize volatility filter.

        Args:
            min_atr_threshold: Minimum ATR to allow trading (too quiet)
            max_atr_threshold: Maximum ATR to allow trading (too volatile)
            min_candle_body_pips: Minimum candle body size in pips
            atr_spike_multiplier: Multiplier to detect ATR spikes
            history_size: Number of ticks to store
            session_window: Optional (start_hour, end_hour) 0‑23 local time.
                            If provided, trades outside this window are blocked.
        """
        self.min_atr_threshold = min_atr_threshold
        self.max_atr_threshold = max_atr_threshold
        self.min_candle_body_pips = min_candle_body_pips
        self.atr_spike_multiplier = atr_spike_multiplier

        # ATR history for spike detection
        self.atr_history = deque(maxlen=history_size)

        # Price history for candle analysis
        self.prices = deque(maxlen=history_size)
        self.highs = deque(maxlen=history_size)
        self.lows = deque(maxlen=history_size)

        # State
        self.current_atr = 0.0
        self.last_block_reason: Optional[str] = None

        # Session timing (dead period) control
        self.session_window: Optional[Tuple[int, int]] = session_window

    def set_session_window(self, start_hour: int, end_hour: int) -> None:
        """
        Configure the allowed trading session window.
        If start == end, window is treated as "disabled".
        """
        if start_hour == end_hour:
            self.session_window = None
        else:
            self.session_window = (start_hour, end_hour)

    def _is_in_session(self) -> bool:
        """Check current local time against configured session window."""
        if not self.session_window:
            return True

        start_hour, end_hour = self.session_window
        now_hour = datetime.now().hour

        if start_hour < end_hour:
            # Normal window, e.g. 8‑20
            return start_hour <= now_hour < end_hour
        else:
            # Overnight window, e.g. 20‑4
            return now_hour >= start_hour or now_hour < end_hour

    def is_valid(self, tick_data: Dict, current_atr: float) -> tuple[bool, Optional[str]]:
        """
        Check if current volatility conditions allow trading.

        Args:
            tick_data: Dictionary containing tick information
            current_atr: Current ATR value from regime detector

        Returns:
            Tuple of (is_valid, block_reason)
        """
        # Session timing filter
        if not self._is_in_session():
            reason = "Outside configured trading session window"
            self.last_block_reason = reason
            logger.debug(f"Trade blocked: {reason}")
            return False, reason

        self.current_atr = current_atr
        self.atr_history.append(current_atr)

        price = float(tick_data.get("quote", 0))
        high = float(tick_data.get("high", price))
        low = float(tick_data.get("low", price))

        self.prices.append(price)
        self.highs.append(high)
        self.lows.append(low)

        # Check 1: ATR too low (market too quiet)
        if current_atr < self.min_atr_threshold:
            reason = f"ATR too low ({current_atr:.6f} < {self.min_atr_threshold})"
            self.last_block_reason = reason
            logger.debug(f"Trade blocked: {reason}")
            return False, reason

        # Check 2: ATR too high (market too volatile)
        if current_atr > self.max_atr_threshold:
            reason = f"ATR too high ({current_atr:.6f} > {self.max_atr_threshold})"
            self.last_block_reason = reason
            logger.debug(f"Trade blocked: {reason}")
            return False, reason

        # Check 3: ATR spike detection (sudden volatility expansion)
        if len(self.atr_history) >= 10:
            avg_atr = np.mean(list(self.atr_history)[:-1])  # Exclude current
            if current_atr > avg_atr * self.atr_spike_multiplier:
                reason = (
                    f"ATR spike detected ({current_atr:.6f} > "
                    f"{avg_atr * self.atr_spike_multiplier:.6f})"
                )
                self.last_block_reason = reason
                logger.warning(f"Trade blocked: {reason}")
                return False, reason

        # Check 4: Micro-consolidation (candle body too small)
        if len(self.prices) >= 5:
            candle_body = abs(high - low)

            # Convert to pips (assuming 5-decimal pricing)
            candle_body_pips = candle_body * 10000

            if candle_body_pips < self.min_candle_body_pips:
                reason = (
                    f"Candle body too small ({candle_body_pips:.1f} pips "
                    f"< {self.min_candle_body_pips})"
                )
                self.last_block_reason = reason
                logger.debug(f"Trade blocked: {reason}")
                return False, reason

        # All checks passed
        self.last_block_reason = None
        return True, None

    def get_volatility_score(self) -> float:
        """
        Get volatility score (0-100).

        Returns:
            Score where 50 is ideal, 0 is too low, 100 is too high
        """
        if self.current_atr == 0:
            return 50.0

        # Map ATR to 0-100 scale
        normalized = (self.current_atr - self.min_atr_threshold) / (
            self.max_atr_threshold - self.min_atr_threshold
        )
        normalized = max(0.0, min(1.0, normalized))

        score = normalized * 100

        return score

    def is_consolidating(self) -> bool:
        """Check if market is in micro-consolidation."""
        if len(self.prices) < 10:
            return False

        recent_prices = list(self.prices)[-10:]
        price_range = max(recent_prices) - min(recent_prices)

        # If range is very small relative to ATR
        if self.current_atr > 0 and price_range < self.current_atr * 0.5:
            return True

        return False

    def get_last_block_reason(self) -> Optional[str]:
        """Get reason for last trading block."""
        return self.last_block_reason

    def update_params(self, 
                      min_atr: float = None, 
                      max_atr: float = None, 
                      min_pips: float = None, 
                      spike_multiplier: float = None):
        """Update volatility parameters dynamically."""
        if min_atr is not None: self.min_atr_threshold = min_atr
        if max_atr is not None: self.max_atr_threshold = max_atr
        if min_pips is not None: self.min_candle_body_pips = min_pips
        if spike_multiplier is not None: self.atr_spike_multiplier = spike_multiplier
        logger.info("VolatilityFilter parameters updated.")

    def reset(self):
        """Reset all history and state."""
        self.atr_history.clear()
        self.prices.clear()
        self.highs.clear()
        self.lows.clear()
        self.current_atr = 0.0
        self.last_block_reason = None
        logger.info("Volatility filter reset")
