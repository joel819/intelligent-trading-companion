import logging
from typing import List, Dict, Optional, Any

logger = logging.getLogger("trade_manager")

class TradeManager:
    @staticmethod
    def validate_and_clamp(signal: dict, contracts: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Production-Ready FIFO Refresh Guard:
        1. Identify correct contract type from refreshed list.
        2. Validate stake against min/max limits.
        3. Clamp if necessary.
        4. Return clean proposal parameters.
        """
        action = signal.get('action')
        symbol = signal.get('symbol')
        requested_stake = signal.get('lots', 0.35) # Default to Deriv min if missing
        
        # Map Action to Contract Type (CALL=Buy, PUT=Sell)
        contract_type = "CALL" if action == 1 else "PUT"
        
        matched_contract = None
        for c in contracts:
            if c.get('contract_type') == contract_type:
                matched_contract = c
                break
        
        if not matched_contract and contracts:
            matched_contract = contracts[0]
            logger.warning(f"Exact match for {contract_type} not found, falling back to {matched_contract.get('contract_type')}")

        if not matched_contract:
            logger.error(f"Critical FIFO Failure: No valid contracts found for {symbol}")
            return None

        # Extract limits from fresh contract data
        min_stake = float(matched_contract.get('min_contract_measure', 0.35))
        max_stake = float(matched_contract.get('max_contract_measure', 5000.0))
        
        # Apply FIFO Clamping
        final_stake = float(requested_stake)
        
        if final_stake < min_stake:
            logger.info(f"FIFO Safety Guard: Clamping {final_stake} -> {min_stake} (Min Required)")
            final_stake = min_stake
        elif final_stake > max_stake:
            logger.warning(f"FIFO Safety Guard: Clamping {final_stake} -> {max_stake} (Max Allowed)")
            final_stake = max_stake
            
        # Round to 2 decimals (standard for USD/EUR stakes)
        final_stake = round(final_stake, 2)

        return {
            "symbol": symbol,
            "contract_type": contract_type,
            "currency": "USD",
            "amount": final_stake,
            "basis": "stake",
            "duration": 5, # Could be made dynamic later
            "duration_unit": "t",
            "validation_metadata": {
                "original_stake": requested_stake,
                "adjusted_stake": final_stake,
                "range": [min_stake, max_stake]
            }
        }

    @staticmethod
    def create_proposal_payload(params: Dict[str, Any], stop_loss: float = None, take_profit: float = None) -> Dict[str, Any]:
        """
        Generates standard Deriv 'proposal' API request with optional SL/TP.
        
        Args:
            params: Validated trade parameters (symbol, amount, duration, etc.)
            stop_loss: Optional stop loss price level
            take_profit: Optional take profit price level
            
        Returns:
            Deriv API proposal request payload
        """
        payload = {
            "proposal": 1,
            "subscribe": 1,
            "amount": params['amount'],
            "basis": params['basis'],
            "contract_type": params['contract_type'],
            "currency": params['currency'],
            "duration": params['duration'],
            "duration_unit": params['duration_unit'],
            "symbol": params['symbol']
        }
        
        # IMPORTANT: CALL/PUT contracts don't support limit_order in Deriv API
        # SL/TP will be enforced locally by monitoring positions
        contract_type = params['contract_type']
        if contract_type not in ['CALL', 'PUT']:
            # Add limit_order for SL/TP only for contract types that support it
            if stop_loss or take_profit:
                payload["limit_order"] = {}
                if stop_loss:
                    payload["limit_order"]["stop_loss"] = float(stop_loss)
                    logger.info(f"Adding Stop Loss to proposal: {stop_loss}")
                if take_profit:
                    payload["limit_order"]["take_profit"] = float(take_profit)
                    logger.info(f"Adding Take Profit to proposal: {take_profit}")
        else:
            logger.info(f"Skipping limit_order for {contract_type} - will use local SL/TP monitoring")
        
        return payload

