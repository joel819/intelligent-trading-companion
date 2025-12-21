#include "engine.hpp"
#include <cmath>
#include <cstring>
#include <ctime>
#include <iostream>

// Global State (Persists in memory as long as shared lib is loaded)
static Config g_config;
static BotState g_state = {false, 0, 0.0, 0, 0.0};
static AccountInfo g_account = {0.0, 0.0, 0.0};
static time_t g_start_time = 0;

// Internal helpers
double calculate_lots(double risk_per_trade, double stop_loss_dist) {
  if (stop_loss_dist <= 0)
    return 0.01;
  // Risk amount = Equity * (Risk% / 100)
  // Lots = Risk Amount / (Points * PointValue) -> Simplified for Volatility
  // Indices Assuming 1 Point = 1 USD for simplicity (Needs thorough symbol data
  // in production)
  double risk_amount = g_account.equity * (g_config.risk_percent / 100.0);
  double lots = risk_amount / stop_loss_dist;

  // Clamp to logical bounds (e.g. 0.01 to Max)
  if (lots < 0.01)
    lots = 0.01;
  if (lots > g_config.max_lots)
    lots = g_config.max_lots;

  return std::floor(lots * 100) / 100.0; // Round to 2 decimals
}

extern "C" {

void init_engine(Config *config) {
  if (config) {
    g_config = *config;
  }
  g_state.is_running = false;
  g_state.total_trades = 0;
  g_state.total_pnl = 0.0;
  g_state.uptime_seconds = 0;
  g_state.current_drawdown = 0.0;
  g_start_time = time(NULL);
}

void update_config(Config *config) {
  if (config) {
    std::cout << "[CPP] Config Updated. Grid Size: " << config->grid_size
              << std::endl;
    g_config = *config;
  }
}

void update_account(AccountInfo *info) {
  if (info) {
    g_account = *info;
  }
}

void set_bot_state(bool running) {
  g_state.is_running = running;
  if (running && g_start_time == 0) {
    g_start_time = time(NULL);
  }
  std::cout << "[CPP] Bot State: " << (running ? "RUNNING" : "STOPPED")
            << std::endl;
}

BotState get_bot_state() {
  if (g_state.is_running) {
    g_state.uptime_seconds = time(NULL) - g_start_time;
  }
  return g_state;
}

Signal process_tick(Tick *tick, Position *positions, int num_positions) {
  Signal sig;
  std::memset(&sig, 0, sizeof(Signal));
  sig.action = ACTION_NONE;

  // 0. Safety Checks
  if (!g_state.is_running || !tick)
    return sig;

  // 1. Drawdown Panic Check
  double start_bal =
      g_account.balance > 0 ? g_account.balance : g_account.equity;
  double drawdown = (start_bal - g_account.equity) / start_bal * 100.0;
  g_state.current_drawdown = drawdown;

  if (drawdown >= g_config.drawdown_limit && g_config.drawdown_limit > 0) {
    std::cout << "[CPP] PANIC! Drawdown limit reached: " << drawdown << "%"
              << std::endl;
    set_bot_state(false); // Stop bot
    sig.action = ACTION_PANIC;
    std::strcpy(sig.comment, "Max Drawdown Reached");
    return sig;
  }

  // 2. Max Trades Check
  if (num_positions >= g_config.max_open_trades) {
    return sig; // No new trades
  }

  // 3. Grid Strategy Logic
  // Simple Grid: If price crosses a grid line (modulo grid_size), buy or sell
  // against trend (mean reversion) This is a simplified demo logic.

  double mid_price = (tick->bid + tick->ask) / 2.0;
  int grid_level = (int)(mid_price / g_config.grid_size);
  double grid_line = grid_level * g_config.grid_size;
  double dist = mid_price - grid_line;

  // Determine if we are "close" to a grid line (within 5% of grid size)
  double tolerance = g_config.grid_size * 0.05;

  if (std::abs(dist) < tolerance) {
    // Check if we already have a trade on this symbol
    // For simplicity, verify we don't have a position opened "too close"
    bool existing_trade_near = false;
    for (int i = 0; i < num_positions; i++) {
      if (std::abs(positions[i].open_price - mid_price) <
          (g_config.grid_size / 2.0)) {
        existing_trade_near = true;
        break;
      }
    }

    if (!existing_trade_near) {
      // Mean Reversion Grid:
      // If price is ABOVE line, SELL (expect return to line)
      // If price is BELOW line, BUY (expect return to line)
      // (Note: Real grid strategies are more complex, this is "Vision"
      // compliant MVP)

      double lots =
          calculate_lots(g_config.risk_percent, g_config.stop_loss_points);

      // Randomize or Alternate for demo if no trend data
      // For this vision: BUY if price < line (bounce up), SELL if price > line
      // (bounce down) -> wait, dist does this. If dist > 0, price > line ->
      // SELL If dist < 0, price < line -> BUY

      double confidence = 1.0 - (std::abs(dist) / tolerance);
      if (confidence < 0)
        confidence = 0;

      if (dist > 0) {
        sig.action = ACTION_SELL;
        sig.lots = lots;
        sig.sl = tick->bid + g_config.stop_loss_points;
        sig.tp = tick->bid - g_config.take_profit_points;
        sig.confidence = confidence;
        std::strcpy(sig.comment, "Grid Sell");
      } else {
        sig.action = ACTION_BUY;
        sig.lots = lots;
        sig.sl = tick->ask - g_config.stop_loss_points;
        sig.tp = tick->ask + g_config.take_profit_points;
        sig.confidence = confidence;
        std::strcpy(sig.comment, "Grid Buy");
      }

      std::strcpy(sig.symbol, tick->symbol);
    }
  }

  // 4. Scalp Logic (Optional Layer)
  // If momentum is high (price change > X in last Y seconds) -> Follow Trend
  // (Placeholder for V2)

  return sig;
}
}
