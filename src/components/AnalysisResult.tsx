import ReactMarkdown from "react-markdown";
import { Loader2 } from "lucide-react";

interface AnalysisResultProps {
  content: string;
  isLoading: boolean;
}

export function AnalysisResult({ content, isLoading }: AnalysisResultProps) {
  if (!content && !isLoading) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <h2 className="text-sm font-mono font-medium text-muted-foreground uppercase tracking-wider">
          Analysis
        </h2>
        {isLoading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary" />}
      </div>
      <div className="prose prose-invert prose-sm max-w-none font-mono text-secondary-foreground prose-headings:text-foreground prose-headings:font-sans prose-strong:text-foreground prose-a:text-primary">
        <ReactMarkdown>{content || "Analyzing..."}</ReactMarkdown>
      </div>
    </div>
  );
}
