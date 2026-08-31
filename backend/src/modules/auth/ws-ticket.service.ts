import { randomBytes } from 'crypto';
import { redis } from '../../lib/redis';

const TICKET_TTL_SECONDS = 2 * 60 ; // ( 2 minutes ) 

export interface validateTicketRes {
    message: string,
    userId: string | null
}

export interface wsTicket {
    ticket: string,
    TTL: number,
}

export async function issueTicket(userId: string): Promise<wsTicket | null> {
    if(!userId){
        return null;
    }
    const ticket = randomBytes(16).toString('base64url');
    const ticketKey = `ws-ticket:${ticket}`;
    await redis.setex(ticketKey, TICKET_TTL_SECONDS, userId.toString());
    return {
        ticket: ticket,
        TTL: TICKET_TTL_SECONDS
    };
}


export async function validateTicket(ticket : string) : Promise<validateTicketRes> {
    if(!ticket){
        return {
            message: "ticket missing",
            userId : null
        };
    }
    const ticketKey = `ws-ticket:${ticket}`;
    const data = await redis.getdel(ticketKey) ?? "";
    if(!data){
        return {
            message: "Invalid ticket",
            userId : null
        }
    }
    return { 
        message: "valid ticket",
        userId: data
    }
}