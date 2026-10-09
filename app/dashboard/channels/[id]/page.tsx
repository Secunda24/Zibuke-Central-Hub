"use client";

import { useState, useEffect, FormEvent, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type ChannelMessage = {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  edited_at?: string;
  is_deleted?: number;
  reply_to_id?: string;
};

type ChannelData = {
  name: string;
  description: string;
};

// Added type for Mention User
type MentionUser = {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
};

export default function ChannelChatPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.id as string;

  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Mentions state
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [mentionState, setMentionState] = useState({ active: false, query: "", index: -1 });
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/settings/profile').then(res => res.json()).then(data => {
        if(data.user) setCurrentUser(data.user.id);
    }).catch(err => console.error(err));
    
    // Fetch users for mentions dropdown
    fetch('/api/people').then(res => res.json()).then(data => {
        if(data.people) setUsers(data.people);
    }).catch(err => console.error(err));
    
    fetchData();
    const interval = setInterval(fetchData, 3000); 
    return () => clearInterval(interval);
  }, [channelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`);
      if (!res.ok) {
        if (res.status === 404) router.push('/dashboard/channels');
        return;
      }
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
      if (data.channel) setChannel(data.channel);
    } catch (error) {
      console.error("Failed to load channel data", error);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNewMessage(val);

    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (match) {
      setMentionState({ active: true, query: match[1].toLowerCase(), index: match.index as number });
    } else {
      setMentionState({ active: false, query: "", index: -1 });
    }
  }

  function insertMention(user: MentionUser) {
    const name = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email.split('@')[0];
    const before = newMessage.slice(0, mentionState.index);
    const after = newMessage.slice(mentionState.index + mentionState.query.length + 1);
    
    setNewMessage(`${before}@${name} ${after}`);
    setMentionState({ active: false, query: "", index: -1 });
    
    if (!mentionedUserIds.includes(user.id)) {
      setMentionedUserIds([...mentionedUserIds, user.id]);
    }
    
    inputRef.current?.focus();
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Pass the mentionedUserIds array to the backend
        body: JSON.stringify({ content: newMessage, mentionedUserIds })
      });

      if (res.ok) {
        setNewMessage("");
        setMentionedUserIds([]);
        setMentionState({ active: false, query: "", index: -1 });
        fetchData(); 
      }
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsSending(false);
    }
  }

  async function submitEdit(e: FormEvent, msgId: string) {
    e.preventDefault();
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`/api/channels/${channelId}/messages/${msgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent })
      });
      if (res.ok) {
        setEditingMessageId(null);
        fetchData();
      }
    } catch (error) {
      console.error("Failed to edit message", error);
    }
  }

  async function deleteMessage(msgId: string) {
    if (!confirm("Are you sure you want to delete this message?")) return;
    try {
      const res = await fetch(`/api/channels/${channelId}/messages/${msgId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Failed to delete message", error);
    }
  }

  const filteredUsers = users.filter(u => {
    const name = u.first_name ? `${u.first_name} ${u.last_name || ''}`.toLowerCase() : u.email.toLowerCase();
    return name.includes(mentionState.query);
  });

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-5xl h-[calc(100vh-120px)] flex flex-col">
        
        <header className="mb-6 flex-shrink-0 flex items-center justify-between">
          <div>
            <Link href="/dashboard/channels" className="text-sm font-semibold text-[#00DF73] hover:underline flex items-center gap-1 mb-2">
              &larr; Back to Channels
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              #{channel?.name || "Loading..."}
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {channel?.description || "Joining channel..."}
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-800 bg-[#141C2F] shadow-sm">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-gray-500">No messages in this channel yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUser;
                const isDeleted = msg.is_deleted === 1;
                
                return (
                  <div key={msg.id} className={`group flex flex-col mb-4 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1 px-1">
                      <span className="font-bold text-gray-300 text-sm">{msg.sender_name}</span>
                      <span className="text-[10px] text-gray-600">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && !isDeleted && (
                        <div className="hidden group-hover:flex items-center gap-2 ml-2">
                          <button onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }} className="text-[10px] font-semibold text-gray-500 hover:text-blue-400 transition">Edit</button>
                          <button onClick={() => deleteMessage(msg.id)} className="text-[10px] font-semibold text-gray-500 hover:text-red-400 transition">Delete</button>
                        </div>
                      )}
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm w-fit max-w-[80%] ${
                      isDeleted
                        ? 'bg-transparent border border-gray-800 text-gray-500 italic'
                        : isMe 
                          ? 'bg-[#00DF73] text-[#0B1120] rounded-tr-none' 
                          : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none'
                    }`}>
                      {isDeleted ? (
                        <p className="text-sm opacity-80">This message was deleted</p>
                      ) : editingMessageId === msg.id ? (
                        <form onSubmit={(e) => submitEdit(e, msg.id)} className="flex flex-col gap-2 min-w-[200px]">
                          <input 
                            type="text" 
                            value={editContent} 
                            onChange={(e) => setEditContent(e.target.value)} 
                            className="text-sm rounded-lg border border-gray-600 bg-[#0B1120] text-white px-3 py-1.5 outline-none focus:border-[#00DF73]"
                            autoFocus
                          />
                          <div className="flex gap-3 text-[11px] justify-end">
                            <button type="button" onClick={() => setEditingMessageId(null)} className="font-semibold text-gray-600 hover:text-[#0B1120]">Cancel</button>
                            <button type="submit" className="font-bold text-[#0B1120] hover:underline">Save changes</button>
                          </div>
                        </form>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm font-medium">
                          {msg.content.split(/(@[a-zA-Z0-9_]+)/g).map((part, i) => 
                            part.startsWith('@') ? <span key={i} className={`font-bold ${isMe ? 'text-black' : 'text-[#00DF73]'}`}>{part}</span> : part
                          )}
                          {msg.edited_at && <span className="ml-2 text-[10px] opacity-60 font-normal">(edited)</span>}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="relative border-t border-gray-800 bg-[#141C2F] p-4">
            
            {/* Mentions Dropdown */}
            {mentionState.active && filteredUsers.length > 0 && (
              <div className="absolute bottom-full left-4 mb-2 w-64 max-h-48 overflow-y-auto rounded-xl border border-gray-700 bg-[#0B1120] p-1 shadow-2xl z-50">
                {filteredUsers.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => insertMention(u)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#141C2F] transition flex items-center gap-2"
                  >
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-[#00DF73] text-[10px] font-bold text-[#0B1120]">
                      {u.first_name ? u.first_name[0].toUpperCase() : u.email[0].toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-200 truncate">
                      {u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder={channel ? `Message #${channel.name}` : "Loading..."}
                className="flex-1 rounded-full border border-gray-700 bg-[#0B1120] px-4 py-2 text-sm text-white outline-none transition focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]"
                disabled={!channel}
              />
              <button
                type="submit"
                disabled={isSending || !newMessage.trim() || !channel}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00DF73] text-[#0B1120] transition hover:bg-[#00c968] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-1">
                  <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}