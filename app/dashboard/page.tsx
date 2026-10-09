"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type User = { first_name: string; last_name: string; role: string; department?: string };
type Update = { id: string; content: string; created_at: string; first_name: string; last_name: string; target_department?: string };

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [newUpdate, setNewUpdate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetDept, setTargetDept] = useState("All");
  const [departments, setDepartments] = useState<string[]>([]);
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  function fetchDashboard() {
    return fetch('/api/dashboard',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('Failed to load dashboard');
      return response.json();
    }).then(data=>{setError(""); if (data.user) setUser(data.user); if (data.updates) setUpdates(data.updates);}).catch(()=>setError("Could not load your dashboard. Please retry.")).finally(()=>setIsLoading(false));
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/people", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { people: [] }))
      .then((data) => setDepartments(Array.from(new Set((data.people || []).map((p: { department?: string }) => p.department).filter(Boolean))).sort() as string[]))
      .catch(() => undefined);
  }, [isAdmin]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpdate.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newUpdate, target_department: isAdmin ? targetDept : "All" }),
      });
      if (!res.ok) throw new Error("Could not share your update. Please retry.");
      if (res.ok) {
        setNewUpdate("");
        await fetchDashboard();
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not share your update. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-transparent">
      <div className="mx-auto max-w-6xl">
        
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-zibuke-accent">Command Center</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Zibuke Central Hub</h1>
          <p className="mt-2 text-zibuke-muted">Your daily overview, quick actions, and cross-department updates.</p>
        </header>

        {error && <div role="alert" className="mb-5 rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-200">{error} <button onClick={() => void fetchDashboard()} className="ml-3 underline">Retry</button></div>}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* Left Column: Feed */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Post Box */}
            <div className="rounded-xl border border-slate-800 bg-zibuke-card p-6 shadow-xl relative overflow-hidden">
               {/* Accent line at the top of the card */}
               <div className="absolute top-0 left-0 w-full h-1 bg-zibuke-accent"></div>
               
              <form onSubmit={handlePost}>
                <textarea 
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  placeholder="Share an update or announcement with the team..."
                  className="w-full resize-none rounded-lg border border-slate-700 bg-black/50 p-4 text-white outline-none focus:ring-1 focus:ring-zibuke-accent focus:border-zibuke-accent transition-all placeholder:text-slate-500"
                  rows={3}
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                  <p className="text-xs text-zibuke-muted">
                    Posting as <span className="font-bold text-white">{user?.first_name || "..."}</span>
                  </p>
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <label className="flex items-center gap-2 text-xs text-zibuke-muted">
                        To:
                        <select
                          value={targetDept}
                          onChange={(e) => setTargetDept(e.target.value)}
                          className="rounded-md border border-slate-700 bg-black/50 px-3 py-2 text-xs text-white outline-none focus:border-zibuke-accent"
                        >
                          <option value="All">All Departments</option>
                          {departments.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button 
                      type="submit" 
                      disabled={!newUpdate.trim() || isSubmitting}
                      className="rounded-md bg-zibuke-accent px-5 py-2 text-sm font-bold text-black transition hover:bg-[#00c966] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(0,223,115,0.3)] hover:shadow-[0_0_15px_rgba(0,223,115,0.5)]"
                    >
                      {isSubmitting ? "Sharing..." : "Share update"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Feed */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">Loading updates...</div>
              ) : updates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
                  <p className="font-bold text-slate-400">No updates yet.</p>
                  <p className="text-sm mt-1">Be the first to share something with the team!</p>
                </div>
              ) : (
                updates.map((update) => (
                  <div key={update.id} className="rounded-xl border border-slate-800 bg-zibuke-card p-6 shadow-sm hover:border-slate-700 transition-colors">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black border border-slate-700 font-bold text-zibuke-accent shadow-[0_0_8px_rgba(0,223,115,0.15)]">
                        {update.first_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{update.first_name} {update.last_name}</p>
                        <p className="text-xs text-zibuke-muted">{new Date(update.created_at).toLocaleDateString()} at {new Date(update.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      <span className="ml-auto rounded-full border border-slate-700 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-zibuke-muted">
                        To: {update.target_department && update.target_department !== "All" ? update.target_department : "All"}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{update.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Widgets */}
          <div className="space-y-6">
            
            {/* Profile Card */}
            <div className="rounded-xl border border-slate-800 bg-zibuke-card p-6 shadow-sm">
              <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black border border-slate-700 text-xl font-bold text-zibuke-accent shadow-[0_0_10px_rgba(0,223,115,0.2)]">
                  {user?.first_name ? user.first_name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <p className="font-bold text-white">{user ? `${user.first_name} ${user.last_name}` : "Loading..."}</p>
                  <p className="text-xs text-zibuke-muted uppercase tracking-wider mt-1">{user?.role || "Team Member"}</p>
                </div>
              </div>
              <Link href="/dashboard/settings" className="mt-4 inline-block text-sm font-bold text-zibuke-accent hover:text-[#00c966] transition-colors">
                Manage Account &rarr;
              </Link>
            </div>

            {/* Workspace Actions */}
            <div className="rounded-xl border border-slate-800 bg-zibuke-card shadow-sm overflow-hidden">
              <div className="border-b border-slate-800 bg-black/40 p-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zibuke-muted">Workspace Actions</h2>
              </div>
              <div className="divide-y divide-slate-800">
                <Link href="/dashboard/people" className="flex items-center gap-4 p-4 hover:bg-slate-800/50 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-black border border-slate-700 text-blue-400 group-hover:border-blue-500/50 transition-colors">👤</div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">Employee Directory</p>
                    <p className="text-xs text-zibuke-muted">View contacts & organograms</p>
                  </div>
                </Link>
                <Link href="/dashboard/files" className="flex items-center gap-4 p-4 hover:bg-slate-800/50 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-black border border-slate-700 text-emerald-400 group-hover:border-emerald-500/50 transition-colors">📄</div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">Company Vault</p>
                    <p className="text-xs text-zibuke-muted">Access shared resources</p>
                  </div>
                </Link>
                <Link href="/dashboard/call" className="flex items-center gap-4 p-4 hover:bg-slate-800/50 transition-colors group">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-black border border-slate-700 text-purple-400 group-hover:border-purple-500/50 transition-colors">📞</div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">Zibuke Meet</p>
                    <p className="text-xs text-zibuke-muted">Start an internal call</p>
                  </div>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}