"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useClient, gql } from "@urql/next";
import { cn } from "@/lib/cn";

const ASK_DOC = gql`
  query AskAgents($question: String!) {
    aiAsk(question: $question) {
      answer
      sources
    }
  }
`;

interface AiAnswer {
  answer: string;
  sources: string[];
}

export function AskBar() {
  const client = useClient();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAnswer | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setOpen(true);
    setResult(null);
    try {
      const { data } = await client
        .query(ASK_DOC, { question: q })
        .toPromise();
      setResult(data?.aiAsk ?? null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
          <Sparkles className="h-4 w-4 flex-shrink-0 text-emerald-500" />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onFocus={() => result && setOpen(true)}
            placeholder="Ask your agents anything…"
            className="flex-1 bg-transparent text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-emerald-500" />}
        </div>
      </form>

      {/* Answer popover */}
      {open && (loading || result) && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="p-4">
            {loading && !result && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                Asking agents…
              </div>
            )}
            {result && (
              <>
                <p className="text-sm text-zinc-800 leading-relaxed">{result.answer}</p>
                {result.sources.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">
                      Sources
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {result.sources.map((src) => (
                        <li
                          key={src}
                          className={cn(
                            "rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5",
                            "text-[11px] text-zinc-600"
                          )}
                        >
                          {src}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
