// Ingest a document: download from storage, parse, chunk, embed, store.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Embedding failed (${resp.status}): ${t}`);
  }
  const data = await resp.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId required");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: doc, error: docErr } = await admin
      .from("documents").select("*").eq("id", documentId).eq("user_id", userId).single();
    if (docErr || !doc) throw new Error("Document not found");

    await admin.from("documents").update({ status: "processing", error: null }).eq("id", doc.id);

    // Download file
    const { data: fileData, error: dlErr } = await admin.storage
      .from("documents").download(doc.storage_path);
    if (dlErr || !fileData) throw new Error(`Download failed: ${dlErr?.message}`);

    // Extract text
    let text = "";
    const mime = doc.mime_type || "";
    if (mime === "application/pdf" || doc.filename.toLowerCase().endsWith(".pdf")) {
      const buf = new Uint8Array(await fileData.arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const { text: pages } = await extractText(pdf, { mergePages: true });
      text = Array.isArray(pages) ? pages.join("\n") : pages;
    } else {
      text = await fileData.text();
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("No text extracted from document");

    // Embed in batches of 50
    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embeddings = await embedBatch(batch, OPENAI_API_KEY);
      const rows = batch.map((content, j) => ({
        document_id: doc.id,
        user_id: userId,
        chunk_index: i + j,
        content,
        embedding: embeddings[j] as unknown as string,
      }));
      const { error: insErr } = await admin.from("document_chunks").insert(rows);
      if (insErr) throw new Error(`Insert chunks failed: ${insErr.message}`);
      inserted += rows.length;
    }

    await admin.from("documents").update({
      status: "ready", chunk_count: inserted,
    }).eq("id", doc.id);

    return new Response(JSON.stringify({ ok: true, chunks: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.documentId) {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await admin.from("documents").update({ status: "error", error: message })
          .eq("id", body.documentId);
      }
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
