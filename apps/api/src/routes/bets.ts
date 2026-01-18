import { Router } from 'express';
import { prisma } from '../models/prisma.js';

export const betRoutes = Router();

// Get bets for a player
betRoutes.get('/player/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const bets = await prisma.bet.findMany({
      where: { player: address.toLowerCase() },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.bet.count({
      where: { player: address.toLowerCase() },
    });

    res.json({
      bets,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    console.error('Error fetching player bets:', error);
    res.status(500).json({ error: 'Failed to fetch bets' });
  }
});

// Get a specific bet by request ID
betRoutes.get('/request/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    const bet = await prisma.bet.findUnique({
      where: { requestId },
    });

    if (!bet) {
      return res.status(404).json({ error: 'Bet not found' });
    }

    res.json(bet);
  } catch (error) {
    console.error('Error fetching bet:', error);
    res.status(500).json({ error: 'Failed to fetch bet' });
  }
});

// Get recent bets (public feed)
betRoutes.get('/recent', async (req, res) => {
  try {
    const { limit = '10' } = req.query;

    const bets = await prisma.bet.findMany({
      where: { settled: true },
      orderBy: { settledAt: 'desc' },
      take: Math.min(parseInt(limit as string), 50),
    });

    res.json(bets);
  } catch (error) {
    console.error('Error fetching recent bets:', error);
    res.status(500).json({ error: 'Failed to fetch recent bets' });
  }
});

// Get player statistics
betRoutes.get('/stats/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const playerAddress = address.toLowerCase();

    const [totalBets, wonBets, settledBets] = await Promise.all([
      prisma.bet.count({ where: { player: playerAddress } }),
      prisma.bet.count({ where: { player: playerAddress, won: true } }),
      prisma.bet.findMany({
        where: { player: playerAddress, settled: true },
        select: { amount: true, payout: true, won: true },
      }),
    ]);

    const totalWagered = settledBets.reduce(
      (sum, bet) => sum + BigInt(bet.amount),
      BigInt(0)
    );

    const totalWon = settledBets.reduce(
      (sum, bet) => sum + (bet.won && bet.payout ? BigInt(bet.payout) : BigInt(0)),
      BigInt(0)
    );

    res.json({
      totalBets,
      wonBets,
      lostBets: totalBets - wonBets,
      winRate: totalBets > 0 ? (wonBets / totalBets) * 100 : 0,
      totalWagered: totalWagered.toString(),
      totalWon: totalWon.toString(),
      netProfit: (totalWon - totalWagered).toString(),
    });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
