import ReactMarkdown from "react-markdown";
import { User, Stars } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isAgent = role === "assistant";

  if (isAgent) {
    return (
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30">
          <Stars className="h-4 w-4" />
        </div>
        <div className="flex-1 pt-1">
          <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-accent prose-code:text-accent prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10">
            <ReactMarkdown>{content || "…"}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row-reverse gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl glass">
        <User className="h-4 w-4 text-foreground/70" />
      </div>
      <div className="max-w-[80%] rounded-3xl rounded-tr-md bg-gradient-to-br from-primary to-accent px-4 py-2.5 text-sm text-primary-foreground shadow-lg shadow-primary/20">
        <p className="leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
