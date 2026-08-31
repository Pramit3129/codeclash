import type { Server } from "socket.io";

let io: Server | null = null;

export function setSocketServer(socketServer: Server) {
    io = socketServer;
}

export function getSocketServer(): Server {
    if (!io) {
        throw new Error("Socket.IO server has not been initialized");
    }

    return io;
}
