"""
Base Strategy
Abstract base class for all trading strategies.
"""

from typing import Dict, Optional, Any, List
from abc import ABC, abstractmethod


class BaseStrategy(ABC):
    """Abstract base class for trading strategies."""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        from .smart_engine_v2 import SmartEngineV2
        self.smart_engine = SmartEngineV2()
        
    @abstractmethod
    def analyze(self, 
                tick_data: Dict, 
                regime_data: Dict, 
                structure_data: Dict, 
                indicator_data: Dict) -> Optional[Dict]:
        """
        Analyze markets and generate a signal.
        
        Args:
            tick_data: Current market data
            regime_data: Market regime info
            structure_data: Market structure analysis
            indicator_data: Technical indicators
            
        Returns:
            Dict with action/confidence or None
        """
        pass
        
    def get_config(self) -> Dict:
        return self.config
        
    def update_config(self, new_config: Dict):
        self.config.update(new_config)

    def check_exit(self, position: Dict, candles: List[Dict]) -> Dict:
        """
        Check if an open position should be exited based on SmartEngine logic.
        Delegates to SmartEngine.generate_exit_decision.
        """
        if hasattr(self, 'smart_engine'):
             return self.smart_engine.generate_exit_decision(position, candles)
        return {"close_now": False, "new_sl": None, "new_tp": None}
