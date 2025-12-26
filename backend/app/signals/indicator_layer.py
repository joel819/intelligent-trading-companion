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
    
    def __init__(self, rsi_period=14):
        self.rsi_period = rsi_period
        self.prices = deque(maxlen=100)
        self.rsi_oversold = 30.0
        self.rsi_overbought = 70.0
        
    def analyze(self, tick_data: Dict) -> Dict:
        """
        Analyze indicators.
        
        Returns:
            Dictionary with indicator scores and values.
        """
        price = float(tick_data.get('quote', 0))
        self.prices.append(price)
        
        if len(self.prices) < 50:
             return {"score": 50, "rsi": 50, "bias": "neutral"}
             
        rsi = self._calculate_rsi()
        macd_val, signal_val, hist_val = self._calculate_macd()
        ma_trend = self._check_ma_trend()
        
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
            
        # MACD Logic
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
            
        return {
            "score": max(0, min(100, score)), # 0=Strong Bear, 100=Strong Bull
            "rsi": rsi,
            "macd_hist": hist_val,
            "bias": "bullish" if score > 55 else ("bearish" if score < 45 else "neutral")
        }
        
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
        
    def _check_ma_trend(self) -> str:
        if len(self.prices) < 20:
            return "neutral"
            
        ma20 = np.mean(list(self.prices)[-20:])
        ma50 = np.mean(list(self.prices)[-50:]) if len(self.prices) >= 50 else ma20
        
        price = self.prices[-1]
        
        if price > ma20 and ma20 > ma50:
            return "bullish"
        elif price < ma20 and ma20 < ma50:
            return "bearish"
            
        return "neutral"
