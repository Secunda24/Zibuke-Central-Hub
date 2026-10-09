"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/src/modules/shared/Icons";

type Notification = {
  id: string;
  content: string;
  is_read: number;
  created_at: string;
  kind?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  function fetchNotifications() {
    return fetch('/api/notifications',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error('Failed to load notifications');
      return response.json();
    }).then(data=>{setError(""); if (data.notifications) setNotifications(data.notifications);}).catch(()=>setError("Could not load notifications. Please retry.")).finally(()=>setIsLoading(false));
  }

  useEffect(() => { void fetchNotifications(); }, []);

  async function markAllAsRead() {
    try {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!response.ok) throw new Error();
      setNotifications((items) => items.map((note) => ({ ...note, is_read: 1 })));
      setError("");
    } catch { setError("Could not mark notifications as read. Please retry."); }
  }

  async function openNotification(note: Notification) {
    setOpeningId(note.id);
    try {
      if (!note.is_read) {
        const response = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: note.id }),
        });
        if (!response.ok) throw new Error();
        setNotifications((items) => items.map((item) => item.id === note.id ? { ...item, is_read: 1 } : item));
      }
      router.push(notificationHref(note));
    } catch {
      setError("Could not open the notification. Please retry.");
    } finally {
      window.setTimeout(() => setOpeningId(null), 700);
    }
  }

  const unreadCount = notifications.filter((note) => note.is_read === 0).length;

  return (
    <main className="min-h-screen bg-[#0B1120] p-5 text-white sm:p-8 xl:p-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">Activity</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Notifications</h1><p className="mt-1 text-sm text-gray-400">Open an alert to jump straight to the related message, announcement or calendar item.</p></div>
          {unreadCount > 0 && <button onClick={() => void markAllAsRead()} className="h-10 rounded-lg border border-gray-700 px-4 text-xs font-semibold text-gray-300 transition hover:bg-[#141C2F] hover:text-[#00DF73]">Mark all as read</button>}
        </header>

        {error && <div role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-200">{error} <button onClick={() => void fetchNotifications()} className="ml-3 underline">Retry</button></div>}
        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-[#141C2F] shadow-sm">
          {isLoading ? (
            <div className="grid min-h-64 place-items-center"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-[#00DF73]"/><p className="mt-3 text-xs text-gray-500">Loading notifications…</p></div></div>
          ) : notifications.length === 0 ? (
            <div className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-gray-800 bg-[#0B1120] text-[#00DF73]"><Icon name="bell" size={22}/></span><h3 className="mt-4 text-base font-semibold text-gray-200">You&apos;re all caught up</h3><p className="mt-1 text-xs text-gray-500">New messages, invitations and announcements will appear here.</p></div></div>
          ) : (
            <div className="divide-y divide-gray-800">
              {notifications.map((note) => {
                const meta = notificationMeta(note);
                return <button key={note.id} onClick={() => void openNotification(note)} className={`group flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-[#0B1120] sm:px-6 ${note.is_read === 0 ? "bg-[#00DF73]/[0.055]" : "bg-transparent"}`}>
                  <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${note.is_read === 0 ? "border-[#00DF73]/25 bg-[#00DF73]/10 text-[#00DF73]" : "border-gray-800 bg-[#0B1120] text-gray-500"}`}><Icon name={meta.icon} size={17}/></span>
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className={`text-sm ${note.is_read === 0 ? "text-white" : "text-gray-300"}`}>{meta.label}</strong>{note.is_read === 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#00DF73]"/>}</span><span className={`mt-1 block text-sm leading-5 ${note.is_read === 0 ? "font-medium text-gray-200" : "text-gray-400"}`}>{note.content}</span><span className="mt-2 block text-[10px] text-gray-600">{new Date(note.created_at).toLocaleString()}</span></span>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 transition group-hover:text-[#00DF73]">{openingId === note.id ? "Opening…" : "Open"}<Icon name="chevronRight" size={13}/></span>
                </button>;
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function notificationHref(note: Notification) {
  const metadata = note.metadata || {};
  const senderId = typeof metadata.senderId === "string" ? metadata.senderId : note.actor_id;
  if (note.entity_type === "direct_message" && senderId) return `/dashboard/messages/${encodeURIComponent(senderId)}`;
  if (note.entity_type === "announcement" && note.entity_id) return `/dashboard/announcements?focus=${encodeURIComponent(note.entity_id)}`;
  if (note.entity_type === "event" && note.entity_id) {
    const instant = metadata.instant === true;
    const meetingTitle = typeof metadata.title === "string" ? metadata.title : "Zibuke meeting";
    if (instant) return `/dashboard/call?title=${encodeURIComponent(meetingTitle)}&meetingId=${encodeURIComponent(note.entity_id)}`;
    return `/dashboard/calendar?meetingId=${encodeURIComponent(note.entity_id)}`;
  }
  if (note.entity_type === "training") return "/dashboard/training";
  if (note.entity_type === "channel" && note.entity_id) return `/dashboard/channels/${encodeURIComponent(note.entity_id)}`;
  return "/dashboard";
}

function notificationMeta(note: Notification): { label: string; icon: "chat" | "calendar" | "bell" | "hash" | "info" } {
  if (note.kind === "direct_message") return { label: "Direct message", icon: "chat" };
  if (note.kind === "announcement") return { label: "Announcement", icon: "bell" };
  if (note.kind?.startsWith("event_") || note.entity_type === "event") return { label: note.kind === "event_reminder" ? "Meeting reminder" : "Calendar", icon: "calendar" };
  if (note.entity_type === "channel") return { label: "Channel", icon: "hash" };
  return { label: "Notification", icon: "info" };
}
