import { createPublicClient, http, parseAbiItem, type Log } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { prisma } from '../models/prisma.js';
import { WebSocketService } from './websocket.js';

// Contract address - update after deployment
const DICE_BETTING_ADDRESS = process.env.DICE_BETTING_ADDRESS as `0x${string}` | undefined;

// Event signatures
const BET_PLACED_EVENT = parseAbiItem(
  'event BetPlaced(uint256 indexed requestId, address indexed player, uint8 betType, uint8 prediction, uint256 amount)'
);
const BET_SETTLED_EVENT = parseAbiItem(
  'event BetSettled(uint256 indexed requestId, address indexed player, uint8 die1, uint8 die2, bool won, uint256 payout)'
);

export class Indexer {
  private client;
  private wsService: WebSocketService;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;

    const chain = process.env.CHAIN_ID === '8453' ? base : baseSepolia;
    this.client = createPublicClient({
      chain,
      transport: http(process.env.RPC_URL),
    });
  }

  async start() {
    if (!DICE_BETTING_ADDRESS) {
      console.log('DICE_BETTING_ADDRESS not set, indexer disabled');
      return;
    }

    this.isRunning = true;
    console.log('Starting indexer...');

    // Get last indexed block
    let lastBlock = await this.getLastIndexedBlock();

    // Poll for new events
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const currentBlock = await this.client.getBlockNumber();

        if (currentBlock > BigInt(lastBlock)) {
          await this.indexBlocks(lastBlock + 1, Number(currentBlock));
          lastBlock = Number(currentBlock);
          await this.updateLastIndexedBlock(lastBlock);
        }
      } catch (error) {
        console.error('Indexer error:', error);
      }
    }, 3000); // Poll every 3 seconds
  }

  stop() {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    console.log('Indexer stopped');
  }

  private async getLastIndexedBlock(): Promise<number> {
    const state = await prisma.indexerState.findUnique({
      where: { id: 'default' },
    });

    if (state) {
      return state.lastBlockNumber;
    }

    // Start from a recent block if no state exists
    const currentBlock = await this.client.getBlockNumber();
    return Number(currentBlock) - 1000; // Start 1000 blocks back
  }

  private async updateLastIndexedBlock(blockNumber: number) {
    await prisma.indexerState.upsert({
      where: { id: 'default' },
      update: { lastBlockNumber: blockNumber },
      create: { id: 'default', lastBlockNumber: blockNumber },
    });
  }

  private async indexBlocks(fromBlock: number, toBlock: number) {
    if (!DICE_BETTING_ADDRESS) return;

    console.log(`Indexing blocks ${fromBlock} to ${toBlock}`);

    // Fetch BetPlaced events
    const betPlacedLogs = await this.client.getLogs({
      address: DICE_BETTING_ADDRESS,
      event: BET_PLACED_EVENT,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    // Fetch BetSettled events
    const betSettledLogs = await this.client.getLogs({
      address: DICE_BETTING_ADDRESS,
      event: BET_SETTLED_EVENT,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    // Process BetPlaced events
    for (const log of betPlacedLogs) {
      await this.handleBetPlaced(log);
    }

    // Process BetSettled events
    for (const log of betSettledLogs) {
      await this.handleBetSettled(log);
    }
  }

  private async handleBetPlaced(log: Log<bigint, number, false, typeof BET_PLACED_EVENT>) {
    if (!log.args.requestId || !log.args.player) return;

    const bet = {
      requestId: log.args.requestId.toString(),
      player: log.args.player.toLowerCase(),
      betType: Number(log.args.betType),
      prediction: Number(log.args.prediction),
      amount: log.args.amount?.toString() || '0',
      txHash: log.transactionHash || '',
      blockNumber: Number(log.blockNumber),
    };

    await prisma.bet.upsert({
      where: { requestId: bet.requestId },
      update: bet,
      create: bet,
    });

    console.log(`Indexed BetPlaced: ${bet.requestId}`);
    this.wsService.broadcastBetPlaced(bet);
  }

  private async handleBetSettled(log: Log<bigint, number, false, typeof BET_SETTLED_EVENT>) {
    if (!log.args.requestId || !log.args.player) return;

    const requestId = log.args.requestId.toString();
    const settleData = {
      die1: Number(log.args.die1),
      die2: Number(log.args.die2),
      won: log.args.won || false,
      payout: log.args.payout?.toString() || '0',
      settled: true,
      settledAt: new Date(),
      settleTxHash: log.transactionHash || '',
    };

    await prisma.bet.update({
      where: { requestId },
      data: settleData,
    });

    console.log(`Indexed BetSettled: ${requestId}`);
    this.wsService.broadcastBetSettled({
      requestId,
      player: log.args.player.toLowerCase(),
      ...settleData,
    });
  }
}
