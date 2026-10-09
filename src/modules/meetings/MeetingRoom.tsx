"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/src/modules/shared/Icons";
import type { CurrentUser } from "@/src/modules/shared/types";
import type { PreJoinSettings } from "./PreJoinLobby";
import CallConnection from "./CallConnection";
import "@livekit/components-styles";

export default function MeetingRoom({
  title,
  meetingRoom,
  settings,
  onLeave,
}: {
  title: string;
  meetingRoom: string;
  jitsiDomain?: string;
  user: CurrentUser | null;
  settings: PreJoinSettings;
  onLeave: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function formatElapsed(total: number) { 
    const hours = Math.floor(total / 3600); 
    const minutes = Math.floor((total % 3600) / 60); 
    const seconds = total % 60; 
    return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`; 
  }

  return (
    <>
      <div className={`fixed inset-0 z-[260] flex flex-col overflow-hidden bg-[#070D16] font-sans text-white transition ${minimized ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <header className="flex h-[64px] shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-[#0D1523] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#00DF73]/10 text-[10px] font-black tracking-wide text-[#00DF73]">ZC</span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                <span>{formatElapsed(elapsed)}</span><span>&bull;</span>
                <span>Meeting room</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setMinimized(true)} className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white" title="Minimize"><Icon name="minimize" size={15} /></button>
            <button onClick={() => setInfoOpen((value) => !value)} className={`grid h-9 w-9 place-items-center rounded-lg ${infoOpen ? "bg-[#00DF73]/10 text-[#00DF73]" : "text-gray-400 hover:bg-white/5 hover:text-white"}`} title="Meeting details"><Icon name="info" size={15} /></button>
            <button onClick={onLeave} className="ml-2 flex h-9 items-center gap-2 rounded-lg bg-red-600/10 px-3 text-xs font-bold text-red-500 hover:bg-red-600 hover:text-white" title="Leave meeting"><Icon name="leave" size={15} /><span className="hidden sm:inline">Leave</span></button>
          </div>
        </header>

        <div className={`grid min-h-0 flex-1 ${infoOpen ? "xl:grid-cols-[minmax(0,1fr)_300px]" : "grid-cols-1"}`}>
          <section className="relative min-h-0 bg-[#070D16] p-2 sm:p-3">
            <div className="relative h-full min-h-[430px] overflow-hidden rounded-2xl border border-white/5 bg-black shadow-2xl shadow-black/30 flex items-center justify-center">
              
              <CallConnection roomName={meetingRoom} audio={settings.micOn} video={settings.cameraOn} onLeave={onLeave} />
            </div>
          </section>

          {infoOpen && (
            <aside className="min-h-0 overflow-y-auto border-l border-white/5 bg-[#0D1523] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#00DF73]">Meeting details</p>
              <h2 className="mt-2 text-base font-semibold">{title}</h2>
              <p className="mt-1 text-[11px] leading-5 text-gray-500">LiveKit Edge Network active.</p>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
