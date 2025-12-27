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
        if current_sl is None:
             return None
             
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
    
    def calculate_v10_tp(
        self,
        entry_price: float,
        direction: str,
        points_offset: float = 14.0,
    ) -> float:
        """
        Calculate V10-specific Take Profit with fixed point range.
        
        Args:
            entry_price: Entry price
            direction: "BUY" or "SELL"
            points_offset: TP distance in points (default 14, range 10-18)
            
        Returns:
            Take Profit Price
        """
        # V10 uses TP range: 10-18 points (RR ≈ 1:1.4)
        # Convert points to price (for 5-decimal forex, 1 point = 0.0001)
        tp_distance = points_offset * 0.0001
        
        if direction == "BUY":
            tp_price = entry_price + tp_distance
        else:  # SELL
            tp_price = entry_price - tp_distance
            
        logger.debug(f"[V10 TP] {direction} @ {entry_price:.5f} -> TP @ {tp_price:.5f} ({points_offset} points)")
        return float(tp_price)
    
    def check_v10_trailing_update(
        self,
        current_price: float,
        entry_price: float,
        current_sl: float,
        direction: str,
    ) -> Optional[float]:
        """
        V10-specific trailing stop logic.
        
        Break-even trigger: +6 points profit
        Trailing activation: +9 points profit
        
        Returns:
            New SL price or None if no update.
        """
        # Calculate profit in points
        if direction == "BUY":
            profit_price = current_price - entry_price
        else:
            profit_price = entry_price - current_price
        
        profit_points = profit_price / 0.0001
        
        if current_sl is None:
            return None
            
        # Break-even at +6 points
        if profit_points >= 6 and profit_points < 9:
            if direction == "BUY" and current_sl < entry_price:
                logger.info(f"[V10 Trailing] Moving to break-even (+{profit_points:.1f} points)")
                return entry_price
            elif direction == "SELL" and current_sl > entry_price:
                logger.info(f"[V10 Trailing] Moving to break-even (+{profit_points:.1f} points)")
                return entry_price
        
        # Trailing stop at +9 points
        if profit_points >= 9:
            # Trail at current_price - 5 points for BUY, current_price + 5 points for SELL
            trailing_distance = 5 * 0.0001
            
            if direction == "BUY":
                new_sl = current_price - trailing_distance
                if new_sl > current_sl:  # Only move SL up
                    logger.info(f"[V10 Trailing] Trailing SL to {new_sl:.5f} (+{profit_points:.1f} points)")
                    return new_sl
            else:  # SELL
                new_sl = current_price + trailing_distance
                if new_sl < current_sl:  # Only move SL down
                    logger.info(f"[V10 Trailing] Trailing SL to {new_sl:.5f} (+{profit_points:.1f} points)")
                    return new_sl

        return None
    
    def calculate_boom300_tp(
        self,
        entry_price: float,
        direction: str = "SELL",
        points_offset: float = 14.0,
    ) -> float:
        """
        Calculate Boom 300-specific Take Profit with fixed point range.
        
        Args:
            entry_price: Entry price
            direction: "BUY" or "SELL" (default SELL for Boom 300)
            points_offset: TP distance in points (default 14, range 10-18)
            
        Returns:
            Take Profit Price
        """
        # Boom 300 uses TP range: 10-18 points
        # Convert points to price (for 5-decimal forex, 1 point = 0.0001)
        tp_distance = points_offset * 0.0001
        
        if direction == "BUY":
            tp_price = entry_price + tp_distance
        else:  # SELL (primary for Boom 300)
            tp_price = entry_price - tp_distance  # Below entry
            
        logger.debug(f"[BOOM300 TP] {direction} @ {entry_price:.5f} -> TP @ {tp_price:.5f} ({points_offset} points)")
        return float(tp_price)
    
    def check_boom300_trailing_update(
        self,
        current_price: float,
        entry_price: float,
        current_sl: float,
        direction: str = "SELL",
    ) -> Optional[float]:
        """
        Boom 300-specific trailing stop logic.
        
        Break-even trigger: +7 points profit
        Trailing activation: +10 points profit (after price drops 10+ points)
        
        Returns:
            New SL price or None if no update.
        """
        # Calculate profit in points (price movement in our favor)
        if direction == "BUY":
            profit_price = current_price - entry_price
        else:  # SELL - profit when price drops
            profit_price = entry_price - current_price
        
        profit_points = profit_price / 0.0001
        
        # Break-even at +7 points
        if profit_points >= 7 and profit_points < 10:
            if direction == "BUY" and current_sl < entry_price:
                logger.info(f"[BOOM300 Trailing] Moving to break-even (+{profit_points:.1f} points)")
                return entry_price
            elif direction == "SELL" and current_sl > entry_price:
                logger.info(f"[BOOM300 Trailing] Moving to break-even (+{profit_points:.1f} points)")
                return entry_price
        
        # Trailing stop at +10 points
        if profit_points >= 10:
            # For SELL: trail at current_price + 5 points (tighter trailing)
            trailing_distance = 5 * 0.0001
            
            if direction == "BUY":
                new_sl = current_price - trailing_distance
                if new_sl > current_sl:  # Only move SL up
                    logger.info(f"[BOOM300 Trailing] Trailing SL to {new_sl:.5f} (+{profit_points:.1f} points)")
                    return new_sl
            else:  # SELL
                new_sl = current_price + trailing_distance
                if new_sl < current_sl:  # Only move SL down (tighter)
                    logger.info(f"[BOOM300 Trailing] Trailing SL to {new_sl:.5f} (+{profit_points:.1f} points)")
                    return new_sl

        return None
    
    def calculate_crash300_tp(
        self,
        entry_price: float,
        direction: str = "BUY",
        points_offset: float = 14.0,
    ) -> float:
        """
        Calculate Crash 300-specific Take Profit (inverse of Boom 300).
        
        Args:
            entry_price: Entry price
            direction: "BUY" or "SELL" (default BUY for Crash 300)
            points_offset: TP distance in points (default 14, range 10-18)
            
        Returns:
            Take Profit Price
        """
        tp_distance = points_offset * 0.0001
        
        if direction == "BUY":  # Primary for Crash 300
            tp_price = entry_price + tp_distance  # Above entry
        else:  # SELL
            tp_price = entry_price - tp_distance
            
        logger.debug(f"[CRASH300 TP] {direction} @ {entry_price:.5f} -> TP @ {tp_price:.5f} ({points_offset} points)")
        return float(tp_price)
    
    def check_crash300_trailing_update(
        self,
        current_price: float,
        entry_price: float,
        current_sl: float,
        direction: str = "BUY",
    ) -> Optional[float]:
        """
        Crash 300-specific trailing stop logic (inverse of Boom 300).
        
        Break-even trigger: +7 points profit
        Trailing activation: +10 points profit
        
        Returns:
            New SL price or None if no update.
        """
        if direction == "BUY":  # Primary - profit when price rises
            profit_price = current_price - entry_price
        else:
            profit_price = entry_price - current_price
        
        profit_points = profit_price / 0.0001
        
        # Break-even at +7 points
        if profit_points >= 7 and profit_points < 10:
            if direction == "BUY" and current_sl < entry_price:
                logger.info(f"[CRASH300 Trailing] Moving to break-even (+{profit_points:.1f} points)")
                return entry_price
            elif direction == "SELL" and current_sl > entry_price:
                logger.info(f"[CRASH300 Trailing] Moving to break-even (+{profit_points:.1f} points)")
                return entry_price
        
        # Trailing at +10 points
        if profit_points >= 10:
            trailing_distance = 5 * 0.0001
            
            if direction == "BUY":
                new_sl = current_price - trailing_distance
                if new_sl > current_sl:
                    logger.info(f"[CRASH300 Trailing] Trailing SL to {new_sl:.5f} (+{profit_points:.1f} points)")
                    return new_sl
            else:
                new_sl = current_price + trailing_distance
                if new_sl < current_sl:
                    logger.info(f"[CRASH300 Trailing] Trailing SL to {new_sl:.5f} (+{profit_points:.1f} points)")
                    return new_sl

        return None
