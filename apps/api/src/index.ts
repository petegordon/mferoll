import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { betRoutes } from './routes/bets.js';
import { healthRoutes } from './routes/health.js';
import { WebSocketService } from './services/websocket.js';
import { Indexer } from './services/indexer.js';

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/bets', betRoutes);

// WebSocket setup
const wsService = new WebSocketService(server);

// Start indexer
const indexer = new Indexer(wsService);

// Start server
server.listen(port, () => {
  console.log(`API server running on port ${port}`);

  // Start indexing after server starts
  indexer.start().catch(console.error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  indexer.stop();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
