// RAG chat: embed query, retrieve user's chunks, stream answer with citations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHAT_MODEL = "gpt-4o-mini";
const EMBED_MODEL = "openai/text-embedding-3-small";
const TOP_K = 5;

const BASE_SYSTEM = `You are a helpful AI assistant that answers questions about the user's uploaded documents.

Rules:
- Use the provided context to answer when relevant.
- If the context doesn't contain the answer, say so honestly and answer from general knowledge if appropriate.
- Cite sources inline using [filename] when you draw from the context.
- Be concise. Use markdown when helpful.`;

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!resp.ok) throw new Error(`Embed failed: ${resp.status}`);
  const data = await resp.json();
  return data.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sign in to chat." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const API_KEY = Deno.env.get("API_KEY");
    if (!API_KEY) throw new Error("API_KEY is not configured");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error("Invalid messages");

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    let contextBlock = "";
    if (lastUser?.content) {
      try {
        const embedding = await embedQuery(lastUser.content, API_KEY);
        const { data: matches, error: matchErr } = await userClient.rpc(
          "match_document_chunks",
          { query_embedding: embedding as unknown as string, match_count: TOP_K },
        );
        if (matchErr) console.error("match error:", matchErr);
        if (matches && matches.length > 0) {
          contextBlock = "\n\nRetrieved context from user's documents:\n" +
            matches.map((m: { filename: string; content: string }, i: number) =>
              `[${i + 1}] (${m.filename})\n${m.content}`
            ).join("\n\n---\n\n");
        }
      } catch (e) {
        console.error("retrieval failed:", e);
      }
    }

    const systemContent = BASE_SYSTEM + (contextBlock || "\n\n(No documents indexed yet.)");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [{ role: "system", content: systemContent }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
