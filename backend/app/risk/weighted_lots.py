"""
Weighted Lot Calculator
Dynamically calculates lot size based on account balance, risk, and market conditions.
"""

from typing import Dict
import logging

logger = logging.getLogger(__name__)


class WeightedLotCalculator:
    """Calculates optimal lot size using weighted factors."""
    
    def __init__(self):
        # Multipliers for different market regimes
        self.regime_multipliers = {
            "trending_up": 1.2,
            "trending_down": 1.2,
            "ranging": 0.8,
            "breakout": 1.5,
            "high_volatility": 0.6,
            "unknown": 0.5
        }
        
        # Symbol-specific minimum stake (USD)
        # Based on Deriv Options/Multipliers API defaults
        self.symbol_min_stake = {
            "R_10": 0.35,
            "R_25": 0.35,
            "R_50": 0.35,
            "R_75": 0.35,
            "R_100": 0.35,
            "RDBULL": 0.50, # Rise/Fall on indices often 0.50
            "RDBEAR": 0.50
        }
        
    def calculate_lot_size(self, 
                          balance: float,
                          base_risk_pct: float,
                          confidence: float,
                          regime: str,
                          confluences: int = 0,
                          volatility: str = "medium",
                          symbol: str = "R_10") -> float:
        """
        Calculate weighted lot size.
        
        Args:
            balance: Account balance
            base_risk_pct: Base risk percentage (e.g. 1.0 for 1%)
            confidence: Strategy confidence score (0.0 to 1.0)
            regime: Current market regime tag
            confluences: Number of confirming indicators
            volatility: Current volatility state
            
        Returns:
            Calculated lot size
        """
        # 1. Base calculation (Fixed fractional)
        # Assuming a standard interaction where risk_amount = balance * risk_pct
        # We need a reference stop loss distance or a fixed 'lot per dollar' ratio.
        # Since strategy SL distances vary, we will output a *risk amount* in dollars first,
        # or assuming the user wants to adjust the 'base lot' derived from risk.
        #
        # Better approach for this bot (based on existing logic):
        # Existing logic often uses a fixed lot or simple calculation.
        # We will calculate a multiplier to apply to the base lot size derived from risk.
        
        # NOTE: Since actual lot size depends on asset specs (tick value), 
        # this calculator returns a *Risk Amount ($)* or a *Multiplier* 
        # that the execution engine converts to lots.
        # To make it compatible with the previous request's logic:
        # "base_lot = balance * base_risk_pct / 100" -> This assumes 1 lot = 1 unit which might not be true.
        # Let's return the Risk Amount in Currency ($), which is safer.
        # The calling connector checks SL distance to convert Risk($) -> Lots.
        
        base_risk_amount = balance * (base_risk_pct / 100.0)
        
        # 2. Confidence adjustment (0.7x to 1.0x)
        # Map 0.0-1.0 confidence to 0.5-1.0 multiplier
        confidence_multiplier = 0.5 + (confidence * 0.5)
        
        # 3. Regime adjustment
        reg_multiplier = self.regime_multipliers.get(regime, 0.8)
        
        # 4. Confluence adjustment
        # Boost up to 1.5x for strong confluence
        conf_multiplier = min(1.0 + (confluences * 0.1), 1.5)
        
        # 5. Volatility adjustment (Adaptive Mode)
        vol_multiplier = 1.0
        if volatility == "extreme":
            vol_multiplier = 0.5
        elif volatility == "high":
            vol_multiplier = 0.8
            
        # Final Risk Amount
        weighted_risk = base_risk_amount * confidence_multiplier * reg_multiplier * conf_multiplier * vol_multiplier
        
        # Cap at reasonable limits (e.g., never risk more than 3x base risk)
        max_risk = base_risk_amount * 3.0
        final_risk = min(weighted_risk, max_risk)
        
        # Ensure symbol-specific minimum
        min_required = self.symbol_min_stake.get(symbol, 0.35)
        if final_risk < min_required:
            final_risk = min_required
            
        logger.debug(f"Lot Calc [{symbol}]: Base=${base_risk_amount:.2f} -> Weighted=${final_risk:.2f} "
                     f"(Conf={confidence_multiplier:.2f}, Reg={reg_multiplier}, Conf={conf_multiplier})")
        
        return round(final_risk, 2)

    def get_lot_from_risk(self, risk_amount: float, stop_loss_points: float, point_value: float) -> float:
        """
        Convert dollar risk to lot size.
        
        Args:
            risk_amount: Amount willing to lose in account currency
            stop_loss_points: Distance to SL in points
            point_value: Dollar value of 1 point per 1 lot
            
        Returns:
            Lot size
        """
        if stop_loss_points <= 0 or point_value <= 0:
            return 0.0
            
        # Risk = Lots * Points * PointValue
        # Lots = Risk / (Points * PointValue)
        lots = risk_amount / (stop_loss_points * point_value)
        return round(lots, 3) 
