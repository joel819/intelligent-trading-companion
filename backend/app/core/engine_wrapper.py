import ctypes
import os
from pydantic import BaseModel

# Data Structures matching C++ Structs
class ConfigInfo(ctypes.Structure):
    _fields_ = [
        ("grid_size", ctypes.c_int),
        ("risk_percent", ctypes.c_double),
        ("max_lots", ctypes.c_double),
        ("confidence_threshold", ctypes.c_double),
        ("stop_loss_points", ctypes.c_double),
        ("take_profit_points", ctypes.c_double),
        ("max_open_trades", ctypes.c_int),
        ("drawdown_limit", ctypes.c_double),
    ]

class TickInfo(ctypes.Structure):
    _fields_ = [
        ("bid", ctypes.c_double),
        ("ask", ctypes.c_double),
        ("timestamp", ctypes.c_long),
    ]

class SignalInfo(ctypes.Structure):
    _fields_ = [
        ("action", ctypes.c_int),
        ("lots", ctypes.c_double),
        ("sl", ctypes.c_double),
        ("tp", ctypes.c_double),
    ]

class BotStateInfo(ctypes.Structure):
    _fields_ = [
        ("is_running", ctypes.c_bool),
        ("total_trades", ctypes.c_int),
        ("total_pnl", ctypes.c_double),
        ("uptime_seconds", ctypes.c_long),
    ]

# Load Shared Library
_lib_path = os.path.join(os.path.dirname(__file__), "../../cpp_engine/libengine.so")
_lib = ctypes.CDLL(_lib_path)

# Function Signatures
_lib.init_engine.argtypes = [ctypes.POINTER(ConfigInfo)]
_lib.init_engine.restype = None

_lib.update_config.argtypes = [ctypes.POINTER(ConfigInfo)]
_lib.update_config.restype = None

_lib.process_tick.argtypes = [ctypes.POINTER(TickInfo)]
_lib.process_tick.restype = SignalInfo

_lib.set_bot_state.argtypes = [ctypes.c_bool]
_lib.set_bot_state.restype = None

_lib.get_bot_state.argtypes = []
_lib.get_bot_state.restype = BotStateInfo

class EngineWrapper:
    @staticmethod
    def init_engine(config: dict):
        c_config = ConfigInfo(**config)
        _lib.init_engine(ctypes.byref(c_config))

    @staticmethod
    def update_config(config: dict):
        c_config = ConfigInfo(**config)
        _lib.update_config(ctypes.byref(c_config))

    @staticmethod
    def process_tick(bid: float, ask: float, timestamp: int):
        c_tick = TickInfo(bid, ask, timestamp)
        return _lib.process_tick(ctypes.byref(c_tick))

    @staticmethod
    def set_bot_state(running: bool):
        _lib.set_bot_state(running)

    @staticmethod
    def get_bot_state() -> dict:
        state = _lib.get_bot_state()
        return {
            "is_running": state.is_running,
            "total_trades": state.total_trades,
            "total_pnl": state.total_pnl,
            "uptime_seconds": state.uptime_seconds
        }
