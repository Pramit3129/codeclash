import express from 'express';
import http from 'http';
import { env } from './config/env.js';
import { createSocketServer } from './modules/realtime/socket.js';

const wsApp = express();

wsApp.get("/", (_req, res) => {
    res.json({
        status: "ok",
        service: "realtime",
    });
});

wsApp.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
    });
});


const httpServer = http.createServer(wsApp);

createSocketServer(httpServer);

httpServer.listen(env.WS_PORT, () => {
    console.log(`WS server is running on port ${env.WS_PORT}`);
});