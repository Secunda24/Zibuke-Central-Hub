"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/src/modules/shared/Icons";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";

type Channel = {
  id: string;
  name: string;
  description?: string;
  creator_name?: string;
  created_at?: string;
  message_count?: number;
  active_member_count?: number;
  last_activity?: string | null;
  last_message?: string | null;
};

export default function ChannelsPage() {
  const { user } = useCurrentUser();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { void loadChannels(); }, []);

  async function loadChannels() {
    try {
      const res = await fetch(`/api/channels?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setChannels(data.channels || []);
    } finally { setLoading(false); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return channels.filter((channel) => !q || `${channel.name} ${channel.description || ""} ${channel.last_message || ""}`.toLowerCase().includes(q));
  }, [channels, query]);

  async function createChannel(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create channel");
      setName(""); setDescription(""); setShowCreate(false); await loadChannels();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create channel"); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen bg-[#0B1120] p-4 text-white sm:p-6 xl:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">Workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Channels</h1><p className="mt-1 max-w-2xl text-sm text-gray-400">Persistent team conversations with media, reactions, replies, meetings and huddles in one place.</p></div>
          <button onClick={() => setShowCreate(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#00DF73] px-4 text-sm font-bold text-[#0B1120] shadow-lg shadow-black/20 hover:bg-[#00c968]"><Icon name="plus"/> New channel</button>
        </header>

        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-[#141C2F] shadow-xl shadow-black/10">
          <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="border-b border-gray-800 bg-[#10192A] lg:min-h-[640px] lg:border-b-0 lg:border-r">
              <div className="border-b border-gray-800 p-4">
                <div className="flex items-center justify-between gap-3"><div><span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Your workspace</span><h2 className="mt-1 text-lg font-bold">Team channels</h2></div><button onClick={() => setShowCreate(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-gray-700 bg-[#0B1120] text-gray-300 hover:border-[#00DF73]/50 hover:text-[#00DF73]" aria-label="Create channel"><Icon name="plus"/></button></div>
                <label className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-gray-700 bg-[#0B1120] px-3 focus-within:border-[#00DF73]"><Icon name="search" size={15} className="text-gray-500"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search channels" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"/></label>
              </div>

              <div className="max-h-[530px] overflow-y-auto p-2">
                {loading ? <div className="p-8 text-center text-xs text-gray-500">Loading channels…</div> : filtered.length === 0 ? <div className="p-8 text-center text-xs text-gray-500">No channels match your search.</div> : filtered.map((channel) => <ChannelRow key={channel.id} channel={channel}/>) }
              </div>
            </aside>

            <section className="grid min-h-[640px] place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(0,223,115,0.06),transparent_34%)] p-6 sm:p-10">
              <div className="max-w-lg text-center">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-[#00DF73]/20 bg-[#00DF73]/10 text-[#00DF73]"><Icon name="chat" size={34}/></div>
                <h2 className="mt-6 text-2xl font-bold">Open a team conversation</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">Select a channel to share updates, photos, documents and reactions. Meetings scheduled from a channel stay visible in both the conversation and Calendar.</p>
                <div className="mt-6 grid gap-3 text-left sm:grid-cols-3"><Feature icon="image" label="Rich media"/><Feature icon="smile" label="Reactions"/><Feature icon="calendar" label="Meeting sync"/></div>
                <button onClick={() => setShowCreate(true)} className="mt-7 inline-flex h-10 items-center gap-2 rounded-xl border border-gray-700 bg-[#141C2F] px-4 text-xs font-bold text-gray-200 hover:border-[#00DF73]/50 hover:text-[#00DF73]"><Icon name="plus" size={15}/> Create a channel</button>
                <p className="mt-3 text-[10px] text-gray-600">Channels created here are visible to authenticated Zibuke Central users.</p>
              </div>
            </section>
          </div>
        </section>
      </div>

      {showCreate && <CreateChannelModal name={name} description={description} setName={setName} setDescription={setDescription} saving={saving} error={error} userRole={user?.role} onClose={() => { setShowCreate(false); setError(""); }} onSubmit={createChannel}/>}
    </main>
  );
}

function ChannelRow({ channel }: { channel: Channel }) {
  return <Link href={`/dashboard/channels/${channel.id}`} className="group mb-1 flex items-center gap-3 rounded-xl p-3 transition hover:bg-[#0B1120]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#00DF73]/10 text-[#00DF73]"><Icon name="hash" size={18}/></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-gray-100 group-hover:text-white">{channel.name}</strong><small className="shrink-0 text-[9px] text-gray-600">{channel.last_activity ? relativeTime(channel.last_activity) : "New"}</small></span><span className="mt-1 flex items-center gap-2"><span className="line-clamp-1 flex-1 text-[11px] text-gray-500">{channel.last_message || channel.description || "Start the conversation"}</span>{Number(channel.message_count || 0) > 0 && <span className="rounded-full bg-[#00DF73] px-1.5 py-0.5 text-[9px] font-black text-[#0B1120]">{Number(channel.message_count || 0)}</span>}</span></span></Link>;
}

function CreateChannelModal({ name, description, setName, setDescription, saving, error, userRole, onClose, onSubmit }: {
  name: string; description: string; setName: (v: string) => void; setDescription: (v: string) => void; saving: boolean; error: string; userRole?: string; onClose: () => void; onSubmit: (event: React.FormEvent) => void;
}) {
  return <div className="fixed inset-0 z-[210] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={onClose}><form onSubmit={onSubmit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-gray-700 bg-[#141C2F] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">New team space</p><h2 className="mt-1 text-xl font-bold">Create a channel</h2><p className="mt-1 text-xs text-gray-500">Workers and administrators can create collaboration channels.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-[#0B1120] hover:text-white"><Icon name="x"/></button></div>{error && <div className="mt-4 rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-xs text-red-400">{error}</div>}<div className="mt-5 space-y-4"><label className="block"><span className="text-xs font-semibold text-gray-300">Channel name</span><div className="mt-1 flex h-11 items-center rounded-xl border border-gray-700 bg-[#0B1120] px-3 focus-within:border-[#00DF73]"><span className="text-gray-500">#</span><input autoFocus value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none" placeholder="project-alpha" required maxLength={48}/></div></label><label className="block"><span className="text-xs font-semibold text-gray-300">Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={240} className="mt-1 w-full resize-none rounded-xl border border-gray-700 bg-[#0B1120] p-3 text-sm text-white outline-none focus:border-[#00DF73]" placeholder="What should people use this channel for?"/></label><div className="rounded-xl border border-gray-800 bg-[#0B1120] p-3 text-[11px] leading-5 text-gray-500"><strong className="text-gray-300">Company channel</strong><br/>Everyone who can access Zibuke Central can discover and participate in this channel. Creator: {userRole === "admin" ? "Administrator" : "Worker"}.</div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-[#0B1120]">Cancel</button><button disabled={saving || !name.trim()} className="rounded-xl bg-[#00DF73] px-4 py-2.5 text-sm font-bold text-[#0B1120] hover:bg-[#00c968] disabled:opacity-50">{saving ? "Creating…" : "Create channel"}</button></div></form></div>;
}

function Feature({ icon, label }: { icon: "image" | "smile" | "calendar"; label: string }) { return <div className="rounded-xl border border-gray-800 bg-[#141C2F]/80 p-3"><Icon name={icon} size={16} className="text-[#00DF73]"/><strong className="mt-2 block text-[11px] text-gray-300">{label}</strong></div>; }
function relativeTime(value: string) { const time = new Date(value).getTime(); const diff = Math.max(0, Date.now() - time); const minutes = Math.floor(diff / 60000); if (minutes < 1) return "Now"; if (minutes < 60) return `${minutes}m`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h`; const days = Math.floor(hours / 24); return `${days}d`; }
