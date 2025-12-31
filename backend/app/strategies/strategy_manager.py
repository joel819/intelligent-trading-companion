"""
Strategy Manager
Manages trading strategies with symbol-based selection.
Simplified to use strategy_selector for multi-pair support.
"""

from typing import Dict, Optional, List
import logging
import datetime
from .strategy_selector import get_strategy, list_available_symbols, get_strategy_name

logger = logging.getLogger(__name__)


class StrategyManager:
    """Manages trading strategies with dynamic symbol-based routing and SmartEngine V2 integration."""
    
    def __init__(self):
        self.current_symbol: Optional[str] = None
        self.current_strategy = None
        
    def select_strategy_by_symbol(self, symbol: str) -> bool:
        """
        Select strategy based on trading symbol.
        
        Args:
            symbol: Trading symbol (e.g., "VOLATILITY_10", "BOOM_300")
            
        Returns:
            True if strategy was successfully selected
        """
        try:
            self.current_strategy = get_strategy(symbol)
            self.current_symbol = symbol
            strategy_name = get_strategy_name(symbol)
            logger.info(f"Selected strategy: {strategy_name} for symbol: {symbol}")
            return True
        except ValueError as e:
            logger.error(f"Failed to select strategy: {e}")
            return False
    
    def get_active_strategy_info(self) -> Dict:
        """Get information about the currently active strategy."""
        if not self.current_strategy or not self.current_symbol:
            return {
                "symbol": None,
                "strategy": None,
                "name": None
            }
        
        return {
            "symbol": self.current_symbol,
            "strategy": self.current_strategy.name,
            "name": get_strategy_name(self.current_symbol),
            "config": self.current_strategy.config
        }
    
    def run_strategy(self, 
                    symbol: str,
                    tick_data: Dict, 
                    engine, # MasterEngine instance
                    structure_data: Dict, 
                    indicator_data: Dict,
                    h1_candles: List[Dict] = None) -> Optional[Dict]:
        """
        Run strategy analysis for the given symbol, enhanced by SmartEngine V2.
        
        Args:
            symbol: Trading symbol
            tick_data: Current market data
            regime_data: Market regime info
            structure_data: Market structure analysis
            indicator_data: Technical indicators
            
        Returns:
            Signal dictionary with action/confidence or None
        """
        # Auto-select strategy if symbol changed
        if symbol != self.current_symbol:
            if not self.select_strategy_by_symbol(symbol):
                logger.error(f"Cannot run strategy - failed to select for symbol: {symbol}")
                return None
        
        # === SMART ENGINE: UPDATE ALREADY DONE IN DERIV CONNECTOR ===
        # engine.update_tick is called before this method
        # =====================================

        if not self.current_strategy:
            logger.error("No strategy selected")
            return None
        
        try:
            # 1. Run Base Strategy
            signal = self.current_strategy.analyze(
                tick_data, 
                engine, # PASSING ENGINE instead of regime_data
                structure_data, 
                indicator_data,
                h1_candles=h1_candles
            )
            
            # === MASTER ENGINE: ENHANCEMENT ===
            
            # Fetch Analysis
            candles_1m = list(engine.candles_1m)
            
            market_mode = engine.detect_market_mode(candles_1m)
            noise_detected = engine.detect_noise(candles_1m)
            patterns = engine.detect_patterns(candles_1m)
            mtf_trend = engine.analyze_multi_timeframe() if hasattr(engine, 'analyze_multi_timeframe') else engine._analyze_mtf_trend()
            
            # Global BLOCK Rules
            if market_mode == "chaotic":
                logger.debug(f"MasterEngine Block: Chaotic Market ({symbol})")
                return None
                
            if noise_detected:
                logger.debug(f"MasterEngine Block: Noise Detected ({symbol})")
                return None
            
            # DEBUG: Heartbeat
            # logger.info(f"Evaluating {symbol} with {strategy_name}")

            # If strategy produced a signal, validate and enrich it
            if signal:
                logger.info(f"DEBUG: Strategy for {symbol} produced raw signal: {signal}")
                
                # Calculate V2 Confidence
                # If strategy already provided a robust confidence score, use it.
                # Otherwise, use MasterEngine to calculate a generic score.
                
                v2_confidence = signal.get("confidence", 0)
                
                if v2_confidence <= 0:
                    # Fallback Generic Calculation
                    conf_data = {
                        "signal_direction": signal.get("action", "ANY").upper(),
                        "patterns": patterns,
                        "market_mode": market_mode,
                        "mtf_trend": mtf_trend,
                        "volatility": engine.get_volatility("1m")
                    }
                    v2_confidence = engine.calculate_confidence(conf_data)
                    logger.info(f"DEBUG: MasterEngine Generic Confidence: {v2_confidence}")
                
                # Confidence Cutoff (Relaxed for Scalping)
                if v2_confidence < 15: 
                    logger.warning(f"DEBUG: Signal BLOCKED by Confidence! {v2_confidence} < 15")
                    return None

                # Update/Enrich Signal
                signal["confidence"] = v2_confidence
                signal["market_mode"] = market_mode
                signal["patterns_detected"] = patterns
                signal["multi_tf_trend"] = mtf_trend["trend"]
                signal["memory_state"] = {
                    "volatility": engine.get_volatility("1m"),
                    "wins_last_5": list(engine.memory["results"]).count("win")
                }
                
                # Ensure SL/TP exist (Adapter)
                if "tp" not in signal: signal["tp"] = None
                if "sl" not in signal: signal["sl"] = None
                
                return signal
                
            return None
            
        except Exception as e:
            logger.error(f"Strategy execution error: {e}", exc_info=True)
            return None
    
    def list_available_symbols(self) -> List[str]:
        """Get list of all available trading symbols."""
        return list_available_symbols()


# Create Singleton Instance
strategy_manager = StrategyManager()

