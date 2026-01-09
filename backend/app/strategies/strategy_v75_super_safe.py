"""
V75 Super Safe Strategy
Specialized strategy for Volatility 75 Index with Scalping Optimization.
"""

from typing import Dict, Optional, Any, List
from .base_strategy import BaseStrategy
from ..signals.ultra_fast_filter import ultra_fast_filter
import logging
import numpy as np

logger = logging.getLogger(__name__)

class V75SuperSafeStrategy(BaseStrategy):
    """V75 Super Safe Strategy optimized for Volatility 75 Index scalping."""
    
    def __init__(self):
        super().__init__("v75_super_safe", {
            # Market Settings
            "symbol": "VOLATILITY_75",
            "timeframe": "1m",
            "confirm_timeframe": "5m",
            "max_trades_per_signal": 1,
            "min_pause_minutes": 5,
            "max_pause_minutes": 10,
            
            # Volatility Filters
            "min_volatility": 0.05,
            "max_volatility": 5.0,
            "noise_threshold": 0.15,
            "min_candle_body_pct": 0.30,
            "max_wick_pct": 0.85,
            
            # Trend Filter
            "use_ma_trend": True,
            "ma_fast": 14,
            "ma_slow": 40,
            "min_ma_slope": 0.0015,
            "adx_threshold": 18,
            "sideways_slope_threshold": 0.0008,
            
            # Entry Logic (HARDENED)
            "rsi_period": 14,
            "rsi_buy_min": 50,
            "rsi_buy_max": 68,
            "rsi_sell_min": 32,
            "rsi_sell_max": 50,
            "require_macd_confirmation": True,
            "reject_wick_spikes": True,
            "min_confidence": 70,
            
            # Risk Management (Adjusted for V75 Price ~44k - 100k)
            "sl_points_min": 50,
            "sl_points_max": 400,
            "tp_points_min": 80,
            "tp_points_max": 800,
            "target_rr": 1.5,
            "atr_sl_multiplier": 2.5,
            
            # Lot Sizing
            "stake_default": 0.01, # V75 min stake is very low, usually 0.01-0.05
            "stake_low_balance": 0.01,
            "stake_high_balance": 0.05,
            
            # Cooldown
            "cooldown_win_min": 300,
            "cooldown_win_max": 600,
            "cooldown_loss_min": 600,
            "cooldown_loss_max": 1200,
        })

    def analyze(self, tick_data: Dict, engine: Any, structure_data: Dict, indicator_data: Dict, h1_candles=None) -> Optional[Dict]:
        price = float(tick_data.get('quote', 0))
        rsi = indicator_data.get('rsi', 50)
        ma_slope = indicator_data.get('ma_slope', 0)
        ma_trend = indicator_data.get('ma_trend', 'neutral')
        
        # === MASTER ENGINE PRE-CHECKS ===
        candles_1m = list(engine.candles_1m)
        market_mode = engine.detect_market_mode(candles_1m)
        noise_detected = engine.detect_noise(candles_1m)
        mtf_data = engine._analyze_mtf_trend()
        patterns = engine.detect_patterns(candles_1m)
        volatility_state = engine.get_volatility("1m")
        
        mtf_trend = mtf_data.get("trend", "neutral")
        
        if noise_detected:
             return None
             
        if market_mode == "chaotic":
             return None
        
        # === FILTER 2: Trend Validation ===
        if abs(ma_slope) < self.config["sideways_slope_threshold"]:
            logger.info(f"[V75] Trade rejected: Sideways market (Slope: {ma_slope:.6f}, RSI: {rsi:.1f})")
            return None

        # === BUY LOGIC ===
        if ma_trend == "bullish" or (ma_trend == "neutral" and rsi > 55):
            # HARD BLOCK: Reject trades against H1 trend
            if mtf_trend == "bearish":
                logger.info(f"[V75] BUY BLOCKED: H1 Trend Bearish - Hard Entry Active")
                return None
            
            # RSI Confirmation
            if not (self.config["rsi_buy_min"] <= rsi <= self.config["rsi_buy_max"]):
                return None
                
            # Hybrid RSI from IndicatorLayer
            rsi_hybrid = None
            if hasattr(engine, 'indicator_layer'):
                rsi_hybrid = engine.indicator_layer.get_multi_rsi_confirmation("BUY")
            
            if rsi_hybrid and not rsi_hybrid.get("allow_buy", True):
                return None
                
            # --- ULTRA-FAST ENTRY FILTER ---
            current_candle = candles_1m[-1] if candles_1m else None
            if current_candle:
                fast_filter = ultra_fast_filter.filter_entry(
                    current_candle, 
                    "BUY", 
                    rsi_momentum_up=rsi_hybrid.get("momentum_up") if rsi_hybrid else None
                )
                if not fast_filter["allow_entry"]:
                    return None

            # Calculate ATR for SL/TP
            closes = np.array([c['close'] for c in candles_1m])
            highs = np.array([c['high'] for c in candles_1m])
            lows = np.array([c['low'] for c in candles_1m])
            curr_atr = 0
            if len(closes) > 15:
                # Basic ATR
                tr = np.maximum(highs[1:] - lows[1:], 
                                np.maximum(np.abs(highs[1:] - closes[:-1]), 
                                          np.abs(lows[1:] - closes[:-1])))
                curr_atr = np.mean(tr[-14:])
            
            sl_dist, tp_dist = self.calculate_sl_tp(price, curr_atr, "BUY", rr_ratio=1.5)
            
            return {
                "action": "BUY",
                "tp": tp_dist, 
                "sl": sl_dist,
                "confidence": 65 if ma_trend == "bullish" else 45, 
                "market_mode": market_mode,
                "strategy": self.name,
                "details": {"trend": ma_trend, "rsi": rsi, "mtf": mtf_trend}
            }

        # === SELL LOGIC ===
        if ma_trend == "bearish" or (ma_trend == "neutral" and rsi < 45):
            # HARD BLOCK: Reject trades against H1 trend
            if mtf_trend == "bullish":
                logger.info(f"[V75] SELL BLOCKED: H1 Trend Bullish - Hard Entry Active")
                return None
            
            if not (self.config["rsi_sell_min"] <= rsi <= self.config["rsi_sell_max"]):
                return None
                
            rsi_hybrid = None
            if hasattr(engine, 'indicator_layer'):
                rsi_hybrid = engine.indicator_layer.get_multi_rsi_confirmation("SELL")
            
            if rsi_hybrid and not rsi_hybrid.get("allow_sell", True):
                return None
                
            # --- ULTRA-FAST ENTRY FILTER ---
            current_candle = candles_1m[-1] if candles_1m else None
            if current_candle:
                fast_filter = ultra_fast_filter.filter_entry(
                    current_candle, 
                    "SELL", 
                    rsi_momentum_down=rsi_hybrid.get("momentum_down") if rsi_hybrid else None
                )
                if not fast_filter["allow_entry"]:
                    return None

            closes = np.array([c['close'] for c in candles_1m])
            highs = np.array([c['high'] for c in candles_1m])
            lows = np.array([c['low'] for c in candles_1m])
            curr_atr = 0
            if len(closes) > 15:
                tr = np.maximum(highs[1:] - lows[1:], 
                                np.maximum(np.abs(highs[1:] - closes[:-1]), 
                                          np.abs(lows[1:] - closes[:-1])))
                curr_atr = np.mean(tr[-14:])
            
            sl_dist, tp_dist = self.calculate_sl_tp(price, curr_atr, "SELL", rr_ratio=1.5)
            
            return {
                "action": "SELL",
                "tp": tp_dist, 
                "sl": sl_dist,
                "confidence": 65 if ma_trend == "bearish" else 45, 
                "market_mode": market_mode,
                "strategy": self.name,
                "details": {"trend": ma_trend, "rsi": rsi, "mtf": mtf_trend}
            }
            
        return None
