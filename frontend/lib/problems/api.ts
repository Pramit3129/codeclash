import { apiJson } from "@/lib/auth/apiClient";
import type {
  ProblemListResponse,
  ProblemDetailResponse,
  Difficulty,
} from "./types";

interface GetProblemsParams {
  limit?: number;
  cursor?: string;
  difficulty?: Difficulty;
}

export async function getProblems({
  limit = 10,
  cursor,
  difficulty,
}: GetProblemsParams = {}): Promise<ProblemListResponse> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  if (difficulty) params.set("difficulty", difficulty);

  return apiJson<ProblemListResponse>(`/api/problems?${params.toString()}`);
}

export async function getProblemBySlug(
  slug: string,
): Promise<ProblemDetailResponse> {
  return apiJson<ProblemDetailResponse>(`/api/problems/${slug}`);
}
