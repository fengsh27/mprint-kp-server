// api.ts
import { ConceptRow, PmidRow, SearchType, TypeData } from "../libs/database/types";

/** Raised when response.ok is false. Carries status, statusText, and parsed body (if any). */
export class ApiError<T = unknown> extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: T
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestInitExtra = Omit<RequestInit, "body" | "method"> & { signal?: AbortSignal };

const DEFAULT_RETRY_STATUS = new Set([429, 502, 503, 504]);

/** Small helper: sleep with jitter */
const delay = (ms: number) =>
  new Promise((r) => setTimeout(r, ms + Math.floor(Math.random() * 50)));

async function parseJsonSafely<T>(res: Response): Promise<T | undefined> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch (e: any) {
    console.error(e);
    // Not JSON; return undefined so caller can decide
    return undefined;
  }
}

async function request<T>(
  input: string,
  init: RequestInit & { retries?: number; retryStatuses?: Set<number> } = {}
): Promise<T> {
  const {
    retries = 2,
    retryStatuses = DEFAULT_RETRY_STATUS,
    headers,
    ...rest
  } = init;

  let attempt = 0;
  // Always include JSON headers if body is provided and no content-type is set
  const finalHeaders: HeadersInit = {
    ...(headers || {}),
  };

  const hasBody = rest.body !== undefined && rest.body !== null;
  if (hasBody && !new Headers(finalHeaders).has("Content-Type")) {
    (finalHeaders as Record<string, string>)["Content-Type"] = "application/json";
  }

  while (true) {
    const res = await fetch(input, { headers: finalHeaders, ...rest });

    if (res.ok) {
      // Try JSON first; if empty or not JSON, return undefined as T (callers can type void)
      const data = (await parseJsonSafely<T>(res)) as T;
      // If server returns plain text or empty, this still works (data may be undefined)
      return data;
    }

    // Try to parse error payload to surface useful info
    const errBody = await parseJsonSafely<unknown>(res);

    if (retryStatuses.has(res.status) && attempt < retries) {
      attempt += 1;
      const backoffMs = 300 * 2 ** (attempt - 1);
      await delay(backoffMs);
      continue;
    }

    throw new ApiError<unknown>(
      `Request failed: ${res.status} ${res.statusText}`,
      res.status,
      res.statusText,
      errBody
    );
  }
}

/** Convenience wrappers */
const api = {
  get: <T>(path: string, init?: RequestInitExtra) =>
    request<T>(path, { method: "GET", ...init }),

  post: <T>(path: string, body?: unknown, init?: RequestInitExtra) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, ...init }),

  put: <T>(path: string, body?: unknown, init?: RequestInitExtra) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined, ...init }),

  del: <T>(path: string, init?: RequestInitExtra) =>
    request<T>(path, { method: "DELETE", ...init }),
};

export default api;
