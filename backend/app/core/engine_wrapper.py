import ctypes
import os
from typing import List, Dict, Optional
from ctypes import Structure, c_int, c_double, c_bool, c_ulonglong, c_longlong, c_char, POINTER

# --- C Structure Definitions (Must match engine.hpp EXACTLY) ---

class Config(Structure):
    _fields_ = [
        ("grid_size", c_int),
        ("risk_percent", c_double),
        ("max_lots", c_double),
        ("confidence_threshold", c_double),
        ("stop_loss_points", c_double),
        ("take_profit_points", c_double),
        ("max_open_trades", c_int),
        ("drawdown_limit", c_double),
    ]

# Tick struct with symbol support
class Tick(Structure):
    _fields_ = [
        ("bid", c_double),
        ("ask", c_double),
        ("epoch_time", c_ulonglong),
        ("symbol", c_char * 16),
    ]

class AccountInfo(Structure):
    _fields_ = [
        ("balance", c_double),
        ("equity", c_double),
        ("margin_free", c_double),
    ]

class Signal(Structure):
    _fields_ = [
        ("action", c_int),      # 0=None, 1=Buy, 2=Sell, 3=CloseBuy, 4=CloseSell, 5=Panic
        ("symbol", c_char * 16),
        ("lots", c_double),
        ("sl", c_double),
        ("tp", c_double),
        ("comment", c_char * 64),
    ]

class Position(Structure):
    _fields_ = [
        ("ticket", c_longlong),
        ("type", c_int),        # 0=Buy, 1=Sell
        ("open_price", c_double),
        ("volume", c_double),
        ("sl", c_double),
        ("tp", c_double),
    ]

class BotState(Structure):
    _fields_ = [
        ("is_running", c_bool),
        ("total_trades", c_int),
        ("total_pnl", c_double),
        ("uptime_seconds", c_longlong),
        ("current_drawdown", c_double),
    ]

# --- Wrapper Class ---

class EngineWrapper:
    _lib = None

    @classmethod
    def _load_lib(cls):
        if cls._lib is None:
            lib_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../cpp_engine/libengine.so"))
            try:
                cls._lib = ctypes.CDLL(lib_path)
                
                # Define argtypes and restypes for safety
                cls._lib.init_engine.argtypes = [POINTER(Config)]
                cls._lib.update_config.argtypes = [POINTER(Config)]
                cls._lib.update_account.argtypes = [POINTER(AccountInfo)]
                cls._lib.set_bot_state.argtypes = [c_bool]
                cls._lib.get_bot_state.restype = BotState
                
                cls._lib.process_tick.argtypes = [POINTER(Tick), POINTER(Position), c_int]
                cls._lib.process_tick.restype = Signal
                
            except OSError as e:
                print(f"Error loading C++ library: {e}")
                raise e

    @classmethod
    def init_engine(cls, config_dict: dict):
        cls._load_lib()
        c_config = Config(**config_dict)
        cls._lib.init_engine(ctypes.byref(c_config))

    @classmethod
    def update_config(cls, config_dict: dict):
        cls._load_lib()
        c_config = Config(**config_dict)
        cls._lib.update_config(ctypes.byref(c_config))

    @classmethod
    def update_account(cls, balance: float, equity: float, margin_free: float):
        cls._load_lib()
        info = AccountInfo(balance, equity, margin_free)
        cls._lib.update_account(ctypes.byref(info))

    @classmethod
    def set_bot_state(cls, running: bool):
        cls._load_lib()
        cls._lib.set_bot_state(running)

    @classmethod
    def get_bot_state(cls) -> dict:
        cls._load_lib()
        state = cls._lib.get_bot_state()
        return {
            "is_running": state.is_running,
            "total_trades": state.total_trades,
            "total_pnl": state.total_pnl,
            "uptime_seconds": state.uptime_seconds,
            "current_drawdown": state.current_drawdown
        }

    @classmethod
    def process_tick(cls, tick_data: dict, open_positions: List[dict] = []) -> dict:
        cls._load_lib()
        
        # Prepare Tick
        c_tick = Tick()
        c_tick.bid = tick_data.get('bid', 0.0)
        c_tick.ask = tick_data.get('ask', 0.0)
        c_tick.epoch_time = tick_data.get('epoch', 0)
        c_tick.symbol = tick_data.get('symbol', '').encode('utf-8')

        # Prepare Positions Array
        num_pos = len(open_positions)
        PositionArray = Position * num_pos
        c_positions = PositionArray()
        
        for i, pos in enumerate(open_positions):
            c_positions[i].ticket = pos.get('ticket', 0)
            c_positions[i].type = 0 if pos.get('type') == 'buy' else 1
            c_positions[i].open_price = pos.get('entry_price', 0.0)
            c_positions[i].volume = pos.get('volume', 0.0)
            c_positions[i].sl = pos.get('sl', 0.0)
            c_positions[i].tp = pos.get('tp', 0.0)

        # Call Engine
        signal = cls._lib.process_tick(ctypes.byref(c_tick), c_positions, num_pos)
        
        return {
            "action": signal.action, # 1=Buy, 2=Sell
            "symbol": signal.symbol.decode('utf-8'),
            "lots": signal.lots,
            "sl": signal.sl,
            "tp": signal.tp,
            "comment": signal.comment.decode('utf-8')
        }
