"""
Strategy Manager
Manages trading strategies with symbol-based selection.
Simplified to use strategy_selector for multi-pair support.
"""

from typing import Dict, Optional, List
import logging
import datetime
from .strategy_selector import get_strategy, list_available_symbols, get_strategy_name
from .smart_engine_v2 import SmartEngineV2

logger = logging.getLogger(__name__)


class StrategyManager:
    """Manages trading strategies with dynamic symbol-based routing and SmartEngine V2 integration."""
    
    def __init__(self):
        self.current_symbol: Optional[str] = None
        self.current_strategy = None
        self.smart_engine = SmartEngineV2()
        
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
                    regime_data: Dict, 
                    structure_data: Dict, 
                    indicator_data: Dict) -> Optional[Dict]:
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
        
        # === SMART ENGINE V2: UPDATE START ===
        # Feed tick to engine for aggregation
        quote = float(tick_data.get('quote', 0))
        epoch = tick_data.get('epoch', int(datetime.datetime.now().timestamp()))
        self.smart_engine.update_tick(symbol, quote, epoch)
        # =====================================

        if not self.current_strategy:
            logger.error("No strategy selected")
            return None
        
        try:
            # 1. Run Base Strategy
            signal = self.current_strategy.analyze(
                tick_data, 
                regime_data, 
                structure_data, 
                indicator_data
            )
            
            # === SMART ENGINE V2: ENHANCEMENT ===
            
            # Fetch V2 Analysis
            # Note: We use the 1m candles for immediate pattern scanning, 
            # but multiframe analysis uses all history.
            candles_1m = list(self.smart_engine.candles_1m)
            
            market_mode = self.smart_engine.detect_market_mode(candles_1m)
            noise_detected = self.smart_engine.detect_noise(candles_1m)
            patterns = self.smart_engine.detect_patterns(candles_1m)
            mtf_trend = self.smart_engine.analyze_multi_timeframe()
            
            # Global BLOCK Rules
            if market_mode == "chaotic":
                # logger.debug(f"SmartEngineV2 Block: Chaotic Market ({symbol})")
                return None
                
            if noise_detected:
                # logger.debug(f"SmartEngineV2 Block: Noise Detected ({symbol})")
                return None
            
            # DEBUG: Heartbeat
            # logger.info(f"Evaluating {symbol} with {strategy_name}")

            # If strategy produced a signal, validate and enrich it
            if signal:
                logger.info(f"DEBUG: Strategy for {symbol} produced raw signal: {signal}")
                
                # Calculate V2 Confidence
                # We interpret the strategy's signal direction for the validation
                algo_filters = {
                    "direction": signal.get("action", "ANY").upper(),
                    "strategy_confidence": signal.get("confidence", 50)
                }
                
                v2_confidence = self.smart_engine.calculate_confidence(
                    algo_filters, patterns, market_mode
                )
                
                logger.info(f"DEBUG: SmartEngineV2 Confidence: {v2_confidence} (Threshold: 5)")
                
                # Confidence Cutoff
                if v2_confidence < -1:
                    logger.warning(f"DEBUG: Signal BLOCKED by Threshold! {v2_confidence} < -1")
                    return None

                # Update/Enrich Signal
                signal["confidence"] = v2_confidence
                signal["market_mode"] = market_mode
                signal["patterns_detected"] = patterns
                signal["multi_tf_trend"] = mtf_trend["overall_status"]
                signal["memory_state"] = {
                    "volatility": self.smart_engine.get_volatility_state("1m"),
                    "wins_last_5": list(self.smart_engine.memory["results"]).count("win")
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

