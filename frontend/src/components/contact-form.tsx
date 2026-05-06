"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


type FormState = "idle" | "submitting" | "success" | "error";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const honeypot = String(formData.get("company") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    if (honeypot) {
      setError("Submission blocked. Please try again.");
      return;
    }

    const startedAt = startedAtRef.current ?? 0;
    if (Date.now() - startedAt < 3000) {
      setError("Please take a moment before submitting the form.");
      return;
    }

    if (name.length < 2) {
      setError("Please enter your name.");
      return;
    }

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (subject.length < 3) {
      setError("Please add a short subject.");
      return;
    }

    if (message.length < 20) {
      setError("Please provide a message with at least 20 characters.");
      return;
    }

    try {
      setState("submitting");
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          submittedAt: startedAt,
          company: honeypot,
        }),
      });

      if (!response.ok) {
        const responseBody = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(responseBody?.error ?? "Request failed");
      }

      form.reset();
      startedAtRef.current = Date.now();
      setState("success");
    } catch (submitError) {
      setState("error");
      setError(
        submitError instanceof Error ? submitError.message : "We could not send your message right now. Please try again."
      );
    } finally {
      setTimeout(() => setState("idle"), 4000);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <input name="company" className="hidden" tabIndex={-1} autoComplete="off" />
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Name *</label>
          <Input name="name" placeholder="Your name" minLength={2} maxLength={60} required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-muted-foreground">Email *</label>
          <Input name="email" placeholder="you@email.com" type="email" required />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-muted-foreground">Subject *</label>
        <Input name="subject" placeholder="What's this about?" minLength={3} maxLength={120} required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-muted-foreground">Message *</label>
        <textarea
          name="message"
          className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Tell us more about your question or feedback..."
          minLength={20}
          maxLength={2000}
          required
        />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {state === "success" ? <p className="text-sm text-emerald-400">Thanks! Your message is on the way.</p> : null}
      <Button type="submit" className="w-full" disabled={state === "submitting"}>
        {state === "submitting" ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
