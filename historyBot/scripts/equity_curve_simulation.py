"""
Equity Curve Simulation with Overnight Holds
Based on Locked Contracts and Expectancy Calculations

System Parameters (from logicalSteps/):
- Win Rate: 68%
- Avg Win: 1.8R (some 2R+, some early structure exits)
- Avg Loss: 0.9R (some protection at +0.8R → BE)
- Expectancy: +0.94R per trade
- Trades/month: 5-6
- Risk: 1% starting, scaling to 2.5%

Trade Management Rules:
- Stop: 5M structure (never 1M)
- Target: 4H structure, ≥2R only
- Protection: +0.8R → move stop to breakeven
- Weekend: Close losers Friday, hold winners with BE stop
- Typical hold: 8-48 hours (swing with intraday entry)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random

# Set seed for reproducibility
np.random.seed(42)

# =============================================================================
# SYSTEM PARAMETERS (FROM LOCKED CONTRACTS)
# =============================================================================

SYSTEM_PARAMS = {
    'win_rate': 0.68,           # 68% win rate (moderate scenario)
    'avg_win_r': 1.8,           # Average winner in R
    'avg_loss_r': 0.9,          # Average loser in R (some BE exits)
    'trades_per_month': 5.5,    # ~5-6 signals per month
    'expectancy_r': 0.94,       # +0.94R per trade

    # Trade management
    'protection_trigger': 0.8,   # Move to BE at +0.8R
    'be_exit_rate': 0.15,        # ~15% of trades hit BE after protection
    'min_rr': 2.0,               # Minimum R:R (skip trades below this)

    # Risk tiers
    'risk_tiers': {
        'phase_1': {'trades': (0, 20), 'risk': 0.01},      # 1%
        'phase_2': {'trades': (21, 50), 'risk': 0.015},    # 1.5%
        'phase_3': {'trades': (51, 100), 'risk': 0.02},    # 2%
        'phase_4': {'trades': (101, 9999), 'risk': 0.025}, # 2.5%
    },

    # Overnight specific
    'overnight_gap_risk': 0.03,   # 3% chance of adverse overnight gap
    'overnight_gap_impact': 0.5,  # Loses 50% more than planned stop

    # Weekend rules
    'weekend_close_losers': True,
    'weekend_hold_winners_be': True,
}

# =============================================================================
# TRADE OUTCOME DISTRIBUTION
# =============================================================================

def generate_trade_outcome(params, use_overnight=True):
    """
    Generate a single trade outcome based on system parameters.

    Returns:
        tuple: (result_r, outcome_type, hold_hours)
    """
    win_rate = params['win_rate']
    avg_win = params['avg_win_r']
    avg_loss = params['avg_loss_r']
    protection_trigger = params['protection_trigger']
    be_exit_rate = params['be_exit_rate']

    # Determine if trade wins
    is_winner = random.random() < win_rate

    # Generate hold time (8-48 hours typical)
    hold_hours = np.random.lognormal(mean=2.7, sigma=0.5)  # Mode ~15h, range 5-60h
    hold_hours = max(4, min(72, hold_hours))  # Clamp to 4-72 hours

    if is_winner:
        # Winner distribution: mostly around target, some runners
        # Use log-normal for positive skew (some big winners)
        win_r = np.random.lognormal(mean=np.log(avg_win * 0.9), sigma=0.25)
        win_r = max(params['min_rr'] * 0.9, min(5.0, win_r))  # Clamp 1.8R to 5R

        outcome_type = 'WIN'
        result_r = win_r

    else:
        # Check if price reached +0.8R before reversing (BE exit)
        # About 15% of losers actually hit BE after protection
        if random.random() < be_exit_rate:
            result_r = 0.0
            outcome_type = 'BREAKEVEN'
        else:
            # Full loss (or partial if structure exit)
            loss_r = np.random.uniform(0.7, 1.0) * avg_loss
            result_r = -loss_r
            outcome_type = 'LOSS'

    # Overnight gap risk (if holding overnight)
    if use_overnight and hold_hours > 12 and outcome_type == 'LOSS':
        if random.random() < params['overnight_gap_risk']:
            # Adverse gap - lose more than stop
            result_r *= (1 + params['overnight_gap_impact'])
            outcome_type = 'LOSS_GAP'

    return result_r, outcome_type, hold_hours


def generate_trade_sequence(n_trades, params, use_overnight=True):
    """Generate a sequence of n trades with outcomes."""
    trades = []
    for i in range(n_trades):
        result_r, outcome, hours = generate_trade_outcome(params, use_overnight)
        trades.append({
            'trade_num': i + 1,
            'result_r': result_r,
            'outcome': outcome,
            'hold_hours': hours
        })
    return trades


# =============================================================================
# EQUITY CURVE SIMULATION
# =============================================================================

def get_risk_for_trade(trade_num, params, current_dd=0):
    """
    Get risk percentage for a given trade number.
    Reduces risk if in significant drawdown.
    """
    tiers = params['risk_tiers']

    # Find applicable tier
    for tier_name, tier_config in tiers.items():
        start, end = tier_config['trades']
        if start <= trade_num <= end:
            base_risk = tier_config['risk']
            break
    else:
        base_risk = 0.01  # Default to 1%

    # Reduce risk if in drawdown
    if current_dd >= 0.10:  # 10% drawdown
        return base_risk * 0.5  # Cut risk in half
    elif current_dd >= 0.05:  # 5% drawdown
        return base_risk * 0.75

    return base_risk


def simulate_equity_curve(starting_balance, n_months, params, use_overnight=True,
                          use_risk_scaling=True, use_weekend_rules=True):
    """
    Simulate equity curve over n_months.

    Returns:
        DataFrame with equity curve data
    """
    trades_per_month = params['trades_per_month']
    total_trades = int(n_months * trades_per_month)

    # Generate all trades
    trades = generate_trade_sequence(total_trades, params, use_overnight)

    # Simulate equity curve
    equity = starting_balance
    peak_equity = starting_balance

    results = []

    for trade in trades:
        trade_num = trade['trade_num']
        result_r = trade['result_r']
        outcome = trade['outcome']
        hold_hours = trade['hold_hours']

        # Calculate current drawdown
        current_dd = (peak_equity - equity) / peak_equity if peak_equity > 0 else 0

        # Get risk for this trade
        if use_risk_scaling:
            risk_pct = get_risk_for_trade(trade_num, params, current_dd)
        else:
            risk_pct = 0.01  # Fixed 1%

        # Weekend rule simulation (simplified)
        is_friday_loser = random.random() < 0.15  # ~15% of trades are Friday losers
        if use_weekend_rules and is_friday_loser and result_r < 0:
            # Close early - reduce loss slightly (exit before full stop)
            result_r = result_r * 0.7
            outcome = 'WEEKEND_EXIT'

        # Calculate dollar result
        dollar_risk = equity * risk_pct
        dollar_result = dollar_risk * result_r

        # Update equity
        prev_equity = equity
        equity = equity + dollar_result

        # Update peak
        if equity > peak_equity:
            peak_equity = equity

        # Calculate metrics
        drawdown = (peak_equity - equity) / peak_equity if peak_equity > 0 else 0

        results.append({
            'trade_num': trade_num,
            'month': (trade_num - 1) / trades_per_month + 1,
            'equity': equity,
            'prev_equity': prev_equity,
            'result_r': result_r,
            'result_dollar': dollar_result,
            'result_pct': dollar_result / prev_equity if prev_equity > 0 else 0,
            'risk_pct': risk_pct,
            'outcome': outcome,
            'hold_hours': hold_hours,
            'peak_equity': peak_equity,
            'drawdown': drawdown,
            'cumulative_r': sum(t['result_r'] for t in trades[:trade_num]),
        })

    return pd.DataFrame(results)


# =============================================================================
# MONTE CARLO SIMULATION
# =============================================================================

def run_monte_carlo(n_simulations, starting_balance, n_months, params,
                    use_overnight=True, use_risk_scaling=True):
    """
    Run Monte Carlo simulation to generate distribution of outcomes.
    """
    results = []

    for sim in range(n_simulations):
        # Set different seed for each simulation
        np.random.seed(42 + sim)
        random.seed(42 + sim)

        curve = simulate_equity_curve(
            starting_balance, n_months, params,
            use_overnight=use_overnight,
            use_risk_scaling=use_risk_scaling
        )

        # Extract key metrics
        final_equity = curve['equity'].iloc[-1]
        max_drawdown = curve['drawdown'].max()
        total_return = (final_equity - starting_balance) / starting_balance
        win_count = len(curve[curve['result_r'] > 0])
        loss_count = len(curve[curve['result_r'] < 0])
        be_count = len(curve[curve['result_r'] == 0])
        total_trades = len(curve)

        results.append({
            'simulation': sim + 1,
            'final_equity': final_equity,
            'total_return_pct': total_return * 100,
            'max_drawdown_pct': max_drawdown * 100,
            'win_count': win_count,
            'loss_count': loss_count,
            'be_count': be_count,
            'total_trades': total_trades,
            'win_rate': win_count / total_trades if total_trades > 0 else 0,
            'avg_r_per_trade': curve['result_r'].mean(),
        })

    return pd.DataFrame(results)


# =============================================================================
# OVERNIGHT HOLD ANALYSIS
# =============================================================================

def compare_overnight_vs_daytrade(n_simulations, starting_balance, n_months, params):
    """
    Compare equity curves: overnight holds vs day trading (no overnight).
    """
    # Simulate with overnight holds (original system)
    overnight_results = run_monte_carlo(
        n_simulations, starting_balance, n_months, params,
        use_overnight=True
    )

    # Simulate day trading (reduced win potential)
    # Day trading params: lower avg win (exit early)
    daytrade_params = params.copy()
    daytrade_params['avg_win_r'] = params['avg_win_r'] * 0.6  # 60% of overnight wins
    daytrade_params['win_rate'] = params['win_rate'] * 0.95   # Slightly lower win rate

    daytrade_results = run_monte_carlo(
        n_simulations, starting_balance, n_months, daytrade_params,
        use_overnight=False
    )

    return overnight_results, daytrade_results


# =============================================================================
# MAIN SIMULATION
# =============================================================================

def main():
    print("=" * 70)
    print("EQUITY CURVE SIMULATION - OVERNIGHT HOLDS")
    print("Based on Locked Contracts and Validated Parameters")
    print("=" * 70)
    print()

    # Simulation parameters
    STARTING_BALANCE = 10000
    N_MONTHS = 24  # 2 years
    N_SIMULATIONS = 1000

    print(f"Starting Balance: ${STARTING_BALANCE:,}")
    print(f"Simulation Period: {N_MONTHS} months ({N_MONTHS/12:.1f} years)")
    print(f"Monte Carlo Simulations: {N_SIMULATIONS:,}")
    print()

    # =========================================================================
    # SINGLE CURVE EXAMPLE
    # =========================================================================
    print("-" * 70)
    print("SINGLE EQUITY CURVE EXAMPLE")
    print("-" * 70)

    np.random.seed(42)
    random.seed(42)

    single_curve = simulate_equity_curve(
        STARTING_BALANCE, N_MONTHS, SYSTEM_PARAMS,
        use_overnight=True, use_risk_scaling=True
    )

    print(f"\nTrade-by-Trade Sample (first 20 trades):\n")
    print(single_curve[['trade_num', 'equity', 'result_r', 'outcome',
                        'hold_hours', 'drawdown']].head(20).to_string(index=False))

    print(f"\n\nSingle Curve Summary:")
    print(f"  Final Equity: ${single_curve['equity'].iloc[-1]:,.2f}")
    print(f"  Total Return: {((single_curve['equity'].iloc[-1] / STARTING_BALANCE) - 1) * 100:.1f}%")
    print(f"  Max Drawdown: {single_curve['drawdown'].max() * 100:.1f}%")
    print(f"  Total Trades: {len(single_curve)}")
    print(f"  Avg R per Trade: {single_curve['result_r'].mean():.3f}R")
    print(f"  Avg Hold Time: {single_curve['hold_hours'].mean():.1f} hours")

    # Outcome distribution
    outcomes = single_curve['outcome'].value_counts()
    print(f"\n  Outcome Distribution:")
    for outcome, count in outcomes.items():
        print(f"    {outcome}: {count} ({count/len(single_curve)*100:.1f}%)")

    # =========================================================================
    # MONTE CARLO SIMULATION
    # =========================================================================
    print("\n" + "-" * 70)
    print("MONTE CARLO SIMULATION (1000 runs)")
    print("-" * 70)

    mc_results = run_monte_carlo(
        N_SIMULATIONS, STARTING_BALANCE, N_MONTHS, SYSTEM_PARAMS,
        use_overnight=True, use_risk_scaling=True
    )

    print(f"\nEquity Distribution After {N_MONTHS} Months:")
    percentiles = [5, 10, 25, 50, 75, 90, 95]
    for p in percentiles:
        val = np.percentile(mc_results['final_equity'], p)
        ret = (val / STARTING_BALANCE - 1) * 100
        print(f"  {p}th percentile: ${val:,.0f} ({ret:+.0f}%)")

    print(f"\nReturn Distribution:")
    print(f"  Mean: {mc_results['total_return_pct'].mean():.1f}%")
    print(f"  Median: {mc_results['total_return_pct'].median():.1f}%")
    print(f"  Std Dev: {mc_results['total_return_pct'].std():.1f}%")
    print(f"  Min: {mc_results['total_return_pct'].min():.1f}%")
    print(f"  Max: {mc_results['total_return_pct'].max():.1f}%")

    print(f"\nDrawdown Distribution:")
    print(f"  Mean Max DD: {mc_results['max_drawdown_pct'].mean():.1f}%")
    print(f"  Median Max DD: {mc_results['max_drawdown_pct'].median():.1f}%")
    print(f"  95th percentile Max DD: {np.percentile(mc_results['max_drawdown_pct'], 95):.1f}%")
    print(f"  Worst Max DD: {mc_results['max_drawdown_pct'].max():.1f}%")

    print(f"\nWin Rate Distribution:")
    print(f"  Mean: {mc_results['win_rate'].mean() * 100:.1f}%")
    print(f"  Std Dev: {mc_results['win_rate'].std() * 100:.1f}%")
    print(f"  Min: {mc_results['win_rate'].min() * 100:.1f}%")
    print(f"  Max: {mc_results['win_rate'].max() * 100:.1f}%")

    # =========================================================================
    # OVERNIGHT vs DAY TRADE COMPARISON
    # =========================================================================
    print("\n" + "-" * 70)
    print("OVERNIGHT HOLDS vs DAY TRADING COMPARISON")
    print("-" * 70)

    overnight, daytrade = compare_overnight_vs_daytrade(
        500, STARTING_BALANCE, N_MONTHS, SYSTEM_PARAMS
    )

    print(f"\nOVERNIGHT HOLDS (Your System):")
    print(f"  Median Final Equity: ${overnight['final_equity'].median():,.0f}")
    print(f"  Median Return: {overnight['total_return_pct'].median():.1f}%")
    print(f"  Mean Max Drawdown: {overnight['max_drawdown_pct'].mean():.1f}%")
    print(f"  Avg R per Trade: {overnight['avg_r_per_trade'].mean():.3f}R")

    print(f"\nDAY TRADING (Exit before overnight):")
    print(f"  Median Final Equity: ${daytrade['final_equity'].median():,.0f}")
    print(f"  Median Return: {daytrade['total_return_pct'].median():.1f}%")
    print(f"  Mean Max Drawdown: {daytrade['max_drawdown_pct'].mean():.1f}%")
    print(f"  Avg R per Trade: {daytrade['avg_r_per_trade'].mean():.3f}R")

    overnight_advantage = overnight['total_return_pct'].median() - daytrade['total_return_pct'].median()
    print(f"\nOVERNIGHT ADVANTAGE: +{overnight_advantage:.1f}% median return")

    # =========================================================================
    # RISK TIER PROGRESSION
    # =========================================================================
    print("\n" + "-" * 70)
    print("RISK TIER SCALING ANALYSIS")
    print("-" * 70)

    # Fixed 1% risk
    fixed_risk = run_monte_carlo(
        500, STARTING_BALANCE, N_MONTHS, SYSTEM_PARAMS,
        use_overnight=True, use_risk_scaling=False
    )

    # Scaling risk
    scaling_risk = run_monte_carlo(
        500, STARTING_BALANCE, N_MONTHS, SYSTEM_PARAMS,
        use_overnight=True, use_risk_scaling=True
    )

    print(f"\nFIXED 1% RISK:")
    print(f"  Median Final Equity: ${fixed_risk['final_equity'].median():,.0f}")
    print(f"  Median Return: {fixed_risk['total_return_pct'].median():.1f}%")
    print(f"  95th percentile Max DD: {np.percentile(fixed_risk['max_drawdown_pct'], 95):.1f}%")

    print(f"\nSCALING RISK (1% → 2.5%):")
    print(f"  Median Final Equity: ${scaling_risk['final_equity'].median():,.0f}")
    print(f"  Median Return: {scaling_risk['total_return_pct'].median():.1f}%")
    print(f"  95th percentile Max DD: {np.percentile(scaling_risk['max_drawdown_pct'], 95):.1f}%")

    # =========================================================================
    # ANNUAL PROJECTIONS
    # =========================================================================
    print("\n" + "-" * 70)
    print("ANNUAL PROJECTIONS BY RISK LEVEL")
    print("-" * 70)

    risk_levels = [0.01, 0.015, 0.02, 0.025]

    print(f"\n{'Risk %':<10} {'Median 1Y':<15} {'Median 2Y':<15} {'95% Max DD':<12} {'Expectancy':<12}")
    print("-" * 65)

    for risk in risk_levels:
        # Create params with fixed risk
        fixed_params = SYSTEM_PARAMS.copy()
        fixed_params['risk_tiers'] = {
            'all': {'trades': (0, 9999), 'risk': risk}
        }

        results_1y = run_monte_carlo(300, STARTING_BALANCE, 12, fixed_params, use_risk_scaling=False)
        results_2y = run_monte_carlo(300, STARTING_BALANCE, 24, fixed_params, use_risk_scaling=False)

        med_1y = results_1y['total_return_pct'].median()
        med_2y = results_2y['total_return_pct'].median()
        max_dd = np.percentile(results_2y['max_drawdown_pct'], 95)
        exp_r = results_2y['avg_r_per_trade'].mean()

        print(f"{risk*100:.1f}%{'':<7} {med_1y:+.0f}%{'':<10} {med_2y:+.0f}%{'':<10} {max_dd:.1f}%{'':<7} {exp_r:.3f}R")

    # =========================================================================
    # SURVIVAL ANALYSIS
    # =========================================================================
    print("\n" + "-" * 70)
    print("SURVIVAL ANALYSIS")
    print("-" * 70)

    # Check how many simulations stay above certain equity levels
    thresholds = [0.9, 0.8, 0.7, 0.5]  # 10%, 20%, 30%, 50% drawdown

    print(f"\nProbability of Staying Above Equity Thresholds (2 years, 1% risk):")

    # Run simulations tracking minimum equity
    survival_results = []
    for sim in range(1000):
        np.random.seed(100 + sim)
        random.seed(100 + sim)

        curve = simulate_equity_curve(
            STARTING_BALANCE, 24, SYSTEM_PARAMS,
            use_overnight=True, use_risk_scaling=False
        )

        min_equity = curve['equity'].min()
        min_ratio = min_equity / STARTING_BALANCE
        survival_results.append(min_ratio)

    survival_results = np.array(survival_results)

    for threshold in thresholds:
        survival_rate = np.mean(survival_results >= threshold) * 100
        dd_level = (1 - threshold) * 100
        print(f"  Never below {threshold*100:.0f}% ({dd_level:.0f}% max DD): {survival_rate:.1f}% of simulations")

    # =========================================================================
    # COMPOUNDING EFFECT
    # =========================================================================
    print("\n" + "-" * 70)
    print("COMPOUNDING EFFECT ANALYSIS")
    print("-" * 70)

    # Compare 1 year vs 2 year vs 5 year
    for years in [1, 2, 3, 5]:
        results = run_monte_carlo(500, STARTING_BALANCE, years * 12, SYSTEM_PARAMS,
                                  use_overnight=True, use_risk_scaling=True)

        median_eq = results['final_equity'].median()
        median_ret = results['total_return_pct'].median()
        p10 = np.percentile(results['final_equity'], 10)
        p90 = np.percentile(results['final_equity'], 90)

        print(f"\n  {years} Year{'s' if years > 1 else ''} (with risk scaling 1%→2.5%):")
        print(f"    Median: ${median_eq:,.0f} ({median_ret:+.0f}%)")
        print(f"    10th-90th percentile: ${p10:,.0f} - ${p90:,.0f}")

    # =========================================================================
    # LOSING STREAK ANALYSIS
    # =========================================================================
    print("\n" + "-" * 70)
    print("LOSING STREAK ANALYSIS")
    print("-" * 70)

    # Run many simulations and track max losing streaks
    max_streaks = []
    for sim in range(1000):
        np.random.seed(200 + sim)
        random.seed(200 + sim)

        curve = simulate_equity_curve(
            STARTING_BALANCE, 24, SYSTEM_PARAMS,
            use_overnight=True
        )

        # Find max consecutive losses
        outcomes = (curve['result_r'] < 0).astype(int).values
        max_streak = 0
        current_streak = 0
        for outcome in outcomes:
            if outcome == 1:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0
        max_streaks.append(max_streak)

    max_streaks = np.array(max_streaks)

    print(f"\nMax Consecutive Losses Distribution (2 years):")
    for streak in range(1, 8):
        pct = np.mean(max_streaks >= streak) * 100
        print(f"  {streak}+ losses in a row: {pct:.1f}% probability")

    print(f"\n  Average max streak: {np.mean(max_streaks):.1f}")
    print(f"  Most common max streak: {np.median(max_streaks):.0f}")
    print(f"  Worst observed streak: {np.max(max_streaks)}")

    # =========================================================================
    # SUMMARY
    # =========================================================================
    print("\n" + "=" * 70)
    print("SIMULATION SUMMARY")
    print("=" * 70)

    print(f"""
SYSTEM CHARACTERISTICS:
  Win Rate: 68% (validated from 4H/1H/5M contracts)
  Avg Winner: 1.8R | Avg Loser: 0.9R
  Expectancy: +0.94R per trade
  Trade Frequency: ~5-6 per month
  Typical Hold: 8-48 hours (swing with intraday precision)

OVERNIGHT HOLD BENEFIT:
  Overnight holds add +{overnight_advantage:.0f}% to 2-year median return
  vs day trading (exiting before overnight)

EXPECTED OUTCOMES (2 YEARS, 1% FIXED RISK):
  Median Return: {fixed_risk['total_return_pct'].median():.0f}%
  5th Percentile: {np.percentile(fixed_risk['total_return_pct'], 5):.0f}%
  95th Percentile: {np.percentile(fixed_risk['total_return_pct'], 95):.0f}%
  Typical Max Drawdown: {fixed_risk['max_drawdown_pct'].median():.0f}%

EXPECTED OUTCOMES (2 YEARS, SCALING 1%→2.5%):
  Median Return: {scaling_risk['total_return_pct'].median():.0f}%
  5th Percentile: {np.percentile(scaling_risk['total_return_pct'], 5):.0f}%
  95th Percentile: {np.percentile(scaling_risk['total_return_pct'], 95):.0f}%
  Typical Max Drawdown: {scaling_risk['max_drawdown_pct'].median():.0f}%

RISK ANALYSIS:
  Probability of never exceeding 20% drawdown: {np.mean(survival_results >= 0.8) * 100:.0f}%
  Most common max losing streak: {np.median(max_streaks):.0f} trades
  Expected max losing streak: {np.mean(max_streaks):.1f} trades

KEY INSIGHT:
  Your system's edge lives in TIME and ASYMMETRY.
  Overnight holds are not just acceptable—they're essential to full edge expression.
""")

    return mc_results, single_curve


if __name__ == "__main__":
    mc_results, single_curve = main()
