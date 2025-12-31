
from typing import Dict, Any

class SymbolIntelligence:
    """
    Lightweight module to detect symbol types and provide market-specific profiles.
    Used to adapt MasterEngine logic dynamically without hardcoding values.
    """

    @staticmethod
    def get_market_profile(symbol: str) -> Dict[str, Any]:
        """
        Detects symbol type and returns configuration profile.
        
        Types:
        - boomcrash: BOOM or CRASH indices
        - volatility: VOL or V indices
        - forex: Everything else (default)
        """
        s = symbol.upper()
        market_type = "forex"
        
        if "BOOM" in s or "CRASH" in s:
            market_type = "boomcrash"
        elif "VOL" in s or "_V" in s or symbol.startswith("R_") or symbol.startswith("1HZ"):
            # Generic catch for Volatility indices (often R_10, 1HZ10V, etc)
            # The user specified "VOL" or "V", but usually Deriv symbols are "R_10", "1HZ100V" etc.
            # We'll follow the user's specific instruction: "If symbol contains 'VOL' or 'V'"
            if "VOL" in s or "V" in s:
                market_type = "volatility"
            # Explicitly adding common Deriv volatility symbols if they don't match strict "V" rule but are Volatility
            elif symbol.startswith("R_"):
                market_type = "volatility"

        # Define Profiles
        if market_type == "forex":
            return {
                "market_type": "forex",
                "atr_multiplier": 1.0,
                "noise_sensitivity": "medium",
                "trend_threshold": 0.0005, # 0.05% separation
                "trend_weight": {"1m": 0.10, "5m": 0.20, "15m": 0.30, "1h": 0.40},
                "spike_protection": False
            }
        
        elif market_type == "boomcrash":
            return {
                "market_type": "boomcrash",
                "atr_multiplier": 0.6,
                "noise_sensitivity": "low",
                "trend_threshold": 0.0003, # More sensitive for Boom/Crash
                "trend_weight": {"1m": 0.10, "5m": 0.20, "15m": 0.25, "1h": 0.45},
                "spike_protection": True
            }
            
        elif market_type == "volatility":
            return {
                "market_type": "volatility",
                "atr_multiplier": 5.0, # Much less sensitive to noise (was 1.8)
                "noise_sensitivity": "low",
                "trend_threshold": 0.0002, # Highly sensitive for R_10 etc.
                "spike_protection": False,
                "trend_weight": {"1m": 0.15, "5m": 0.25, "15m": 0.25, "1h": 0.35}
            }
            
        return {
            "market_type": "forex",
            "atr_multiplier": 1.0,
            "noise_sensitivity": "medium",
            "trend_weight": {"1m": 0.10, "5m": 0.20, "15m": 0.30, "1h": 0.40},
            "spike_protection": False
        }
