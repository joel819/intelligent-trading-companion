#include "json.hpp" // Using nlohmann/json
#include <chrono>
#include <iostream>
#include <string>
#include <unordered_map>

using json = nlohmann::json;
using namespace std;

// --- Safety Constants ---
const double MAX_LATENCY_MS = 1000.0;
const int MAX_ACTIVE_TRADES = 10;
const double MIN_STAKE = 0.35;
const double MAX_STAKE = 100.0;

class TradingEngine {
private:
  std::unordered_map<std::string, double> price_cache;
  std::chrono::time_point<std::chrono::steady_clock> last_trade_time;
  int cooldown_seconds = 60;
  bool is_initialized = false;
  bool is_running = true;
  std::chrono::time_point<std::chrono::steady_clock> start_time;

public:
  TradingEngine() {
    // Initialize with a past time to allow immediate trading
    last_trade_time = std::chrono::steady_clock::now() -
                      std::chrono::seconds(cooldown_seconds * 2);
    start_time = std::chrono::steady_clock::now();
  }

  void initialize(const string &config_json) {
    try {
      auto config = json::parse(config_json);
      if (config.contains("cooldown_seconds")) {
        cooldown_seconds = config["cooldown_seconds"];
      }
      is_initialized = true;
      cout << "[CPP] Engine Initialized. Cooldown: " << cooldown_seconds << "s"
           << endl;
    } catch (...) {
      cout << "[CPP] Init Error: Invalid Config" << endl;
    }
  }

  // Safety Validation Layer
  struct ValidationResult {
    bool valid;
    string error;
  };

  ValidationResult validate_trade(double stake, const string &symbol,
                                  int active_trades) {
    if (!is_initialized)
      return {false, "Engine not initialized"};
    if (!is_running)
      return {false, "Bot is stopped"};

    if (stake < MIN_STAKE)
      return {false, "Stake below minimum (" + to_string(MIN_STAKE) + ")"};
    if (stake > MAX_STAKE)
      return {false, "Stake above maximum (" + to_string(MAX_STAKE) + ")"};

    if (symbol.empty())
      return {false, "Symbol is empty"};

    if (active_trades >= MAX_ACTIVE_TRADES) {
      return {false, "Max active trades limit reached"};
    }

    // Cooldown check
    auto now = std::chrono::steady_clock::now();
    auto elapsed =
        std::chrono::duration_cast<std::chrono::seconds>(now - last_trade_time)
            .count();
    if (elapsed < cooldown_seconds) {
      return {false, "Cooldown active. Wait " +
                         to_string(cooldown_seconds - elapsed) + "s"};
    }

    return {true, "OK"};
  }

  // Core Processing
  string process_tick(const string &tick_json) {
    try {
      auto tick = json::parse(tick_json);
      string symbol = tick["symbol"];
      double price = tick["quote"];

      // Update cache
      price_cache[symbol] = price;

      // Return analysis
      json result;
      result["symbol"] = symbol;
      result["price"] = price;
      result["signal"] = 0.5; // Neutral

      return result.dump();

    } catch (const exception &e) {
      return "{\"error\": \"" + string(e.what()) + "\"}";
    }
  }

  // Unified Trade Execution Interface
  string execute_trade(const string &params_json) {
    try {
      auto params = json::parse(params_json);

      string symbol = params["symbol"];
      string action = params["action"];
      double stake = params["stake"];
      int active_trades = params.value("active_trades", 0);

      // 1. Validate
      ValidationResult val = validate_trade(stake, symbol, active_trades);

      if (!val.valid) {
        json error_res;
        error_res["status"] = "rejected";
        error_res["reason"] = val.error;
        return error_res.dump();
      }

      // Update state
      last_trade_time = std::chrono::steady_clock::now();

      json success_res;
      success_res["status"] = "approved";
      success_res["symbol"] = symbol;
      success_res["action"] = action;
      success_res["stake"] = stake;

      return success_res.dump();

    } catch (const exception &e) {
      json err;
      err["status"] = "error";
      err["message"] = e.what();
      return err.dump();
    }
  }

  // Set cooldown dynamically
  void set_cooldown(int seconds) { cooldown_seconds = seconds; }

  void set_bot_state(bool state) { is_running = state; }

  string get_bot_state() {
    json state;
    state["is_running"] = is_running;

    auto now = std::chrono::steady_clock::now();
    auto uptime =
        std::chrono::duration_cast<std::chrono::seconds>(now - start_time)
            .count();
    state["uptime_seconds"] = uptime;

    return state.dump();
  }
};

// Global Engine Instance
TradingEngine engine;

// --- C Exports for Python ctypes ---

#include <cstring>

#include <cstdlib>
#include <cstring>

extern "C" {

void init_engine(const char *config_json) { engine.initialize(config_json); }

char *process_tick(const char *tick_json) {
  string result = engine.process_tick(tick_json);
  char *cstr = (char *)malloc(result.length() + 1);
  if (cstr) {
    std::strcpy(cstr, result.c_str());
  }
  return cstr;
}

char *execute_trade(const char *params_json) {
  string result = engine.execute_trade(params_json);
  char *cstr = (char *)malloc(result.length() + 1);
  if (cstr) {
    std::strcpy(cstr, result.c_str());
  }
  return cstr;
}

void set_cooldown(int seconds) { engine.set_cooldown(seconds); }

void set_bot_state(bool state) { engine.set_bot_state(state); }

char *get_bot_state() {
  string result = engine.get_bot_state();
  char *cstr = (char *)malloc(result.length() + 1);
  if (cstr) {
    std::strcpy(cstr, result.c_str());
  }
  return cstr;
}

void free_result(char *ptr) {
  if (ptr) {
    free(ptr);
  }
}
}
