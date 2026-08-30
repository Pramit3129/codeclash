import type { Socket } from "socket.io";

export function getUserRoomName(userId: string) {
    return `user:${userId}`;
}

export function getMatchRoomName(matchId: string) {
    return `match:${matchId}`;
}

export function getSpectatorRoomName(matchId: string) {
    return `spectate:${matchId}`;
}

export function joinUserRoom(socket: Socket, userId: string) {
    const roomName = getUserRoomName(userId);
    socket.join(roomName);
    return roomName;
}

export function leaveUserRoom(socket: Socket, userId: string) {
    const roomName = getUserRoomName(userId);
    socket.leave(roomName);
    return roomName;
}

export function isInUserRoom(socket: Socket, userId: string) {
    const roomName = getUserRoomName(userId);
    return socket.rooms.has(roomName);
}

export function joinMatchRoom(socket: Socket, matchId: string) {
    const roomName = getMatchRoomName(matchId);
    const alreadyInMatchRoom = isInMatchRoom(socket, matchId);
    if (!alreadyInMatchRoom) {
        socket.join(roomName);
    }
    return roomName;
}

export function leaveMatchRoom(socket: Socket, matchId: string) {
    const roomName = getMatchRoomName(matchId);
    const alreadyInMatchRoom = isInMatchRoom(socket, matchId);
    if (alreadyInMatchRoom) {
        socket.leave(roomName);
    }
    return roomName;
}

export function isInMatchRoom(socket: Socket, matchId: string) {
    const roomName = getMatchRoomName(matchId);
    return socket.rooms.has(roomName);
}

export function joinSpectatorRoom(socket: Socket, matchId: string) {
    const roomName = getSpectatorRoomName(matchId);
    socket.join(roomName);
    return roomName;
}

export function leaveSpectatorRoom(socket: Socket, matchId: string) {
    const roomName = getSpectatorRoomName(matchId);
    socket.leave(roomName);
    return roomName;
}

export function isInSpectatorRoom(socket: Socket, matchId: string) {
    const roomName = getSpectatorRoomName(matchId);
    return socket.rooms.has(roomName);
}