"""
Indicator Layer
Technical indicator analysis for signal confirmation.
"""

import numpy as np
from typing import Dict, List, Deque
from collections import deque
import logging

logger = logging.getLogger(__name__)


class IndicatorLayer:
    """Calculates and scores technical indicators."""
    
    def __init__(self, rsi_period=14, adx_period=14):
        self.rsi_period = rsi_period
        self.adx_period = adx_period
        self.prices = deque(maxlen=100)
        self.highs = deque(maxlen=100)
        self.lows = deque(maxlen=100)
        self.rsi_oversold = 30.0
        self.rsi_overbought = 70.0
        
        # V10-specific RSI ranges
        self.v10_rsi_buy_min = 48
        self.v10_rsi_buy_max = 62
        self.v10_rsi_sell_min = 38
        self.v10_rsi_sell_max = 55
        
    def analyze(self, tick_data: Dict) -> Dict:
        """
        Analyze indicators.
        
        Returns:
            Dictionary with indicator scores and values.
        """
        price = float(tick_data.get('quote', 0))
        high = float(tick_data.get('high', price))
        low = float(tick_data.get('low', price))
        
        self.prices.append(price)
        self.highs.append(high)
        self.lows.append(low)
        
        if len(self.prices) < 50:
             return {"score": 50, "rsi": 50, "bias": "neutral", "ma_trend": "neutral", "ma_slope": 0, "adx": 0}
             
        rsi = self._calculate_rsi()
        macd_val, signal_val, hist_val = self._calculate_macd()
        ma_trend, ma_slope = self._check_ma_trend()
        adx = self._calculate_adx()
        
        score = 50
        
        # RSI Logic
        if rsi > self.rsi_overbought:
            score -= 10  # Overbought - slight bearish bias for reversal, or strong trend?
            # Context matters, but simplisticly extremes indicate probability of pivot
        elif rsi < self.rsi_oversold:
            score += 10  # Oversold - slight bullish bias
            
        # RSI Slope for momentum
        rsi_slope = 0
        if len(self.prices) > 2:
            # Check if RSI increasing or decreasing
            # (Need RSI history, keeping simple here)
            pass
            
        # MACD Logic - Enhanced turning detection
        if hist_val > 0:
            score += 10
            if hist_val > 0 and macd_val > signal_val:
                score += 5 # Growing momentum
        else:
            score -= 10
            if hist_val < 0 and macd_val < signal_val:
                score -= 5
                
        # MA Trend
        if ma_trend == "bullish":
            score += 15
        elif ma_trend == "bearish":
            score -= 15
        
        # ADX - Trend strength bonus
        if adx > 25:  # Strong trend
            if ma_trend == "bullish":
                score += 5
            elif ma_trend == "bearish":
                score -= 5
            
        return {
            "score": max(0, min(100, score)), # 0=Strong Bear, 100=Strong Bull
            "rsi": rsi,
            "macd_hist": hist_val,
            "macd_line": macd_val,
            "macd_signal": signal_val,
            "ma_trend": ma_trend,
            "ma_slope": ma_slope,
            "adx": adx,
            "bias": "bullish" if score > 55 else ("bearish" if score < 45 else "neutral")
        }
        
    def set_v10_mode(self) -> None:
        """
        Configure indicator layer for V10 Super Safe mode.
        Uses V10-specific RSI ranges.
        """
        # V10 requires tighter RSI ranges for entries
        self.rsi_oversold = self.v10_rsi_sell_min  # 38
        self.rsi_overbought = self.v10_rsi_buy_max  # 62
        logger.info("IndicatorLayer configured for V10 Super Safe mode")
    
    def set_boom300_mode(self) -> None:
        """
        Configure indicator layer for Boom 300 Super Safe mode.
        Uses Boom-specific RSI ranges for spike-catching.
        """
        # Boom 300 uses different RSI thresholds (42-56 for SELL)
        self.rsi_oversold = 42
        self.rsi_overbought = 56  # Never overbought for SELL entries
        logger.info("IndicatorLayer configured for Boom 300 Super Safe mode")
    
    def set_crash300_mode(self) -> None:
        """
        Configure indicator layer for Crash 300 Super Safe mode.
        Uses Crash-specific RSI ranges for spike-catching.
        """
        # Crash 300 uses different RSI thresholds (44-60 for BUY)
        self.rsi_oversold = 44  # Not too oversold for BUY entries
        self.rsi_overbought = 60
        logger.info("IndicatorLayer configured for Crash 300 Super Safe mode")
    
    def update_params(self, 
                      rsi_oversold: float = None, 
                      rsi_overbought: float = None):
        """Update indicator parameters dynamically."""
        # For IndicatorLayer, we'll store these locally to use in analyze()
        if rsi_oversold is not None: self.rsi_oversold = rsi_oversold
        if rsi_overbought is not None: self.rsi_overbought = rsi_overbought
        logger.info("IndicatorLayer parameters updated.")

    def _calculate_rsi(self) -> float:
        if len(self.prices) <= self.rsi_period:
            return 50.0
        
        prices_arr = np.array(list(self.prices)[-self.rsi_period-1:])
        deltas = np.diff(prices_arr)
        
        gains = deltas[deltas > 0]
        losses = -deltas[deltas < 0]
        
        avg_gain = np.mean(gains) if len(gains) > 0 else 0
        avg_loss = np.mean(losses) if len(losses) > 0 else 1e-10
        
        if avg_loss == 0:
            return 100.0
            
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))
        
    def _calculate_macd(self, fast=12, slow=26, signal=9):
        # Extremely simplified MACD for tick stream
        if len(self.prices) < slow:
            return 0, 0, 0
            
        prices = list(self.prices)
        
        # Simple EMAs used for approximation in this scope
        def ema(data, span):
            return np.mean(data[-span:]) # SMA fallback if no numpy ema
            
        ema_fast = ema(prices, fast)
        ema_slow = ema(prices, slow)
        macd_line = ema_fast - ema_slow
        signal_line = macd_line * 0.9 # approximation
        histogram = macd_line - signal_line
        
        return macd_line, signal_line, histogram
        
    def _check_ma_trend(self) -> tuple[str, float]:
        """
        Check MA trend and calculate slope.
        
        Returns:
            Tuple of (trend_direction, ma_slope)
        """
        if len(self.prices) < 20:
            return "neutral", 0.0
            
        ma20 = np.mean(list(self.prices)[-20:])
        ma50 = np.mean(list(self.prices)[-50:]) if len(self.prices) >= 50 else ma20
        
        # Calculate MA20 slope
        if len(self.prices) >= 25:
            ma20_prev = np.mean(list(self.prices)[-25:-5])
            ma_slope = (ma20 - ma20_prev) / ma20_prev if ma20_prev != 0 else 0.0
        else:
            ma_slope = 0.0
        
        price = self.prices[-1]
        
        if price > ma20 and ma20 > ma50:
            return "bullish", ma_slope
        elif price < ma20 and ma20 < ma50:
            return "bearish", ma_slope
            
        return "neutral", ma_slope
    
    def _calculate_adx(self, period: int = None) -> float:
        """
        Calculate Average Directional Index (ADX) for trend strength.
        Simplified implementation for tick stream.
        
        Returns:
            ADX value (0-100, higher = stronger trend)
        """
        if period is None:
            period = self.adx_period
            
        if len(self.highs) < period + 1:
            return 0.0
        
        highs = np.array(list(self.highs)[-period-1:])
        lows = np.array(list(self.lows)[-period-1:])
        closes = np.array(list(self.prices)[-period-1:])
        
        # Calculate +DM and -DM
        high_diff = np.diff(highs)
        low_diff = -np.diff(lows)
        
        plus_dm = np.where((high_diff > low_diff) & (high_diff > 0), high_diff, 0)
        minus_dm = np.where((low_diff > high_diff) & (low_diff > 0), low_diff, 0)
        
        # Calculate True Range
        tr1 = highs[1:] - lows[1:]
        tr2 = np.abs(highs[1:] - closes[:-1])
        tr3 = np.abs(lows[1:] - closes[:-1])
        tr = np.maximum(tr1, np.maximum(tr2, tr3))
        
        # Smooth with simple average
        atr = np.mean(tr) if len(tr) > 0 else 1e-10
        plus_di = 100 * np.mean(plus_dm) / atr if atr > 0 else 0
        minus_di = 100 * np.mean(minus_dm) / atr if atr > 0 else 0
        
        # Calculate DX and ADX
        dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di) if (plus_di + minus_di) > 0 else 0
        adx = dx  # Simplified, normally would smooth DX as well
        
        return float(adx)
