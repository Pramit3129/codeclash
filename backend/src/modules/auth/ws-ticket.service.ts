import { randomBytes } from 'crypto';
import { redis } from '../../lib/redis';

const ticket_TTL = 2 * 60 * 1000; // ( 2 min ms ) 

interface validateTicketRes {
    message: string,
    userId: string | null
}

interface wsTicket {
    ticket : string,
    TTL: string,
}

export async function issueTicket(userId : String): Promise<wsTicket | null> {
    if(!userId){
        return null;
    }
    const ticket = randomBytes(16).toString('base64url');
    const ticketKey = `ws-ticket:${ticket}`;
    await redis.setex(ticketKey, ticket_TTL, userId.toString());
    return {
        ticket: ticket,
        TTL: ticket_TTL.toString()
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