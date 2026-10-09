"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDataChannel } from "@livekit/components-react";
import CallConnection from "@/src/modules/meetings/CallConnection";
import "@livekit/components-styles";

type Person={id:string;first_name?:string;last_name?:string;name?:string;department:string};

// --- 1. EMOJI OVERLAY COMPONENT ---
function EmojiOverlay() {
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: string; emoji: string; left: number }[]>([]);

  const {send}=useDataChannel("reactions", message => {
    if (message && message.payload) {
      const decoder = new TextDecoder();
      const emoji = decoder.decode(message.payload);
      
      const newEmoji = {
        id: crypto.randomUUID(),
        emoji,
        left: Math.random() * 80 + 10,
      };
      
      setFloatingEmojis((prev) => [...prev, newEmoji]);
      
      setTimeout(() => {
        setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
      }, 3000);
    }
  });

  const sendEmoji = useCallback(async (emoji: string) => {
    const encoder = new TextEncoder();
    await send(encoder.encode(emoji), { reliable: true });
    
    const newEmoji = { id: crypto.randomUUID(), emoji, left: Math.random() * 80 + 10 };
    setFloatingEmojis((prev) => [...prev, newEmoji]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
    }, 3000);
  }, [send]);

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
        {floatingEmojis.map((e) => (
          <div
            key={e.id}
            className="absolute bottom-20 animate-float-up text-4xl opacity-0"
            style={{ left: `${e.left}%` }}
          >
            {e.emoji}
          </div>
        ))}
      </div>

      <div className="absolute bottom-24 right-5 z-40 flex gap-2 rounded-xl border border-gray-700 bg-[#141C2F]/90 p-2 shadow-2xl backdrop-blur-md">
        {["\u{1F44D}", "\u{1F389}", "\u2764\uFE0F", "\u{1F602}", "\u{1F44F}"].map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendEmoji(emoji)}
            className="grid h-10 w-10 place-items-center rounded-lg text-xl transition hover:bg-[#0B1120] hover:scale-110"
            title="React"
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}

// --- 2. LIVEKIT ROOM COMPONENT ---
function CallRoom({ roomName, onLeave }: { roomName: string; onLeave: () => void }) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-800 bg-black ring-1 ring-[#00DF73]/30">
      <CallConnection roomName={roomName} onLeave={onLeave}>
        <EmojiOverlay />
      </CallConnection>
    </div>
  );
}
// --- 3. MAIN PAGE COMPONENT (LOBBY & SCHEDULING) ---
function CallPageContent() {
  const searchParams = useSearchParams();
  return <CallPageView key={searchParams.toString()} />;
}

function CallPageView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitRoom = searchParams.get("room");
  const targetUserId = searchParams.get("userId");
  

  const [people, setPeople] = useState<Person[]>([]);
  const [phase, setPhase] = useState<"lobby" | "scheduling" | "active">(explicitRoom ? "active" : "lobby");
  const [scheduleForm, setScheduleForm] = useState({ title: "", department: "All Departments", date: "", time: "" });
  const [toast, setToast] = useState("");

  const activeRoomName = explicitRoom || "Zibuke-Company-Watercooler";
  const invitationStarted = useRef(false);
  useEffect(() => {
    if (!targetUserId || explicitRoom || invitationStarted.current) return;
    invitationStarted.current = true;
    const roomName = "Zibuke-Direct-" + crypto.randomUUID();
    fetch("/api/calls/signal", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({targetUserId, roomName})
    }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to start call");
      router.replace("/dashboard/call?room=" + encodeURIComponent(body.roomName));
    }).catch(error => setToast(error.message));
  }, [targetUserId, explicitRoom, router]);

  useEffect(() => {
    Promise.all([
      fetch("/api/people", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      fetch("/api/messages", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).catch(() => ({}))
    ]).then(([peopleRes, messagesRes]) => {
      const peopleData = peopleRes as {users?:Person[];people?:Person[];data?:Person[]};
      const messagesData = messagesRes as {users?:Person[];people?:Person[];data?:Person[]};
      
      const list1 = peopleData?.users || peopleData?.people || peopleData?.data || (Array.isArray(peopleData) ? peopleData : []);
      const list2 = messagesData?.users || messagesData?.people || messagesData?.data || (Array.isArray(messagesData) ? messagesData : []);
      
      const combined:Person[] = [...list1, ...list2];
      
      const uniqueUsers = Array.from(new Map(combined.filter((u) => u && u.id).map((u) => [u.id, {
        ...u,
        department: u.department || "General"
      }])).values());
      
      setPeople(uniqueUsers);
    });
  }, []);

  const uniqueDepartments = Array.from(new Set(people.map(p => p.department).filter(Boolean)));

  const targetUsers = scheduleForm.department === "All Departments" 
    ? people 
    : people.filter(p => p.department === scheduleForm.department);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleForm.title || !scheduleForm.date || !scheduleForm.time) return;
      
    const inviteeIds = targetUsers.map(p => p.id).filter(Boolean);

    if (inviteeIds.length === 0) {
      setToast("Error: No users found in this department to invite.");
      return;
    }

    const startTime = new Date(`${scheduleForm.date}T${scheduleForm.time}`);
    const endTime = new Date(startTime.getTime() + 60 * 60000);

    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: scheduleForm.title,
          description: `Scheduled meeting for ${scheduleForm.department} department.`,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          event_type: "meeting",
          online: true,
          invitee_ids: inviteeIds, 
        }),
      });

      if (res.ok) {
        setToast(`Meeting scheduled! ${inviteeIds.length} team members formally invited.`);
        setTimeout(() => setPhase("lobby"), 3000);
      } else {
        const err = await res.json();
        setToast(err.error || "Failed to schedule meeting.");
      }
    } catch (e) {
      setToast("Network error scheduling meeting.");
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-120px)] max-w-6xl flex-col">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">Unified Communications</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Zibuke Meet</h1>
        </div>
      </header>

      {phase === "active" && <CallRoom roomName={activeRoomName} onLeave={() => { setPhase("lobby"); router.replace("/dashboard/call"); }} />}

      {phase === "lobby" && (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-800 bg-[#141C2F]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Start or Schedule a Meeting</h2>
            <p className="mt-2 text-gray-400">Join the watercooler instantly, or schedule a formal department meeting.</p>
            <div className="mt-8 flex justify-center gap-4">
              <button 
                onClick={() => setPhase("active")} 
                className="rounded-lg bg-[#00DF73] px-6 py-3 font-bold text-[#0B1120] transition hover:bg-[#00c968]"
              >
                Join Instant Meeting
              </button>
              <button 
                onClick={() => setPhase("scheduling")} 
                className="rounded-lg border border-gray-700 bg-[#0B1120] px-6 py-3 font-bold text-white transition hover:border-[#00DF73]"
              >
                Schedule for Later
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "scheduling" && (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-gray-800 bg-[#141C2F]">
          <form onSubmit={handleSchedule} className="w-full max-w-md rounded-xl border border-gray-800 bg-[#0B1120] p-6 shadow-xl">
            <h2 className="text-xl font-bold text-white">Schedule Department Meeting</h2>
            
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-400">Meeting Title</span>
                <input required type="text" value={scheduleForm.title} onChange={(e) => setScheduleForm({...scheduleForm, title: e.target.value})} className="mt-1 w-full rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-white focus:border-[#00DF73] focus:outline-none" placeholder="Weekly Sync" />
              </label>

              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">Department</span>
                  <span className="text-[10px] font-bold text-[#00DF73]">{targetUsers.length} members found</span>
                </div>
                <select value={scheduleForm.department} onChange={(e) => setScheduleForm({...scheduleForm, department: e.target.value})} className="mt-1 w-full rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-white focus:border-[#00DF73] focus:outline-none">
                  <option className="bg-[#0B1120]" value="All Departments">All Departments</option>
                  {uniqueDepartments.map(dept => (
                    <option key={dept} className="bg-[#0B1120]" value={dept as string}>{dept as string}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-400">Date</span>
                  <input required type="date" value={scheduleForm.date} onChange={(e) => setScheduleForm({...scheduleForm, date: e.target.value})} className="mt-1 w-full rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-white [color-scheme:dark] focus:border-[#00DF73] focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-400">Time</span>
                  <input required type="time" value={scheduleForm.time} onChange={(e) => setScheduleForm({...scheduleForm, time: e.target.value})} className="mt-1 w-full rounded-lg border border-gray-700 bg-transparent px-4 py-2 text-white [color-scheme:dark] focus:border-[#00DF73] focus:outline-none" />
                </label>
              </div>
            </div>

            {toast && (
              <div className={`mt-4 rounded-lg px-3 py-2 text-center text-sm font-semibold ${toast.startsWith("Error") ? "bg-red-950/30 text-red-400" : "bg-[#00DF73]/10 text-[#00DF73]"}`}>
                {toast}
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => setPhase("lobby")} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white">Cancel</button>
              <button type="submit" disabled={targetUsers.length === 0} className="rounded-lg bg-[#00DF73] px-6 py-2 text-sm font-bold text-[#0B1120] transition hover:bg-[#00c968] disabled:opacity-50">Schedule & Notify</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// 4. MAIN EXPORT WITH PROPER SUSPENSE BOUNDARY
export default function CallPage() {
  return (
    <main className="min-h-screen bg-[#0B1120] p-4 text-white sm:p-8">
      <Suspense fallback={
        <div className="mx-auto flex h-[calc(100vh-120px)] max-w-6xl items-center justify-center rounded-xl border border-gray-800 bg-[#141C2F]">
          <p className="animate-pulse text-[#00DF73]">Loading Zibuke Meet...</p>
        </div>
      }>
        <CallPageContent />
      </Suspense>
    </main>
  );
}
