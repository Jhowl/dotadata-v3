import { z } from "zod";

export const slugParam = z.object({ slug: z.string().min(1).max(200) });
export const patchParam = z.object({ patch: z.string().min(1).max(50) });
export const yearParam = z.object({ year: z.coerce.number().int().min(2010).max(2100) });
export const limitQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(10) });
export const idsQuery = z.object({
  ids: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((s) => s.trim()).filter(Boolean)),
});
