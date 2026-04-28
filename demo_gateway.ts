import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// NOTE: This is a LOCAL-ONLY demo gateway tool for development/presentation.
// It uses permissive CORS (*) to allow rapid prototyping without proxying.
import { load } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
import {
  EXECUTIVE_SYSTEM_PROMPT,
  getRoleContext,
} from "./supabase/functions/_shared/prompts-executive.ts";

await load({ export: true, allowEmptyValues: true });

const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY");

const GEMINI_MODEL =
  Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { role, messages } = await req.json();

    const roleContext = getRoleContext(role);
    const systemPrompt = `${EXECUTIVE_SYSTEM_PROMPT}\n\n${roleContext}`;

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Missing API key. Add GEMINI_API_KEY or GOOGLE_API_KEY to your .env file.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const safeMessages = Array.isArray(messages) ? messages : [];

    const contents = safeMessages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "") }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents:
            contents.length > 0
              ? contents
              : [{ role: "user", parts: [{ text: "Hello" }] }],
        }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: `Gemini ${res.status}: ${
            data?.error?.message ?? "Unknown API error"
          }`,
          details: data,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text ?? "")
        .join("")
        .trim();

    if (!reply) {
      return new Response(
        JSON.stringify({
          error: "Gemini returned no text response.",
          details: data,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}, { port: 9999 });

console.log(
  `PAWS AI Gateway running at http://localhost:9999 using model ${GEMINI_MODEL}`,
);