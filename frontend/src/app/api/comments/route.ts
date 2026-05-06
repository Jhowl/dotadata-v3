import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  COMMENT_BODY_MAX,
  type CommentEntityType,
  createComment,
  listComments,
  softDeleteComment,
} from "@/lib/comments";
import { rateLimit } from "@/lib/rate-limit";

const POST_IP_LIMIT = 20;
const POST_USER_LIMIT = 10;
const POST_WINDOW_MS = 10 * 60_000;

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
};

const isEntityType = (value: unknown): value is CommentEntityType =>
  value === "league" || value === "team";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entity_type");
  const entityId = url.searchParams.get("entity_id");
  if (!isEntityType(entityType) || !entityId) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }
  const comments = await listComments(entityType, entityId);
  return NextResponse.json({ comments });
}

export async function POST(request: Request) {
  const session = await getSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const ipLimit = rateLimit(`comments:ip:${ip}`, POST_IP_LIMIT, POST_WINDOW_MS);
  const userLimit = rateLimit(`comments:user:${session.sub}`, POST_USER_LIMIT, POST_WINDOW_MS);
  if (!ipLimit.allowed || !userLimit.allowed) {
    return NextResponse.json({ error: "Too many comments. Slow down." }, { status: 429 });
  }

  let payload: { entity_type?: unknown; entity_id?: unknown; body?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { entity_type, entity_id, body } = payload;
  if (!isEntityType(entity_type) || typeof entity_id !== "string" || typeof body !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (body.length > COMMENT_BODY_MAX) {
    return NextResponse.json({ error: "Comment too long" }, { status: 400 });
  }

  const result = await createComment(session.sub, entity_type, entity_id, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ comment: result.comment }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const result = await softDeleteComment(id, session.sub);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
