
import type { Socket } from "socket.io";
import { validateTicket } from "../auth/ws-ticket.service";
import { logger } from "../../lib/logger";

export const socketAuthMiddleware = async (socket: Socket, next: any) => {
    const ticket = socket.handshake.auth.ticket;

    if (!ticket) {
        return next(new Error("Authentication required"));
    }

    try {
        const result = await validateTicket(ticket);

        if (!result.userId) {
            return next(new Error("Invalid or expired ticket"));
        }

        socket.data.userId = result.userId;

        return next();
    } catch (e) {
        logger.error(e);
        return next(new Error("Internal server error"));
    }

}