import type { Socket } from 'socket.io';
import { z } from 'zod';
import { canUserJoinMatch, getMatchRoomName, isInMatchRoom, joinMatchRoom, leaveMatchRoom } from './socket.rooms.js';
import type { SocketAckCallback, SocketResponse } from './socket.types.js';

export const matchEventPayloadSchema = z.object({
    matchId: z.string().trim().min(1, 'matchId is required')
});

export type MatchEventPayload = z.infer<typeof matchEventPayloadSchema>;

function safeParsePayload(payload: unknown): unknown {
    if (typeof payload === 'string') {
        try {
            return JSON.parse(payload);
        } catch {
            return null;
        }
    }
    return payload;
}

function sendResponse<T>(
    socket: Socket,
    eventName: string,
    ack: SocketAckCallback<T> | undefined,
    response: SocketResponse<T>
) {
    if (typeof ack === 'function') {
        ack(response);
    }
    socket.emit(eventName, response);
}

export function registerSocketEvents(socket: Socket) {
    socket.on('test:ping', (data: unknown, ack?: SocketAckCallback<{ message: string; receivedAt: string }>) => {
        console.log('Received test:ping:', data);

        const response: SocketResponse<{ message: string; receivedAt: string }> = {
            success: true,
            data: {
                message: 'Pong from server!',
                receivedAt: new Date().toISOString()
            }
        };

        sendResponse(socket, 'test:pong', ack, response);
    });

    socket.on('match.join', async (payload: unknown, ack?: SocketAckCallback<{ matchId: string }>) => {
        const userId = socket.data?.userId;
        if (!userId) {
            const errorResponse: SocketResponse<{ matchId: string }> = {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            };
            sendResponse(socket, 'match.error', ack, errorResponse);
            return;
        }

        const rawData = safeParsePayload(payload);
        const parseResult = matchEventPayloadSchema.safeParse(rawData);

        if (!parseResult.success) {
            const errorResponse: SocketResponse<{ matchId: string }> = {
                success: false,
                error: {
                    code: 'INVALID_PAYLOAD',
                    message: 'Payload must contain a non-empty matchId',
                    details: parseResult.error.flatten().fieldErrors
                }
            };
            sendResponse(socket, 'match.error', ack, errorResponse);
            return;
        }

        const { matchId } = parseResult.data;

        // TODO: Enforce DB match membership check
        const isAllowed = await canUserJoinMatch(userId, matchId);
        if (!isAllowed) {
            const errorResponse: SocketResponse<{ matchId: string }> = {
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `User ${userId} is not authorized to join match ${matchId}`
                }
            };
            sendResponse(socket, 'match.error', ack, errorResponse);
            return;
        }

        const matchRoom = joinMatchRoom(socket, matchId);
        console.log(`User: ${userId} joined match room ${matchRoom}`);

        const successResponse: SocketResponse<{ matchId: string }> = {
            success: true,
            data: { matchId }
        };

        sendResponse(socket, 'match.joined', ack, successResponse);

        socket.to(matchRoom).emit('room.joined', {
            userId,
            matchId
        });
    });

    socket.on('match.leave', async (payload: unknown, ack?: SocketAckCallback<{ matchId: string }>) => {
        const userId = socket.data?.userId;
        if (!userId) {
            const errorResponse: SocketResponse<{ matchId: string }> = {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            };
            sendResponse(socket, 'match.error', ack, errorResponse);
            return;
        }

        const rawData = safeParsePayload(payload);
        const parseResult = matchEventPayloadSchema.safeParse(rawData);

        if (!parseResult.success) {
            const errorResponse: SocketResponse<{ matchId: string }> = {
                success: false,
                error: {
                    code: 'INVALID_PAYLOAD',
                    message: 'Payload must contain a non-empty matchId',
                    details: parseResult.error.flatten().fieldErrors
                }
            };
            sendResponse(socket, 'match.error', ack, errorResponse);
            return;
        }

        const { matchId } = parseResult.data;

        // TODO: Enforce DB match membership check
        const isAllowed = await canUserJoinMatch(userId, matchId);
        if (!isAllowed) {
            const errorResponse: SocketResponse<{ matchId: string }> = {
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: `User ${userId} is not authorized for match ${matchId}`
                }
            };
            sendResponse(socket, 'match.error', ack, errorResponse);
            return;
        }

        // Verify socket is actually inside the room before broadcasting leave
        if (!isInMatchRoom(socket, matchId)) {
            const errorResponse: SocketResponse<{ matchId: string }> = {
                success: false,
                error: {
                    code: 'NOT_IN_ROOM',
                    message: `Socket is not in match room ${matchId}`
                }
            };
            sendResponse(socket, 'match.error', ack, errorResponse);
            return;
        }

        const matchRoom = getMatchRoomName(matchId);

        socket.to(matchRoom).emit('room.left', {
            userId,
            matchId
        });

        leaveMatchRoom(socket, matchId);
        console.log(`User: ${userId} left match room ${matchRoom}`);

        const successResponse: SocketResponse<{ matchId: string }> = {
            success: true,
            data: { matchId }
        };

        sendResponse(socket, 'match.left', ack, successResponse);
    });
}