#!/usr/bin/env python3
"""
Automated Strategy Backtester
Runs all strategy-pair combinations and outputs results for analysis.
"""
import asyncio
import aiohttp
import json
from datetime import datetime, timedelta

# Configuration
API_URL = "http://localhost:8000/backtest/run"

PAIRS = [
    "1HZ75V",   # Volatility 75 (1s)
    "R_75",     # Volatility 75
    "R_10",     # Volatility 10
    "R_50",     # Volatility 50
    "R_100",    # Volatility 100
    "BOOM300N", # Boom 300
    "CRASH300N",# Crash 300
    "BOOM500",  # Boom 500
    "CRASH500", # Crash 500
]

STRATEGIES = [
    "spike_bot",
    "v10_safe",
    "v75_super_safe",
    "boom300_safe",
    "crash300_safe",
    "breakout",  # default SMA crossover
]

async def run_backtest(session, pair: str, strategy: str):
    """Run a single backtest and return results."""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    payload = {
        "strategyId": strategy,
        "symbol": pair,
        "startDate": start_date.strftime("%Y-%m-%d"),
        "endDate": end_date.strftime("%Y-%m-%d"),
        "initialBalance": 10000.0
    }
    
    try:
        async with session.post(API_URL, json=payload, timeout=60) as resp:
            if resp.status == 200:
                data = await resp.json()
                metrics = data.get("metrics", {})
                return {
                    "pair": pair,
                    "strategy": strategy,
                    "totalPnL": metrics.get("totalPnL", 0),
                    "winRate": metrics.get("winRate", 0),
                    "totalTrades": metrics.get("totalTrades", 0),
                    "profitFactor": metrics.get("profitFactor", 0),
                    "maxDrawdown": metrics.get("maxDrawdown", 0),
                    "status": "success"
                }
            else:
                return {
                    "pair": pair,
                    "strategy": strategy,
                    "status": "error",
                    "error": f"HTTP {resp.status}"
                }
    except Exception as e:
        return {
            "pair": pair,
            "strategy": strategy,
            "status": "error",
            "error": str(e)
        }

async def run_all_backtests():
    """Run backtests for all pair-strategy combinations."""
    results = []
    
    connector = aiohttp.TCPConnector(limit=2)  # Limit concurrent connections
    async with aiohttp.ClientSession(connector=connector) as session:
        for pair in PAIRS:
            print(f"\n{'='*50}")
            print(f"Testing pair: {pair}")
            print(f"{'='*50}")
            
            pair_results = []
            for strategy in STRATEGIES:
                print(f"  Running {strategy}...", end=" ", flush=True)
                result = await run_backtest(session, pair, strategy)
                pair_results.append(result)
                
                if result["status"] == "success":
                    print(f"✓ PnL: ${result['totalPnL']:.2f}, WR: {result['winRate']:.1f}%, Trades: {result['totalTrades']}")
                else:
                    print(f"✗ Error: {result.get('error', 'Unknown')}")
                
                await asyncio.sleep(0.5)  # Rate limit
            
            results.extend(pair_results)
    
    return results

def analyze_results(results):
    """Analyze results and find best strategy for each pair."""
    print("\n" + "="*70)
    print("ANALYSIS RESULTS")
    print("="*70)
    
    # Group by pair
    pair_results = {}
    for r in results:
        if r["status"] != "success":
            continue
        pair = r["pair"]
        if pair not in pair_results:
            pair_results[pair] = []
        pair_results[pair].append(r)
    
    best_strategies = {}
    
    for pair, strategies in pair_results.items():
        print(f"\n{pair}:")
        print("-" * 40)
        
        # Sort by profit (primary), then win rate (secondary)
        # Only consider if profitable
        profitable = [s for s in strategies if s["totalPnL"] > 0]
        
        if profitable:
            # Sort by profit descending
            profitable.sort(key=lambda x: x["totalPnL"], reverse=True)
            best = profitable[0]
            
            for s in strategies:
                marker = " ★ BEST" if s == best else ""
                print(f"  {s['strategy']:20} | PnL: ${s['totalPnL']:>8.2f} | WR: {s['winRate']:>5.1f}% | Trades: {s['totalTrades']:>3}{marker}")
            
            best_strategies[pair] = {
                "strategy": best["strategy"],
                "pnl": best["totalPnL"],
                "winRate": best["winRate"]
            }
        else:
            # No profitable strategy - pick highest win rate with least loss
            strategies.sort(key=lambda x: (x["winRate"], x["totalPnL"]), reverse=True)
            best = strategies[0] if strategies else None
            
            for s in strategies:
                marker = " (best available)" if s == best else ""
                print(f"  {s['strategy']:20} | PnL: ${s['totalPnL']:>8.2f} | WR: {s['winRate']:>5.1f}% | Trades: {s['totalTrades']:>3}{marker}")
            
            if best:
                best_strategies[pair] = {
                    "strategy": best["strategy"],
                    "pnl": best["totalPnL"],
                    "winRate": best["winRate"],
                    "note": "No profitable strategy found"
                }
    
    return best_strategies

def generate_code_update(best_strategies):
    """Generate the code update for strategy_selector.py"""
    print("\n" + "="*70)
    print("RECOMMENDED STRATEGY_MAP UPDATE")
    print("="*70)
    
    print("\n# Optimal Strategy Assignments (based on backtesting)")
    print("STRATEGY_MAP = {")
    
    strategy_class_map = {
        "spike_bot": "SpikeBotStrategy",
        "v10_safe": "V10SuperSafeStrategy",
        "v75_super_safe": "V75SuperSafeStrategy",
        "boom300_safe": "Boom300SafeStrategy",
        "crash300_safe": "Crash300SafeStrategy",
        "breakout": "V10SuperSafeStrategy",  # default
    }
    
    for pair, data in best_strategies.items():
        strategy = data["strategy"]
        strategy_class = strategy_class_map.get(strategy, "V10SuperSafeStrategy")
        pnl = data["pnl"]
        wr = data["winRate"]
        note = data.get("note", "")
        comment = f"  # PnL: ${pnl:.2f}, WR: {wr:.1f}%"
        if note:
            comment += f" ({note})"
        print(f'    "{pair}": {strategy_class},{comment}')
    
    print("}")
    
    return best_strategies

async def main():
    print("="*70)
    print("AUTOMATED STRATEGY BACKTESTER")
    print("="*70)
    print(f"Testing {len(PAIRS)} pairs × {len(STRATEGIES)} strategies = {len(PAIRS)*len(STRATEGIES)} combinations")
    print(f"Start time: {datetime.now()}")
    
    results = await run_all_backtests()
    
    # Save raw results
    with open("backtest_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nRaw results saved to backtest_results.json")
    
    best = analyze_results(results)
    generate_code_update(best)
    
    # Save best strategies
    with open("best_strategies.json", "w") as f:
        json.dump(best, f, indent=2)
    print(f"\nBest strategies saved to best_strategies.json")
    
    print(f"\nCompleted at: {datetime.now()}")

if __name__ == "__main__":
    asyncio.run(main())
