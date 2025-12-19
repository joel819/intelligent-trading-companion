import logging
import os
import json
from datetime import datetime
from typing import Any, Dict

class AuditLogger:
    def __init__(self, log_dir: str = "logs"):
        self.log_dir = log_dir
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)
        
        self.logger = logging.getLogger("audit_logger")
        self.logger.setLevel(logging.INFO)
        
        # Prevent duplicate handlers if singleton is re-instantiated
        if not self.logger.handlers:
            audit_file = os.path.join(self.log_dir, "audit.log")
            handler = logging.FileHandler(audit_file)
            formatter = logging.Formatter('%(asctime)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

    def log_trade(self, signal: Dict[str, Any], validation: Dict[str, Any], response: Dict[str, Any]):
        """
        Record a complete trade execution attempts.
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": "trade_execution",
            "signal": signal,
            "validation_adjustment": validation,
            "deriv_response": response
        }
        self.logger.info(json.dumps(log_entry))

    def log_error(self, context: str, error_details: Any):
        """
        Record failures or exceptions in the trading flow.
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": "error",
            "context": context,
            "details": str(error_details)
        }
        self.logger.info(json.dumps(log_entry))

# Global Audit Instance
audit_logger = AuditLogger(log_dir=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../logs")))
