import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const { documentId, userId, filename, storage_path, mime_type, size_bytes } = await req.json();

  if (!documentId || !userId) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Insert document with SERVICE_ROLE_KEY (bypasses RLS)
    const { data: doc, error: insErr } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        user_id: userId,
        filename,
        storage_path,
        mime_type,
        size_bytes,
        status: "pending",
      })
      .select()
      .single();

    if (insErr) {
      throw insErr;
    }

    return new Response(JSON.stringify({ success: true, doc }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
