"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/src/modules/shared/Icons";
import type { CurrentUser } from "@/src/modules/shared/types";

export type PreJoinSettings = { micOn: boolean; cameraOn: boolean; background: "none"; displayName: string };

export default function PreJoinLobby({ title, user, onJoin, onCancel }: { title: string; user: CurrentUser | null; onJoin: (settings: PreJoinSettings) => void; onCancel: () => void }) {
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [displayName, setDisplayName] = useState(user?.name || "Zibuke user");
  const [mediaError, setMediaError] = useState("");
  const [checkingMedia, setCheckingMedia] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshPreview() {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;

      if (!micOn && !cameraOn) {
        setCheckingMedia(false);
        setMediaError("");
        return;
      }

      setCheckingMedia(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: micOn, video: cameraOn });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current && cameraOn) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setMediaError("");
      } catch {
        if (!cancelled) setMediaError("Camera or microphone permission is blocked. You can still join, then enable devices after granting browser permission.");
      } finally {
        if (!cancelled) setCheckingMedia(false);
      }
    }

    void refreshPreview();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [micOn, cameraOn]);

  function join() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    onJoin({ micOn, cameraOn, background: "none", displayName: displayName.trim() || "Zibuke user" });
  }

  const initials = initialsFor(displayName);

  return (
    <div className="fixed inset-0 z-[250] overflow-y-auto bg-[#08101d] p-4 font-sans text-white sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg border border-gray-800 bg-[#141C2F] text-xs font-black text-[#00DF73]">ZC</span><div><strong className="block text-sm">Zibuke Central Meetings</strong><span className="text-xs text-gray-500">Pre-join lobby</span></div></div>
          <button onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-lg border border-gray-800 text-gray-400 hover:bg-[#141C2F] hover:text-white"><Icon name="x" /></button>
        </header>

        <div className="grid gap-6 py-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)] lg:items-center">
          <section>
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-gray-700 bg-gradient-to-br from-[#1b2940] to-[#0B1120]">
              {cameraOn && !mediaError ? <video ref={videoRef} muted playsInline className="h-full w-full object-cover [transform:scaleX(-1)]" /> : <div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-gray-700 bg-[#141C2F] text-3xl font-black text-[#00DF73]">{initials}</div><strong className="mt-4 block text-sm">{cameraOn ? "Camera preview unavailable" : "Camera is off"}</strong><span className="mt-1 block text-xs text-gray-500">{cameraOn ? "Check browser permission, or join with camera off." : "You can turn it on in the meeting."}</span></div></div>}
              {checkingMedia && <div className="absolute right-4 top-4 rounded-full border border-gray-700 bg-[#0B1120]/85 px-3 py-1.5 text-[10px] text-gray-400">Checking devices…</div>}
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-700 bg-[#0B1120]/85 p-2 shadow-xl backdrop-blur"><ControlButton active={!micOn} onClick={() => setMicOn((value) => !value)} icon={micOn ? "mic" : "micOff"} label={micOn ? "Mute" : "Unmute"} /><ControlButton active={!cameraOn} onClick={() => setCameraOn((value) => !value)} icon={cameraOn ? "video" : "videoOff"} label={cameraOn ? "Camera off" : "Camera on"} /></div>
            </div>
            {mediaError && <div className="mt-3 rounded-xl border border-amber-800/60 bg-amber-950/20 px-4 py-3 text-xs leading-5 text-amber-300">{mediaError}</div>}
            <p className="mt-3 text-xs leading-5 text-gray-500">This preview checks your browser camera and microphone permissions before you join. Screen sharing, reactions, chat and participant controls are available inside the meeting.</p>
          </section>

          <aside className="rounded-2xl border border-gray-800 bg-[#141C2F] p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">Ready to join?</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight">{title}</h1>
            <div className="mt-4 space-y-2 text-xs text-gray-400"><div className="flex items-center gap-2"><Icon name="lock" size={15} className="text-[#00DF73]" />Zibuke authenticated meeting</div><div className="flex items-center gap-2"><Icon name="users" size={15} className="text-[#00DF73]" />{user?.role === "admin" ? "Administrator" : "Worker"}</div><div className="flex items-center gap-2"><Icon name="video" size={15} className="text-[#00DF73]" />Live audio and video</div></div>
            <label className="mt-5 block"><span className="text-xs font-semibold text-gray-300">Display name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 h-11 w-full rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-sm text-white outline-none focus:border-[#00DF73]" /></label>
            <button onClick={join} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#00DF73] text-sm font-bold text-[#0B1120] hover:bg-[#00c968]"><Icon name="video" size={17} /> Join meeting</button>
            <button onClick={onCancel} className="mt-2 h-10 w-full rounded-lg border border-gray-700 text-xs font-semibold text-gray-400 hover:bg-[#0B1120] hover:text-white">Cancel</button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function ControlButton({ icon, label, onClick, active }: { icon: "mic" | "micOff" | "video" | "videoOff"; label: string; onClick: () => void; active?: boolean }) { return <button onClick={onClick} title={label} className={`grid h-11 w-11 place-items-center rounded-full border transition ${active ? "border-red-900 bg-red-950/60 text-red-300" : "border-gray-700 bg-[#141C2F] text-gray-200 hover:text-[#00DF73]"}`}><Icon name={icon} size={18} /></button>; }
function initialsFor(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ZU"; }
