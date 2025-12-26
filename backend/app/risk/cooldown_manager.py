"""
Cooldown Manager
Enforces mandatory waiting periods between trades.
"""

from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class CooldownManager:
    """Manages cooldown timers between trades."""
    
    def __init__(self, default_cooldown_seconds: int = 60):
        self.default_cooldown = default_cooldown_seconds
        self.last_trade_time: Optional[datetime] = None
        self.custom_cooldown: Optional[int] = None
        
    def can_trade(self) -> bool:
        """Check if cooldown period has passed."""
        if not self.last_trade_time:
            return True
            
        now = datetime.now()
        duration = self.custom_cooldown if self.custom_cooldown is not None else self.default_cooldown
        
        elapsed = (now - self.last_trade_time).total_seconds()
        
        if elapsed < duration:
            return False
            
        return True
        
    def record_trade(self):
        """Record time of a new trade execution."""
        self.last_trade_time = datetime.now()
        # Reset custom cooldown
        self.custom_cooldown = None
        
    def set_next_cooldown(self, seconds: int):
        """Set a custom cooldown duration for the next interval only."""
        self.custom_cooldown = seconds
        
    def get_remaining_seconds(self) -> float:
        """Get seconds remaining in current cooldown."""
        if not self.last_trade_time:
            return 0.0
            
        now = datetime.now()
        duration = self.custom_cooldown if self.custom_cooldown is not None else self.default_cooldown
        elapsed = (now - self.last_trade_time).total_seconds()
        
        remaining = duration - elapsed
        return max(0.0, remaining)
