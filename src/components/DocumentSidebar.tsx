import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileText, Loader2, Trash2, Upload, LogOut, CheckCircle2, AlertCircle, Stars } from "lucide-react";
import { toast } from "sonner";

interface Doc {
  id: string;
  filename: string;
  status: string;
  chunk_count: number;
  error: string | null;
  storage_path: string;
}

export function DocumentSidebar() {
  const { user, signOut } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("documents")
      .select("id, filename, status, chunk_count, error, storage_path")
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setDocs(data || []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel("docs")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `user_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    const allowed = ["application/pdf", "text/plain", "text/markdown"];
    if (!allowed.includes(file.type) && !/\.(pdf|txt|md)$/i.test(file.name)) {
      toast.error("Only PDF, TXT, or MD files are supported.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (max 20MB).");
      return;
    }

    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("documents").upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw upErr;

      const { data: doc, error: insErr } = await supabase
        .from("documents").insert({
          filename: file.name, 
          storage_path: path,
          mime_type: file.type, 
          size_bytes: file.size, 
          status: "pending",
        }).select().single();
      if (insErr) throw insErr;

      toast.success("Uploaded — indexing…");
      supabase.functions.invoke("ingest-document", {
        body: { documentId: doc.id },
      }).then(({ error }) => {
        if (error) toast.error(`Indexing failed: ${error.message}`);
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (doc: Doc) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return;
    await supabase.storage.from("documents").remove([doc.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) toast.error(error.message);
  };

  return (
    <aside className="glass m-3 mr-0 flex w-72 shrink-0 flex-col rounded-3xl">
      <div className="border-b border-white/5 p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
            <Stars className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gradient">PrabhasBot</h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">RAG · v1</p>
          </div>
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary to-accent px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload document"}
        </button>
        <input ref={fileInput} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain"
          onChange={handleUpload} className="hidden" />
        <p className="mt-2 text-center text-[10px] text-muted-foreground">PDF · TXT · MD · max 20MB</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h2 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Knowledge base
        </h2>
        {docs.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            No documents yet. Upload a file to start chatting with it.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {docs.map((d) => (
              <li key={d.id}
                className="group flex items-start gap-2 rounded-xl p-2 transition hover:bg-white/5">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{d.filename}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {d.status === "ready" && (
                      <><CheckCircle2 className="h-3 w-3 text-emerald-400" />{d.chunk_count} chunks</>
                    )}
                    {(d.status === "pending" || d.status === "processing") && (
                      <><Loader2 className="h-3 w-3 animate-spin" />Indexing…</>
                    )}
                    {d.status === "error" && (
                      <><AlertCircle className="h-3 w-3 text-destructive" />{d.error || "Failed"}</>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(d)}
                  className="opacity-0 transition group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-white/5 p-3">
        <div className="mb-2 truncate px-1 text-xs text-muted-foreground">{user?.email}</div>
        <button onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-foreground">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
