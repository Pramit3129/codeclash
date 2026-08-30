import type { Socket } from 'socket.io';
import { getMatchRoomName, joinMatchRoom, leaveMatchRoom } from './socket.rooms';

export function registerSocketEvents(socket: Socket) {
    socket.on('test:ping', (data) => {
        console.log('Received test:ping:', data);

        socket.emit('test:pong', {
            message: 'Pong from server!',
            receivedAt: new Date().toISOString()
        });
    });

    socket.on('match.join', (payload: any) => {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const matchId = data?.matchId;
        if (!matchId) return;

        const matchRoom = joinMatchRoom(socket, matchId);
        console.log(`User: ${socket.id} joined match room ${matchRoom}`);

        // 1. Confirm to the joining client
        socket.emit('match.joined', { matchId });

        // 2. Notify other participants in the room
        socket.to(matchRoom).emit('room.joined', {
            userId: socket.data?.userId || "unknown",
            matchId
        });
    });

    socket.on('match.leave', (payload: any) => {
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        const matchId = data?.matchId;
        if (!matchId) return;

        const matchRoom = getMatchRoomName(matchId);

        // 1. Notify remaining participants in the room (before leaving)
        socket.to(matchRoom).emit('room.left', {
            userId: socket.data?.userId || "unknown",
            matchId
        });

        // 2. Leave the room
        leaveMatchRoom(socket, matchId);
        console.log(`User: ${socket.id} left match room ${matchRoom}`);

        // 3. Confirm to the leaving client
        socket.emit('match.left', { matchId });
    });
}