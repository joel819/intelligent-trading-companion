"""
Market Regime Detector
Analyzes market conditions to classify regime type and volatility level.
"""

import numpy as np
from typing import Dict, List, Tuple
from collections import deque
import logging

logger = logging.getLogger(__name__)


class RegimeDetector:
    """Detects market regime (trending/ranging/breakout) and volatility level."""
    
    def __init__(self, 
                 atr_period: int = 14,
                 ma_short_period: int = 20,
                 ma_long_period: int = 50,
                 rsi_period: int = 14,
                 history_size: int = 100):
        """
        Initialize regime detector.
        
        Args:
            atr_period: Period for ATR calculation
            ma_short_period: Short-term MA period
            ma_long_period: Long-term MA period
            rsi_period: RSI period
            history_size: Number of ticks to store in history
        """
        self.atr_period = atr_period
        self.ma_short_period = ma_short_period
        self.ma_long_period = ma_long_period
        self.rsi_period = rsi_period
        
        # Price history
        self.prices = deque(maxlen=history_size)
        self.highs = deque(maxlen=history_size)
        self.lows = deque(maxlen=history_size)
        
        # Current regime state
        self.current_regime = {
            "regime": "unknown",
            "volatility": "medium",
            "confidence": 0.0,
            "atr": 0.0,
            "ma_slope": 0.0,
            "rsi": 50.0
        }
    
    def update(self, tick_data: Dict) -> Dict:
        """
        Update regime analysis with new tick data.
        
        Args:
            tick_data: Dictionary containing 'quote' (price), 'high', 'low'
        
        Returns:
            Current regime state
        """
        price = float(tick_data.get('quote', 0))
        high = float(tick_data.get('high', price))
        low = float(tick_data.get('low', price))
        
        self.prices.append(price)
        self.highs.append(high)
        self.lows.append(low)
        
        # Need minimum data
        if len(self.prices) < self.ma_long_period:
            return self.current_regime
        
        # Calculate indicators
        atr = self._calculate_atr()
        ma_slope = self._calculate_ma_slope()
        rsi = self._calculate_rsi()
        
        # Detect regime
        regime = self._detect_regime(ma_slope, rsi, atr)
        volatility = self._classify_volatility(atr)
        confidence = self._calculate_confidence(ma_slope, rsi, atr)
        
        # Update state
        self.current_regime = {
            "regime": regime,
            "volatility": volatility,
            "confidence": confidence,
            "atr": atr,
            "ma_slope": ma_slope,
            "rsi": rsi
        }
        
        return self.current_regime
    
    def _calculate_atr(self) -> float:
        """Calculate Average True Range for volatility measurement."""
        if len(self.highs) < self.atr_period:
            return 0.0
        
        tr_values = []
        for i in range(1, min(self.atr_period + 1, len(self.prices))):
            high = self.highs[-i]
            low = self.lows[-i]
            prev_close = self.prices[-(i+1)] if i < len(self.prices) else self.prices[-i]
            
            tr = max(
                high - low,
                abs(high - prev_close),
                abs(low - prev_close)
            )
            tr_values.append(tr)
        
        return np.mean(tr_values) if tr_values else 0.0
    
    def _calculate_ma_slope(self) -> float:
        """Calculate moving average slope to detect trend direction."""
        if len(self.prices) < self.ma_short_period:
            return 0.0
        
        # Calculate short and long MAs
        ma_short = np.mean(list(self.prices)[-self.ma_short_period:])
        ma_long = np.mean(list(self.prices)[-self.ma_long_period:]) if len(self.prices) >= self.ma_long_period else ma_short
        
        # Slope = difference between MAs
        slope = (ma_short - ma_long) / ma_long if ma_long != 0 else 0.0
        
        return slope
    
    def _calculate_rsi(self) -> float:
        """Calculate RSI for momentum analysis."""
        if len(self.prices) < self.rsi_period + 1:
            return 50.0
        
        prices_array = np.array(list(self.prices)[-self.rsi_period-1:])
        deltas = np.diff(prices_array)
        
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains) if len(gains) > 0 else 0
        avg_loss = np.mean(losses) if len(losses) > 0 else 1e-10
        
        rs = avg_gain / avg_loss if avg_loss != 0 else 0
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def _detect_regime(self, ma_slope: float, rsi: float, atr: float) -> str:
        """
        Classify market regime based on indicators.
        
        Returns:
            One of: "trending_up", "trending_down", "ranging", "breakout", "high_volatility"
        """
        # Thresholds
        strong_trend_threshold = 0.002
        weak_trend_threshold = 0.0005
        breakout_atr_threshold = atr * 2.0 if atr > 0 else 0.001
        
        # Check for breakout (sudden volatility spike)
        if len(self.prices) > 5:
            recent_range = max(list(self.prices)[-5:]) - min(list(self.prices)[-5:])
            if recent_range > breakout_atr_threshold:
                return "breakout"
        
        # Check for trending
        if abs(ma_slope) > strong_trend_threshold:
            if ma_slope > 0 and rsi > 50:
                return "trending_up"
            elif ma_slope < 0 and rsi < 50:
                return "trending_down"
        
        # Check for ranging
        if abs(ma_slope) < weak_trend_threshold:
            return "ranging"
        
        # Default to weak trend detection
        return "trending_up" if ma_slope > 0 else "trending_down"
    
    def _classify_volatility(self, atr: float) -> str:
        """
        Classify volatility level.
        
        Returns:
            One of: "low", "medium", "high", "extreme"
        """
        if atr < 0.001: 
            return "low"
        elif atr < 0.01:
            return "medium"
        elif atr < 0.1:
            return "high"
        else:
            return "extreme"
    
    def _calculate_confidence(self, ma_slope: float, rsi: float, atr: float) -> float:
        """
        Calculate confidence score for current regime classification.
        
        Returns:
            Confidence score between 0.0 and 1.0
        """
        confidence = 0.5  # Base confidence
        
        # Increase confidence for strong trends
        if abs(ma_slope) > 0.002:
            confidence += 0.2
        
        # Increase confidence for RSI confirmation
        if (ma_slope > 0 and rsi > 60) or (ma_slope < 0 and rsi < 40):
            confidence += 0.2
        
        # Decrease confidence for extreme volatility
        if atr > 0.005:
            confidence -= 0.2
        
        # Decrease confidence for ranging markets
        if abs(ma_slope) < 0.0005:
            confidence -= 0.1
        
        return max(0.0, min(1.0, confidence))
    
    def get_regime(self) -> Dict:
        """Get current regime state."""
        return self.current_regime
    
    def reset(self):
        """Reset all history and state."""
        self.prices.clear()
        self.highs.clear()
        self.lows.clear()
        self.current_regime = {
            "regime": "unknown",
            "volatility": "medium",
            "confidence": 0.0,
            "atr": 0.0,
            "ma_slope": 0.0,
            "rsi": 50.0
        }
        logger.info("Regime detector reset")
