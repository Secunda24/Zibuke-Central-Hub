"use client";
import {useSearchParams} from "next/navigation";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Icon } from "@/src/modules/shared/Icons";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";
import type {
  Announcement,
  AnnouncementStatus,
  DraftAnnouncementAttachment,
} from "@/src/modules/announcements/types";

const CATEGORIES = ["General Update", "Policy", "IT & Systems", "HR", "Event", "Urgent Notice"];
const REACTIONS = ["👍", "❤️", "👏", "🎉"];

type Person = { id: string; department?: string; role?: string; job_title?: string | null };
type PublishMode = "draft" | "published" | "scheduled";
type EmployeeView = "all" | "published" | "pinned" | "archived";

export default function AnnouncementsPage(){const params=useSearchParams();return <AnnouncementsPageContent key={params.toString()}/>;}
function AnnouncementsPageContent() {
  const { user, loading: userLoading } = useCurrentUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AnnouncementStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const params=useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(params.get("focus"));
  const [toast, setToast] = useState("");
  
  const [canManage, setCanManage] = useState(false);

  function loadAnnouncements() {
    return fetch('/api/announcements',{cache:'no-store'}).then(async response=>{
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not load announcements');
      return data;
    }).then(data=>{
      setAnnouncements(data.announcements||[]);
      setCanManage(Boolean(data.canManage));
      setSelectedId(current=>current||data.announcements?.[0]?.id||null);
    }).catch(error=>setToast(error instanceof Error?error.message:'Could not load announcements'))
      .finally(()=>setLoading(false));
  }

  useEffect(() => {
    void loadAnnouncements();
  }, []);



  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return announcements.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const haystack = `${item.title} ${item.content} ${item.author_name} ${item.category} ${item.audience_value || ""}`.toLowerCase();
      const matchesQuery = !q || haystack.includes(q);
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [announcements, query, statusFilter, categoryFilter]);

  const selected = announcements.find((item) => item.id === selectedId) || filtered[0] || null;
  
  const isAdmin = canManage;

  async function react(id: string, emoji: string) {
    const response = await fetch(`/api/announcements/${id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast(data.error || "Reaction could not be saved");
      return;
    }
    await loadAnnouncements();
  }

  async function acknowledge(id: string) {
    const response = await fetch(`/api/announcements/${id}/acknowledge`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast(data.error || "Could not acknowledge announcement");
      return;
    }
    setToast("Announcement acknowledged");
    await loadAnnouncements();
  }

  async function updateAnnouncement(id: string, patch: Record<string, unknown>, message: string) {
    const response = await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast(data.error || "Announcement could not be updated");
      return;
    }
    setToast(message);
    await loadAnnouncements();
  }

  async function deleteAnnouncement(id: string) {
    if (!confirm("Are you sure you want to permanently delete this announcement?")) return;
    const response = await fetch(`/api/announcements/${id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast(data.error || "Announcement could not be deleted");
      return;
    }
    setToast("Announcement deleted");
    setSelectedId(null);
    await loadAnnouncements();
  }

  if (userLoading || loading) return <LoadingState />;

  if (creating && isAdmin) {
    return (
      <AnnouncementComposer
        onClose={() => setCreating(false)}
        onSaved={async (message) => {
          setCreating(false);
          setToast(message);
          await loadAnnouncements();
        }}
      />
    );
  }

  if (!isAdmin) {
    return (
      <EmployeeAnnouncementsWorkspace
        announcements={announcements}
        filtered={filtered}
        query={query}
        setQuery={setQuery}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        onReact={(id, emoji) => void react(id, emoji)}
        onAcknowledge={(id) => void acknowledge(id)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1120] p-4 text-white sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1450px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">Company communication (LIVE)</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Announcements</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">Important company updates, policies and events in one searchable history.</p>
          </div>
          <button onClick={() => setCreating(true)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#00DF73] px-4 text-sm font-bold text-[#0B1120] shadow-lg shadow-black/20 hover:bg-[#00c968]">
            <Icon name="plus" size={17} /> Create announcement
          </button>
        </header>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#141C2F] px-3 focus-within:border-[#00DF73]">
            <Icon name="search" size={16} className="text-gray-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, content, category or author" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600" />
          </label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-11 rounded-xl border border-gray-700 bg-[#141C2F] px-3 text-sm text-gray-200 outline-none focus:border-[#00DF73]">
            <option value="all">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        <StatusTabs value={statusFilter} onChange={setStatusFilter} announcements={announcements} />

        {announcements.length === 0 ? (
          <EmptyAnnouncements isAdmin onCreate={() => setCreating(true)} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-2xl border border-gray-800 bg-[#141C2F]">
              <div className="border-b border-gray-800 px-4 py-3"><span className="text-xs font-semibold text-gray-400">{filtered.length} announcement{filtered.length === 1 ? "" : "s"}</span></div>
              <div className="max-h-[720px] overflow-y-auto p-2">
                {filtered.length === 0 ? <div className="p-10 text-center text-sm text-gray-500">No announcements match these filters.</div> : filtered.map((item) => <AnnouncementListItem key={item.id} announcement={item} selected={selected?.id === item.id} onClick={() => setSelectedId(item.id)} />)}
              </div>
            </section>
            <section className="min-w-0">
              {selected ? (
                <AdminAnnouncementDetail
                  announcement={selected}
                  onReact={(emoji) => void react(selected.id, emoji)}
                  onAcknowledge={() => void acknowledge(selected.id)}
                  onPin={() => void updateAnnouncement(selected.id, { pinned: !selected.pinned }, selected.pinned ? "Announcement unpinned" : "Announcement pinned")}
                  onPublish={() => void updateAnnouncement(selected.id, { status: "published" }, "Announcement published")}
                  onArchive={() => void updateAnnouncement(selected.id, { status: "archived" }, "Announcement archived")}
                  onDelete={() => void deleteAnnouncement(selected.id)}
                />
              ) : (
                <div className="rounded-2xl border border-gray-800 bg-[#141C2F] p-12 text-center text-gray-500">Select an announcement.</div>
              )}
            </section>
          </div>
        )}
      </div>
      {toast && <div className="fixed bottom-5 right-5 z-[250] rounded-xl border border-gray-700 bg-[#141C2F] px-4 py-3 text-sm font-semibold text-white shadow-2xl">{toast}</div>}
    </main>
  );
}

function EmployeeAnnouncementsWorkspace({
  announcements,
  filtered,
  query,
  setQuery,
  categoryFilter,
  setCategoryFilter,
  onReact,
  onAcknowledge,
}: {
  announcements: Announcement[];
  filtered: Announcement[];
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  categoryFilter: string;
  setCategoryFilter: Dispatch<SetStateAction<string>>;
  onReact: (id: string, emoji: string) => void;
  onAcknowledge: (id: string) => void;
}) {
  const [view, setView] = useState<EmployeeView>("all");
  const params=useSearchParams();
  const [detailId, setDetailId] = useState<string | null>(params.get("focus"));



  const visible = useMemo(() => {
    return filtered.filter((item) => {
      if (view === "all") return item.status === "published" || item.status === "archived";
      if (view === "pinned") return Boolean(item.pinned) && item.status !== "draft" && item.status !== "scheduled";
      if (view === "archived") return item.status === "archived";
      return item.status === "published";
    });
  }, [filtered, view]);

  const detailItem = announcements.find((item) => item.id === detailId) || null;
  const attentionItems = announcements.filter((item) => item.require_acknowledgement && !item.acknowledgedByMe && item.status === "published").slice(0, 4);
  const recentItems = announcements.filter((item) => item.status === "published" || item.status === "archived").slice(0, 5);

  if (detailItem) {
    const related = announcements.filter((item) => item.id !== detailItem.id && item.status !== "draft" && item.status !== "scheduled").slice(0, 4);
    return (
      <main className="min-h-full bg-[#F4F7FA] p-4 text-[#0F172A] sm:p-6 xl:p-8">
        <div className="mx-auto max-w-[1380px]">
          <button onClick={() => setDetailId(null)} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#0B1120]">
            <Icon name="chevronLeft" size={16} /> Back to announcements
          </button>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
            <EmployeeAnnouncementDetail announcement={detailItem} onReact={(emoji) => onReact(detailItem.id, emoji)} onAcknowledge={() => onAcknowledge(detailItem.id)} />
            <aside className="space-y-5">
              <section className="rounded-2xl border border-[#DDE6E2] bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#0F172A]">Announcement actions</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-2 rounded-xl bg-[#F6F9F7] px-3 py-2.5"><Icon name="bell" size={15} className="text-[#087A46]" /> Published announcement</div>
                  <div className="flex items-center gap-2 rounded-xl bg-[#F6F9F7] px-3 py-2.5"><Icon name="users" size={15} className="text-[#087A46]" /> {audienceLabel(detailItem)}</div>
                  {detailItem.require_acknowledgement ? <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-amber-700"><Icon name="check" size={15} /> Acknowledgement required</div> : null}
                </div>
              </section>
              <RelatedAnnouncements items={related} onSelect={setDetailId} />
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#F4F7FA] p-4 text-[#0F172A] sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1380px]">
        <header className="mb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 h-1 w-10 rounded-full bg-[#00DF73]" />
              <h1 className="text-3xl font-bold tracking-tight text-[#0B1120]">Announcements</h1>
              <p className="mt-1 text-sm text-slate-500">Stay informed with company updates, policies and important notices.</p>
            </div>
            <div className="rounded-2xl border border-[#DDE6E2] bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Your feed</p>
              <p className="mt-1 text-sm font-semibold text-[#0B1120]">{announcements.length} announcement{announcements.length === 1 ? "" : "s"}</p>
            </div>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {([[
            "all", "All announcements"
          ], ["published", "Published"], ["pinned", "Pinned"], ["archived", "Archived"]] as Array<[EmployeeView, string]>).map(([key, label]) => (
            <button key={key} onClick={() => setView(key)} className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${view === key ? "border-[#0B1120] bg-[#0B1120] text-white" : "border-[#DDE6E2] bg-white text-slate-600 hover:border-[#B9C8C0]"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap gap-3">
          <label className="flex h-12 min-w-[280px] flex-1 items-center gap-3 rounded-xl border border-[#DDE6E2] bg-white px-4 shadow-sm focus-within:border-[#00C968]">
            <Icon name="search" size={16} className="text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search announcements..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" />
          </label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-12 rounded-xl border border-[#DDE6E2] bg-white px-4 text-sm text-slate-700 shadow-sm outline-none focus:border-[#00C968]">
            <option value="all">All categories</option>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#C8D6CF] bg-white p-16 text-center shadow-sm">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#E8FFF3] text-[#087A46]"><Icon name="bell" size={24} /></span>
            <h2 className="mt-4 text-lg font-bold text-[#0B1120]">No announcements match these filters</h2>
            <p className="mt-1 text-sm text-slate-500">Try another category or search term.</p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="space-y-3">
              {visible.map((item) => <EmployeeFeedCard key={item.id} announcement={item} onClick={() => setDetailId(item.id)} />)}
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-[#DDE6E2] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-[#0B1120]">Quick view</h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MetricCard label="Published" value={announcements.filter((item) => item.status === "published").length} />
                  <MetricCard label="Pinned" value={announcements.filter((item) => item.pinned).length} />
                </div>
              </section>
              {attentionItems.length > 0 ? <NeedsAttention items={attentionItems} onSelect={setDetailId} /> : null}
              <RecentActivity items={recentItems} onSelect={setDetailId} />
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#F6F9F7] p-3"><span className="text-[11px] text-slate-500">{label}</span><strong className="mt-1 block text-xl text-[#0B1120]">{value}</strong></div>;
}

function NeedsAttention({ items, onSelect }: { items: Announcement[]; onSelect: (id: string) => void }) {
  return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm"><div className="flex items-center gap-2"><Icon name="info" size={16} className="text-amber-600" /><h3 className="text-sm font-bold text-[#0B1120]">Needs your attention</h3></div><p className="mt-1 text-xs text-slate-500">Announcements waiting for your acknowledgement.</p><div className="mt-3 space-y-2">{items.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className="w-full rounded-xl bg-white p-3 text-left shadow-sm transition hover:shadow"><strong className="line-clamp-2 block text-xs text-[#0B1120]">{item.title}</strong><span className="mt-1 block text-[11px] text-amber-700">Acknowledge required</span></button>)}</div></section>;
}

function RecentActivity({ items, onSelect }: { items: Announcement[]; onSelect: (id: string) => void }) {
  return <section className="rounded-2xl border border-[#DDE6E2] bg-white p-5 shadow-sm"><h3 className="text-sm font-bold text-[#0B1120]">Recent activity</h3><div className="mt-3 space-y-1">{items.map((item) => <button key={item.id} onClick={() => onSelect(item.id)} className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#F6F9F7]"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#00DF73]" /><span className="min-w-0"><strong className="line-clamp-1 block text-xs text-[#0B1120]">{item.title}</strong><span className="mt-1 block text-[11px] text-slate-400">{formatAnnouncementDate(item)}</span></span></button>)}</div></section>;
}

function RelatedAnnouncements({ items, onSelect }: { items: Announcement[]; onSelect: (id: string) => void }) {
  return <section className="rounded-2xl border border-[#DDE6E2] bg-white p-4 shadow-sm"><h3 className="text-sm font-bold text-[#0B1120]">Related announcements</h3><div className="mt-3 space-y-2">{items.map((item) => { const cover = item.attachments.find((a) => a.slot === "cover"); return <button key={item.id} onClick={() => onSelect(item.id)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[#F6F9F7]">{cover ? <img src={cover.url} alt="" className="h-12 w-14 rounded-lg object-cover" /> : <span className="grid h-12 w-14 place-items-center rounded-lg bg-[#E8FFF3] text-[#087A46]"><Icon name="bell" size={16} /></span>}<span className="min-w-0"><strong className="line-clamp-2 block text-xs text-[#0B1120]">{item.title}</strong><span className="mt-1 block text-[10px] text-slate-400">{item.category} · {formatAnnouncementDate(item)}</span></span></button>; })}</div></section>;
}

function AnnouncementComposer({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [targetDepartment, setTargetDepartment] = useState("All");
  const [targetJobTitle, setTargetJobTitle] = useState("All");
  const [people, setPeople] = useState<Person[]>([]);
  const [attachments, setAttachments] = useState<DraftAnnouncementAttachment[]>([]);
  const [publishMode, setPublishMode] = useState<PublishMode>("published");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pinned, setPinned] = useState(false);
  const [reactionsEnabled, setReactionsEnabled] = useState(true);
  const [requireAcknowledgement, setRequireAcknowledgement] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    fetch("/api/people", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setPeople(Array.isArray(data.people) ? (data.people as Person[]) : []))
      .catch(() => undefined);
  }, []);

  // The three canonical divisions first, then any other department present in the directory.
  const departmentOptions = Array.from(new Set([
    "Zibuke OnCall",
    "Zibuke Africa Sales",
    "Zibuke Africa Office",
    ...(people.map((person) => person.department).filter(Boolean) as string[]),
  ])).sort();

  // Job titles narrow to the chosen department, so the second dropdown only offers titles that
  // actually exist inside the first — the same chaining the People directory uses.
  const jobTitleOptions = Array.from(new Set(
    people
      .filter((person) => targetDepartment === "All" || person.department === targetDepartment)
      .map((person) => person.job_title)
      .filter(Boolean) as string[]
  )).sort();

  const cover = attachments.find((item) => item.slot === "cover");
  const otherAttachments = attachments.filter((item) => item.slot !== "cover");

  async function save(mode: PublishMode) {
    if (!title.trim() || !content.trim()) {
      setError("Provide a title and content before saving.");
      return;
    }
    if (mode === "scheduled" && !scheduledAt) {
      setError("Choose when this announcement should be published.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          category,
          priority,
          status: mode,
          targetDepartment,
          targetJobTitle,
          scheduledAt: mode === "scheduled" ? scheduledAt : null,
          pinned,
          reactionsEnabled,
          requireAcknowledgement,
          attachments,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Announcement could not be saved");
      onSaved(mode === "draft" ? "Draft saved" : mode === "scheduled" ? "Announcement scheduled" : "Announcement published");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Announcement could not be saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F7FA] p-4 text-[#0F172A] sm:p-6 xl:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-[#DDE6E2] bg-white text-slate-500 shadow-sm hover:text-[#0F172A]">
              <Icon name="chevronLeft" />
            </button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0B1120]">Announcements</p>
              <h1 className="mt-1 text-2xl font-bold">Create announcement</h1>
              <p className="mt-1 text-xs text-slate-500">Build the announcement and review the employee view before publishing.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button disabled={saving} onClick={() => void save("draft")} className="h-10 rounded-xl border border-[#DDE6E2] bg-white px-4 text-xs font-bold text-slate-700 shadow-sm hover:border-[#B9C8C0]">Save draft</button>
            <button disabled={saving} onClick={() => void save(publishMode)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B1120] px-4 text-xs font-black text-white hover:bg-[#141C2F] disabled:opacity-50">
              <Icon name={publishMode === "scheduled" ? "calendar" : "send"} size={15} />
              {saving ? "Saving…" : publishMode === "scheduled" ? "Schedule announcement" : "Publish announcement"}
            </button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,.85fr)]">
          <section className="space-y-5">
            <EditorCard title="Announcement details">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><FieldLabel>Title</FieldLabel><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="Enter a clear and concise title" className="field" /><div className="mt-1 text-right text-[10px] text-slate-400">{title.length}/150</div></label>
                <label><FieldLabel>Announcement type</FieldLabel><select value={category} onChange={(e) => setCategory(e.target.value)} className="field">{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><FieldLabel>Priority</FieldLabel><select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="field"><option value="normal">Normal</option><option value="high">Important</option><option value="low">Informational</option></select></label>
                <div className="sm:col-span-2">
                  <FieldLabel>Audience</FieldLabel>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <select
                      value={targetDepartment}
                      onChange={(e) => { setTargetDepartment(e.target.value); setTargetJobTitle("All"); }}
                      className="h-10 w-full rounded-lg border border-gray-700 bg-[#1E232B] px-3 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]"
                    >
                      <option value="All">All Departments</option>
                      {departmentOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <select
                      value={targetJobTitle}
                      onChange={(e) => setTargetJobTitle(e.target.value)}
                      className="h-10 w-full rounded-lg border border-gray-700 bg-[#1E232B] px-3 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]"
                    >
                      <option value="All">All Job Titles</option>
                      {jobTitleOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {targetDepartment === "All" && targetJobTitle === "All"
                      ? "Everyone in the company will see this."
                      : `Visible to ${targetDepartment === "All" ? "every department" : targetDepartment}${targetJobTitle === "All" ? "" : ` · ${targetJobTitle}`}.`}
                  </p>
                </div>
              </div>
            </EditorCard>

            <EditorCard title="Media & attachments" subtitle="Use a strong cover image and add supporting video or documents.">
              <AnnouncementMediaPicker attachments={attachments} setAttachments={setAttachments} />
            </EditorCard>

            <EditorCard title="Content">
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={9} maxLength={10000} placeholder="Write the full announcement here. Keep it clear, practical and easy to scan." className="w-full resize-y rounded-xl border border-[#DDE6E2] bg-white p-4 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#0B1120]" />
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>Plain text is kept intentionally clean and consistent across desktop and mobile.</span><span>{content.length}/10000</span></div>
            </EditorCard>

            <EditorCard title="Publishing">
              <div className="grid gap-3 sm:grid-cols-3"><ModeCard active={publishMode === "published"} title="Publish now" description="Visible immediately" onClick={() => setPublishMode("published")} /><ModeCard active={publishMode === "scheduled"} title="Schedule" description="Publish later" onClick={() => setPublishMode("scheduled")} /><ModeCard active={publishMode === "draft"} title="Draft" description="Keep private" onClick={() => setPublishMode("draft")} /></div>
              {publishMode === "scheduled" && <label className="mt-4 block"><FieldLabel>Publishing date & time</FieldLabel><input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="field max-w-sm" /></label>}
            </EditorCard>

            <EditorCard title="Announcement settings">
              <div className="grid gap-3 sm:grid-cols-3"><ToggleCard title="Pin announcement" description="Keep important news at the top" checked={pinned} onChange={setPinned} /><ToggleCard title="Enable reactions" description="Workers can react after reading" checked={reactionsEnabled} onChange={setReactionsEnabled} /><ToggleCard title="Require acknowledgement" description="Track who confirms they have read it" checked={requireAcknowledgement} onChange={setRequireAcknowledgement} /></div>
            </EditorCard>
          </section>

          <aside className="xl:sticky xl:top-5 xl:self-start">
            <div className="rounded-3xl border border-[#DDE6E2] bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">Preview</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Employee announcement view</p>
                </div>
                <div className="flex rounded-lg border border-[#DDE6E2] bg-[#F7FAFD] p-1">
                  <button type="button" onClick={() => setPreviewMode("desktop")} className={`rounded-md px-2.5 py-1 text-[9px] font-bold ${previewMode === "desktop" ? "bg-[#0B1120] text-white" : "text-slate-500"}`}>Desktop</button>
                  <button type="button" onClick={() => setPreviewMode("mobile")} className={`rounded-md px-2.5 py-1 text-[9px] font-bold ${previewMode === "mobile" ? "bg-[#0B1120] text-white" : "text-slate-500"}`}>Mobile</button>
                </div>
              </div>
              <div className={previewMode === "mobile" ? "mx-auto max-w-sm" : ""}><PreviewAnnouncement title={title || "Your announcement title"} content={content || "Your announcement content will appear here as you type."} category={category} priority={priority} audience={targetDepartment === "All" && targetJobTitle === "All" ? "All employees" : [targetDepartment === "All" ? "" : targetDepartment, targetJobTitle === "All" ? "" : targetJobTitle].filter(Boolean).join(" · ")} cover={cover} attachments={otherAttachments} pinned={pinned} reactionsEnabled={reactionsEnabled} requireAcknowledgement={requireAcknowledgement} /></div>
            </div>
          </aside>
        </div>
      </div>
      <style jsx global>{`.field{margin-top:.35rem;height:2.75rem;width:100%;border-radius:.75rem;border:1px solid #d9e4f2;background:#fff;padding:0 .8rem;font-size:.875rem;color:#334155;outline:none}.field:focus{border-color:#0B1120}.field option{background:#fff;color:#0f172a}`}</style>
    </main>
  );
}

function AnnouncementMediaPicker({ attachments, setAttachments }: { attachments: DraftAnnouncementAttachment[]; setAttachments: Dispatch<SetStateAction<DraftAnnouncementAttachment[]>> }) {
  const coverRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const cover = attachments.find((item) => item.slot === "cover");
  const others = attachments.filter((item) => item.slot !== "cover");

  async function upload(files: FileList | null, slot: "cover" | "attachment") {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const uploaded: DraftAnnouncementAttachment[] = [];
      for (const file of Array.from(files).slice(0, slot === "cover" ? 1 : 6)) {
        if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) throw new Error("GIF files are not supported.");
        if (slot === "cover" && !file.type.startsWith("image/")) throw new Error("The cover must be a PNG, JPG or WEBP image.");
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/attachments/upload", { method: "POST", body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Could not upload ${file.name}`);
        if (data.attachment.type === "audio" || data.attachment.type === "link") throw new Error("Announcements support images, videos and documents.");
        uploaded.push({ ...data.attachment, slot, previewUrl: URL.createObjectURL(file) });
      }
      setAttachments((current) => slot === "cover" ? [...current.filter((item) => item.slot !== "cover"), ...uploaded] : [...current, ...uploaded].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (coverRef.current) coverRef.current.value = "";
      if (mediaRef.current) mediaRef.current.value = "";
    }
  }

  return (
    <div>
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>}
      <div className="grid gap-3 md:grid-cols-3">
        <MediaSlot title="Cover image" hint="PNG, JPG or WEBP" icon="image" preview={cover} onPick={() => coverRef.current?.click()} onRemove={cover ? () => setAttachments((items) => items.filter((item) => item.id !== cover.id)) : undefined} />
        <button type="button" onClick={() => mediaRef.current?.click()} className="min-h-36 rounded-xl border border-dashed border-[#DDE6E2] bg-white p-4 text-left transition hover:border-[#0B1120]/40"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8FFF3] text-[#0B1120]"><Icon name="video" /></span><strong className="mt-3 block text-xs text-[#0F172A]">Video or document</strong><span className="mt-1 block text-[10px] leading-4 text-slate-500">Add MP4/MOV/WEBM, PDF, Word, Excel or PowerPoint attachments.</span></button>
        <div className="min-h-36 rounded-xl border border-[#DDE6E2] bg-[#F8FAFD] p-4"><strong className="text-xs text-[#0F172A]">Attached files</strong><p className="mt-1 text-[10px] text-slate-500">{others.length ? `${others.length} supporting file${others.length === 1 ? "" : "s"}` : "No supporting files yet"}</p>{others.slice(0, 3).map((item) => <div key={item.id} className="mt-2 flex items-center gap-2"><Icon name={item.type === "video" ? "video" : item.type === "image" ? "image" : "file"} size={13} className="text-[#0B1120]" /><span className="min-w-0 flex-1 truncate text-[10px] text-slate-600">{item.name}</span><button type="button" onClick={() => setAttachments((items) => items.filter((candidate) => candidate.id !== item.id))} className="text-slate-400 hover:text-slate-800"><Icon name="x" size={12} /></button></div>)}</div>
      </div>
      {uploading && <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#0B1120]" /> Uploading securely…</div>}
      <input ref={coverRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => void upload(e.target.files, "cover")} />
      <input ref={mediaRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt" className="hidden" onChange={(e) => void upload(e.target.files, "attachment")} />
    </div>
  );
}

function AdminAnnouncementDetail({ announcement, onReact, onAcknowledge, onPin, onPublish, onArchive, onDelete }: { announcement: Announcement; onReact: (emoji: string) => void; onAcknowledge: () => void; onPin?: () => void; onPublish?: () => void; onArchive?: () => void; onDelete?: () => void }) {
  const cover = announcement.attachments.find((item) => item.slot === "cover");
  const attachments = announcement.attachments.filter((item) => item.slot !== "cover");

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-800 bg-[#141C2F] shadow-xl shadow-black/10">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-gray-800 p-3">
        <button onClick={onPin} className="rounded-lg border border-gray-700 px-3 py-2 text-[10px] font-bold text-gray-300 hover:border-[#00DF73]/50 hover:text-[#00DF73]">{announcement.pinned ? "Unpin" : "Pin"}</button>
        {announcement.status !== "published" && announcement.status !== "archived" && <button onClick={onPublish} className="rounded-lg bg-[#00DF73] px-3 py-2 text-[10px] font-black text-[#0B1120]">Publish now</button>}
        {announcement.status !== "archived" && <button onClick={onArchive} className="rounded-lg border border-gray-700 px-3 py-2 text-[10px] font-bold text-gray-400 hover:border-amber-800 hover:text-amber-400">Archive</button>}
        {onDelete && <button onClick={onDelete} className="rounded-lg border border-red-900/50 px-3 py-2 text-[10px] font-bold text-red-500 hover:bg-red-900/20 hover:text-red-400">Delete</button>}
      </div>
      {cover && <div className="relative aspect-[16/6] min-h-44 max-h-80 overflow-hidden bg-[#0B1120]"><img src={cover.url} alt={cover.filename} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#0B1120]/45 to-transparent" /></div>}
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><CategoryPillDark value={announcement.category} /><StatusPill status={announcement.status} />{announcement.pinned ? <span className="rounded-full border border-amber-700/30 bg-amber-500/10 px-2 py-1 text-[9px] font-bold text-amber-300">Pinned</span> : null}<span className="ml-auto text-[10px] text-gray-600">{formatAnnouncementDate(announcement)}</span></div>
        <h2 className="mt-3 text-xl font-bold leading-tight text-white sm:text-2xl">{announcement.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500"><span>By <strong className="text-gray-300">{announcement.author_name}</strong></span><span>{audienceLabel(announcement)}</span>{announcement.priority === "high" && <span className="font-bold text-red-400">Important</span>}</div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-300">{announcement.content}</p>
        {attachments.length > 0 && <AnnouncementAttachmentsDark attachments={attachments} />}
        <div className="mt-5 border-t border-gray-800 pt-4">
          {announcement.reactions_enabled ? <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">React</span>{REACTIONS.map((emoji) => { const reaction = announcement.reactions.find((item) => item.emoji === emoji); return <button key={emoji} onClick={() => onReact(emoji)} className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition ${reaction?.reactedByMe ? "border-[#00DF73]/50 bg-[#00DF73]/10 text-white" : "border-gray-700 bg-[#0B1120] text-gray-400 hover:border-gray-600 hover:text-white"}`}><span>{emoji}</span>{reaction?.count ? <strong>{reaction.count}</strong> : null}</button>; })}</div> : <p className="text-xs text-gray-600">Reactions are disabled for this announcement.</p>}
          {announcement.require_acknowledgement && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#00DF73]/20 bg-[#00DF73]/5 p-3"><div><strong className="text-xs text-white">Acknowledgement required</strong><p className="mt-1 text-[10px] text-gray-500">{announcement.acknowledgementCount} acknowledgement{announcement.acknowledgementCount === 1 ? "" : "s"} recorded.</p></div><button disabled={announcement.acknowledgedByMe} onClick={onAcknowledge} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#00DF73] px-3 text-[10px] font-black text-[#0B1120] disabled:bg-[#00DF73]/20 disabled:text-[#00DF73]"><Icon name="check" size={13} />{announcement.acknowledgedByMe ? "Acknowledged" : "Mark as acknowledged"}</button></div>}
        </div>
      </div>
    </article>
  );
}

function EmployeeFeedCard({ announcement, onClick }: { announcement: Announcement; onClick: () => void }) {
  const cover = announcement.attachments.find((item) => item.slot === "cover");
  const primaryAttachment = announcement.attachments.find((item) => item.slot !== "cover");
  const reactionTotal = announcement.reactions.reduce((sum, item) => sum + item.count, 0);

  return (
    <button onClick={onClick} className="group w-full overflow-hidden rounded-2xl border border-[#DDE6E2] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#B9C8C0] hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-48 shrink-0 bg-[#EEF3F0] sm:h-auto sm:w-52">
          {cover ? <img src={cover.url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full min-h-36 w-full place-items-center text-[#087A46]"><Icon name={primaryAttachment?.kind === "video" ? "video" : primaryAttachment?.kind === "document" ? "file" : "bell"} size={30} /></div>}
          {announcement.pinned ? <span className="absolute left-3 top-3 rounded-full bg-[#0B1120] px-2.5 py-1 text-[10px] font-semibold text-white">Pinned</span> : null}
        </div>
        <div className="min-w-0 flex-1 p-5">
          <div className="flex flex-wrap items-center gap-2"><CategoryPillLight value={announcement.category} /><SoftBadge color={announcement.status === "archived" ? "slate" : "emerald"}>{announcement.status === "archived" ? "Archived" : "Published"}</SoftBadge><span className="ml-auto text-[11px] text-slate-400">{formatAnnouncementDate(announcement)}</span></div>
          <h2 className="mt-3 text-lg font-bold leading-6 text-[#0B1120] transition group-hover:text-[#087A46]">{announcement.title}</h2>
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-500">{summaryText(announcement.content, 170)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500"><span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">To: {audienceLabel(announcement)}</span><span>By {announcement.author_name}</span>{announcement.attachments.length > 0 ? <span className="inline-flex items-center gap-1"><Icon name="paperclip" size={12} /> {announcement.attachments.length}</span> : null}</div>
          <div className="mt-4 flex items-center gap-4 border-t border-[#EDF2EF] pt-3 text-[11px] text-slate-500"><span>👍 {reactionTotal}</span>{announcement.require_acknowledgement ? <span className="font-semibold text-amber-600">Acknowledgement required</span> : <span className="text-slate-400">Open announcement</span>}</div>
        </div>
      </div>
    </button>
  );
}

function EmployeeAnnouncementDetail({ announcement, onReact, onAcknowledge }: { announcement: Announcement; onReact: (emoji: string) => void; onAcknowledge: () => void }) {
  const cover = announcement.attachments.find((item) => item.slot === "cover");
  const attachments = announcement.attachments.filter((item) => item.slot !== "cover");

  return (
    <article className="overflow-hidden rounded-2xl border border-[#DDE6E2] bg-white shadow-sm">
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">{announcement.pinned ? <SoftBadge color="blue">Pinned</SoftBadge> : null}<CategoryPillLight value={announcement.category} /><SoftBadge color={announcement.status === "archived" ? "slate" : "emerald"}>{announcement.status === "archived" ? "Archived" : "Published"}</SoftBadge><span className="ml-auto text-xs text-slate-400">{formatAnnouncementDate(announcement)}</span></div>
        <h1 className="mt-4 text-3xl font-bold leading-tight text-[#0B1120] sm:text-4xl">{announcement.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#0B1120] text-xs font-bold text-[#00DF73]">{initialsFromName(announcement.author_name)}</span><span>By <strong className="text-[#0B1120]">{announcement.author_name}</strong></span></span><span>{audienceLabel(announcement)}</span>{announcement.priority === "high" ? <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-600">Important</span> : null}</div>
      </div>

      {cover ? <div className="border-y border-[#EDF2EF] bg-[#F6F9F7] p-4 sm:p-6"><img src={cover.url} alt={cover.filename} className="max-h-[420px] w-full rounded-xl object-cover" /></div> : null}

      <div className="p-6 sm:p-8">
        <div className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">{announcement.content}</div>
        {attachments.length > 0 && <AnnouncementAttachmentsLight attachments={attachments} />}
        <div className="mt-7 border-t border-[#EDF2EF] pt-5">
          {announcement.reactions_enabled ? <div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-xs font-semibold uppercase tracking-wider text-slate-400">React</span>{REACTIONS.map((emoji) => { const reaction = announcement.reactions.find((item) => item.emoji === emoji); return <button key={emoji} onClick={() => onReact(emoji)} className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm transition ${reaction?.reactedByMe ? "border-[#8BCBAC] bg-[#E8FFF3] text-[#087A46]" : "border-[#DDE6E2] bg-white text-slate-600 hover:border-[#B9C8C0]"}`}><span>{emoji}</span>{reaction?.count ? <strong className="text-xs">{reaction.count}</strong> : null}</button>; })}</div> : <p className="text-sm text-slate-400">Reactions are disabled for this announcement.</p>}
          {announcement.require_acknowledgement && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#CFEADD] bg-[#F1FBF6] px-4 py-4"><div><strong className="text-sm text-[#0B1120]">Acknowledgement required</strong><p className="mt-1 text-xs text-slate-500">Confirm that you have read and understood this announcement.</p></div><button disabled={announcement.acknowledgedByMe} onClick={onAcknowledge} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B1120] px-4 text-xs font-bold text-white transition hover:bg-[#141C2F] disabled:bg-[#E2EAE6] disabled:text-[#087A46]"><Icon name="check" size={13} />{announcement.acknowledgedByMe ? "Acknowledged" : "Acknowledge"}</button></div>}
        </div>
      </div>
    </article>
  );
}

function AnnouncementHistoryRail({ items, onSelect }: { items: Announcement[]; onSelect: (id: string) => void }) {
  return (
    <section className="rounded-3xl border border-[#DDE6E2] bg-white shadow-sm">
      <div className="border-b border-[#EDF2EF] px-5 py-4">
        <p className="text-sm font-semibold text-[#0F172A]">Past announcements</p>
        <p className="mt-1 text-xs text-slate-500">Access previous announcements and track what you have read.</p>
      </div>
      <div className="space-y-3 p-4">
        {items.length === 0 ? <p className="text-sm text-slate-400">No additional announcements to show.</p> : items.map((item) => {
          const thumb = item.attachments.find((attachment) => attachment.slot === "cover") || item.attachments.find((attachment) => attachment.slot !== "cover");
          return (
            <button key={item.id} onClick={() => onSelect(item.id)} className="flex w-full items-start gap-3 rounded-2xl border border-[#EDF2EF] p-3 text-left transition hover:border-[#DDE6E2] hover:bg-[#F8FAFD]">
              {thumb ? thumb.kind === "image" ? <img src={thumb.url} alt="" className="h-14 w-16 rounded-xl object-cover" /> : <span className="grid h-14 w-16 place-items-center rounded-xl bg-[#F3F7FB] text-[#0B1120]"><Icon name={thumb.kind === "video" ? "video" : "file"} size={18} /></span> : <span className="grid h-14 w-16 place-items-center rounded-xl bg-[#F3F7FB] text-[#0B1120]"><Icon name="bell" size={18} /></span>}
              <span className="min-w-0 flex-1"><strong className="line-clamp-2 block text-xs text-[#0F172A]">{item.title}</strong><span className="mt-1 block text-[11px] text-slate-500">{item.category}</span><span className="mt-1 block text-[11px] text-slate-400">{formatAnnouncementDate(item)}</span></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AnnouncementNotificationsRail({ items }: { items: Array<{ id: string; label: string; title: string; time: string; color: "blue" | "amber" }> }) {
  return (
    <section className="rounded-3xl border border-[#DDE6E2] bg-white shadow-sm">
      <div className="border-b border-[#EDF2EF] px-5 py-4">
        <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-[#0F172A]">Announcement notifications</p><span className="text-xs font-semibold text-slate-400">Latest 5 updates</span></div>
        <p className="mt-1 text-xs text-slate-500">Stay up to date with the latest announcement activity.</p>
      </div>
      <div className="space-y-3 p-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[#EDF2EF] p-3">
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.color === "amber" ? "bg-amber-50 text-amber-500" : "bg-[#E8FFF3] text-[#0B1120]"}`}><Icon name={item.color === "amber" ? "info" : "bell"} size={16} /></span>
            <div className="min-w-0"><strong className="block text-xs text-[#0F172A]">{item.label}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{item.title}</p><span className="mt-1 block text-[11px] text-slate-400">{item.time}</span></div>
          </div>
        ))}
        <div className="rounded-2xl bg-[#F2FBF7] p-4 text-center">
          <h4 className="text-lg font-bold text-[#0F172A]">Stay informed.</h4>
          <p className="mt-1 text-sm text-slate-500">People. Information. Progress.</p>
        </div>
      </div>
    </section>
  );
}

function AnnouncementAttachmentsDark({ attachments }: { attachments: Announcement["attachments"] }) {
  return <div className="mt-5 space-y-2"><h3 className="text-xs font-bold text-white">Attachments ({attachments.length})</h3>{attachments.map((item) => item.kind === "video" ? <div key={item.id} className="overflow-hidden rounded-xl border border-gray-800 bg-[#0B1120]"><video controls preload="metadata" src={item.url} className="max-h-80 w-full bg-black" /><div className="px-3 py-2 text-[10px] text-gray-400">{item.filename}</div></div> : item.kind === "image" ? <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-gray-800 bg-[#0B1120]"><img src={item.url} alt={item.filename} className="max-h-72 w-full object-cover" /></a> : <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0B1120] p-3 hover:border-[#00DF73]/40"><span className="grid h-10 w-10 place-items-center rounded-lg bg-red-500/10 text-red-300"><Icon name="file" size={17} /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{item.filename}</strong><small className="text-[10px] text-gray-500">{formatBytes(item.size_bytes || 0)}</small></span><span className="text-[10px] font-bold text-[#00DF73]">Open</span></a>)}</div>;
}

function AnnouncementAttachmentsLight({ attachments }: { attachments: Announcement["attachments"] }) {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-[#0F172A]">Attachments ({attachments.length})</h3><span className="text-xs font-semibold text-slate-400">Open each attachment below</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {attachments.map((item) => item.kind === "video" ? (
          <div key={item.id} className="overflow-hidden rounded-2xl border border-[#DDE6E2] bg-[#F8FAFD]">
            <video controls preload="metadata" src={item.url} className="h-40 w-full bg-black object-cover" />
            <div className="px-4 py-3"><strong className="block truncate text-xs text-[#0F172A]">{item.filename}</strong><small className="text-[11px] text-slate-500">Video • {formatBytes(item.size_bytes || 0)}</small></div>
          </div>
        ) : item.kind === "image" ? (
          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-[#DDE6E2] bg-[#F8FAFD] transition hover:border-[#B9C8C0]">
            <img src={item.url} alt={item.filename} className="h-40 w-full object-cover" />
            <div className="px-4 py-3"><strong className="block truncate text-xs text-[#0F172A]">{item.filename}</strong><small className="text-[11px] text-slate-500">Image • {formatBytes(item.size_bytes || 0)}</small></div>
          </a>
        ) : (
          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-[#DDE6E2] bg-[#F8FAFD] p-4 transition hover:border-[#B9C8C0]">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-500"><Icon name="file" size={18} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#0F172A]">{item.filename}</strong><small className="text-[11px] text-slate-500">Document • {formatBytes(item.size_bytes || 0)}</small></span><span className="text-xs font-semibold text-[#0B1120]">Open</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function AnnouncementListItem({ announcement, selected, onClick }: { announcement: Announcement; selected: boolean; onClick: () => void }) {
  const cover = announcement.attachments.find((item) => item.slot === "cover");
  return <button onClick={onClick} className={`mb-2 flex w-full gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-[#00DF73]/50 bg-[#00DF73]/10" : "border-transparent bg-[#0B1120]/45 hover:border-gray-700"}`}>{cover ? <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg"><img src={cover.url} alt="" className="h-full w-full object-cover" /></div> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-[#0B1120] text-[#00DF73]"><Icon name="bell" size={22} /></span>}<span className="min-w-0 flex-1"><span className="flex items-center gap-2"><StatusPill status={announcement.status} />{announcement.pinned ? <span className="text-[9px] text-amber-300">Pinned</span> : null}</span><strong className="mt-2 block line-clamp-2 text-sm text-white">{announcement.title}</strong><span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-gray-500">{announcement.content}</span><span className="mt-2 flex items-center justify-between gap-2 text-[9px] text-gray-600"><span>{announcement.category}</span><span>{formatAnnouncementDate(announcement)}</span></span></span></button>;
}

function PreviewAnnouncement({ title, content, category, priority, audience, cover, attachments, pinned, reactionsEnabled, requireAcknowledgement }: { title: string; content: string; category: string; priority: string; audience: string; cover?: DraftAnnouncementAttachment; attachments: DraftAnnouncementAttachment[]; pinned: boolean; reactionsEnabled: boolean; requireAcknowledgement: boolean }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#DDE6E2] bg-white shadow-sm">
      <div className="border-b border-[#EDF2EF] px-4 py-4">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#E8FFF3] text-xs font-black text-[#0B1120]">TA</span><div><strong className="block text-xs text-[#0F172A]">Test Admin</strong><span className="text-[10px] text-slate-500">All employees</span></div><span className="ml-auto text-slate-400"><Icon name="more" size={16} /></span></div>
      </div>
      {cover?.previewUrl && <div className="aspect-[16/7] overflow-hidden bg-[#F8FAFD]"><img src={cover.previewUrl} alt="Cover preview" className="h-full w-full object-cover" /></div>}
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2"><CategoryPillLight value={category} />{pinned && <SoftBadge color="blue">Pinned</SoftBadge>}{priority === "high" && <SoftBadge color="amber">Important</SoftBadge>}<span className="text-[11px] text-slate-500">{audience}</span></div>
        <h2 className="mt-3 text-2xl font-bold text-[#0F172A]">{title}</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{content}</p>
        {attachments.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{attachments.slice(0, 4).map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl border border-[#DDE6E2] bg-[#F8FAFD] p-3"><Icon name={item.type === "video" ? "video" : item.type === "image" ? "image" : "file"} size={15} className="text-[#0B1120]" /><span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">{item.name}</span></div>)}</div>}
        {reactionsEnabled && <div className="mt-4 flex gap-2 border-t border-[#EDF2EF] pt-4">{REACTIONS.map((emoji) => <span key={emoji} className="grid h-9 w-9 place-items-center rounded-full border border-[#DDE6E2] bg-white text-sm">{emoji}</span>)}</div>}
        {requireAcknowledgement && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-slate-600">Employees will be asked to acknowledge this announcement after reading.</div>}
      </div>
    </div>
  );
}

function MediaSlot({ title, hint, icon, preview, onPick, onRemove }: { title: string; hint: string; icon: "image"; preview?: DraftAnnouncementAttachment; onPick: () => void; onRemove?: () => void }) {
  return <div className="relative min-h-36 overflow-hidden rounded-xl border border-dashed border-[#DDE6E2] bg-white">{preview?.previewUrl ? <><img src={preview.previewUrl} alt="" className="h-36 w-full object-cover" /><div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/55 p-2 backdrop-blur"><button type="button" onClick={onPick} className="text-[10px] font-bold text-white">Replace image</button>{onRemove && <button type="button" onClick={onRemove} className="rounded-md bg-black/40 p-1 text-gray-300"><Icon name="x" size={12} /></button>}</div></> : <button type="button" onClick={onPick} className="flex h-36 w-full flex-col items-start p-4 text-left"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8FFF3] text-[#0B1120]"><Icon name={icon} /></span><strong className="mt-3 text-xs text-[#0F172A]">{title}</strong><span className="mt-1 text-[10px] text-slate-500">{hint}</span></button>}</div>;
}

function EditorCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) { return <section className="rounded-3xl border border-[#DDE6E2] bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-sm font-bold text-[#0F172A]">{title}</h2>{subtitle && <p className="mt-1 text-[10px] leading-4 text-slate-500">{subtitle}</p>}</div>{children}</section>; }
function FieldLabel({ children }: { children: ReactNode }) { return <span className="text-xs font-semibold text-slate-600">{children}</span>; }
function ModeCard({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={`rounded-xl border p-3 text-left transition ${active ? "border-[#0B1120] bg-[#E8FFF3]" : "border-[#DDE6E2] bg-white hover:border-[#B9C8C0]"}`}><span className={`inline-block h-3 w-3 rounded-full border ${active ? "border-[#0B1120] bg-[#0B1120] shadow-[0_0_0_3px_rgba(29,78,216,.12)]" : "border-slate-400"}`} /><strong className="ml-2 text-xs text-[#0F172A]">{title}</strong><p className="mt-2 text-[10px] text-slate-500">{description}</p></button>; }
function ToggleCard({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void }) { return <button type="button" onClick={() => onChange(!checked)} className="rounded-xl border border-[#DDE6E2] bg-[#F8FAFD] p-3 text-left"><div className="flex items-center justify-between gap-3"><strong className="text-xs text-[#0F172A]">{title}</strong><span className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-[#16A34A]" : "bg-slate-300"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-[18px]" : "left-0.5"}`} /></span></div><p className="mt-2 text-[10px] leading-4 text-slate-500">{description}</p></button>; }
function StatusTabs({ value, onChange, announcements }: { value: "all" | AnnouncementStatus; onChange: (value: "all" | AnnouncementStatus) => void; announcements: Announcement[] }) { const tabs: Array<["all" | AnnouncementStatus, string]> = [["all", "All"], ["draft", "Drafts"], ["scheduled", "Scheduled"], ["published", "Published"], ["archived", "Archived"]]; return <div className="mb-5 flex flex-wrap gap-2">{tabs.map(([key, label]) => { const count = key === "all" ? announcements.length : announcements.filter((item) => item.status === key).length; return <button key={key} onClick={() => onChange(key)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${value === key ? "border-[#00DF73]/40 bg-[#00DF73]/10 text-[#00DF73]" : "border-gray-800 bg-[#141C2F] text-gray-400 hover:text-white"}`}>{label} <span className="ml-1 text-[9px] opacity-70">{count}</span></button>; })}</div>; }
function StatusPill({ status }: { status: AnnouncementStatus }) { const styles = status === "published" ? "bg-[#00DF73]/10 text-[#00DF73]" : status === "scheduled" ? "bg-blue-500/10 text-blue-300" : status === "draft" ? "bg-gray-700/50 text-gray-300" : "bg-amber-500/10 text-amber-300"; return <span className={`rounded-full px-2 py-1 text-[9px] font-bold capitalize ${styles}`}>{status}</span>; }
function CategoryPillDark({ value }: { value: string }) { return <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[9px] font-bold text-blue-300">{value}</span>; }
function CategoryPillLight({ value }: { value: string }) { return <span className="rounded-full bg-[#E8FFF3] px-2.5 py-1 text-[10px] font-bold text-[#087A46]">{value}</span>; }
function SoftBadge({ children, color }: { children: ReactNode; color: "emerald" | "amber" | "blue" | "slate" }) { const styles = color === "emerald" ? "bg-emerald-50 text-emerald-700" : color === "amber" ? "bg-amber-50 text-amber-700" : color === "slate" ? "bg-slate-100 text-slate-600" : "bg-[#E8FFF3] text-[#087A46]"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles}`}>{children}</span>; }
function audienceLabel(item: Announcement) {
  const department = item.target_department && item.target_department !== "All" ? item.target_department : null;
  const jobTitle = item.target_job_title && item.target_job_title !== "All" ? item.target_job_title : null;
  if (department && jobTitle) return `${department} · ${jobTitle}`;
  if (department) return department;
  if (jobTitle) return jobTitle;
  // Announcements created before the Department/Job Title columns existed fall back to the old model.
  if (item.audience_type === "department") return item.audience_value || "All employees";
  if (item.audience_type === "role") return item.audience_value === "employee" ? "Workers" : item.audience_value === "admin" ? "Administrators" : item.audience_value || "All employees";
  return "All employees";
}
function formatAnnouncementDate(item: Announcement) { const value = item.status === "scheduled" ? item.scheduled_at : item.published_at || item.created_at; if (!value) return ""; return new Date(value).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }); }
function formatAnnouncementDateTime(value: string | null | undefined) { if (!value) return ""; return new Date(value).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); }
function formatBytes(bytes: number) { if (!bytes) return "File"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); const value = bytes / 1024 ** index; return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`; }
function LoadingState() { return <main className="min-h-screen bg-[#F4F7FA] p-8"><div className="mx-auto max-w-6xl rounded-3xl border border-[#DDE6E2] bg-white p-12 text-center text-sm text-slate-500 shadow-sm">Loading announcements…</div></main>; }
function EmptyAnnouncements({ isAdmin, onCreate }: { isAdmin: boolean; onCreate: () => void }) { return <div className="rounded-3xl border border-dashed border-[#DDE6E2] bg-white p-16 text-center shadow-sm"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#E8FFF3] text-[#0B1120]"><Icon name="bell" size={24} /></span><h2 className="mt-4 text-lg font-bold text-[#0F172A]">No announcements yet</h2><p className="mt-1 text-sm text-slate-500">Published company updates will appear here and remain searchable.</p>{isAdmin && <button onClick={onCreate} className="mt-5 rounded-xl bg-[#0B1120] px-4 py-2.5 text-xs font-black text-white">Create first announcement</button>}</div>; }
function initialsFromName(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((item) => item[0]?.toUpperCase() || "").join("") || "AD"; }
function summaryText(text: string, max = 120) { const clean = text.replace(/\s+/g, " ").trim(); return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean; }
function buildEmployeeAnnouncementNotifications(announcements: Announcement[]) {
  return announcements.slice(0, 5).map((item) => ({
    id: item.id,
    label: item.require_acknowledgement && !item.acknowledgedByMe ? "Reminder" : item.attachments.some((attachment) => attachment.kind === "video") ? "New video announcement" : "New announcement posted",
    title: item.title,
    time: formatAnnouncementDateTime(item.published_at || item.created_at),
    color: item.require_acknowledgement && !item.acknowledgedByMe ? "amber" as const : "blue" as const,
  }));
}