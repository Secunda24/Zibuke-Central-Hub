"use client";
import {useNow} from "@/src/modules/shared/useNow";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AttachmentComposer, DraftAttachmentTray } from "@/src/modules/shared/AttachmentComposer";
import { AttachmentGallery, QuickReactionPicker, ReactionStrip, RichMessageText } from "@/src/modules/shared/MessageContent";
import { Icon } from "@/src/modules/shared/Icons";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";
import type { DraftAttachment, MessageAttachment, ReactionSummary } from "@/src/modules/shared/types";

type MeetingMetadata = {
  eventId?: string;
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  eventType?: "meeting" | "huddle" | "event";
  organizerName?: string;
  online?: boolean;
  cancelled?: boolean;
};

type ChannelMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  reply_to_id?: string | null;
  reply_content?: string | null;
  reply_sender_name?: string | null;
  reply_deleted_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  is_deleted?: number;
  message_type?: "message" | "meeting" | "meeting_cancelled";
  event_id?: string | null;
  metadata?: MeetingMetadata | null;
  attachments?: MessageAttachment[];
  reactions?: ReactionSummary[];
};

type ChannelData = {
  id?: string;
  name: string;
  description?: string;
  creator_name?: string;
  created_by?: string;
  active_member_count?: number;
};

type ChannelSummary = {
  id: string;
  name: string;
  description?: string;
  last_message?: string | null;
  last_activity?: string | null;
  message_count?: number;
};

type SearchFilter = "all" | "messages" | "links" | "attachments" | "meetings";

export default function ChannelPage() {
  const params = useParams();
  const router = useRouter();
  
  // Bypassing strict TypeScript checks for custom user properties (role, email)
  const { user } = useCurrentUser();
  
  const channelId = params.id as string;
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [channelList, setChannelList] = useState<ChannelSummary[]>([]);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [channelQuery, setChannelQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null);
  const [editing, setEditing] = useState<ChannelMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [startingHuddle, setStartingHuddle] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDescription, setNewChannelDescription] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [createError, setCreateError] = useState("");
  const [toast, setToast] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 4000);
    return () => window.clearInterval(interval);
  }, [channelId]);
  useEffect(() => { if (!query) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, query]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3000); return () => window.clearTimeout(timer); }, [toast]);

  async function load() {
    try {
      const [messageResponse, channelResponse] = await Promise.all([
        fetch(`/api/channels/${channelId}/messages?t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/channels?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      if (messageResponse.status === 404) { router.replace("/dashboard/channels"); return; }
      const data = await messageResponse.json();
      const channelData = await channelResponse.json().catch(() => ({}));
      if (messageResponse.ok) {
        if (data.channel) setChannel(data.channel);
        if (data.messages) setMessages(data.messages);
      }
      if (channelResponse.ok) setChannelList(channelData.channels || []);
    } catch { /* keep current state during a transient refresh failure */ }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((message) => {
      const media = message.attachments || [];
      const hasLink = /https?:\/\/\S+/i.test(message.content) || media.some((item) => item.kind === "link");
      const hasAttachment = media.some((item) => item.kind !== "link");
      const isMeeting = message.message_type === "meeting" || message.message_type === "meeting_cancelled";
      const typeMatch = filter === "all" || filter === "messages" && !hasLink && !hasAttachment && !isMeeting || filter === "links" && hasLink || filter === "attachments" && hasAttachment || filter === "meetings" && isMeeting;
      const attachmentText = media.map((item) => `${item.filename} ${item.mime_type || ""}`).join(" ");
      const queryMatch = !q || `${message.sender_name} ${message.content} ${attachmentText} ${message.metadata?.title || ""}`.toLowerCase().includes(q);
      return typeMatch && queryMatch;
    });
  }, [messages, query, filter]);

  const filteredChannels = useMemo(() => {
    const q = channelQuery.trim().toLowerCase();
    return channelList.filter((item) => !q || `${item.name} ${item.description || ""} ${item.last_message || ""}`.toLowerCase().includes(q));
  }, [channelList, channelQuery]);

  const activeContributors = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const item of [...messages].reverse()) {
      if (!item.sender_name || seen.has(item.sender_name)) continue;
      seen.add(item.sender_name);
      names.push(item.sender_name);
      if (names.length === 4) break;
    }
    return names;
  }, [messages]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const clean = text.trim();

    if (editing) {
      if (!clean) return;
      setSending(true);
      try {
        const response = await fetch(`/api/channels/${channelId}/messages/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: clean }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { setToast(data.error || "Message could not be edited."); return; }
        setText("");
        setEditing(null);
        await load();
        setToast("Message edited.");
      } finally { setSending(false); }
      return;
    }

    if (!clean && attachments.length === 0) return;
    setSending(true);
    try {
      const response = await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: clean, replyToId: replyTo?.id || null, attachments }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setToast(data.error || "Message could not be sent."); return; }
      setText(""); setAttachments([]); setReplyTo(null); await load();
    } finally { setSending(false); }
  }

  function beginReply(message: ChannelMessage) {
    if (message.deleted_at || message.is_deleted === 1) return;
    setEditing(null);
    setReplyTo(message);
    setText("");
  }

  function beginEdit(message: ChannelMessage) {
    if (message.deleted_at || message.is_deleted === 1 || message.message_type !== "message") return;
    setReplyTo(null);
    setAttachments([]);
    setEditing(message);
    setText(message.content || "");
  }

  function cancelComposerMode() {
    setEditing(null);
    setReplyTo(null);
    setText("");
  }

  async function deleteMessage(message: ChannelMessage) {
    if (!window.confirm("Delete this message? It will remain in the channel as ‘Message deleted’.")) return;
    
    const response = await fetch(`/api/channels/${channelId}/messages/${message.id}`, { 
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" }) 
    });
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setToast(data.error || "Message could not be deleted."); return; }
    if (editing?.id === message.id) cancelComposerMode();
    await load();
    setToast("Message deleted.");
  }

  async function deleteChannel() {
    const userRole = String(user?.role || "").toLowerCase();
    const userEmail = String(user?.email || "").toLowerCase();
    const isAdmin = userRole === "admin" || userEmail === "jayjacobs@zibukeafrica.co.za";
    
    if (!channel || (channel.created_by !== user?.id && !isAdmin)) return;
    
    if (!window.confirm(`Delete #${channel.name}? The channel will be removed from active channels.`)) return;
    const response = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setToast(data.error || "Channel could not be deleted."); return; }
    router.replace("/dashboard/channels");
  }

  async function react(messageId: string, emoji: string) {
    const response = await fetch("/api/reactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: "channel", targetId: messageId, emoji }) });
    if (response.ok) await load();
  }

  async function startHuddle() {
    if (!channel) return;
    setStartingHuddle(true);
    try {
      const start = new Date();
      const end = new Date(start.getTime() + 30 * 60000);
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `#${channel.name} huddle`,
          description: `Instant working huddle started from #${channel.name}.`,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          event_type: "huddle",
          channel_id: channelId,
          invitee_ids: [],
          online: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setToast(data.error || "Could not start huddle."); return; }
      await load();
      router.push(`/dashboard/call?title=${encodeURIComponent(`#${channel.name} huddle`)}&meetingId=${encodeURIComponent(data.eventId)}`);
    } finally { setStartingHuddle(false); }
  }

  async function createChannel(event: React.FormEvent) {
    event.preventDefault();
    if (!newChannelName.trim()) return;
    setCreatingChannel(true); setCreateError("");
    try {
      const response = await fetch("/api/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newChannelName, description: newChannelDescription }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setCreateError(data.error || "Unable to create channel."); return; }
      setShowCreate(false); setNewChannelName(""); setNewChannelDescription("");
      await load();
      if (data.channelId) router.push(`/dashboard/channels/${data.channelId}`);
    } finally { setCreatingChannel(false); }
  }

  const channelName = channel?.name || "channel";
  
  const userRole = String(user?.role || "").toLowerCase();
  const userEmail = String(user?.email || "").toLowerCase();
  const isAdmin = userRole === "admin" || userEmail === "jayjacobs@zibukeafrica.co.za";
  const canDeleteChannel = channel?.created_by === user?.id || isAdmin;

  return (
    <main className="h-[calc(100vh-64px)] overflow-hidden bg-[#0B1120] text-white">
      <div className="grid h-full lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 border-r border-gray-800 bg-[#10192A] lg:flex lg:flex-col">
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Workspace</p><h2 className="mt-1 text-lg font-bold">Channels</h2></div><button onClick={() => setShowCreate(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-gray-700 bg-[#0B1120] text-gray-300 hover:border-[#00DF73]/50 hover:text-[#00DF73]" title="Create channel"><Icon name="plus"/></button></div>
            <label className="mt-4 flex h-10 items-center gap-2 rounded-xl border border-gray-700 bg-[#0B1120] px-3 focus-within:border-[#00DF73]"><Icon name="search" size={15} className="text-gray-500"/><input value={channelQuery} onChange={(e) => setChannelQuery(e.target.value)} placeholder="Search channels" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"/></label>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredChannels.map((item) => <Link key={item.id} href={`/dashboard/channels/${item.id}`} className={`mb-1 flex items-center gap-3 rounded-xl p-3 transition ${item.id === channelId ? "bg-[#00DF73]/10 ring-1 ring-[#00DF73]/20" : "hover:bg-[#0B1120]"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.id === channelId ? "bg-[#00DF73] text-[#0B1120]" : "bg-[#0B1120] text-gray-500"}`}><Icon name="hash" size={17}/></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><strong className={`truncate text-sm ${item.id === channelId ? "text-white" : "text-gray-300"}`}>{item.name}</strong><small className="text-[9px] text-gray-600">{item.last_activity ? relativeTime(item.last_activity) : "New"}</small></span><span className="mt-0.5 block truncate text-[10px] text-gray-600">{item.last_message || item.description || "No messages yet"}</span></span></Link>)}
          </div>
          <div className="border-t border-gray-800 p-3"><button onClick={() => setShowCreate(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-700 px-3 py-2.5 text-xs font-semibold text-gray-500 hover:border-[#00DF73]/40 hover:text-[#00DF73]"><Icon name="plus" size={14}/> Create team channel</button></div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col bg-[#0D1524]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 bg-[#141C2F] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3"><Link href="/dashboard/channels" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gray-700 text-gray-400 hover:bg-[#0B1120] hover:text-white lg:hidden"><Icon name="chevronLeft"/></Link><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#00DF73]/10 text-[#00DF73]"><Icon name="hash"/></span><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-base font-bold text-white">#{channelName}</h1><span className="hidden rounded-full border border-gray-700 px-2 py-0.5 text-[9px] text-gray-500 sm:inline">Company channel</span></div><div className="mt-0.5 flex items-center gap-2"><AvatarStack names={activeContributors}/><p className="truncate text-[11px] text-gray-500">{channel?.description || "Company collaboration channel"}{messages.length ? ` · ${Math.max(Number(channel?.active_member_count || 0), activeContributors.length)} active` : ""}</p></div></div></div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push(`/dashboard/calendar?action=create&channelId=${encodeURIComponent(channelId)}&channel=${encodeURIComponent(channelName)}`)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-700 bg-[#0B1120] px-3 text-xs font-semibold text-gray-300 hover:border-[#00DF73]/40 hover:text-white"><Icon name="calendar" size={15}/><span className="hidden sm:inline">Schedule</span></button>
              <button onClick={() => void startHuddle()} disabled={startingHuddle} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#00DF73] px-3 text-xs font-bold text-[#0B1120] hover:bg-[#00c968] disabled:opacity-50"><Icon name="video" size={15}/> {startingHuddle ? "Starting…" : "Start huddle"}</button>
              {canDeleteChannel && <button onClick={() => void deleteChannel()} className="hidden h-9 w-9 place-items-center rounded-xl border border-red-900/70 bg-red-950/20 text-red-400 hover:bg-red-950/40 sm:grid" title="Delete channel"><Icon name="trash" size={15}/></button>}
              <button onClick={() => setShowCreate(true)} className="hidden h-9 w-9 place-items-center rounded-xl border border-gray-700 bg-[#0B1120] text-gray-400 hover:text-[#00DF73] sm:grid" title="Create another channel"><Icon name="plus" size={16}/></button>
            </div>
          </header>

          <div className="border-b border-gray-800 bg-[#10192A] p-3">
            <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-[#0B1120] px-3 focus-within:border-[#00DF73]"><Icon name="search" size={16} className="text-gray-500"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search #${channelName} by keyword, link or attachment`} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"/>{query && <button onClick={() => setQuery("")} className="text-gray-500 hover:text-white"><Icon name="x" size={14}/></button>}</label>
              <div className="flex overflow-x-auto rounded-xl border border-gray-700 bg-[#0B1120] p-1">{(["all", "messages", "links", "attachments", "meetings"] as SearchFilter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] font-bold capitalize ${filter === item ? "bg-[#00DF73] text-[#0B1120]" : "text-gray-500 hover:text-gray-300"}`}>{item}</button>)}</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_20%_0%,rgba(0,223,115,0.035),transparent_26%),linear-gradient(180deg,#0D1524,#0B1120)] p-3 sm:p-5">
            <div className="mx-auto max-w-5xl">
              <ChannelIntro channelName={channelName} description={channel?.description}/>
              {filtered.length === 0 ? <div className="mt-14 text-center"><Icon name={messages.length ? "search" : "chat"} size={34} className="mx-auto text-gray-700"/><p className="mt-3 text-sm font-semibold text-gray-400">{messages.length ? "No matching channel content." : "No messages in this channel yet."}</p><p className="mt-1 text-xs text-gray-600">{messages.length ? "Try a different filter or search term." : "Share the first update, photo, file or meeting."}</p></div> : <div className="space-y-1">{filtered.map((message, index) => {
                const previous = index > 0 ? filtered[index - 1] : null;
                const showDate = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
                const mine = Boolean(user?.id && message.sender_id === user.id);
                message.deleted_at = (message.deleted_at || message.is_deleted === 1 || message.content === '[This message was deleted]') ? "deleted" : message.deleted_at;
                
                return <Fragment key={message.id}>{showDate && <DateDivider value={message.created_at}/>} {message.message_type === "meeting" || message.message_type === "meeting_cancelled" ? <MeetingChannelCard message={message} onOpenCalendar={() => router.push(`/dashboard/calendar?meetingId=${encodeURIComponent(message.event_id || "")}`)} onJoin={() => message.event_id && router.push(`/dashboard/call?title=${encodeURIComponent(message.metadata?.title || "Channel meeting")}&meetingId=${encodeURIComponent(message.event_id)}`)} onReact={(emoji) => void react(message.id, emoji)}/> : <ChannelPost message={message} mine={mine} onReply={() => beginReply(message)} onEdit={() => beginEdit(message)} onDelete={() => void deleteMessage(message)} onReact={(emoji) => void react(message.id, emoji)}/>}</Fragment>;
              })}</div>}
              <div ref={bottomRef}/>
            </div>
          </div>

          <footer className="border-t border-gray-800 bg-[#141C2F] p-3 sm:p-4">
            <div className="mx-auto max-w-5xl">
              {replyTo && !editing && <div className="mb-2 flex items-center justify-between rounded-xl border-l-2 border-[#00DF73] bg-[#0B1120] px-3 py-2 text-xs text-gray-400"><span className="truncate">Replying to <strong className="text-gray-200">{replyTo.sender_name}</strong>: {replyTo.content || replyTo.metadata?.title}</span><button onClick={cancelComposerMode} className="ml-2 text-gray-500 hover:text-white"><Icon name="x" size={14}/></button></div>}
              {editing && <div className="mb-2 flex items-center justify-between rounded-xl border-l-2 border-amber-400 bg-[#0B1120] px-3 py-2 text-xs text-gray-400"><span className="truncate">Editing your message: <strong className="text-gray-200">{editing.content}</strong></span><button onClick={cancelComposerMode} className="ml-2 text-gray-500 hover:text-white"><Icon name="x" size={14}/></button></div>}
              {!editing && <DraftAttachmentTray attachments={attachments} onRemove={(id) => setAttachments((items) => items.filter((item) => item.id !== id))}/>}
              <form onSubmit={send} className="flex items-end gap-2 rounded-2xl border border-gray-700 bg-[#0B1120] p-2 focus-within:border-[#00DF73]/70">
                {!editing && <button type="button" onClick={() => setAttachmentOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-gray-400 hover:bg-[#141C2F] hover:text-[#00DF73]" title="Attach file"><Icon name="paperclip"/></button>}
                <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder={editing ? "Edit message" : replyTo ? "Write a reply" : `Message #${channelName}`} className="min-h-10 max-h-32 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-white outline-none placeholder:text-gray-600"/>
                <button type="button" onClick={() => setText((value) => `${value}${value ? " " : ""}🙂`)} className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl text-gray-400 hover:bg-[#141C2F] hover:text-[#00DF73] sm:grid" title="Add emoji"><Icon name="smile"/></button>
                <button disabled={sending || (!text.trim() && (Boolean(editing) || attachments.length === 0))} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#00DF73] text-[#0B1120] hover:bg-[#00c968] disabled:bg-gray-800 disabled:text-gray-600"><Icon name={editing ? "check" : "send"} size={16}/></button>
              </form>
              <p className="mt-2 text-[10px] text-gray-600">Enter sends · Shift+Enter adds a line · Photos appear directly in the conversation · @name or @department sends mentions</p>
            </div>
          </footer>
        </section>
      </div>

      <AttachmentComposer open={attachmentOpen} onClose={() => setAttachmentOpen(false)} onAttach={(item) => setAttachments((items) => [...items, item])}/>
      {showCreate && <CreateChannelModal name={newChannelName} description={newChannelDescription} setName={setNewChannelName} setDescription={setNewChannelDescription} saving={creatingChannel} error={createError} onClose={() => { setShowCreate(false); setCreateError(""); }} onSubmit={createChannel}/>}
      {toast && <div className="fixed bottom-5 right-5 z-[220] rounded-xl border border-gray-700 bg-[#141C2F] px-4 py-3 text-sm font-semibold text-white shadow-2xl"><span className="mr-2 text-[#00DF73]">●</span>{toast}</div>}
    </main>
  );
}

function ChannelPost({ message, mine, onReply, onEdit, onDelete, onReact }: { message: ChannelMessage; mine: boolean; onReply: () => void; onEdit: () => void; onDelete: () => void; onReact: (emoji: string) => void }) {
  const deleted = Boolean(message.deleted_at);
  const hasMedia = !deleted && Boolean(message.attachments?.some((item) => item.kind === "image" || item.kind === "video"));
  return <article className={`group flex gap-2 py-1.5 ${mine ? "justify-end" : "justify-start"}`}>
    {!mine && <Avatar name={message.sender_name}/>}<div className={`max-w-[88%] sm:max-w-[76%] ${mine ? "items-end" : "items-start"}`}>
      <div className={`relative rounded-2xl border px-3 py-2.5 shadow-sm ${mine ? "rounded-br-md border-[#00DF73]/20 bg-[#123226]" : "rounded-bl-md border-gray-800 bg-[#141C2F]"}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2"><strong className={`text-[11px] ${mine ? "text-[#83f4bb]" : "text-[#00DF73]"}`}>{mine ? "You" : message.sender_name || "Zibuke user"}</strong><span className="text-[9px] text-gray-600">{timeOnly(message.created_at)}{message.edited_at && !deleted ? " · Edited" : ""}</span></div>
        {message.reply_to_id && <div className="mb-2 rounded-lg border-l-2 border-[#00DF73]/60 bg-[#0B1120]/65 px-3 py-2 text-[10px] text-gray-500"><strong className="text-gray-300">{message.reply_sender_name || "Reply"}</strong><span className="ml-2 line-clamp-1">{message.reply_deleted_at ? "Message deleted" : message.reply_content || "Original message"}</span></div>}
        {deleted ? <em className="text-xs text-gray-500">Message deleted</em> : <>{message.content && <RichMessageText content={message.content}/>}<AttachmentGallery attachments={message.attachments}/></>}
        {mine && !deleted && <span className="mt-1 block text-right text-[9px] text-[#7bdcac]/60">✓ Sent</span>}
      </div>
      {!deleted && <div className={`mt-1 flex flex-wrap items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}><ReactionStrip reactions={message.reactions} onReact={onReact}/><div className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"><button onClick={onReply} className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-800 bg-[#0B1120] px-2 text-[10px] font-semibold text-gray-500 hover:text-[#00DF73]"><Icon name="reply" size={12}/> Reply</button>{mine && Boolean(message.content?.trim()) && <button onClick={onEdit} className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-800 bg-[#0B1120] px-2 text-[10px] font-semibold text-gray-500 hover:text-[#00DF73]"><Icon name="edit" size={12}/> Edit</button>}{mine && <button onClick={onDelete} className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-800 bg-[#0B1120] px-2 text-[10px] font-semibold text-gray-500 hover:text-red-400"><Icon name="trash" size={12}/> Delete</button>}<QuickReactionPicker onReact={onReact} minimal/></div>{hasMedia && <span className="hidden text-[9px] text-gray-700 sm:inline">Media</span>}</div>}
    </div>
  </article>;
}

function MeetingChannelCard({ message, onOpenCalendar, onJoin, onReact }: { message: ChannelMessage; onOpenCalendar: () => void; onJoin: () => void; onReact: (emoji: string) => void }) {
  const meta = message.metadata || {};
  const cancelled = message.message_type === "meeting_cancelled" || meta.cancelled;
  const now = useNow();
  const past = meta.endTime ? new Date(meta.endTime).getTime() < now : false;
  const typeLabel = meta.eventType === "huddle" ? "Huddle" : meta.eventType === "event" ? "Event" : "Meeting";
  return <article className="mx-auto my-4 max-w-3xl rounded-2xl border border-gray-800 bg-[#141C2F] p-4 shadow-xl shadow-black/10"><div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${cancelled ? "bg-red-500/10 text-red-300" : "bg-[#00DF73]/10 text-[#00DF73]"}`}><Icon name={cancelled ? "x" : "calendar"}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${cancelled ? "bg-red-500/10 text-red-300" : "bg-[#00DF73]/10 text-[#00DF73]"}`}>{cancelled ? "Cancelled" : `${typeLabel} in this channel`}</span><span className="text-[10px] text-gray-600">scheduled by {message.sender_name || meta.organizerName || "Zibuke user"}</span></div><h3 className="mt-2 text-base font-bold text-white">{meta.title || "Channel session"}</h3>{meta.startTime && <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400"><span className="inline-flex items-center gap-1.5"><Icon name="calendar" size={13}/>{new Date(meta.startTime).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</span><span className="inline-flex items-center gap-1.5"><Icon name="clock" size={13}/>{new Date(meta.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{meta.endTime ? `–${new Date(meta.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span></p>}{meta.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{meta.description}</p>}<div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={onOpenCalendar} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-700 px-3 text-[10px] font-semibold text-gray-300 hover:bg-[#0B1120]"><Icon name="calendar" size={13}/> Calendar</button>{!cancelled && !past && meta.online !== false && meta.eventType !== "event" && <button onClick={onJoin} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#00DF73] px-3 text-[10px] font-bold text-[#0B1120]"><Icon name="video" size={13}/> Join meeting</button>}<ReactionStrip reactions={message.reactions} onReact={onReact} showPicker/></div></div></div></article>;
}

function ChannelIntro({ channelName, description }: { channelName: string; description?: string }) { return <div className="mb-6 flex items-start gap-4 rounded-2xl border border-gray-800/80 bg-[#141C2F]/55 p-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#00DF73]/10 text-[#00DF73]"><Icon name="hash" size={22}/></span><div><h2 className="text-lg font-bold">#{channelName}</h2><p className="mt-1 text-xs leading-5 text-gray-500">{description || "A shared company conversation."} Messages, decisions, meetings and shared media stay together here.</p></div></div>; }
function DateDivider({ value }: { value: string }) { const now=useNow(); const date = new Date(value); const today = new Date(now); const yesterday = new Date(now - 86400000); const key = dayKey(value); const label = key === dayKey(today.toISOString()) ? "Today" : key === dayKey(yesterday.toISOString()) ? "Yesterday" : date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); return <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-gray-800"/><span className="rounded-full border border-gray-800 bg-[#10192A] px-3 py-1 text-[9px] font-semibold text-gray-500">{label}</span><div className="h-px flex-1 bg-gray-800"/></div>; }
function Avatar({ name }: { name?: string }) { const initials = initialsFor(name || "Zibuke user"); return <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gray-700 bg-[#141C2F] text-[10px] font-bold text-[#00DF73] shadow-sm">{initials}</span>; }
function AvatarStack({ names }: { names: string[] }) { if (!names.length) return null; return <span className="flex -space-x-1.5">{names.slice(0, 3).map((name) => <span key={name} title={name} className="grid h-5 w-5 place-items-center rounded-full border border-[#141C2F] bg-[#0B1120] text-[7px] font-bold text-[#00DF73]">{initialsFor(name)}</span>)}</span>; }
function CreateChannelModal({ name, description, setName, setDescription, saving, error, onClose, onSubmit }: { name: string; description: string; setName: (v: string) => void; setDescription: (v: string) => void; saving: boolean; error: string; onClose: () => void; onSubmit: (event: React.FormEvent) => void }) { return <div className="fixed inset-0 z-[230] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={onClose}><form onSubmit={onSubmit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-gray-700 bg-[#141C2F] p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">New team space</p><h2 className="mt-1 text-xl font-bold">Create channel</h2><p className="mt-1 text-xs text-gray-500">Any authenticated worker or administrator can create a collaboration channel.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-[#0B1120] hover:text-white"><Icon name="x"/></button></div>{error && <div className="mt-4 rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-xs text-red-400">{error}</div>}<div className="mt-5 space-y-4"><label className="block"><span className="text-xs font-semibold text-gray-300">Channel name</span><div className="mt-1 flex h-11 items-center rounded-xl border border-gray-700 bg-[#0B1120] px-3 focus-within:border-[#00DF73]"><span className="text-gray-500">#</span><input autoFocus value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} className="min-w-0 flex-1 bg-transparent px-1 text-sm text-white outline-none" placeholder="new-project" required maxLength={48}/></div></label><label className="block"><span className="text-xs font-semibold text-gray-300">Description</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={240} className="mt-1 w-full resize-none rounded-xl border border-gray-700 bg-[#0B1120] p-3 text-sm text-white outline-none focus:border-[#00DF73]" placeholder="What is this channel for?"/></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-[#0B1120]">Cancel</button><button disabled={saving || !name.trim()} className="rounded-xl bg-[#00DF73] px-4 py-2.5 text-sm font-bold text-[#0B1120] hover:bg-[#00c968] disabled:opacity-50">{saving ? "Creating…" : "Create channel"}</button></div></form></div>; }
function timeOnly(value: string) { return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function dayKey(value: string) { const d = new Date(value); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function initialsFor(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ZU"; }
function relativeTime(value: string) { const time = new Date(value).getTime(); const diff = Math.max(0, Date.now() - time); const minutes = Math.floor(diff / 60000); if (minutes < 1) return "Now"; if (minutes < 60) return `${minutes}m`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h`; const days = Math.floor(hours / 24); return `${days}d`; }