import { apiJson } from "@/lib/auth/apiClient";

interface IssueWsTicketResponse {
  success: boolean;
  ticket?: string;
  TTL?: number;
  message?: string;
}

/**
 * Requests a one-time WebSocket ticket from the normal backend.
 *
 * The ticket is stored in Redis with a short TTL and consumed atomically
 * (GETDEL) by the realtime server during the handshake — it is therefore valid
 * for exactly one connection attempt. Callers must never cache or replay it.
 */
export async function issueWsTicket(): Promise<string> {
  const data = await apiJson<IssueWsTicketResponse>(
    "/api/auth/issue-ws-ticket",
    { method: "POST" },
  );

  if (!data?.success || !data.ticket) {
    throw new Error(data?.message ?? "Failed to issue realtime ticket");
  }

  return data.ticket;
}
