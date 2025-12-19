#include "engine.hpp"
#include <iostream>
#include <ctime>

// Global state
static Config current_config;
static BotState current_state = {false, 0, 0.0, 0};
static long start_time = 0;

void init_engine(Config* config) {
    current_config = *config;
    current_state.is_running = false;
    current_state.total_trades = 0;
    current_state.total_pnl = 0.0;
    current_state.uptime_seconds = 0;
    std::cout << "Engine initialized with Grid Size: " << current_config.grid_size << std::endl;
}

void update_config(Config* config) {
    current_config = *config;
    std::cout << "Configuration updated." << std::endl;
}

Signal process_tick(Tick* tick) {
    Signal signal = {0, 0.0, 0.0, 0.0};
    
    if (!current_state.is_running) {
        return signal;
    }

    // Update uptime
    if (start_time > 0) {
        current_state.uptime_seconds = std::time(nullptr) - start_time;
    }

    // Simple Dummy Strategy: If spread is low, buy/sell randomly (Placeholder)
    double spread = tick->ask - tick->bid;
    
    // In a real strategy, we would use grid_size, indicators, ML inference here.
    // For now, we return 0 (No Action) to respect safety.
    
    return signal; 
}

void set_bot_state(bool running) {
    current_state.is_running = running;
    if (running) {
        if (start_time == 0) start_time = std::time(nullptr);
    } else {
        start_time = 0;
        current_state.uptime_seconds = 0;
    }
    std::cout << "Bot state set to: " << (running ? "Running" : "Stopped") << std::endl;
}

BotState get_bot_state() {
    if (current_state.is_running && start_time > 0) {
        current_state.uptime_seconds = std::time(nullptr) - start_time;
    }
    return current_state;
}
