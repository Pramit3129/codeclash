import { randomBytes } from 'crypto';
import { redis } from '../../lib/redis';

const ticket_TTL = 1 * 60 * 1000; // ( 1 min ms ) 

interface validateTicketRes {
    message: string,
    userId: string | null
}

export async function issueTicket(userId : String): Promise<string | null> {
    if(!userId){
        return null;
    }
    const ticket = randomBytes(16).toString('base64url');
    const ticketKey = `ws-ticket:${ticket}`;
    await redis.setex(ticketKey, ticket_TTL, userId.toString());
    return ticket;
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