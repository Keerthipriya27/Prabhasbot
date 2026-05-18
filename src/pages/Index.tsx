import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { DocumentSidebar } from "@/components/DocumentSidebar";
import { streamChat, type ChatMessage as Msg } from "@/lib/streamChat";
import { Stars, FileSearch, ListChecks, HelpCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS = [
  { icon: FileSearch, label: "Summarize my docs", prompt: "Summarize the key points across my uploaded documents." },
  { icon: ListChecks, label: "Extract action items", prompt: "List any action items or decisions from my documents." },
  { icon: HelpCircle, label: "Ask a question", prompt: "What is the main topic of my documents?" },
  { icon: Sparkles, label: "Compare ideas", prompt: "Compare the main ideas across my documents." },
];

const Index = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (input: string) => {
    const userMsg: Msg = { role: "user", content: input };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      const text = assistantSoFar;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: text } : m));
        }
        return [...prev, { role: "assistant", content: text }];
      });
    };

    try {
      await streamChat({
        messages: updatedMessages,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
      setIsLoading(false);
    }
  }, [messages]);

  return (
    <div className="flex h-screen">
      <DocumentSidebar />

      <div className="flex flex-1 flex-col p-3 pl-3">
        <div className="glass-strong flex flex-1 flex-col overflow-hidden rounded-3xl">
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
            <div>
              <h1 className="text-lg font-bold text-gradient">PrabhasBot</h1>
              <p className="text-xs text-muted-foreground">Retrieval-augmented · grounded in your documents</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider text-emerald-300">Online</span>
            </div>
          </header>

          {/* Chat area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent shadow-2xl shadow-primary/40">
                  <Stars className="h-9 w-9 text-primary-foreground" />
                </div>
                <h2 className="mb-2 text-2xl font-bold text-gradient">
                  Hey, I'm PrabhasBot
                </h2>
                <p className="mb-10 max-w-md text-center text-sm text-muted-foreground">
                  Upload a document on the left, then ask me anything about it. I'll retrieve the most relevant passages and cite them in my answer.
                </p>
                <div className="grid w-full max-w-xl grid-cols-2 gap-3">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => send(s.prompt)}
                      disabled={isLoading}
                      className="glass group flex items-center gap-3 rounded-2xl p-4 text-left transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-primary/10 disabled:opacity-50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-accent transition group-hover:from-primary/30 group-hover:to-accent/30">
                        <s.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((m, i) => (
                  <ChatMessage key={i} role={m.role} content={m.content} />
                ))}
                {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                  <ChatMessage role="assistant" content="" />
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-6 pb-5 pt-2">
            <div className="mx-auto max-w-3xl">
              <ChatInput onSend={send} disabled={isLoading} />
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                PrabhasBot grounds answers in your uploaded documents when relevant.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
