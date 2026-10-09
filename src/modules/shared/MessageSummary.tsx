"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function MessageSummary({ content }: { content: string }) {
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const panelId = useId();
  useEffect(() => () => controller.current?.abort(), []);

  async function summarize() {
    if (controller.current) return;
    if (summary) { setExpanded(value => !value); return; }
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError("");
    setExpanded(true);
    try {
      const response = await fetch("/api/messages/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }), signal: request.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to summarize this message.");
      if (typeof data.summary !== "string" || !data.summary.trim()) throw new Error("No summary was returned. Please retry.");
      if (!request.signal.aborted) setSummary(data.summary);
    } catch (err) {
      if (!request.signal.aborted) setError(err instanceof Error ? err.message : "Unable to summarize. Please retry.");
    } finally {
      if (!request.signal.aborted) { controller.current = null; setLoading(false); }
    }
  }

  if (content.trim().length < 400) return null;
  return (
    <div className="mt-3">
      <button type="button" disabled={loading} onClick={() => void summarize()} aria-expanded={expanded} aria-controls={panelId}
        title="Summarize this message with AI"
        className="rounded-lg border border-gray-700 bg-[#0B1120] px-3 py-1.5 text-xs font-semibold text-[#00DF73] transition hover:bg-[#141C2F] disabled:opacity-60">
        {loading ? "Summarizing..." : summary && expanded ? "Hide TL;DR" : error ? "Retry TL;DR" : "TL;DR"}
      </button>
      <div id={panelId} hidden={!expanded} aria-live="polite" aria-busy={loading}>
        {loading && <p role="status" className="mt-2 text-xs">Preparing your summary...</p>}
        {error && <p role="alert" className="mt-2 rounded-lg bg-[#0B1120] p-3 text-xs text-red-300">{error}</p>}
        {summary && <div className="mt-2 rounded-lg border border-gray-700 bg-[#0B1120] p-3 text-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#00DF73]">AI summary</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{summary}</p>
          <p className="mt-2 text-[10px] text-gray-400">Only visible to you. Check the original for details.</p>
        </div>}
      </div>
    </div>
  );
}
