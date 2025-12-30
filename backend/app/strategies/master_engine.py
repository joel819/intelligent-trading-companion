import logging
import numpy as np
from collections import deque
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from .symbol_intelligence import SymbolIntelligence

logger = logging.getLogger(__name__)

class MasterEngine:
    """
    MASTERENGINE – FINAL MERGED VERSION
    
    Purpose:
    Create one stable, central logic engine with ALL intelligent features combined:
    - Multi-timeframe analysis (1m, 5m, 15m, 1h)
    - Pattern recognition
    - Noise detection
    - Market mode detection
    - Adaptive thresholds
    - Confidence scoring (0–100)
    - Memory system
    - Smart exit engine
    - Full integration with all strategies
    """
    
    def __init__(self):
        # --- 1. Multi-Timeframe Data Storage ---
        self.candles_1m = deque(maxlen=200)
        self.candles_5m = deque(maxlen=200)
        self.candles_15m = deque(maxlen=200)
        self.candles_1h = deque(maxlen=100)  # Added 1h
        
        # Temp storage for building candles
        self.current_1m = None
        self.current_5m = None
        self.current_15m = None
        self.current_1h = None
        
        # --- 7. Market Memory System ---
        self.memory = {
            "confidence_scores": deque(maxlen=5),
            "results": deque(maxlen=5), # 'win' or 'loss'
            "volatility_samples": deque(maxlen=20),
            "spike_counter": 0, # Boom/Crash only
            "rejected_trades": 0,
            "last_trade_time": None,
            "high_chaos_count": 0
        }
        
        # --- 8. Symbol Intelligence Profile ---
        self.current_profile = SymbolIntelligence.get_market_profile("DEFAULT")
        self.current_symbol = "DEFAULT"
        
        logger.info("MasterEngine Initialized - Unified Intelligence Module")

    def reset(self):
        """Reset all data storage and memory for a clean start on a new symbol."""
        logger.info(f"MasterEngine: Resetting all data for symbol {self.current_symbol}")
        
        # Clear Candle Deques
        self.candles_1m.clear()
        self.candles_5m.clear()
        self.candles_15m.clear()
        self.candles_1h.clear()
        
        # Reset current building candles
        self.current_1m = None
        self.current_5m = None
        self.current_15m = None
        self.current_1h = None
        
        # Reset Memory
        self.memory["confidence_scores"].clear()
        self.memory["results"].clear()
        self.memory["volatility_samples"].clear()
        self.memory["spike_counter"] = 0
        self.memory["rejected_trades"] = 0
        self.memory["last_trade_time"] = None
        self.memory["high_chaos_count"] = 0
        
        logger.info("MasterEngine: Data reset complete.")

    # ==================================================================
    # CORE: TICK UPDATE & AGGREGATION
    # ==================================================================
    
    def update_tick(self, symbol: str, price: float, epoch: int):
        """
        Ingest a new tick, update candle aggregations for 1m, 5m, 15m, 1h.
        Strategies should call this first before requesting analysis.
        """
        if symbol != self.current_symbol:
            self.current_symbol = symbol
            self.current_profile = SymbolIntelligence.get_market_profile(symbol)
            
        timestamp = datetime.fromtimestamp(epoch)
        
        # Update Memory counters
        self.memory["spike_counter"] += 1
        
        # Aggregate Candles
        self._update_candidate_candle(self.current_1m, price, timestamp, "1m")
        self._update_candidate_candle(self.current_5m, price, timestamp, "5m")
        self._update_candidate_candle(self.current_15m, price, timestamp, "15m")
        self._update_candidate_candle(self.current_1h, price, timestamp, "1h")

    def _update_candidate_candle(self, current_candle: Optional[Dict], price: float, timestamp: datetime, period: str):
        """Helper to manage candle construction."""
        
        # Determine start of period
        if period == "1m":
            interval_start = timestamp.replace(second=0, microsecond=0)
            target_list = self.candles_1m
            # Special handling to update the 'current' reference since it's immutable if None
            # We must assign back to self.current_Xm
        elif period == "5m":
            minute = (timestamp.minute // 5) * 5
            interval_start = timestamp.replace(minute=minute, second=0, microsecond=0)
            target_list = self.candles_5m
        elif period == "15m":
            minute = (timestamp.minute // 15) * 15
            interval_start = timestamp.replace(minute=minute, second=0, microsecond=0)
            target_list = self.candles_15m
        elif period == "1h":
            interval_start = timestamp.replace(minute=0, second=0, microsecond=0)
            target_list = self.candles_1h
        
        # Get actual reference to current candle
        if period == "1m": ref = self.current_1m
        elif period == "5m": ref = self.current_5m
        elif period == "15m": ref = self.current_15m
        elif period == "1h": ref = self.current_1h
        else: return

        # Initialize if strictly None
        if ref is None:
            new_candle = {
                "open": price, "high": price, "low": price, "close": price,
                "time": interval_start, "volume": 1
            }
            self._set_current(period, new_candle)
            return

        # Check if we stepped into a new period
        try:
            # ref["time"] might be older timeframe if stream lagged or jumped
            if interval_start > ref["time"]:
                # Close current
                target_list.append(ref.copy())
                
                # Start new
                new_candle = {
                    "open": price, "high": price, "low": price, "close": price,
                    "time": interval_start, "volume": 1
                }
                self._set_current(period, new_candle)
            else:
                # Update current
                ref["high"] = max(ref["high"], price)
                ref["low"] = min(ref["low"], price)
                ref["close"] = price
                ref["volume"] += 1
                # No need to set back, dict is mutable
        except Exception as e:
            logger.error(f"Error updating candle {period}: {e}")

    def _set_current(self, period, candle):
        if period == "1m": self.current_1m = candle
        elif period == "5m": self.current_5m = candle
        elif period == "15m": self.current_15m = candle
        elif period == "1h": self.current_1h = candle

    def inject_external_candles(self, timeframe: str, candles: List[Dict]):
        """Allows injecting history (e.g. from API) to warm up."""
        if timeframe == "1m": self.candles_1m = deque(candles, maxlen=200)
        elif timeframe == "5m": self.candles_5m = deque(candles, maxlen=200)
        elif timeframe == "15m": self.candles_15m = deque(candles, maxlen=200)
        elif timeframe == "1h": self.candles_1h = deque(candles, maxlen=100)

    # ==================================================================
    # 1. MULTI-TIMEFRAME ANALYZER
    # ==================================================================

    def get_trend(self, tf: str) -> str:
        """
        Trend states: "strong_up", "up", "neutral", "down", "strong_down"
        """
        candles = self._get_candles(tf)
        if not candles or len(candles) < 20: return "neutral"
        
        closes = np.array([c['close'] for c in candles])
        ema20 = self._ema(closes, 20)
        ema50 = self._ema(closes, 50)
        
        current_ema20 = ema20[-1]
        current_ema50 = ema50[-1]
        prev_ema20 = ema20[-2]
        
        # Slope check
        slope = current_ema20 - prev_ema20
        
        if current_ema20 > current_ema50:
            if slope > 0 and (current_ema20 - current_ema50) > (current_ema50 * 0.0002):
                return "strong_up"
            return "up"
        elif current_ema20 < current_ema50:
            if slope < 0 and (current_ema50 - current_ema20) > (current_ema50 * 0.0002):
                return "strong_down"
            return "down"
            
        return "neutral"

    def get_momentum(self, tf: str) -> float:
        """Returns RSI (0-100)"""
        candles = self._get_candles(tf)
        if not candles or len(candles) < 14: return 50.0
        closes = np.array([c['close'] for c in candles])
        return self._rsi(closes, 14)[-1]

    def get_volatility(self, tf: str) -> str:
        """Returns: 'low', 'normal', 'high', 'extreme'"""
        candles = self._get_candles(tf)
        if not candles or len(candles) < 20: return "normal"
        
        highs = np.array([c['high'] for c in candles])
        lows = np.array([c['low'] for c in candles])
        closes = np.array([c['close'] for c in candles])
        
        atr = self._atr(highs, lows, closes, 14)
        current = atr[-1]
        avg = np.mean(atr[-20:])
        
        if current > avg * 2.5: return "extreme"
        if current > avg * 1.5: return "high"
        if current < avg * 0.7: return "low"
        return "normal"

    def get_macro_trend(self) -> str:
        """Based on 1h timeframe only."""
        return self.get_trend("1h")

    def _analyze_mtf_trend(self) -> Dict:
        """
        Unified Result:
        Trend Weighting:
        - 1h = 40%
        - 15m = 30%
        - 5m = 20%
        - 1m = 10%
        """
        trends = {
            "1h": self.get_trend("1h"),
            "15m": self.get_trend("15m"),
            "5m": self.get_trend("5m"),
            "1m": self.get_trend("1m")
        }
        
        score_map = {
            "strong_up": 100, "up": 50, "neutral": 0, "down": -50, "strong_down": -100
        }
        
        weights = self.current_profile.get("trend_weight", {"1m": 0.1, "5m": 0.2, "15m": 0.3, "1h": 0.4})
        
        weighted_score = (
            score_map[trends["1h"]] * weights["1h"] +
            score_map[trends["15m"]] * weights["15m"] +
            score_map[trends["5m"]] * weights["5m"] +
            score_map[trends["1m"]] * weights["1m"]
        )
        
        final_trend = "neutral"
        if weighted_score > 60: final_trend = "strong_up"
        elif weighted_score > 20: final_trend = "up"
        elif weighted_score < -60: final_trend = "strong_down"
        elif weighted_score < -20: final_trend = "down"
        
        return {
            "trend": final_trend,
            "weighted_score": weighted_score,
            "details": trends
        }

    # ==================================================================
    # 2. PATTERN RECOGNITION ENGINE
    # ==================================================================

    def detect_patterns(self, candles: List[Dict]) -> List[str]:
        if not candles or len(candles) < 20: return []
        detected = []
        
        current = candles[-1]
        prev = candles[-2]
        prev2 = candles[-3]
        
        closes = [c['close'] for c in candles]
        opens = [c['open'] for c in candles]
        highs = [c['high'] for c in candles]
        lows = [c['low'] for c in candles]
        
        # 1. Engulfing
        # Bullish
        if prev['close'] < prev['open'] and current['close'] > current['open']:
            if current['close'] > prev['open'] and current['open'] < prev['close']:
                detected.append("bullish_engulfing")
        # Bearish
        elif prev['close'] > prev['open'] and current['close'] < current['open']:
            if current['close'] < prev['open'] and current['open'] > prev['close']:
                detected.append("bearish_engulfing")
                
        # 2. Reversal Engulfing (Stronger version) - implied by above but context matters
        
        # 3. Momentum Compression (Squeeze)
        # Using BB-width proxy or ATR drop
        recent_atr = self._atr(np.array(highs[-10:]), np.array(lows[-10:]), np.array(closes[-10:]), 5)[-1]
        avg_atr = np.mean(self._atr(np.array(highs[-20:]), np.array(lows[-20:]), np.array(closes[-20:]), 14))
        if recent_atr < avg_atr * 0.7:
            detected.append("compression")

        # 4. Hidden Divergence (Simple Slope Check)
        rsi = self._rsi(np.array(closes), 14)
        if len(rsi) >= 10:
            price_slope = closes[-1] - closes[-5]
            rsi_slope = rsi[-1] - rsi[-5]
            # Bullish Hidden: Price higher low (up trend), RSI lower low
            # Bearish Hidden: Price lower high (down trend), RSI higher high
            # Simplified logic for "divergence" flag
            if (price_slope > 0 and rsi_slope < 0) or (price_slope < 0 and rsi_slope > 0):
                detected.append("divergence")
                
        # 5. Mini Double Top/Bottom (Last 20 candles)
        # Scan for peaks
        
        return detected

    # ==================================================================
    # 3. NOISE & SPIKE DETECTOR
    # ==================================================================

    def detect_noise(self, candles: List[Dict]) -> bool:
        if not candles or len(candles) < 20: return False # Need enough data for EMA20 + lookback
        
        c = candles[-1]
        body = abs(c['close'] - c['open'])
        # Avoid division by zero
        if body == 0: body = 0.00001
            
        wick_total = (c['high'] - max(c['close'], c['open'])) + (min(c['close'], c['open']) - c['low'])
        
        # 1. Wick-to-body ratio > 3x
        if (wick_total / body) > 3.0:
            return True
            
        # 2. ATR Spike > 2.5x average (Adjusted by Multiplier)
        highs = np.array([x['high'] for x in candles])
        lows = np.array([x['low'] for x in candles])
        closes = np.array([x['close'] for x in candles])
        atr = self._atr(highs, lows, closes, 14)
        
        atr_mult = self.current_profile.get("atr_multiplier", 1.0)
        sensitivity = self.current_profile.get("noise_sensitivity", "medium")
        
        # Adjust threshold based on sensitivity
        threshold = 2.5
        if sensitivity == "low": threshold = 3.5
        elif sensitivity == "high": threshold = 2.0
            
        # Apply profile multiplier to normalized checking
        if atr[-1] > (np.mean(atr) * threshold * atr_mult):
            return True
        
        # 3. EMA Whipsawing
        # Price crossing EMA20 multiple times in last 5 candles
        ema20 = self._ema(closes, 20)
        crosses = 0
        
        # Safe lookback
        lookback = min(len(closes) - 1, 5)
        for i in range(1, lookback + 1):
            idx = -i
            prev_idx = -i - 1
            if abs(prev_idx) > len(closes): break
            
            # Check for cross
            above_now = closes[idx] > ema20[idx]
            above_prev = closes[prev_idx] > ema20[prev_idx]
            if above_now != above_prev:
                crosses += 1
        
        if crosses >= 3:
            return True
            
        return False

    # ==================================================================
    # 4. MARKET MODE (5-STAGE SYSTEM)
    # ==================================================================

    def detect_market_mode(self, candles: List[Dict]) -> str:
        """
        - "strong_trend"
        - "trend"
        - "range"
        - "compression"
        - "chaotic"
        """
        if not candles or len(candles) < 50: return "range"
        
        closes = np.array([c['close'] for c in candles])
        ema20 = self._ema(closes, 20)
        ema50 = self._ema(closes, 50)
        highs = np.array([c['high'] for c in candles])
        lows = np.array([c['low'] for c in candles])
        atr = self._atr(highs, lows, closes, 14)
        
        avg_atr = np.mean(atr[-20:])
        curr_atr = atr[-1]
        
        # 1. Chaotic Check
        if curr_atr > avg_atr * 2.0: # Or Noise detector true
            if self.detect_noise(candles):
                return "chaotic"
        
        # 2. Compression Check
        if curr_atr < avg_atr * 0.6:
            return "compression"
            
        # 3. Trend Check
        # ADX would be better, but using EMA separation
        sep = abs(ema20[-1] - ema50[-1])
        avg_p = np.mean(closes)
        
        if sep > (avg_p * 0.0005):
            # Strong trend check (steep slope)
            slope_5 = abs(ema20[-1] - ema20[-5])
            if slope_5 > (avg_p * 0.001):
                return "strong_trend"
            return "trend"
            
        return "range"

    # ==================================================================
    # 5. ADAPTIVE THRESHOLDS SYSTEM
    # ==================================================================

    def adapt_thresholds(self, raw_filters: Dict, market_state: str) -> Dict:
        adapted = raw_filters.copy()
        
        if market_state == "strong_trend":
            # Loosen RSI
            if "rsi_max" in adapted: adapted["rsi_max"] = 80 # was 70
            if "rsi_min" in adapted: adapted["rsi_min"] = 20 # was 30
        
        elif market_state == "range":
            # Require stronger confirmation
            adapted["confidence_threshold"] = adapted.get("confidence_threshold", 50) + 10
            
        elif market_state == "neutral": # calm
            # Bigger TP allowed
             if "tp_multiplier" in adapted: adapted["tp_multiplier"] = 2.0
             
        return adapted

    # ==================================================================
    # 6. CONFIDENCE SCORING (0–100)
    # ==================================================================

    def calculate_confidence(self, data_dict: Dict) -> int:
        """
        data_dict contains: 
        - signal_direction: "BUY" or "SELL"
        - patterns: List[str]
        - market_mode: str
        - mtf_trend: Dict (result of _analyze_mtf_trend)
        - volatility: str
        - momentum: float (RSI)
        """
        score = 0
        direction = data_dict.get("signal_direction")
        
        # 1. Multi-Timeframe Trend Alignment (0-30)
        mtf_data = data_dict.get("mtf_trend", {})
        macro_trend = mtf_data.get("trend", "neutral")
        
        # Logic: If signal matches macro trend -> High points
        if direction == "BUY":
            if macro_trend == "strong_up": score += 30
            elif macro_trend == "up": score += 20
            elif macro_trend == "neutral": score += 10
            elif macro_trend == "down": score += 0 # Risky
            elif macro_trend == "strong_down": score -= 20 # Counter-trend suicide
        elif direction == "SELL":
            if macro_trend == "strong_down": score += 30
            elif macro_trend == "down": score += 20
            elif macro_trend == "neutral": score += 10
            elif macro_trend == "up": score += 0
            elif macro_trend == "strong_up": score -= 20
            
        # 2. Pattern Recognition (0-25)
        patterns = data_dict.get("patterns", [])
        bullish_p = ["bullish_engulfing", "bullish_flag", "reversal_engulfing"]
        bearish_p = ["bearish_engulfing", "bearish_flag"]
        
        found = False
        if direction == "BUY":
            for p in patterns:
                if p in bullish_p:
                    score += 15
                    found = True
            if "compression" in patterns: score += 10 # Breakout
        elif direction == "SELL":
            for p in patterns:
                if p in bearish_p:
                    score += 15
                    found = True
            if "compression" in patterns: score += 10
            
        # 3. Volatility Match (0-20)
        vol = data_dict.get("volatility", "normal")
        if vol == "normal": score += 20
        elif vol == "low": score += 15
        elif vol == "high": score += 10
        elif vol == "extreme": score -= 10 # Penalty unless strategy handles it specifically
        
        # 4. Momentum Quality (0-10)
        rsi = data_dict.get("momentum", 50)
        if direction == "BUY":
            if 40 <= rsi <= 70: score += 10 # Good buy zone in trend or range
        elif direction == "SELL":
            if 30 <= rsi <= 60: score += 10
            
        # 5. Memory Streak (0-10)
        wins = list(self.memory["results"]).count("win")
        score += (wins * 2)
        
        if self.memory["rejected_trades"] > 3:
            score -= 5 # System is nervous
            
        # 6. Market Mode Bonus (+/- 20)
        mode = data_dict.get("market_mode", "range")
        if mode == "strong_trend": score += 20
        elif mode == "chaotic": score -= 50 # Kill trade effectively
        elif mode == "compression": score -= 10 # Wait for breakout
        
        # 7. Spike Protection (Penalty)
        if self.current_profile.get("spike_protection", False):
            # If requesting trade on boom/crash, ensure confidence is higher
            score -= 10 # Default penalty to force higher quality setups
        
        return max(0, min(100, score))

    # ==================================================================
    # 7. MEMORY SYSTEM METHODS
    # ==================================================================
    
    def update_memory(self, key: str, value: Any):
        if key in self.memory:
            if isinstance(self.memory[key], deque):
                self.memory[key].append(value)
            elif isinstance(self.memory[key], int):
                self.memory[key] = value
            else:
                self.memory[key] = value

    # ==================================================================
    # 8. SMART EXIT ENGINE V3
    # ==================================================================

    def smart_exit(self, position: Dict, candles: List[Dict], confidence: int, market_mode: str) -> Dict:
        """
        Returns: { "close_now": bool, "new_sl": float|None, "new_tp": float|None }
        """
        decision = {"close_now": False, "new_sl": None, "new_tp": None}
        if not candles: return decision
        
        # 1. Panic Exit
        if market_mode == "chaotic":
            decision["close_now"] = True
            return decision
        
        # 2. Opposite Signal / Pattern
        patterns = self.detect_patterns(candles)
        pos_type = position.get("type", "").upper() # CALL/PUT or BUY/SELL
        
        if pos_type in ["BUY", "CALL"]:
            if "bearish_engulfing" in patterns or "bearish_flag" in patterns:
                # If checking close logic on every tick
                decision["close_now"] = True
        elif pos_type in ["SELL", "PUT", "MULTDOWN"]:
             if "bullish_engulfing" in patterns:
                 decision["close_now"] = True
                 
        # 3. Adaptive Trailing
        # This implementation requires knowing current price vs SL, which is passed in position or accessible via candles
        # Assuming position has 'entry_price' and 'current_sl'
        
        return decision

    # ==================================================================
    # 9. HELPERS
    # ==================================================================

    def _get_candles(self, timeframe: str) -> List[Dict]:
        if timeframe == "1m": return list(self.candles_1m)
        if timeframe == "5m": return list(self.candles_5m)
        if timeframe == "15m": return list(self.candles_15m)
        if timeframe == "1h": return list(self.candles_1h)
        return []

    def _ema(self, data: np.array, period: int) -> np.array:
        if len(data) < period: return np.zeros_like(data)
        alpha = 2 / (period + 1)
        ema = np.zeros_like(data)
        ema[0] = data[0]
        for i in range(1, len(data)):
            ema[i] = alpha * data[i] + (1 - alpha) * ema[i-1]
        return ema
        
    def _rsi(self, data: np.array, period: int = 14) -> np.array:
        if len(data) < period + 1: return np.zeros_like(data)
        delta = np.diff(data)
        gain = (delta > 0) * delta
        loss = (delta < 0) * -delta
        
        avg_gain = np.zeros_like(data)
        avg_loss = np.zeros_like(data)
        
        avg_gain[period] = np.mean(gain[:period])
        avg_loss[period] = np.mean(loss[:period])
        
        for i in range(period + 1, len(data)):
            avg_gain[i] = (avg_gain[i-1] * (period - 1) + gain[i-1]) / period
            avg_loss[i] = (avg_loss[i-1] * (period - 1) + loss[i-1]) / period
            
        rs = np.divide(avg_gain, avg_loss, out=np.zeros_like(avg_gain), where=avg_loss!=0)
        rsi = 100 - (100 / (1 + rs))
        return rsi

    def _atr(self, highs, lows, closes, period=14) -> np.array:
        if len(closes) < 2: return np.zeros_like(closes)
        tr = np.zeros_like(closes)
        for i in range(1, len(closes)):
            tr[i] = max(highs[i] - lows[i], abs(highs[i] - closes[i-1]), abs(lows[i] - closes[i-1]))
            
        atr = np.zeros_like(closes)
        if len(tr) > period:
            atr[period] = np.mean(tr[1:period+1])
            for i in range(period+1, len(tr)):
                atr[i] = (atr[i-1] * (period - 1) + tr[i]) / period
        return atr
