"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icons";
import type { DraftAttachment } from "./types";

const FILE_TYPES = [
  { type: "document" as const, label: "Document", hint: "PDF, Word, Excel, PowerPoint, CSV or TXT", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt", icon: "file" as const },
  { type: "image" as const, label: "Photo or image", hint: "PNG, JPG or WEBP", accept: ".png,.jpg,.jpeg,.webp", icon: "image" as const },
  { type: "video" as const, label: "Video", hint: "MP4, MOV or WEBM", accept: "video/mp4,video/quicktime,video/webm", icon: "video" as const },
  { type: "audio" as const, label: "Audio", hint: "MP3, WAV or M4A", accept: "audio/*", icon: "audio" as const },
];

type Mode = "choose" | "link";

export function AttachmentComposer({ open, onClose, onAttach, initialMode = "choose" }: {
  open: boolean;
  onClose: () => void;
  onAttach: (attachment: DraftAttachment) => void;
  initialMode?: Mode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedType = useRef<(typeof FILE_TYPES)[number]>(FILE_TYPES[0]);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [url, setUrl] = useState("https://");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function close() {
    setMode("choose");
    setUrl("https://");
    setLabel("");
    setError("");
    onClose();
  }

  function chooseFileType(item: (typeof FILE_TYPES)[number]) {
    selectedType.current = item;
    if (!fileRef.current) return;
    fileRef.current.accept = item.accept;
    fileRef.current.value = "";
    fileRef.current.click();
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (file.type === "image/gif" || file.name.toLowerCase().endsWith(".gif")) throw new Error("GIF files are not supported.");
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/attachments/upload", { method: "POST", body: form });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Could not upload ${file.name}`);
        onAttach({ ...data.attachment, previewUrl: URL.createObjectURL(file) });
      }
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function addExternal(event: React.FormEvent) {
    event.preventDefault();
    const clean = url.trim();
    if (!/^https?:\/\//i.test(clean)) {
      setError("Enter a complete http:// or https:// address.");
      return;
    }
    onAttach({
      id: crypto.randomUUID(),
      type: "link",
      name: label.trim() || clean.replace(/^https?:\/\//i, "").split("/")[0],
      url: clean,
      mimeType: "text/uri-list",
      size: "Web link",
      sizeBytes: 0,
    });
    close();
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/70 p-4" onMouseDown={close}>
      <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-[#141C2F] p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00DF73]">Add to message</p>
            <h2 className="mt-1 text-xl font-bold text-white">{mode === "link" ? "Add a link" : "Choose attachment"}</h2>
          </div>
          <button onClick={close} className="rounded-lg p-2 text-gray-400 hover:bg-[#0B1120] hover:text-white"><Icon name="x" /></button>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-xs text-red-400">{error}</div>}

        {mode === "choose" ? (
          <div className="mt-5 space-y-2">
            {FILE_TYPES.map((item) => (
              <button key={item.type} type="button" disabled={uploading} onClick={() => chooseFileType(item)} className="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-[#0B1120] p-3 text-left transition hover:border-[#00DF73]/60 disabled:opacity-50">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#00DF73]/10 text-[#00DF73]"><Icon name={item.icon} /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm text-white">{item.label}</strong><small className="text-xs text-gray-500">{item.hint}</small></span>
                <Icon name="chevronRight" size={16} className="text-gray-500" />
              </button>
            ))}
            <button type="button" onClick={() => setMode("link")} className="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-[#0B1120] p-3 text-left transition hover:border-[#00DF73]/60">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#00DF73]/10 text-[#00DF73]"><Icon name="link" /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm text-white">Link</strong><small className="text-xs text-gray-500">Website or shared resource URL</small></span>
              <Icon name="chevronRight" size={16} className="text-gray-500" />
            </button>
            {uploading && <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-[#00DF73]"/> Uploading securely…</div>}
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={addExternal}>
            <label className="block"><span className="text-xs font-semibold text-gray-300">URL</span><input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-sm text-white outline-none focus:border-[#00DF73]" placeholder="https://…"/></label>
            <label className="block"><span className="text-xs font-semibold text-gray-300">Display name <em className="font-normal text-gray-500">optional</em></span><input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-sm text-white outline-none focus:border-[#00DF73]" /></label>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setMode("choose")} className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-[#0B1120]">Back</button><button className="rounded-lg bg-[#00DF73] px-4 py-2 text-sm font-bold text-[#0B1120]">Add link</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

export function DraftAttachmentTray({ attachments, onRemove }: { attachments: DraftAttachment[]; onRemove: (id: string) => void }) {
  if (!attachments.length) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {attachments.map((item) => (
        <div key={item.id} className="flex max-w-xs items-center gap-2 rounded-xl border border-gray-700 bg-[#0B1120] p-2">
          {item.type === "image" && (item.previewUrl || item.url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.previewUrl || item.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#00DF73]/10 text-[#00DF73]"><Icon name={item.type === "video" ? "video" : item.type === "audio" ? "audio" : item.type === "link" ? "link" : "file"} size={15}/></span>}
          <span className="min-w-0"><strong className="block max-w-44 truncate text-xs text-white">{item.name}</strong><small className="text-[10px] text-gray-500">{item.size}</small></span>
          <button type="button" onClick={() => onRemove(item.id)} className="ml-1 text-gray-500 hover:text-white"><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function serializeAttachments(_attachments: DraftAttachment[]) {
  return "";
}
