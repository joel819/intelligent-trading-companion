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
    
    def set_cooldown_for_v10_result(self, result: str, consecutive_losses: int = 0):
        """
        Set V10-specific cooldown based on trade result.
        
        Args:
            result: "win" or "loss"
            consecutive_losses: Number of consecutive losses
        """
        import random
        
        if consecutive_losses >= 2:
            # After 2 consecutive losses: 50 minute block
            cooldown = 3000  # 50 minutes
            logger.warning(f"V10 Cooldown: {consecutive_losses} consecutive losses - setting 50min block")
        elif result == "win":
            # After win: 8-12 minutes random
            cooldown = random.randint(480, 720)
            logger.info(f"V10 Cooldown: Win - setting {cooldown}s ({cooldown/60:.1f}min) cooldown")
        else:  # loss
            # After loss: 15-20 minutes random
            cooldown = random.randint(900, 1200)
            logger.info(f"V10 Cooldown: Loss - setting {cooldown}s ({cooldown/60:.1f}min) cooldown")
        
        self.set_next_cooldown(cooldown)
    
    def set_cooldown_for_boom300_result(self, result: str, consecutive_losses: int = 0):
        """
        Set Boom 300-specific cooldown based on trade result.
        
        Args:
            result: "win" or "loss"
            consecutive_losses: Number of consecutive losses
        """
        if consecutive_losses >= 2:
            # After 2 consecutive losses: 45 minute block
            cooldown = 2700  # 45 minutes
            logger.warning(f"Boom300 Cooldown: {consecutive_losses} consecutive losses - setting 45min block")
        elif result == "win":
            # After win: 12 minutes fixed
            cooldown = 720
            logger.info(f"Boom300 Cooldown: Win - setting {cooldown}s (12min) cooldown")
        else:  # loss
            # After loss: 20 minutes fixed
            cooldown = 1200
            logger.info(f"Boom300 Cooldown: Loss - setting {cooldown}s (20min) cooldown")
        
        self.set_next_cooldown(cooldown)
    
    def set_cooldown_for_crash300_result(self, result: str, consecutive_losses: int = 0):
        """
        Set Crash 300-specific cooldown (identical to Boom 300).
        
        Args:
            result: "win" or "loss"
            consecutive_losses: Number of consecutive losses
        """
        # Crash 300 uses same cooldowns as Boom 300
        self.set_cooldown_for_boom300_result(result, consecutive_losses)
