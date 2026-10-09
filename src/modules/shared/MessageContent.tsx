"use client";

import { Icon } from "./Icons";
import MessageSummary from "./MessageSummary";
import type { MessageAttachment, ReactionSummary } from "./types";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "✅", "👀"];

export function RichMessageText({ content, accent = true }: { content: string; accent?: boolean }) {
  const tokens = content.split(/(https?:\/\/[^\s]+|@[A-Za-z0-9._-]+)/g);
  return (
    <>
    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
      {tokens.map((token, index) => {
        if (/^https?:\/\//i.test(token)) {
          return <a key={index} href={token} target="_blank" rel="noreferrer" className={accent ? "text-[#00DF73] underline underline-offset-2" : "underline underline-offset-2"}>{token}</a>;
        }
        if (/^@[A-Za-z0-9._-]+$/.test(token)) {
          return <span key={index} className="rounded bg-[#00DF73]/12 px-1 py-0.5 font-semibold text-[#00DF73]">{token}</span>;
        }
        return token;
      })}
    </p>
    <MessageSummary key={content} content={content} />
    </>
  );
}

export function AttachmentGallery({ attachments, compact = false }: { attachments?: MessageAttachment[]; compact?: boolean }) {
  if (!attachments?.length) return null;
  const images = attachments.filter((item) => item.kind === "image");
  const others = attachments.filter((item) => item.kind !== "image");

  return (
    <div className="mt-3 space-y-2">
      {images.length > 0 && (
        <div className={`grid gap-2 ${images.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
          {images.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="group/media relative block overflow-hidden rounded-xl border border-gray-800 bg-[#0B1120]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.filename} loading="lazy" className={`${compact ? "max-h-56" : "max-h-80"} w-full object-cover transition duration-200 group-hover/media:scale-[1.01]`} />
              <span className="absolute bottom-2 left-2 max-w-[85%] truncate rounded-md bg-black/65 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">{item.filename}</span>
            </a>
          ))}
        </div>
      )}

      {others.map((item) => {
        if (item.kind === "video") {
          return <div key={item.id} className="overflow-hidden rounded-xl border border-gray-800 bg-[#0B1120]"><video controls preload="metadata" className="max-h-80 w-full bg-black" src={item.url}/><div className="px-3 py-2 text-[11px] text-gray-400">{item.filename}</div></div>;
        }
        if (item.kind === "audio") {
          return <div key={item.id} className="rounded-xl border border-gray-800 bg-[#0B1120] p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-300"><Icon name="audio" size={15} className="text-[#00DF73]"/><span className="truncate">{item.filename}</span></div><audio controls preload="metadata" className="h-9 w-full" src={item.url}/></div>;
        }
        if (item.kind === "link") {
          return <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0B1120] p-3 transition hover:border-[#00DF73]/50"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#00DF73]/10 text-[#00DF73]"><Icon name="link" size={16}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{item.filename}</strong><small className="block truncate text-[10px] text-gray-500">{item.url}</small></span><Icon name="external" size={14} className="text-gray-600"/></a>;
        }
        return <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0B1120] p-3 transition hover:border-[#00DF73]/50"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#00DF73]/10 text-[#00DF73]"><Icon name="file" size={16}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{item.filename}</strong><small className="text-[10px] text-gray-500">{formatBytes(item.size_bytes || 0)}</small></span><span className="text-[10px] font-bold text-[#00DF73]">Open</span></a>;
      })}
    </div>
  );
}

export function ReactionStrip({ reactions = [], onReact, showPicker = false }: { reactions?: ReactionSummary[]; onReact: (emoji: string) => void; showPicker?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {reactions.map((reaction) => (
        <button key={reaction.emoji} type="button" onClick={() => onReact(reaction.emoji)} className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] transition ${reaction.reactedByMe ? "border-[#00DF73]/50 bg-[#00DF73]/10 text-white" : "border-gray-800 bg-[#0B1120] text-gray-400 hover:border-gray-700 hover:text-white"}`} title={reaction.reactedByMe ? "Remove reaction" : "React"}>
          <span>{reaction.emoji}</span><span className="font-semibold">{reaction.count}</span>
        </button>
      ))}
      {showPicker && <QuickReactionPicker onReact={onReact} />}
    </div>
  );
}

export function QuickReactionPicker({ onReact, minimal = false }: { onReact: (emoji: string) => void; minimal?: boolean }) {
  return (
    <div className={`flex items-center gap-0.5 rounded-full border border-gray-800 bg-[#0B1120] ${minimal ? "p-0.5" : "p-1"}`}>
      {QUICK_REACTIONS.map((emoji) => <button key={emoji} type="button" onClick={() => onReact(emoji)} className={`${minimal ? "h-6 w-6 text-xs" : "h-7 w-7 text-sm"} grid place-items-center rounded-full transition hover:bg-[#141C2F] hover:scale-110`} title={`React ${emoji}`}>{emoji}</button>)}
    </div>
  );
}

function formatBytes(bytes: number) {
  if (!bytes) return "File";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}
