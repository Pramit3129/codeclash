import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { env } from '../../config/env.js';
import { registerSocketEvents } from './socket.events.js';
import { socketAuthMiddleware } from './socket.auth.middleware.js';
import { joinUserRoom } from './socket.rooms.js';

export function createSocketServer(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: {
            // origin: env.CLIENT_ORIGIN,
            origin: "*",
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // immediately join user:{userId} room, so that we can send something to that specific user, regardless of which tab they have open
        joinUserRoom(socket, socket.data.userId);

        registerSocketEvents(socket);

        socket.on('disconnect', (reason) => {
            console.log(
                `Socket disconnected: ${socket.id}, reason: ${reason}`
            );
        });
    });

    return io;
}