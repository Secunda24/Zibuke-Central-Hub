"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AttachmentComposer, DraftAttachmentTray } from "@/src/modules/shared/AttachmentComposer";
import { AttachmentGallery, QuickReactionPicker, ReactionStrip, RichMessageText } from "@/src/modules/shared/MessageContent";
import { Icon } from "@/src/modules/shared/Icons";
import type { DraftAttachment, MessageAttachment, ReactionSummary } from "@/src/modules/shared/types";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name?: string;
  content: string;
  created_at: string;
  reply_to_id?: string | null;
  reply_content?: string | null;
  reply_sender_name?: string | null;
  reply_deleted_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  is_deleted?: number;
  attachments?: MessageAttachment[];
  reactions?: ReactionSummary[];
};

type Person = { id: string; first_name?: string; last_name?: string; name?: string; department?: string };

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const receiverId = decodeURIComponent(params.userId as string);
  const { user } = useCurrentUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (receiverId.startsWith("dept_")) {
      router.replace("/dashboard/messages");
      return;
    }
    void loadConversation();
    const interval = window.setInterval(loadConversation, 4000);
    return () => window.clearInterval(interval);
  }, [receiverId]);

  useEffect(() => {
    if (!query) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, query]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadConversation() {
    try {
      const [messageResponse, peopleResponse] = await Promise.all([
        fetch(`/api/messages?chatWith=${encodeURIComponent(receiverId)}&t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/messages?t=${Date.now()}`, { cache: "no-store" }),
      ]);
      const messageData = await messageResponse.json();
      const peopleData = await peopleResponse.json();
      if (messageResponse.ok && messageData.messages) setMessages(messageData.messages);
      const found = (peopleData.users || []).find((candidate: Person) => candidate.id === receiverId);
      if (found) setPerson(found);
    } catch {
      // Keep the conversation surface available if one refresh fails.
    } finally {
      setLoading(false);
    }
  }

  const visibleMessages = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((message) => !q || `${message.content} ${(message.attachments || []).map((item) => item.filename).join(" ")}`.toLowerCase().includes(q));
  }, [messages, query]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const clean = text.trim();

    if (editing) {
      if (!clean) return;
      setSending(true);
      try {
        const response = await fetch(`/api/messages/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: clean }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setToast(data.error || "Message could not be edited.");
          return;
        }
        setText("");
        setEditing(null);
        await loadConversation();
        setToast("Message edited.");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!clean && attachments.length === 0) return;
    setSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId,
          content: clean,
          replyToId: replyTo?.id || null,
          attachments,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast(data.error || "Message could not be sent.");
        return;
      }
      setText("");
      setAttachments([]);
      setReplyTo(null);
      await loadConversation();
    } finally {
      setSending(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    const response = await fetch("/api/reactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: "direct", targetId: messageId, emoji }),
    });
    if (response.ok) await loadConversation();
  }

  function beginReply(message: Message) {
    if (message.deleted_at || message.is_deleted === 1) return;
    setEditing(null);
    setReplyTo(message);
    setText("");
  }

  function beginEdit(message: Message) {
    if (message.deleted_at || message.is_deleted === 1) return;
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

  async function deleteMessage(message: Message) {
    if (!window.confirm("Delete this message? It will remain in the conversation as ‘Message deleted’.")) return;
    
    // CHANGED: Use PATCH instead of DELETE to hit the soft-delete route
    const response = await fetch(`/api/messages/${message.id}`, { 
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" }) 
    });
    
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setToast(data.error || "Message could not be deleted.");
      return;
    }
    if (editing?.id === message.id) cancelComposerMode();
    await loadConversation();
    setToast("Message deleted.");
  }

  const title = person ? displayName(person) : "Direct message";

  return (
    <main className="h-[calc(100vh-64px)] bg-[#0B1120] p-4 text-white sm:p-6">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-xl border border-gray-800 bg-[#141C2F] shadow-sm">
        <header className="flex items-center justify-between gap-4 border-b border-gray-800 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard/messages" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gray-700 text-gray-400 hover:bg-[#0B1120] hover:text-white"><Icon name="chevronLeft" /></Link>
            <Avatar name={title} />
            <div className="min-w-0"><h1 className="truncate text-base font-bold text-white">{title}</h1><p className="truncate text-xs text-gray-500">{person?.department || "Private conversation"}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen((value) => !value)} className={`grid h-9 w-9 place-items-center rounded-lg border border-gray-700 ${searchOpen ? "bg-[#00DF73] text-[#0B1120]" : "text-gray-400 hover:bg-[#0B1120] hover:text-[#00DF73]"}`} aria-label="Search conversation"><Icon name="search" size={17} /></button>
            <Link href={`/dashboard/call?with=${encodeURIComponent(title)}&withId=${encodeURIComponent(receiverId)}`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#00DF73] px-3 text-xs font-bold text-[#0B1120] hover:bg-[#00c968]"><Icon name="video" size={16} /> Meet</Link>
          </div>
        </header>

        {searchOpen && <div className="border-b border-gray-800 bg-[#0B1120]/50 p-3"><label className="mx-auto flex h-10 max-w-2xl items-center gap-2 rounded-lg border border-gray-700 bg-[#0B1120] px-3 focus-within:border-[#00DF73]"><Icon name="search" size={16} className="text-gray-500" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search conversation with ${title}`} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600" />{query && <button onClick={() => setQuery("")} className="text-gray-500 hover:text-white"><Icon name="x" size={14} /></button>}</label></div>}

        <div className="flex-1 overflow-y-auto bg-[#0B1120]/35 p-4 sm:p-6">
          {loading ? (
            <div className="mt-12 text-center text-sm text-gray-500">Loading conversation…</div>
          ) : visibleMessages.length === 0 ? (
            <EmptyState search={Boolean(query)} />
          ) : (
            <div className="mx-auto max-w-4xl space-y-2">
              {visibleMessages.map((message) => {
                const mine = user?.id === message.sender_id;
                // CHANGED: Verify is_deleted flag from database
                const deleted = Boolean(message.deleted_at) || message.is_deleted === 1 || message.content === '[This message was deleted]';
                
                return (
                  <div key={message.id} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[86%] sm:max-w-[74%] ${mine ? "items-end" : "items-start"}`}>
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${mine ? "rounded-br-md bg-[#00DF73] text-[#07130d]" : "rounded-bl-md border border-gray-800 bg-[#141C2F] text-gray-200"}`}>
                        {message.reply_to_id && (
                          <div className={`mb-2 rounded-lg border-l-2 px-3 py-2 text-[10px] ${mine ? "border-[#07130d]/30 bg-[#07130d]/10 text-[#07130d]/70" : "border-[#00DF73]/60 bg-[#0B1120]/65 text-gray-500"}`}>
                            <strong className={mine ? "text-[#07130d]" : "text-gray-300"}>{message.reply_sender_name || "Reply"}</strong>
                            <span className="ml-2 line-clamp-1">{message.reply_deleted_at ? "Message deleted" : message.reply_content || "Original message"}</span>
                          </div>
                        )}
                        {deleted ? <em className={mine ? "text-[#07130d]/60" : "text-gray-500"}>Message deleted</em> : <>{message.content && <RichMessageText content={message.content} accent={!mine} />}<AttachmentGallery attachments={message.attachments} compact /></>}
                        <span className={`mt-1 block text-[9px] ${mine ? "text-[#0B1120]/55" : "text-gray-600"}`}>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{message.edited_at && !deleted ? " · Edited" : ""}</span>
                      </div>

                      {!deleted && (
                        <div className={`mt-1 flex flex-wrap items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                          <ReactionStrip reactions={message.reactions} onReact={(emoji) => void react(message.id, emoji)} />
                          <div className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                            <button onClick={() => beginReply(message)} className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-800 bg-[#0B1120] px-2 text-[10px] font-semibold text-gray-500 hover:text-[#00DF73]"><Icon name="reply" size={12} /> Reply</button>
                            {mine && Boolean(message.content?.trim()) && <button onClick={() => beginEdit(message)} className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-800 bg-[#0B1120] px-2 text-[10px] font-semibold text-gray-500 hover:text-[#00DF73]"><Icon name="edit" size={12} /> Edit</button>}
                            {mine && <button onClick={() => void deleteMessage(message)} className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-800 bg-[#0B1120] px-2 text-[10px] font-semibold text-gray-500 hover:text-red-400"><Icon name="trash" size={12} /> Delete</button>}
                            <QuickReactionPicker onReact={(emoji) => void react(message.id, emoji)} minimal />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <footer className="border-t border-gray-800 bg-[#141C2F] p-3 sm:p-4">
          <div className="mx-auto max-w-4xl">
            {replyTo && !editing && <ComposerContext tone="reply" label={`Replying to ${replyTo.sender_name || title}`} text={replyTo.content} onClose={cancelComposerMode} />}
            {editing && <ComposerContext tone="edit" label="Editing your message" text={editing.content} onClose={cancelComposerMode} />}
            {!editing && <DraftAttachmentTray attachments={attachments} onRemove={(id) => setAttachments((items) => items.filter((item) => item.id !== id))} />}
            <form onSubmit={sendMessage} className="flex items-end gap-2">
              {!editing && <button type="button" onClick={() => setAttachmentOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-gray-700 text-gray-400 transition hover:bg-[#0B1120] hover:text-[#00DF73]" aria-label="Attach file"><Icon name="paperclip" /></button>}
              <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder={editing ? "Edit message" : replyTo ? "Write a reply" : `Message ${title}`} className="min-h-11 max-h-32 flex-1 resize-none rounded-xl border border-gray-700 bg-[#0B1120] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#00DF73]" />
              <button type="button" onClick={() => setText((value) => `${value}${value ? " " : ""}🙂`)} className="hidden h-11 w-11 shrink-0 place-items-center rounded-lg border border-gray-700 text-gray-400 hover:bg-[#0B1120] hover:text-[#00DF73] sm:grid" aria-label="Add emoji"><Icon name="smile" /></button>
              <button disabled={sending || (!text.trim() && (Boolean(editing) || attachments.length === 0))} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#00DF73] text-[#0B1120] hover:bg-[#00c968] disabled:bg-gray-800 disabled:text-gray-600" aria-label={editing ? "Save edit" : "Send"}><Icon name={editing ? "check" : "send"} size={17} /></button>
            </form>
            <p className="mt-2 text-[10px] text-gray-600">Reply to any message. You can edit or delete messages that you sent. Photos appear inline instead of as file links.</p>
          </div>
        </footer>
      </div>
      <AttachmentComposer open={attachmentOpen} onClose={() => setAttachmentOpen(false)} onAttach={(item) => setAttachments((items) => [...items, item])} />
      {toast && <div className="fixed bottom-5 right-5 z-[220] rounded-xl border border-gray-700 bg-[#141C2F] px-4 py-3 text-sm font-semibold text-white shadow-2xl"><span className="mr-2 text-[#00DF73]">●</span>{toast}</div>}
    </main>
  );
}

function ComposerContext({ tone, label, text, onClose }: { tone: "reply" | "edit"; label: string; text: string; onClose: () => void }) {
  return <div className={`mb-2 flex items-center justify-between rounded-xl border-l-2 bg-[#0B1120] px-3 py-2 text-xs text-gray-400 ${tone === "edit" ? "border-amber-400" : "border-[#00DF73]"}`}><span className="min-w-0 truncate"><strong className="text-gray-200">{label}</strong>{text ? `: ${text}` : ""}</span><button onClick={onClose} className="ml-2 shrink-0 text-gray-500 hover:text-white"><Icon name="x" size={14} /></button></div>;
}

function EmptyState({ search }: { search: boolean }) { return <div className="mt-16 text-center"><Icon name={search ? "search" : "chat"} size={34} className="mx-auto text-gray-700" /><p className="mt-3 text-sm font-semibold text-gray-400">{search ? "No matching messages." : "No messages yet."}</p><p className="mt-1 text-xs text-gray-600">{search ? "Try a different keyword." : "Send the first message to start the conversation."}</p></div>; }
function displayName(person: Person) { return person.name || [person.first_name, person.last_name].filter(Boolean).join(" ") || "Zibuke user"; }
function Avatar({ name }: { name: string }) { const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ZU"; return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gray-700 bg-[#0B1120] text-xs font-bold text-[#00DF73]">{initials}</span>; }