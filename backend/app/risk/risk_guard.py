"""
Risk Guard
Protects account from excessive losses, over-trading, and unfavorable conditions.
"""

from typing import Dict, List, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class RiskGuard:
    """Checks various safety conditions before allowing a trade."""
    
    def __init__(self,
                 max_daily_loss_pct: float = 5.0,
                 max_sl_hits: int = 3,
                 max_active_trades: int = 5):
        self.max_daily_loss_pct = max_daily_loss_pct
        self.max_sl_hits = max_sl_hits
        self.max_active_trades = max_active_trades
        
        # Tracking state
        self.daily_loss = 0.0
        self.sl_hits_today = 0
        self.last_reset = datetime.now().date()
        self.trade_history = []  # List of "win" or "loss"
    
    def check_trade_allowed(self, 
                           account_balance: float,
                           start_balance: float,
                           active_trades_count: int,
                           volatility_state: str,
                           api_connected: bool) -> Tuple[bool, str]:
        """
        Run all risk checks.
        
        Returns:
            (Allowed: bool, Reason: str)
        """
        self._check_daily_reset()
        
        # 1. API Health
        if not api_connected:
            return False, "API connection unstable"
            
        # 2. Daily Loss Limit
        # Calculate current loss based on balance vs start of day/session
        current_loss = start_balance - account_balance
        max_loss = start_balance * (self.max_daily_loss_pct / 100.0)
        
        if current_loss >= max_loss:
            logger.warning(f"RiskGuard: StartBal={start_balance}, CurrentBal={account_balance}, Loss={current_loss}, MaxAllowed={max_loss} (Pct={self.max_daily_loss_pct}%)")
            return False, f"Daily loss limit hit (-${current_loss:.2f})"
        
        # 3. Max Stop Losses
        if self.sl_hits_today >= self.max_sl_hits:
            return False, f"Max SL hits reached ({self.sl_hits_today})"
            
        # 4. Extreme Volatility
        if volatility_state == "extreme":
            if not hasattr(self, '_last_vol_log') or (datetime.now() - self._last_vol_log).total_seconds() > 60:
                logger.warning(f"Risk Guard: High Volatility detected ({volatility_state}). Proceeding with caution.")
                self._last_vol_log = datetime.now()
            # return False, "Volatility too high (Extreme)" # Disabled hard block
            pass
            
        # 5. Consecutive Losses (Cooldown)
        consecutive_losses = sum(1 for r in self.trade_history[-2:] if r == "loss") if len(self.trade_history) >= 2 else 0
        if consecutive_losses >= 2:
            return False, f"{consecutive_losses} consecutive losses - cooldown required"
            
        # 6. Active Trades Limit
        if active_trades_count >= self.max_active_trades:
            return False, f"Max active trades reached ({active_trades_count})"
            
        return True, "OK"
    
    def calculate_v10_stake(self, account_balance: float) -> float:
        """
        Calculate optimal stake size for V10 trading based on account balance.
        
        Args:
            account_balance: Current account balance
            
        Returns:
            Recommended stake size
        """
        if account_balance < 20:
            return 0.5
        elif account_balance <= 50:
            return 1.0
        else:
            return 1.5
    
    def calculate_boom300_stake(self, account_balance: float) -> float:
        """
        Calculate optimal stake size for Boom 300 trading based on account balance.
        
        Args:
            account_balance: Current account balance
            
        Returns:
            Recommended stake size
        """
        if account_balance < 20:
            return 0.35
        elif account_balance <= 50:
            return 0.70  # Mid-range between 0.5-1.0
        else:
            return 1.2
    
    def calculate_crash300_stake(self, account_balance: float) -> float:
        """
        Calculate optimal stake size for Crash 300 trading (same as Boom 300).
        
        Args:
            account_balance: Current account balance
            
        Returns:
            Recommended stake size
        """
        return self.calculate_boom300_stake(account_balance)
    
    def record_trade_result(self, result: str):
        """Record trade outcome ('win' or 'loss')."""
        self._check_daily_reset()
        
        self.trade_history.append(result)
        if result == "loss":
            self.sl_hits_today += 1
            
    def update_daily_loss(self, loss_amount: float):
        """Update accumulated daily loss."""
        self._check_daily_reset()
        if loss_amount > 0:
            self.daily_loss += loss_amount
            
    def update_params(self, 
                      max_daily_loss_percent: float = None, 
                      max_sl_hits: int = None, 
                      max_active_trades: int = None):
        """Update risk parameters dynamically."""
        if max_daily_loss_percent is not None: self.max_daily_loss_pct = max_daily_loss_percent
        if max_sl_hits is not None: self.max_sl_hits = max_sl_hits
        if max_active_trades is not None: self.max_active_trades = max_active_trades
        logger.info("RiskGuard parameters updated.")

    def _check_daily_reset(self):
        """Reset counters if it's a new day."""
        today = datetime.now().date()
        if today != self.last_reset:
            self.daily_loss = 0.0
            self.sl_hits_today = 0
            self.trade_history = []
            self.last_reset = today
            logger.info("Risk guard counters reset for new day")
