import { NextRequest } from "next/server";
import { API_URL } from "@/lib/auth/config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  const token = request.nextUrl.searchParams.get("token");

  const backendUrl = new URL(
    `/api/submissions/${submissionId}/judgeStream`,
    API_URL,
  );
  if (token) backendUrl.searchParams.set("token", token);

  const backendRes = await fetch(backendUrl.toString(), {
    headers: {
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!backendRes.ok) {
    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: { "Content-Type": backendRes.headers.get("Content-Type") ?? "text/plain" },
    });
  }

  if (!backendRes.body) {
    return new Response("No body", { status: 502 });
  }

  return new Response(backendRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
