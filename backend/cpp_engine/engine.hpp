#ifndef ENGINE_HPP
#define ENGINE_HPP

#include <string>
#include <vector>

extern "C" {

    struct Config {
        int grid_size;
        double risk_percent;
        double max_lots;
        double confidence_threshold;
        double stop_loss_points;
        double take_profit_points;
        int max_open_trades;
        double drawdown_limit;
    };

    struct Tick {
        double bid;
        double ask;
        long timestamp;
    };

    struct Signal {
        int action; // 0: None, 1: Buy, 2: Sell, 3: Close Buy, 4: Close Sell
        double lots;
        double sl; 
        double tp;
    };

    struct BotState {
        bool is_running;
        int total_trades;
        double total_pnl;
        long uptime_seconds;
    };

    // Exported functions
    void init_engine(Config* config);
    void update_config(Config* config);
    Signal process_tick(Tick* tick);
    void set_bot_state(bool running);
    BotState get_bot_state();
}

#endif // ENGINE_HPP
