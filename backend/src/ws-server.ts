import express from 'express';
import http from 'http';
import { env } from './config/env.js';
import { createSocketServer } from './modules/realtime/socket.js';

const wsApp = express();

const httpServer = http.createServer(wsApp);

createSocketServer(httpServer);

httpServer.listen(env.WS_PORT, () => {
    console.log(`WS server is running on port ${env.WS_PORT}`);
});