/**
 * Lightweight C interface for the JSON‑based trading engine.
 *
 * The Python side talks to these functions via ctypes. All complex
 * data structures are passed as JSON strings to keep the ABI simple.
 */

#ifndef ENGINE_HPP
#define ENGINE_HPP

extern "C" {

// Initialize / reset the engine with JSON configuration
// Example: {"cooldown_seconds": 60, ...}
void init_engine(const char *config_json);

// Hot‑reload configuration while running
void update_config(const char *config_json);

// Update account information used internally for risk metrics
// (balance, equity, margin_free)
void update_account(double balance, double equity, double margin_free);

// Process a tick (JSON in, JSON out)
// Example tick: {"symbol":"R_100","quote":123.45}
const char *process_tick(const char *tick_json);

// Unified trade execution + safety layer
// Params JSON example:
// {"symbol":"R_100","action":"BUY","stake":5.0,"active_trades":2,
//  "symbol_available":true,"api_latency_ms":120.5,
//  "rate_limit_warning":false,"api_error":""}
const char *execute_trade(const char *params_json);

// Runtime controls
void set_cooldown(int seconds);
void set_bot_state(bool state);
const char *get_bot_state();

} // extern "C"

#endif // ENGINE_HPP
