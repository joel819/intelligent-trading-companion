"""
Dynamic Take Profit
Calculates take profit levels based on risk-reward, momentum, and provides
helpers for break-even and trailing behaviour.
"""

from typing import Optional
import logging

logger = logging.getLogger(__name__)


class DynamicTakeProfit:
    """Calculates optimal take profit placement."""

    def __init__(self, min_rr_ratio: float = 2.0):
        # Minimum risk:reward; momentum can scale this up/down.
        self.min_rr_ratio = min_rr_ratio

    def calculate_tp_price(
        self,
        entry_price: float,
        sl_price: float,
        direction: str,
        momentum_factor: float = 1.0,
    ) -> float:
        """
        Calculate Take Profit price.

        Args:
            entry_price: Entry price
            sl_price: Stop Loss price
            direction: "BUY" or "SELL"
            momentum_factor: Multiplier based on RSI / MACD conditions.
                             >1.0 for strong trends, <1.0 for slowdown.

        Returns:
            Take Profit Price
        """
        risk_distance = abs(entry_price - sl_price)

        if risk_distance <= 0:
            # Fallback – avoid division/pathological cases.
            logger.debug("Dynamic TP: zero risk distance, using small synthetic risk.")
            risk_distance = max(entry_price * 0.0005, 1e-5)

        # Base TP based on Risk:Reward and momentum
        reward_distance = risk_distance * self.min_rr_ratio * max(0.5, momentum_factor)

        if direction == "BUY":
            tp_price = entry_price + reward_distance
        else:  # SELL
            tp_price = entry_price - reward_distance

        return float(tp_price)

    def check_trailing_update(
        self,
        current_price: float,
        entry_price: float,
        current_sl: float,
        direction: str,
    ) -> Optional[float]:
        """
        Determine if SL should be moved for trailing / break-even.

        Behaviour:
        - When price has moved +25% of the distance towards TP (≈ 0.25x risk),
          move SL to entry (break-even) if it is still in loss territory.

        Returns:
            New SL price or None if no update.
        """
        risk_dist = abs(entry_price - current_sl) if current_sl > 0 else 0
        if risk_dist == 0:
            return None

        if direction == "BUY":
            profit_dist = current_price - entry_price
        else:
            profit_dist = entry_price - current_price

        # Trigger at ~0.25x Risk -> break-even behaviour
        if profit_dist > (risk_dist * 0.25):
            if direction == "BUY" and current_sl < entry_price:
                return entry_price
            elif direction == "SELL" and current_sl > entry_price:
                return entry_price

        return None
