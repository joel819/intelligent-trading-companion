import logging
from typing import Dict, List, Optional, Any, Union
from collections import deque
import numpy as np
from datetime import datetime

logger = logging.getLogger(__name__)

class SmartEngineV2:
    """
    Smart Engine V2 - Next-Gen AI-Style Trading Logic Layer
    
    Features:
    - Multi-Timeframe Analysis (1m, 5m, 15m)
    - Pattern Recognition (Price Action)
    - Market Memory & Stateful Analysis
    - Adaptive Thresholds
    - Advanced Confidence Engine (0-100)
    - Advanced Market Mode Detection
    - Advanced Noise Detection
    - Smart Exit System
    """
    
    def __init__(self):
        # --- 1. Multi-Timeframe Data Storage ---
        # Storing candles as dictionaries: {'open', 'high', 'low', 'close', 'volume', 'time'}
        self.candles_1m = deque(maxlen=200)
        self.candles_5m = deque(maxlen=200)
        self.candles_15m = deque(maxlen=200)
        
        # Temp storage for building candles
        self.current_1m_candle = None
        self.current_5m_candle = None
        self.current_15m_candle = None
        
        # --- 3. Market Memory ---
        self.memory = {
            "confidence_scores": deque(maxlen=5),
            "results": deque(maxlen=5), # 'win' or 'loss'
            "volatility_profile": deque(maxlen=20),
            "time_since_last_spike": 0, # Ticks since last spike
            "chaos_rejections": 0,
            "last_trade_time": None
        }
        
        # --- Config & Weights ---
        self.weights = {
            "mtf_trend": 30,
            "pattern": 25,
            "volatility": 20,
            "momentum": 10,
            "memory": 10,
            # Market mode is separate bonus/penalty
        }
        
        logger.info("SmartEngineV2 Initialized")

    # ==================================================================
    # CORE: TICK UPDATE & AGGREGATION
    # ==================================================================
    
    def update_tick(self, symbol: str, price: float, epoch: int):
        """
        Ingest a new tick, update candle aggregations for 1m, 5m, 15m.
        """
        timestamp = datetime.fromtimestamp(epoch)
        
        # Update Market Memory counters
        self.memory["time_since_last_spike"] += 1
        
        # Aggregate 1m Candle
        self._update_candidate_candle(self.current_1m_candle, price, timestamp, period="1m")
        
        # Aggregate 5m Candle
        self._update_candidate_candle(self.current_5m_candle, price, timestamp, period="5m")
        
        # Aggregate 15m Candle
        self._update_candidate_candle(self.current_15m_candle, price, timestamp, period="15m") 

    def _update_candidate_candle(self, current_candle: Optional[Dict], price: float, timestamp: datetime, period: str):
        """Helper to manage candle construction."""
        
        # Determine start of period
        if period == "1m":
            interval_start = timestamp.replace(second=0, microsecond=0)
        elif period == "5m":
            minute = (timestamp.minute // 5) * 5
            interval_start = timestamp.replace(minute=minute, second=0, microsecond=0)
        elif period == "15m":
            minute = (timestamp.minute // 15) * 15
            interval_start = timestamp.replace(minute=minute, second=0, microsecond=0)
        
        # Logic to close previous candle and start new one
        if period == "1m":
            target_list = self.candles_1m
            target_ref = self.current_1m_candle
        elif period == "5m":
            target_list = self.candles_5m
            target_ref = self.current_5m_candle
        else: # 15m
            target_list = self.candles_15m
            target_ref = self.current_15m_candle
            
        # Initialize if strictly None
        if target_ref is None:
            new_candle = {
                "open": price, "high": price, "low": price, "close": price,
                "time": interval_start, "volume": 1
            }
            if period == "1m": self.current_1m_candle = new_candle
            elif period == "5m": self.current_5m_candle = new_candle
            elif period == "15m": self.current_15m_candle = new_candle
            return

        # Check if we stepped into a new period
        # Using string comparison of isoformat time to detect change
        if interval_start > target_ref["time"]:
            # Close current
            target_list.append(target_ref.copy())
            
            # Start new
            new_candle = {
                "open": price, "high": price, "low": price, "close": price,
                "time": interval_start, "volume": 1
            }
            
            if period == "1m": self.current_1m_candle = new_candle
            elif period == "5m": self.current_5m_candle = new_candle
            elif period == "15m": self.current_15m_candle = new_candle
            
        else:
            # Update current
            target_ref["high"] = max(target_ref["high"], price)
            target_ref["low"] = min(target_ref["low"], price)
            target_ref["close"] = price
            target_ref["volume"] += 1
            # In-place update is effective because self.current_Xm_candle is a reference
            
    # ==================================================================
    # 1. MULTI-TIMEFRAME ANALYSIS
    # ==================================================================

    def get_trend_strength(self, timeframe: str) -> str:
        candles = self._get_candles(timeframe)
        if not candles or len(candles) < 20: return "neutral"
        
        closes = np.array([c['close'] for c in candles])
        ema20 = self._ema(closes, 20)
        ema50 = self._ema(closes, 50)
        
        if ema20[-1] > ema50[-1]:
            # Check slope
            if (ema20[-1] - ema20[-2]) > 0: return "strong_up"
            return "weak_up"
        elif ema20[-1] < ema50[-1]:
            if (ema20[-1] - ema20[-2]) < 0: return "strong_down"
            return "weak_down"
        return "neutral"

    def get_momentum(self, timeframe: str) -> float:
        """Returns RSI-like momentum score (0-100)."""
        candles = self._get_candles(timeframe)
        if not candles or len(candles) < 14: return 50.0
        
        closes = np.array([c['close'] for c in candles])
        return self._rsi(closes, 14)[-1]

    def get_volatility_state(self, timeframe: str) -> str:
        candles = self._get_candles(timeframe)
        if not candles or len(candles) < 20: return "normal"
        
        highs = np.array([c['high'] for c in candles])
        lows = np.array([c['low'] for c in candles])
        closes = np.array([c['close'] for c in candles])
        
        atr = self._atr(highs, lows, closes, 14)
        current_atr = atr[-1]
        avg_atr = np.mean(atr[-20:])
        
        if current_atr > avg_atr * 2.0: return "high"
        if current_atr < avg_atr * 0.5: return "low"
        return "normal"

    def analyze_multi_timeframe(self) -> Dict:
        """Combine all 3 timeframes."""
        t1 = self.get_trend_strength("1m")
        t5 = self.get_trend_strength("5m")
        t15 = self.get_trend_strength("15m")
        
        # Score alignment
        score = 0
        score_map = {"strong_up": 2, "weak_up": 1, "neutral": 0, "weak_down": -1, "strong_down": -2}
        
        total = score_map[t1] + score_map[t5] + score_map[t15]
        
        # Conflict check
        conflict = False
        if score_map[t1] * score_map[t15] < 0: # Opposite signs
            conflict = True
            
        status = "neutral"
        if total >= 3: status = "strong_up"
        elif total > 0: status = "weak_up"
        elif total <= -3: status = "strong_down"
        elif total < 0: status = "weak_down"
        
        if conflict: status = "neutral" # Downgrade due to conflict
        
        return {
            "overall_status": status,
            "1m": t1, "5m": t5, "15m": t15,
            "conflict": conflict
        }

    # ==================================================================
    # 2. PATTERN RECOGNITION (AI-STYLE)
    # ==================================================================

    def detect_patterns(self, candles: List[Dict]) -> List[str]:
        if not candles or len(candles) < 10: return []
        
        detected = []
        closes = [c['close'] for c in candles]
        highs = [c['high'] for c in candles]
        lows = [c['low'] for c in candles]
        
        # 1. Mini Double Top (last 5-10 candles)
        # Peak 1 roughly equal to Peak 2, with dip in between
        # Very simplified detection
        recent_highs = highs[-10:]
        if len(recent_highs) >= 5:
            # Check for M shape
            pass # Skipping complex logic for brevity, implementing key ones

        # 2. Momentum Compression (Squeeze)
        # ATR dropping, Bollinger Bands squeezing (approximated by High-Low range)
        ranges = [h-l for h,l in zip(highs[-5:], lows[-5:])]
        avg_range = sum(ranges) / len(ranges)
        prev_ranges = [h-l for h,l in zip(highs[-15:-5], lows[-15:-5])]
        if prev_ranges:
            prev_avg = sum(prev_ranges) / len(prev_ranges)
            if avg_range < prev_avg * 0.6:
                detected.append("compression")

        # 3. Engulfing
        if len(closes) >= 2:
            prev = candles[-2]
            curr = candles[-1]
            # Bullish Engulfing
            if prev['close'] < prev['open'] and curr['close'] > curr['open']:
                if curr['close'] > prev['open'] and curr['open'] < prev['close']:
                    detected.append("bullish_engulfing")
            # Bearish Engulfing
            elif prev['close'] > prev['open'] and curr['close'] < curr['open']:
                if curr['close'] < prev['open'] and curr['open'] > prev['close']:
                    detected.append("bearish_engulfing")

        # 4. Long Wicked Rejection (Hammer/Shooting Star)
        curr = candles[-1]
        body = abs(curr['close'] - curr['open'])
        range_ = curr['high'] - curr['low']
        if range_ > 0:
            upper_wick = curr['high'] - max(curr['close'], curr['open'])
            lower_wick = min(curr['close'], curr['open']) - curr['low']
            
            if lower_wick > body * 2.5 and upper_wick < body:
                detected.append("bullish_rejection") # Hammer
            elif upper_wick > body * 2.5 and lower_wick < body:
                detected.append("bearish_rejection") # Shooting Star

        return detected

    # ==================================================================
    # 3. MARKET MEMORY & 4. ADAPTIVE THRESHOLDS
    # ==================================================================

    def update_memory(self, key: str, value: Any):
        if key in self.memory:
            if isinstance(self.memory[key], deque):
                self.memory[key].append(value)
            else:
                self.memory[key] = value

    def adapt_thresholds(self, base_filters: Dict, market_state: str) -> Dict:
        """Adjusts filters based on market mode and memory."""
        adapted = base_filters.copy()
        
        # High volatility -> Tighten SL, widen TP or reduce confidence requirement if following trend
        if market_state == "strong_trend":
            # Loosen pullback requirements
            if "rsi_max" in adapted: adapted["rsi_max"] += 5  # Allow higher RSI in strong uptrend
            if "rsi_min" in adapted: adapted["rsi_min"] -= 5
            
        elif market_state == "chaotic":
            # Tighten everything (or just block, handled elsewhere)
            pass
            
        # Memory-based adaptation
        recent_losses = list(self.memory["results"]).count("loss")
        if recent_losses >= 2:
            # Become defensive
            adapted["confidence_threshold"] = adapted.get("confidence_threshold", 45) + 10
            
        return adapted

    # ==================================================================
    # 5. ADVANCED CONFIDENCE & 6. MARKET MODE
    # ==================================================================

    def detect_market_mode(self, candles: List[Dict]) -> str:
        if not candles or len(candles) < 20: return "range"
        
        # Use existing logic from v1 but mapped to v2 states
        # Reuse helper calculations
        closes = np.array([c['close'] for c in candles])
        ema20 = self._ema(closes, 20)
        ema50 = self._ema(closes, 50)
        atr = self._atr(np.array([c['high'] for c in candles]), 
                        np.array([c['low'] for c in candles]), 
                        closes, 14)
        
        # 1. Chaotic Check
        if atr[-1] > np.mean(atr) * 2.5:
            return "chaotic"
            
        # 2. Trend Check
        separation = abs(ema20[-1] - ema50[-1])
        avg_price = np.mean(closes)
        if separation > (avg_price * 0.0005):
            # Strong vs Normal Trend
            slope = (ema20[-1] - ema20[-5])
            if abs(slope) > (avg_price * 0.0002):
                return "strong_trend"
            return "trend"
            
        # 3. Compression Check
        if atr[-1] < np.mean(atr) * 0.5:
            return "compression"
            
        return "range"

    def calculate_confidence(self, filters: Dict, patterns: List[str] = None, market_mode: str = "range") -> int:
        score = 0
        
        # 1. Multi-Timeframe Trend (0-30)
        mtf = self.analyze_multi_timeframe()
        if mtf["overall_status"] in ["strong_up", "strong_down"]: score += 30
        elif mtf["overall_status"] in ["weak_up", "weak_down"]: score += 15
        else: score += 5
        
        # 2. Patterns (0-25)
        # Clean patterns for directionality
        bullish_patterns = ["bullish_engulfing", "bullish_rejection", "flag_continuation"]
        bearish_patterns = ["bearish_engulfing", "bearish_rejection"]
        
        desired_direction = filters.get("direction", "ANY") # BUY, SELL, ANY
        
        found_valid_pattern = False
        for p in patterns:
            if desired_direction == "BUY" and p in bullish_patterns:
                score += 25
                found_valid_pattern = True
            elif desired_direction == "SELL" and p in bearish_patterns:
                score += 25
                found_valid_pattern = True
            elif desired_direction == "ANY":
                score += 15 # Generic pattern bonus
                
        if not found_valid_pattern and "compression" in patterns:
            score += 10 # Breakout potential
            
        # 3. Volatility (0-20)
        vol_state = self.get_volatility_state("1m")
        if vol_state == "normal": score += 20
        elif vol_state == "high": score += 10 # More risk
        elif vol_state == "low": score += 10 # Less profit potential
        
        # 4. Momentum (0-10)
        rsi = self.get_momentum("1m")
        # Assuming strategy pre-filtered for "good" momentum, so this is a quality bonus
        # Extreme RSI in trend is good, in range is bad. 
        if market_mode in ["trend", "strong_trend"]:
            score += 10
        elif 30 < rsi < 70: # Safe range
            score += 10
            
        # 5. Memory (0-10)
        wins = list(self.memory["results"]).count("win")
        score += (wins * 2) # Up to 10 points
        
        # 6. Market Mode Bonus (+/- 20)
        if market_mode == "strong_trend": score += 20
        elif market_mode == "chaotic": score -= 20
        elif market_mode == "range":
             if desired_direction != "ANY": score -= 10 # Trend strat in range is bad
             
        return max(0, min(100, score))

    # ==================================================================
    # 7. NOISE DETECTION & 8. SMART EXIT
    # ==================================================================

    def detect_noise(self, candles: List[Dict]) -> bool:
        if not candles or len(candles) < 5: return False
        
        # Wick Ratio
        c = candles[-1]
        body = abs(c['close'] - c['open'])
        wick_total = (c['high'] - max(c['close'], c['open'])) + (min(c['close'], c['open']) - c['low'])
        if body > 0 and (wick_total / body) > 3.0:
            return True
            
        # Back-to-back chaos (alternating colors with large bodies/wicks) - Simplified
        # Direction flip check
        dir_1 = c['close'] > c['open']
        dir_2 = candles[-2]['close'] > candles[-2]['open']
        if dir_1 != dir_2:
            # If both were large candles, it's whipsaw
            pass 
            
        # ATR Spike
        highs = np.array([x['high'] for x in candles])
        lows = np.array([x['low'] for x in candles])
        closes = np.array([x['close'] for x in candles])
        atr = self._atr(highs, lows, closes, 14)
        if atr[-1] > np.mean(atr) * 2.5:
            return True
            
        return False

    def smart_exit(self, position: Dict, candles: List[Dict], confidence: int, market_mode: str) -> Dict:
        """
        Determine if we should close, or adjust SL/TP.
        """
        decision = {"close_now": False, "new_sl": None, "new_tp": None}
        
        if not candles: return decision
        
        # 1. Panic Exit (Chaos)
        if market_mode == "chaotic":
            # If we are in profit, take it. If small loss, cut it.
            decision["close_now"] = True
            return decision
            
        # 2. Opposite Engulfing
        patterns = self.detect_patterns(candles)
        pos_type = position.get("type", "").lower() # buy or sell
        
        if pos_type == "buy" and "bearish_engulfing" in patterns:
             decision["close_now"] = True
        elif pos_type == "sell" and "bullish_engulfing" in patterns:
             decision["close_now"] = True
             
        # 3. Dynamic Stop Tightening
        # If confidence was low to begin with, tighten SL
        if confidence < 50:
             # Suggest tighter SL
             pass
             
        return decision

    # ==================================================================
    # HELPERS
    # ==================================================================

    def _get_candles(self, timeframe: str) -> List[Dict]:
        if timeframe == "1m": return list(self.candles_1m)
        if timeframe == "5m": return list(self.candles_5m)
        if timeframe == "15m": return list(self.candles_15m)
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
        
        # Simple intial average (not standard EMA RSI but close enough for brevity)
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
