import { Position } from '../pages/api/positions';
import { AccountStats } from '../pages/api/account';

export const MOCK_POSITIONS: Position[] = [
  {
    id: 1,
    direction: 'LONG',
    entry_price: 42000,
    current_price: 42500,
    stop_loss: 41000,
    take_profit: 44000,
    position_size_btc: 0.5,
    position_size_usd: 21000,
    unrealized_pnl: 250,
    unrealized_pnl_percent: 1.19,
    stop_loss_source: '5M_SWING',
    trailing_stop_active: true,
    opened_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    duration_minutes: 30,
    risk_amount: 500,
    potential_profit: 1000,
  },
  {
    id: 2,
    direction: 'SHORT',
    entry_price: 43000,
    current_price: 42500,
    stop_loss: 44000,
    take_profit: 41000,
    position_size_btc: 0.2,
    position_size_usd: 8600,
    unrealized_pnl: 100,
    unrealized_pnl_percent: 1.16,
    stop_loss_source: '4H_SWING',
    trailing_stop_active: false,
    opened_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    duration_minutes: 120,
    risk_amount: 200,
    potential_profit: 400,
  },
];

export const MOCK_ACCOUNT_STATS: AccountStats = {
  balance: 10500,
  totalPnl: 500,
  totalPnlPercent: 5,
  winRate: 65.5,
  totalTrades: 42,
  wins: 27,
  losses: 15,
  breakevens: 0,
  consecutiveLosses: 1,
  dailyPnl: 150,
  dailyPnlPercent: 1.5,
  bestTrade: 800,
  worstTrade: -300,
  averageWin: 200,
  averageLoss: -150,
  profitFactor: 1.8,
};
