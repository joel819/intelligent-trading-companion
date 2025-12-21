#ifndef ENGINE_HPP
#define ENGINE_HPP

extern "C" {

// --- Data Structures ---

struct Config {
  int grid_size;               // Distance between grid levels in points
  double risk_percent;         // Risk per trade (% of equity)
  double max_lots;             // Maximum lot size allowed
  double confidence_threshold; // ML Confidence floor (0.0 - 1.0)
  double stop_loss_points;     // SL distance
  double take_profit_points;   // TP distance
  int max_open_trades;         // Global limit
  double drawdown_limit;       // Panic stop if equity drops below this %
};

struct Tick {
  double bid;
  double ask;
  unsigned long long epoch_time; // Unix timestamp
  char symbol[16];               // e.g., "R_100"
};

struct AccountInfo {
  double balance;
  double equity;
  double margin_free;
};

enum ActionType {
  ACTION_NONE = 0,
  ACTION_BUY = 1,
  ACTION_SELL = 2,
  ACTION_CLOSE_BUY = 3,
  ACTION_CLOSE_SELL = 4,
  ACTION_PANIC = 5 // Internal panic trigger
};

struct Signal {
  int action; // From ActionType enum
  char symbol[16];
  double lots;
  double sl;
  double tp;
  double confidence; // Confidence score (0.0 - 1.0)
  char comment[64];  // Reason for trade (e.g., "Grid Level 5")
};

struct Position {
  long long ticket;
  int type; // 0=Buy, 1=Sell
  double open_price;
  double volume;
  double sl;
  double tp;
};

// --- State Management ---
struct BotState {
  bool is_running;
  int total_trades;
  double total_pnl;
  long long uptime_seconds;
  double current_drawdown;
};

// --- Exported Functions ---

// Initialize the engine (resets state)
void init_engine(Config *config);

// Hot-reload configuration without stopping
void update_config(Config *config);

// Update account info (needed for risk calc)
void update_account(AccountInfo *info);

// Process a new tick and return a Signal
// Pass num_positions and array of Position structs to be stateless-ish
Signal process_tick(Tick *tick, Position *positions, int num_positions);

// Manual control
void set_bot_state(bool running);
BotState get_bot_state();
}

#endif // ENGINE_HPP
