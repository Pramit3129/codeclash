import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { env } from '../../config/env.js';

export function createSocketServer(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: env.CLIENT_ORIGIN,
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        socket.on('disconnect', (reason) => {
            console.log(
                `Socket disconnected: ${socket.id}, reason: ${reason}`
            );
        });
    });

    return io;
}