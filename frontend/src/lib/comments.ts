import { supabaseAdmin } from "@/lib/supabase/client";

export type CommentEntityType = "league" | "team";

export type Comment = {
  id: string;
  entityType: CommentEntityType;
  entityId: string;
  steamid64: string;
  personaName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  body: string;
  createdAt: string;
};

export const COMMENT_BODY_MAX = 2000;

const isValidEntityType = (value: unknown): value is CommentEntityType =>
  value === "league" || value === "team";

const mapRow = (row: Record<string, unknown>): Comment => {
  const user = (row.users ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    entityType: row.entity_type as CommentEntityType,
    entityId: String(row.entity_id),
    steamid64: String(row.steamid64),
    personaName: (user.persona_name as string | null) ?? null,
    avatarUrl: (user.avatar_url as string | null) ?? null,
    profileUrl: (user.profile_url as string | null) ?? null,
    body: String(row.body ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
};

export const listComments = async (
  entityType: CommentEntityType,
  entityId: string,
): Promise<Comment[]> => {
  if (!supabaseAdmin || !entityId || !isValidEntityType(entityType)) return [];
  const { data, error } = await supabaseAdmin
    .from("comments")
    .select("id, entity_type, entity_id, steamid64, body, created_at, users(persona_name, avatar_url, profile_url)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map((row) => mapRow(row as Record<string, unknown>));
};

export type CreateCommentResult =
  | { ok: true; comment: Comment }
  | { ok: false; error: string };

export const createComment = async (
  steamid: string,
  entityType: CommentEntityType,
  entityId: string,
  body: string,
): Promise<CreateCommentResult> => {
  if (!supabaseAdmin) return { ok: false, error: "Server not configured" };
  if (!isValidEntityType(entityType)) return { ok: false, error: "Invalid entity type" };
  if (!entityId) return { ok: false, error: "Missing entity id" };
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: "Comment cannot be empty" };
  if (trimmed.length > COMMENT_BODY_MAX) return { ok: false, error: "Comment too long" };

  const { data, error } = await supabaseAdmin
    .from("comments")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      steamid64: steamid,
      body: trimmed,
    })
    .select("id, entity_type, entity_id, steamid64, body, created_at, users(persona_name, avatar_url, profile_url)")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, comment: mapRow(data as Record<string, unknown>) };
};

export const softDeleteComment = async (
  commentId: string,
  steamid: string,
): Promise<{ ok: boolean; error?: string }> => {
  if (!supabaseAdmin) return { ok: false, error: "Server not configured" };
  if (!commentId || !steamid) return { ok: false, error: "Missing parameters" };
  const { data, error } = await supabaseAdmin
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("steamid64", steamid)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Comment not found" };
  return { ok: true };
};
