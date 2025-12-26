"""
Base Strategy
Abstract base class for all trading strategies.
"""

from typing import Dict, Optional, Any
from abc import ABC, abstractmethod


class BaseStrategy(ABC):
    """Abstract base class for trading strategies."""
    
    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        
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
