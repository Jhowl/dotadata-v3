import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "@/config/env.js";
import { HttpError } from "@/middleware/error.js";

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  hp: z.string().max(0).optional(),
});

export const contactController = {
  submit: async (req: Request, res: Response) => {
    const data = contactSchema.parse(req.body);
    if (data.hp) {
      res.status(204).end();
      return;
    }

    if (!env.N8N_CONTACT_WEBHOOK_URL) {
      throw new HttpError(503, "WEBHOOK_UNAVAILABLE", "Contact webhook not configured");
    }

    const response = await fetch(env.N8N_CONTACT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        receivedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new HttpError(502, "WEBHOOK_FAILED", "Failed to deliver message");
    }
    res.status(204).end();
  },
};
