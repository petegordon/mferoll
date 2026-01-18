import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface Client {
  ws: WebSocket;
  address?: string;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Set<Client> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      const client: Client = { ws };
      this.clients.add(client);

      console.log('WebSocket client connected');

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(client, message);
        } catch {
          console.error('Invalid WebSocket message');
        }
      });

      ws.on('close', () => {
        this.clients.delete(client);
        console.log('WebSocket client disconnected');
      });

      // Send welcome message
      ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
    });
  }

  private handleMessage(client: Client, message: { type: string; address?: string }) {
    switch (message.type) {
      case 'subscribe':
        // Subscribe to updates for a specific address
        if (message.address) {
          client.address = message.address.toLowerCase();
          console.log(`Client subscribed to address: ${client.address}`);
        }
        break;
      case 'unsubscribe':
        client.address = undefined;
        break;
    }
  }

  // Broadcast a bet placed event
  broadcastBetPlaced(bet: {
    requestId: string;
    player: string;
    betType: number;
    prediction: number;
    amount: string;
  }) {
    this.broadcast({
      type: 'bet_placed',
      data: bet,
    });
  }

  // Broadcast a bet settled event
  broadcastBetSettled(bet: {
    requestId: string;
    player: string;
    die1: number;
    die2: number;
    won: boolean;
    payout: string;
  }) {
    this.broadcast({
      type: 'bet_settled',
      data: bet,
    });
  }

  private broadcast(message: object) {
    const data = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Send to all clients or filter by address if subscribed
        const msg = message as { data?: { player?: string } };
        if (!client.address || client.address === msg.data?.player?.toLowerCase()) {
          client.ws.send(data);
        }
      }
    }
  }
}
