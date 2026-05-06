import { rateLimit } from "@/lib/rate-limit";

const WEBHOOK_URL = process.env.N8N_CONTACT_WEBHOOK_URL;

const MAX_BODY_BYTES = 10_000;
const MIN_SUBMIT_TIME_MS = 3_000;
const IP_LIMIT = 10;
const EMAIL_LIMIT = 3;
const WINDOW_MS = 10 * 60_000;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
};

const buildRateLimitResponse = (resetAt: number, limit: number) => {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(resetAt),
    },
  });
};

export async function POST(request: Request) {
  if (!WEBHOOK_URL) {
    return new Response(JSON.stringify({ error: "Server misconfiguration." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large." }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Unsupported content type." }), {
      status: 415,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return new Response(JSON.stringify({ error: "Invalid payload." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const allowedKeys = new Set(["name", "email", "subject", "message", "company", "submittedAt"]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      return new Response(JSON.stringify({ error: "Unexpected field provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim().toLowerCase();
  const subject = String(payload.subject ?? "").trim();
  const message = String(payload.message ?? "").trim();
  const company = String(payload.company ?? "").trim();
  const submittedAt = Number(payload.submittedAt ?? 0);

  if (company) {
    return new Response(JSON.stringify({ error: "Submission rejected." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!submittedAt || Date.now() - submittedAt < MIN_SUBMIT_TIME_MS) {
    return new Response(JSON.stringify({ error: "Submission too fast. Please try again." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (name.length < 2 || name.length > 60) {
    return new Response(JSON.stringify({ error: "Invalid name." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!emailRegex.test(email) || email.length > 254) {
    return new Response(JSON.stringify({ error: "Invalid email." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (subject.length < 3 || subject.length > 120) {
    return new Response(JSON.stringify({ error: "Invalid subject." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (message.length < 20 || message.length > 2000) {
    return new Response(JSON.stringify({ error: "Invalid message." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ip = getClientIp(request);
  // Apply layered throttles (IP + email) to reduce spam bursts.
  const ipLimit = rateLimit(`contact:ip:${ip}`, IP_LIMIT, WINDOW_MS);
  if (!ipLimit.allowed) {
    return buildRateLimitResponse(ipLimit.resetAt, IP_LIMIT);
  }

  const emailLimit = rateLimit(`contact:email:${email}`, EMAIL_LIMIT, WINDOW_MS);
  if (!emailLimit.allowed) {
    return buildRateLimitResponse(emailLimit.resetAt, EMAIL_LIMIT);
  }

  try {
    const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "dotadata-contact/1.0",
      },
      body: JSON.stringify({
        name,
        email,
        subject,
        message,
        source: "dotadata-contact",
        submittedAt: new Date().toISOString(),
        ip,
        forwardedFor,
        userAgent: request.headers.get("user-agent") ?? "",
        referer: request.headers.get("referer") ?? "",
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to deliver message." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Failed to deliver message." }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
