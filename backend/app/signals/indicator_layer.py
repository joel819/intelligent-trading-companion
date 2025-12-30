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
        
        # RSI Hybrid Mode: History for slope/volatility calculations
        self.rsi_history = deque(maxlen=10)
        
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
        # Update RSI Hybrid Mode history
        self.rsi_history.append(rsi)
        
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
    
    # ===============================================
    # RSI HYBRID MODE METHODS
    # ===============================================
    
    def get_rsi_flow(self) -> str:
        """
        RSI Trend Flow:
        - rsi > 50 → bullish flow
        - rsi < 50 → bearish flow
        
        Returns:
            "bullish", "bearish", or "neutral" (exactly at 50)
        """
        if len(self.rsi_history) < 1:
            return "neutral"
        
        current_rsi = self.rsi_history[-1]
        
        if current_rsi > 50:
            return "bullish"
        elif current_rsi < 50:
            return "bearish"
        else:
            return "neutral"
    
    def get_rsi_slope(self) -> dict:
        """
        RSI Slope Momentum:
        - If RSI_current > RSI_previous → momentum_up = true
        - If RSI_current < RSI_previous → momentum_down = true
        
        Returns:
            dict with momentum_up, momentum_down, and slope_value
        """
        if len(self.rsi_history) < 2:
            return {"momentum_up": False, "momentum_down": False, "slope_value": 0.0}
        
        current_rsi = self.rsi_history[-1]
        previous_rsi = self.rsi_history[-2]
        slope_value = current_rsi - previous_rsi
        
        return {
            "momentum_up": current_rsi > previous_rsi,
            "momentum_down": current_rsi < previous_rsi,
            "slope_value": slope_value
        }
    
    def get_rsi_volatility(self) -> dict:
        """
        RSI Volatility State:
        - Calculate rsi_volatility = abs(RSI_current - RSI_previous)
        - If rsi_volatility < 2 → state = "flat"
        - If rsi_volatility between 2 and 5 → state = "normal"
        - If rsi_volatility > 5 → state = "expanding"
        
        Returns:
            dict with state, volatility_value, and confidence_modifier
        """
        if len(self.rsi_history) < 2:
            return {"state": "flat", "volatility_value": 0.0, "confidence_modifier": -0.1}
        
        current_rsi = self.rsi_history[-1]
        previous_rsi = self.rsi_history[-2]
        rsi_volatility = abs(current_rsi - previous_rsi)
        
        if rsi_volatility < 2:
            state = "flat"
            confidence_modifier = -0.1  # Reduce confidence, avoid entries
        elif rsi_volatility <= 5:
            state = "normal"
            confidence_modifier = 0.0   # Neutral
        else:
            state = "expanding"
            confidence_modifier = 0.05  # Slight increase in confidence
        
        return {
            "state": state,
            "volatility_value": rsi_volatility,
            "confidence_modifier": confidence_modifier
        }
    
    def get_rsi_confirmation(self, direction: str = None) -> dict:
        """
        RSI Hybrid Mode: Combined confirmation for trade entries.
        
        Args:
            direction: Optional "BUY" or "SELL" to check against.
        
        Returns:
            dict with:
                - allow_buy: bool
                - allow_sell: bool
                - flow: str ("bullish", "bearish", "neutral")
                - momentum_up: bool
                - momentum_down: bool
                - volatility_state: str ("flat", "normal", "expanding")
                - confidence_modifier: float
                - rsi_value: float
                - summary: str (human-readable)
        """
        flow = self.get_rsi_flow()
        slope = self.get_rsi_slope()
        volatility = self.get_rsi_volatility()
        
        current_rsi = self.rsi_history[-1] if len(self.rsi_history) > 0 else 50.0
        
        # Decision Logic:
        # BUY: flow is bullish AND momentum_up is true
        # SELL: flow is bearish AND momentum_down is true
        # If volatility_state = "flat", reduce confidence but DON'T completely block
        
        allow_buy = (flow == "bullish" and slope["momentum_up"])
        allow_sell = (flow == "bearish" and slope["momentum_down"])
        
        # Flat volatility: Instead of blocking, we just reduce confidence
        # This allows trades in slow-moving markets while still penalizing them
        # The complete block was too restrictive and prevented trades for hours
        
        # Build summary
        summary = f"RSI={current_rsi:.1f} | Flow={flow} | Mom={'↑' if slope['momentum_up'] else ('↓' if slope['momentum_down'] else '→')} | Vol={volatility['state']}"
        if allow_buy:
            summary += " → BUY OK"
        elif allow_sell:
            summary += " → SELL OK"
        else:
            summary += " → NO ENTRY"
        
        result = {
            "allow_buy": allow_buy,
            "allow_sell": allow_sell,
            "flow": flow,
            "momentum_up": slope["momentum_up"],
            "momentum_down": slope["momentum_down"],
            "volatility_state": volatility["state"],
            "confidence_modifier": volatility["confidence_modifier"],
            "rsi_value": current_rsi,
            "summary": summary
        }
        
        # If direction is specified, log the decision
        if direction:
            if direction.upper() == "BUY" and not allow_buy:
                logger.debug(f"[RSI Hybrid] BUY blocked: {summary}")
            elif direction.upper() == "SELL" and not allow_sell:
                logger.debug(f"[RSI Hybrid] SELL blocked: {summary}")
        
        return result

        
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
