"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; metric_type: string; metric_value: string; notes: string; logged_at: string };

const METRIC_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "training_task", label: "Training task" },
  { value: "general", label: "General" },
  { value: "other", label: "Other" },
];

const typeLabel = (value: string) => METRIC_TYPES.find((option) => option.value === value)?.label ?? value.replace(/_/g, " ");

export default function MyMetricsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metricType, setMetricType] = useState("sales");
  const [metricValue, setMetricValue] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm/metrics?t=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && Array.isArray(data.entries)) setEntries(data.entries);
        else if (!ok) setMessage({ type: "error", text: data.error || "Could not load your entries." });
      })
      .catch(() => {
        if (!cancelled) setMessage({ type: "error", text: "Could not load your entries." });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/crm/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricType, metricValue, notes }),
      });
      const data = await res.json();
      if (res.ok && data.entry) {
        setEntries((prev) => [data.entry as Entry, ...prev]);
        setMessage({ type: "success", text: "Entry logged." });
        setMetricValue("");
        setNotes("");
      } else {
        setMessage({ type: "error", text: data.error || "Could not save your entry." });
      }
    } catch {
      setMessage({ type: "error", text: "Could not save your entry." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = "mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]";

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">Internal CRM</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Log your metrics</h1>
          <p className="mt-2 text-gray-400">Record your daily or weekly tracking details. Your manager sees these entries.</p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white">Metric type</span>
              <select value={metricType} onChange={(event) => setMetricType(event.target.value)} className={inputClass}>
                {METRIC_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-white">Value</span>
              <input
                type="text"
                value={metricValue}
                onChange={(event) => setMetricValue(event.target.value)}
                placeholder="e.g. 12 sales, 3 calls, report submitted"
                required
                maxLength={100}
                className={inputClass}
              />
            </label>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-white">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Optional detail for your manager"
              className={`${inputClass} resize-y`}
            />
          </label>

          {message && (
            <div className={`mt-5 rounded-md border p-3 text-sm ${message.type === "success" ? "border-green-800 bg-green-900/30 text-green-400" : "border-red-800 bg-red-900/30 text-red-400"}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 w-full rounded-md bg-[#00DF73] py-2.5 text-sm font-bold text-[#0B1120] transition hover:bg-[#00c968] disabled:bg-gray-800 disabled:text-gray-500"
          >
            {isSubmitting ? "Saving..." : "Log entry"}
          </button>
        </form>

        <section className="mt-8 rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-white">Your recent entries</h2>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading your entries...</p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">Nothing logged yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-800">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#00DF73]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#00DF73] ring-1 ring-[#00DF73]/30">
                        {typeLabel(entry.metric_type)}
                      </span>
                      <span className="text-sm font-semibold text-white">{entry.metric_value}</span>
                    </div>
                    {entry.notes && <p className="mt-1 text-sm text-gray-400">{entry.notes}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">{new Date(entry.logged_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
