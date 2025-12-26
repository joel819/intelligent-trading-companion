import ctypes
import os
import json
from ctypes import c_char_p, c_int, c_void_p

class EngineWrapper:
    _lib = None

    @classmethod
    def _load_lib(cls):
        if cls._lib is None:
            lib_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../cpp_engine/libengine.so"))
            try:
                cls._lib = ctypes.CDLL(lib_path)
                
                # void init_engine(const char* config_json)
                cls._lib.init_engine.argtypes = [c_char_p]
                cls._lib.init_engine.restype = None
                
                # const char* process_tick(const char* tick_json)
                cls._lib.process_tick.argtypes = [c_char_p]
                cls._lib.process_tick.restype = c_char_p
                
                # const char* execute_trade(const char* params_json)
                cls._lib.execute_trade.argtypes = [c_char_p]
                cls._lib.execute_trade.restype = c_char_p
                
                # void set_cooldown(int seconds)
                cls._lib.set_cooldown.argtypes = [c_int]
                cls._lib.set_cooldown.restype = None
                
            except OSError as e:
                print(f"Error loading C++ library: {e}")
                raise e

    @classmethod
    def init_engine(cls, config_json: str):
        """Initialize the C++ engine with JSON configuration."""
        cls._load_lib()
        c_config = config_json.encode('utf-8')
        cls._lib.init_engine(c_config)

    @classmethod
    def process_tick(cls, tick_json: str) -> str:
        """Process a tick through the C++ engine (ML logic)."""
        cls._load_lib()
        c_tick = tick_json.encode('utf-8')
        result_ptr = cls._lib.process_tick(c_tick)
        return ctypes.cast(result_ptr, c_char_p).value.decode('utf-8')

    @classmethod
    def execute_trade(cls, params_json: str) -> str:
        """Execute/Validate a trade through the C++ engine safety layer."""
        cls._load_lib()
        c_params = params_json.encode('utf-8')
        result_ptr = cls._lib.execute_trade(c_params)
        return ctypes.cast(result_ptr, c_char_p).value.decode('utf-8')
        
    @classmethod
    def set_cooldown(cls, seconds: int):
        """Update cooldown timer dynamically."""
        cls._load_lib()
        cls._lib.set_cooldown(seconds)

    @classmethod
    def set_bot_state(cls, state: bool):
        """Enable/Disable the bot."""
        cls._load_lib()
        # void set_bot_state(bool)
        cls._lib.set_bot_state.argtypes = [ctypes.c_bool]
        cls._lib.set_bot_state.restype = None
        cls._lib.set_bot_state(state)

    @classmethod
    def get_bot_state(cls) -> dict:
        """Get bot running state and uptime."""
        cls._load_lib()
        # const char* get_bot_state()
        cls._lib.get_bot_state.argtypes = []
        cls._lib.get_bot_state.restype = c_char_p
        
        res_ptr = cls._lib.get_bot_state()
        json_str = ctypes.cast(res_ptr, c_char_p).value.decode('utf-8')
        return json.loads(json_str)
