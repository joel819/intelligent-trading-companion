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
        
        # Multi-Timeframe RSI: History for each timeframe
        self.rsi_history_1m = deque(maxlen=10)   # Entry signal timeframe
        self.rsi_history_5m = deque(maxlen=10)   # Short-term directional filter
        self.rsi_history_15m = deque(maxlen=10)  # Medium-trend confirmation
        self.rsi_history_1h = deque(maxlen=10)   # Macro trend filter
        
        # V10-specific RSI ranges
        self.v10_rsi_buy_min = 48
        self.v10_rsi_buy_max = 62
        self.v10_rsi_sell_min = 38
        self.v10_rsi_sell_max = 55
        
    def analyze(self, tick_data: Dict, **kwargs) -> Dict:
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
        
        engine = kwargs.get('engine') # Optional MasterEngine
        
        if len(self.prices) < 50 and not engine:
             return {"score": 50, "rsi": 50, "bias": "neutral", "ma_trend": "neutral", "ma_slope": 0, "adx": 0}
             
        rsi = self._calculate_rsi(engine=engine, current_price=price)
        # Update RSI Hybrid Mode history
        self.rsi_history.append(rsi)
        
        macd_val, signal_val, hist_val = self._calculate_macd()
        ma_trend, ma_slope = self._check_ma_trend(engine=engine, current_price=price)
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

    def _calculate_rsi(self, engine=None, current_price=None, period: int = None) -> float:
        """
        Calculate RSI using Wilder's Smoothing (Industry Standard).
        If engine is provided, uses 1-minute candles.
        Otherwise falls back to tick-based calculation.
        """
        if period is None:
            period = self.rsi_period
            
        # --- CASE 1: Engine Provided (Use 1m Candles) ---
        if engine and hasattr(engine, 'candles_1m') and len(engine.candles_1m) >= period:
            candles = list(engine.candles_1m)
            # Use 'close' of last N candles + current price
            closes = [c['close'] for c in candles[-period:]]
            if current_price is not None:
                closes.append(current_price)
            
            closes_arr = np.array(closes)
            return self._wilder_rsi(closes_arr, period)

        # --- CASE 2: Fallback to Tick-based RSI ---
        if len(self.prices) <= period:
            return 50.0
        
        prices_arr = np.array(list(self.prices)[-period-1:])
        return self._wilder_rsi(prices_arr, period)

    def _wilder_rsi(self, closes: np.array, period: int) -> float:
        """Helper for Wilder's smoothed RSI."""
        if len(closes) < period + 1:
            return 50.0
            
        delta = np.diff(closes)
        gain = np.where(delta > 0, delta, 0)
        loss = np.where(delta < 0, -delta, 0)
        
        # Initial average: Simple Mean
        avg_gain = np.mean(gain[:period])
        avg_loss = np.mean(loss[:period])
        
        # Wilder's Smoothing (MMA)
        for i in range(period, len(gain)):
            avg_gain = (avg_gain * (period - 1) + gain[i]) / period
            avg_loss = (avg_loss * (period - 1) + loss[i]) / period
            
        if avg_loss == 0:
            return 100.0 if avg_gain > 0 else 50.0
            
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
        
        # BUY: flow is bullish (Current RSI > 50)
        # SELL: flow is bearish (Current RSI < 50)
        # Relaxed: Removed strict momentum_up/down requirement for scalping
        
        allow_buy = (flow == "bullish")
        allow_sell = (flow == "bearish")
        
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

    # ===============================================
    # MULTI-TIMEFRAME RSI SYSTEM
    # ===============================================
    
    def update_rsi_timeframe(self, timeframe: str, rsi_value: float) -> None:
        """
        Update RSI history for a specific timeframe.
        
        Args:
            timeframe: "1m", "5m", "15m", or "1h"
            rsi_value: The RSI value to store
        """
        if timeframe == "1m":
            self.rsi_history_1m.append(rsi_value)
        elif timeframe == "5m":
            self.rsi_history_5m.append(rsi_value)
        elif timeframe == "15m":
            self.rsi_history_15m.append(rsi_value)
        elif timeframe == "1h":
            self.rsi_history_1h.append(rsi_value)
    
    def get_rsi_1m_momentum(self, current_rsi: float = None) -> dict:
        """
        RSI(1m) Momentum Direction based on slope.
        If current_rsi is provided, compares it to the last closed candle in history.
        
        Returns:
            dict with momentum_up, momentum_down, and slope_value
        """
        if current_rsi is None:
            if len(self.rsi_history_1m) < 2:
                # Fallback to legacy rsi_history if 1m not populated
                if len(self.rsi_history) < 2:
                    return {"momentum_up": False, "momentum_down": False, "slope_value": 0.0}
                current_rsi = self.rsi_history[-1]
                previous_rsi = self.rsi_history[-2]
            else:
                current_rsi = self.rsi_history_1m[-1]
                previous_rsi = self.rsi_history_1m[-2]
        else:
            if len(self.rsi_history_1m) < 1:
                return {"momentum_up": False, "momentum_down": False, "slope_value": 0.0}
            previous_rsi = self.rsi_history_1m[-1] # Compare to last closed candle
        
        slope_value = current_rsi - previous_rsi
        
        return {
            "momentum_up": slope_value > 0.1, # Small threshold for meaningful momentum
            "momentum_down": slope_value < -0.1,
            "slope_value": slope_value
        }
    
    def get_rsi_1m_volatility(self, current_rsi: float = None) -> dict:
        """
        RSI(1m) Volatility State.
        If current_rsi is provided, compares it to the last closed candle.
        
        Returns:
            - state: "flat" if < 0.5, "normal" if 0.5-5, "expanding" if > 5
            - volatility_value: absolute difference
            - confidence_modifier: adjustment for confidence scoring
        """
        if current_rsi is None:
            if len(self.rsi_history_1m) < 2:
                # Fallback to legacy rsi_history
                if len(self.rsi_history) < 2:
                    return {"state": "flat", "volatility_value": 0.0, "confidence_modifier": -0.1}
                current_rsi = self.rsi_history[-1]
                previous_rsi = self.rsi_history[-2]
            else:
                current_rsi = self.rsi_history_1m[-1]
                previous_rsi = self.rsi_history_1m[-2]
        else:
            if len(self.rsi_history_1m) < 1:
                return {"state": "flat", "volatility_value": 0.0, "confidence_modifier": -0.1}
            previous_rsi = self.rsi_history_1m[-1]
        
        rsi_volatility = abs(current_rsi - previous_rsi)
        
        if rsi_volatility < 0.5:
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
    
    def get_rsi_5m_flow(self) -> str:
        """
        RSI(5m) Short-term Directional Flow.
        
        Returns:
            "bullish" if RSI(5m) > 50, "bearish" if < 50, "neutral" if exactly 50
        """
        if len(self.rsi_history_5m) < 1:
            return "neutral"
        
        current_rsi = self.rsi_history_5m[-1]
        
        if current_rsi > 50:
            return "bullish"
        elif current_rsi < 50:
            return "bearish"
        else:
            return "neutral"
    
    def get_rsi_15m_trend(self) -> str:
        """
        RSI(15m) Medium-term Trend Confirmation.
        
        Returns:
            "bullish" if RSI(15m) > 50, "bearish" if < 50, "neutral" if exactly 50
        """
        if len(self.rsi_history_15m) < 1:
            return "neutral"
        
        current_rsi = self.rsi_history_15m[-1]
        
        if current_rsi > 50:
            return "bullish"
        elif current_rsi < 50:
            return "bearish"
        else:
            return "neutral"
    
    def get_rsi_1h_macro_trend(self) -> str:
        """
        RSI(1h) Macro Trend Filter.
        
        Returns:
            "bullish" if RSI(1h) > 50, "bearish" if < 50, "neutral" if exactly 50
        """
        if len(self.rsi_history_1h) < 1:
            return "neutral"
        
        current_rsi = self.rsi_history_1h[-1]
        
        if current_rsi > 50:
            return "bullish"
        elif current_rsi < 50:
            return "bearish"
        else:
            return "neutral"
    
    def get_multi_rsi_confirmation(self, direction: str = None) -> dict:
        """
        Multi-Timeframe RSI Confirmation System - Hierarchical Version.
        
        HIERARCHY RULES:
        1. L1 (Strict): RSI(1m) Flow & Momentum must align with direction.
        2. L2 (Strict): RSI(5m) Flow must align with direction (Short-term trend).
        3. L3 (Soft): RSI(15m) & RSI(1h) are directional biases. 
        
        Note: Now compares current tick RSI to last closed candle history.
        """
        # Determine current RSI (Real-time)
        if len(self.rsi_history) > 0:
            rsi_now = self.rsi_history[-1]
        elif len(self.rsi_history_1m) > 0:
            rsi_now = self.rsi_history_1m[-1]
        else:
            rsi_now = 50.0

        # Get 1m signals (ENTRY TRIGGER) using real-time tick vs history model
        momentum_1m = self.get_rsi_1m_momentum(current_rsi=rsi_now)
        volatility_1m = self.get_rsi_1m_volatility(current_rsi=rsi_now)
        
        flow_1m = "bullish" if rsi_now > 50 else ("bearish" if rsi_now < 50 else "neutral")
        
        # Get higher timeframe filters
        flow_5m = self.get_rsi_5m_flow()
        trend_15m = self.get_rsi_15m_trend()
        macro_1h = self.get_rsi_1h_macro_trend()
        
        # --- Confidence Calculation ---
        conf_mod = volatility_1m["confidence_modifier"]
        
        # Bonus for MTF alignment
        if direction == "BUY":
            if trend_15m == "bullish": conf_mod += 0.1
            elif trend_15m == "bearish": conf_mod -= 0.1
            
            if macro_1h == "bullish": conf_mod += 0.05
            elif macro_1h == "bearish": conf_mod -= 0.05
            
        elif direction == "SELL":
            if trend_15m == "bearish": conf_mod += 0.1
            elif trend_15m == "bullish": conf_mod -= 0.1
            
            if macro_1h == "bearish": conf_mod += 0.05
            elif macro_1h == "bullish": conf_mod -= 0.05

        # --- Hierarchical Approval ---
        
        # BUY: (1m Bullish + 1m Mom Up + 1m Not Flat) AND (5m Bullish)
        # We allow a very small 'sideways' RSI if it's already deep in bullish territory (>55)
        allow_buy = (flow_1m == "bullish" and (momentum_1m["momentum_up"] or rsi_now > 55) and 
                     volatility_1m["state"] != "flat" and flow_5m == "bullish")
        
        # SELL: (1m Bearish + 1m Mom Down + 1m Not Flat) AND (5m Bearish)
        allow_sell = (flow_1m == "bearish" and (momentum_1m["momentum_down"] or rsi_now < 45) and 
                      volatility_1m["state"] != "flat" and flow_5m == "bearish")
        
        # Build summary
        summary = (
            f"MTF-RSI(H) | Now={rsi_now:.1f} "
            f"Mom={'↑' if momentum_1m['momentum_up'] else ('↓' if momentum_1m['momentum_down'] else '→')} | "
            f"5m={flow_5m} | 15m={trend_15m} | 1h={macro_1h}"
        )
        
        if allow_buy:
            summary += " → BUY APPROVED"
        elif allow_sell:
            summary += " → SELL APPROVED"
        else:
            summary += " → BLOCK (L1/L2 Mismatch)"
        
        result = {
            "allow_buy": allow_buy,
            "allow_sell": allow_sell,
            "rsi_1m_value": rsi_now,
            "slope_value": momentum_1m["slope_value"],
            "flow_1m": flow_1m,
            "flow_5m": flow_5m,
            "trend_15m": trend_15m,
            "macro_1h": macro_1h,
            "confidence_modifier": round(conf_mod, 2),
            "summary": summary
        }
        
        if direction:
            logger.debug(f"[MTF-RSI] {direction} Check: {summary}")
            
        return result

        
    def _calculate_macd(self, fast=12, slow=26, signal=9):
        """
        Calculate MACD using proper EMAs and Signal Line.
        """
        if len(self.prices) < slow + signal:
            return 0, 0, 0
            
        prices = np.array(list(self.prices))
        
        # Calculate EMAs
        def get_ema(data, period):
            alpha = 2 / (period + 1)
            ema = np.zeros_like(data)
            ema[0] = data[0]
            for i in range(1, len(data)):
                ema[i] = alpha * data[i] + (1 - alpha) * ema[i-1]
            return ema
            
        ema_fast = get_ema(prices, fast)
        ema_slow = get_ema(prices, slow)
        macd_line = ema_fast - ema_slow
        
        # Proper Signal Line (EMA of MACD)
        signal_line_series = get_ema(macd_line, signal)
        
        macd_val = macd_line[-1]
        sig_val = signal_line_series[-1]
        histogram = macd_val - sig_val
        
        return float(macd_val), float(sig_val), float(histogram)
        
    def _check_ma_trend(self, engine=None, current_price=None) -> tuple[str, float]:
        """
        Check MA trend and calculate slope.
        If engine is provided, uses 1-minute candles.
        """
        # --- CASE 1: Engine Provided (Use 1m Candles) ---
        if engine and hasattr(engine, 'candles_1m') and len(engine.candles_1m) >= 50:
            candles = list(engine.candles_1m)
            closes = [c['close'] for c in candles]
            if current_price is not None:
                closes.append(current_price)
            
            closes_arr = np.array(closes)
            
            # Use standard EMA periods (14 and 40 as per V10 config)
            ma20 = np.mean(closes_arr[-20:])
            ma50 = np.mean(closes_arr[-50:])
            
            # Slope of MA20 over last few candles
            ma20_prev = np.mean(closes_arr[-25:-5])
            ma_slope = (ma20 - ma20_prev) / ma20_prev if ma20_prev != 0 else 0.0
            
            price = closes_arr[-1]
            if price > ma20 and ma20 > ma50:
                trend = "bullish"
            elif price < ma20 and ma20 < ma50:
                trend = "bearish"
            else:
                trend = "neutral"
                
            return trend, ma_slope

        # --- CASE 2: Fallback to Tick-based MA ---
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
        Calculate ADX using Wilder's Smoothing.
        """
        if period is None:
            period = self.adx_period
            
        if len(self.highs) < period * 2: # ADX needs more data for smoothing
            return 0.0
        
        highs = np.array(list(self.highs))
        lows = np.array(list(self.lows))
        closes = np.array(list(self.prices))
        
        # +DM, -DM
        up_move = highs[1:] - highs[:-1]
        down_move = lows[:-1] - lows[1:]
        
        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0)
        
        # True Range
        tr1 = highs[1:] - lows[1:]
        tr2 = np.abs(highs[1:] - closes[:-1])
        tr3 = np.abs(lows[1:] - closes[:-1])
        tr = np.maximum(tr1, np.maximum(tr2, tr3))
        
        # Wilder's Smoothing for ATR, +DM, -DM
        def wilders_smooth(data, p):
            smoothed = np.zeros_like(data)
            smoothed[p-1] = np.mean(data[:p])
            for i in range(p, len(data)):
                smoothed[i] = (smoothed[i-1] * (p - 1) + data[i]) / p
            return smoothed
            
        atr_s = wilders_smooth(tr, period)
        plus_dm_s = wilders_smooth(plus_dm, period)
        minus_dm_s = wilders_smooth(minus_dm, period)
        
        # +DI, -DI
        plus_di = 100 * (plus_dm_s / (atr_s + 1e-10))
        minus_di = 100 * (minus_dm_s / (atr_s + 1e-10))
        
        # DX
        dx = 100 * (np.abs(plus_di - minus_di) / (plus_di + minus_di + 1e-10))
        
        # ADX (Smoothed DX)
        adx_series = wilders_smooth(dx, period)
        
        return float(adx_series[-1])
