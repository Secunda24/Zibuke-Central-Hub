"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

type Source = { title: string; url: string; checkedAt: string };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[] };
const suggestions = ["What does Zibuke Africa do?", "How do I call a colleague?", "What services does Zibuke OnCall offer?"];
function safeSource(url: string) {
  if (/^\/dashboard(?:\/[a-z-]+)*$/.test(url)) return true;
  try { const u = new URL(url); return u.protocol === "https:" && !u.username && !u.password && !u.port && ["zibukeafrica.com", "www.zibukeafrica.com", "zibukeoncall.co.za", "www.zibukeoncall.co.za"].includes(u.hostname); } catch { return false; }
}

export default function AiAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isLoading, error, isOpen]);

  function close() { setIsOpen(false); toggleRef.current?.focus(); }
  function clear() {
    requestRef.current?.abort(); requestRef.current = null;
    setMessages([]); setInput(""); setError(""); setLastQuestion(""); setIsLoading(false); inputRef.current?.focus();
  }
  async function sendMessage(question = input, retry = false) {
    const text = question.trim();
    if (!text || text.length > 2000 || requestRef.current) return;
    const history = retry ? messages.slice(0,-1) : messages;
    const nextMessages: Message[] = [...history, { role: "user", content: text }];
    const controller = new AbortController(); requestRef.current = controller;
    setMessages(nextMessages); setInput(""); setIsLoading(true); setError(""); setLastQuestion(text);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ message: text, chatHistory: history.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0,6000) })), currentPath: pathname }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "I couldn't answer just now. Please retry.");
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("No answer was returned. Please retry.");
      if (controller.signal.aborted) return;
      const sources: Source[] = Array.isArray(data.sources) ? data.sources.filter((s: Source) => s && typeof s.title === "string" && typeof s.url === "string" && safeSource(s.url)) : [];
      setMessages([...nextMessages, { role: "assistant", content: data.reply, sources }]);
      if (typeof data.knowledgeUpdatedAt === "string") setCheckedAt(data.knowledgeUpdatedAt);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Connection failed. Please retry.");
    } finally {
      if (!controller.signal.aborted) { requestRef.current = null; setIsLoading(false); inputRef.current?.focus(); }
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[300] font-sans sm:bottom-6 sm:right-6">
      {isOpen && (
        <section id="zibuke-ai-chat" role="dialog" aria-labelledby="zibuke-ai-title" onKeyDown={event => { if (event.key === "Escape") close(); }}
          className="mb-3 flex h-[min(620px,calc(100dvh-112px))] w-[calc(100vw-2rem)] max-w-[410px] flex-col overflow-hidden rounded-2xl border border-[#00DF73]/25 bg-[#0B1120] text-white shadow-2xl shadow-black/40">
          <header className="flex shrink-0 items-center gap-3 border-b border-gray-800 bg-[#141C2F] p-4">
            <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-[#00DF73]/15 text-xs font-bold text-[#00DF73]">AI</span>
            <div className="min-w-0 flex-1"><h2 id="zibuke-ai-title" className="text-sm font-bold">Zibuke AI Bot</h2><p className="text-[11px] text-gray-400">Your company &amp; platform guide</p></div>
            <button type="button" onClick={clear} title="Start a new conversation" className="rounded-lg px-2 py-1 text-xs text-gray-300 hover:bg-gray-800">New chat</button>
            <button type="button" onClick={close} aria-label="Close Zibuke AI" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-800"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M6 18 18-12" /></svg></button>
          </header>
          <div ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
            {!messages.length && <div className="py-3"><h3 className="text-lg font-semibold">Hi, welcome to Zibuke!</h3><p className="mt-2 text-sm leading-6 text-gray-300">Ask me about our companies or how to get things done in Zibuke Central. What can I help you with?</p><div className="mt-5 space-y-2">{suggestions.map(question => <button key={question} onClick={() => void sendMessage(question)} className="block w-full rounded-xl border border-gray-700 bg-[#141C2F] px-3 py-3 text-left text-xs text-gray-200 transition hover:border-[#00DF73]/60">{question}</button>)}</div><p className="mt-4 text-[11px] leading-5 text-gray-500">Answers use our company websites and platform help. I do not read your private messages or files.</p></div>}
            {messages.map((message, index) => <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[#00DF73] text-[#0B1120]" : "border border-gray-800 bg-[#141C2F] text-gray-200"}`}>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              {!!message.sources?.length && <div className="mt-3 border-t border-gray-700 pt-2"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Sources</p>{message.sources.map(source => <Link key={source.url} href={source.url} target={source.url.startsWith("https:") ? "_blank" : undefined} rel={source.url.startsWith("https:") ? "noopener noreferrer" : undefined} className="block break-words py-1 text-xs text-[#00DF73] underline underline-offset-2">{source.title}</Link>)}</div>}
            </div></div>)}
            {isLoading && <p role="status" className="animate-pulse text-xs text-gray-400">Checking the reference library...</p>}
            {error && <div role="alert" className="rounded-xl border border-red-900 bg-red-950/30 p-3 text-xs text-red-200"><p>{error}</p><button onClick={() => void sendMessage(lastQuestion, true)} className="mt-2 font-semibold underline">Try again</button></div>}
          </div>
          <form onSubmit={event => { event.preventDefault(); void sendMessage(); }} className="shrink-0 border-t border-gray-800 bg-[#141C2F] p-3">
            <div className="flex items-end gap-2"><label htmlFor="zibuke-ai-question" className="sr-only">Your question for Zibuke AI</label><textarea id="zibuke-ai-question" ref={inputRef} value={input} maxLength={2000} rows={2} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); } }} placeholder="Ask about Zibuke or the platform..." className="min-w-0 flex-1 resize-none rounded-xl border border-gray-700 bg-[#0B1120] px-3 py-2 text-sm text-white outline-none focus:border-[#00DF73]" /><button type="submit" disabled={isLoading || !input.trim()} className="h-10 rounded-xl bg-[#00DF73] px-3 text-xs font-bold text-[#0B1120] hover:bg-[#00c968] disabled:opacity-40">Send</button></div>
            <p className="mt-2 text-center text-[10px] text-gray-500">AI can make mistakes. Check the linked sources.{checkedAt && !Number.isNaN(Date.parse(checkedAt)) ? ` Updated ${new Date(checkedAt).toLocaleDateString()}.` : ""}</p>
          </form>
        </section>
      )}
      <div className="flex justify-end"><button ref={toggleRef} type="button" onClick={() => isOpen ? close() : setIsOpen(true)} aria-expanded={isOpen} aria-controls="zibuke-ai-chat" aria-label={isOpen ? "Close Zibuke AI" : "Ask Zibuke AI"} className="flex h-12 items-center gap-2 rounded-full bg-[#00DF73] px-4 text-[#0B1120] shadow-lg transition hover:bg-[#00c968] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00DF73]"><svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 5v-5Z" /></svg><span className="text-sm font-bold">Zibuke AI</span></button></div>
    </div>
  );
}
