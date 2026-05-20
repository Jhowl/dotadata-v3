const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";
const INTERNAL_BASE = process.env.API_INTERNAL_BASE_URL ?? PUBLIC_BASE;

const baseUrl = () => (typeof window === "undefined" ? INTERNAL_BASE : PUBLIC_BASE);

type FetchOptions = RequestInit & { revalidate?: number };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const isBrowser = typeof window !== "undefined";

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { revalidate, ...init } = options;
  const url = `${baseUrl()}${path}`;
  // Only default `credentials: include` in the browser. Setting it server-side
  // tells Next.js to forward the incoming request's cookies, which marks the
  // surrounding route as dynamic and breaks ISR pages with
  // `DYNAMIC_SERVER_USAGE` at render time. Server-side callers that genuinely
  // need to forward auth (e.g. SiteAuth's /auth/me) pass cookies via `headers`
  // explicitly, not via this default.
  const credentials = init.credentials ?? (isBrowser ? "include" : undefined);
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...(credentials ? { credentials } : {}),
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  });

  if (!response.ok) {
    let code = "REQUEST_FAILED";
    let message = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { code: string; message: string } };
      if (body?.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, options?: FetchOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
