"use client";
import { useEffect, useState } from "react";

type Document = { id: string; kind: "id" | "other"; filename: string; size: number; created_at: string };
export default function EmployeeDocuments(props: {userId?:string;admin?:boolean}) {
 return <EmployeeDocumentsContent key={props.userId||'self'} {...props}/>;
}
function EmployeeDocumentsContent({ userId, admin = false }: { userId?: string; admin?: boolean }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [verified, setVerified] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const endpoint = `/api/employee-documents${userId ? `?userId=${encodeURIComponent(userId)}` : ""}`;
  async function load() {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load documents. Refresh to try again.");
    const data = await response.json();
    setDocuments(data.documents); setVerified(data.verified); setLoaded(true);
  }
  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Could not load documents. Refresh to try again.");
      const data = await response.json();
      if (active) { setDocuments(data.documents); setVerified(data.verified); setLoaded(true); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [endpoint]);

  async function save(body: FormData | string, method: "POST" | "PATCH") {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(endpoint, { method, body, headers: method === "PATCH" ? { "Content-Type": "application/json" } : undefined });
      if (!res.ok) { const text = await res.text(); let error = text; try { error = JSON.parse(text).error || text; } catch {} throw new Error(error); }
      await load(); setMessage(method === "POST" ? "Document uploaded successfully." : "ID verification updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save document."); }
    finally { setBusy(false); }
  }
  const latestId = documents.find(doc => doc.kind === "id");
  return <section className={`rounded-xl border p-6 ${admin ? "border-gray-700 bg-[#0B1120] text-white" : "border-slate-200 bg-white text-slate-900 shadow-sm"}`}>
    <h2 className="text-lg font-bold">Identity &amp; Documents</h2>
    <p className={`mt-1 text-sm ${admin ? "text-gray-400" : "text-slate-500"}`}>Private documents are accessible only to this employee and administrators. PDF, JPEG or PNG, up to 10 MB per file.</p>
    <p className="mt-4 text-sm font-semibold">ID status: {loaded ? verified ? "Verified" : latestId ? "Awaiting verification" : "Not uploaded / not verified" : "Loading…"}</p>
    {admin && <button type="button" disabled={busy || !loaded} onClick={() => save(JSON.stringify({ verified: !verified, documentId: latestId?.id || null }), "PATCH")} className="mt-3 rounded-md border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-500 disabled:opacity-50">{verified ? "Remove ID verification" : "Mark ID as verified"}</button>}
    {admin && !latestId && loaded && <p className="mt-2 text-xs opacity-70">You may mark the ID verified after checking it in person, even without a file.</p>}
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {([['id','Upload ID'],['other','Upload certificate / other document']] as const).map(([kind,label]) => <label key={kind} className="block text-sm font-semibold">
        {label}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={busy || !loaded} className="mt-2 block w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:font-semibold file:text-emerald-800 disabled:opacity-50" onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
          if (file.size > 10 * 1024 * 1024) { setMessage("Choose a file up to 10 MB."); return; }
          const form = new FormData(); form.append("kind",kind); form.append("file",file); void save(form,"POST");
        }} />
      </label>)}
    </div>
    <p className="mt-3 text-xs opacity-70">Uploading a new ID requires a fresh administrator verification.</p>
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
    {busy && <p role="status" className="mt-3 text-sm">Saving…</p>}
    <ul className="mt-4 divide-y divide-gray-500/20">{documents.map(doc => <li key={doc.id} className="flex items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="break-words font-medium">{doc.filename}</p><p className="text-xs opacity-70">{doc.kind === "id" ? "ID document" : "Supporting document"} · {Math.ceil(doc.size / 1024)} KB · {new Date(doc.created_at).toLocaleDateString()}</p></div><a className="shrink-0 font-semibold text-emerald-600 underline" href={`/api/employee-documents/${doc.id}`}>Download</a></li>)}</ul>
  </section>;
}
