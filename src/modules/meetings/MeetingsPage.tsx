"use client";
import {useNow} from "@/src/modules/shared/useNow";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/src/modules/shared/Icons";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";
import MeetingRoom from "./MeetingRoom";
import PreJoinLobby, { type PreJoinSettings } from "./PreJoinLobby";

type Phase = "home" | "prejoin" | "meeting";
type UpcomingMeeting = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  event_type?: "meeting" | "huddle" | "event";
  online?: number | boolean;
  response_status?: "pending" | "accepted" | "tentative" | "declined" | null;
  organizer_name?: string | null;
};

export default function MeetingsPage() {const params=useSearchParams();return <MeetingView key={params.toString()}/>;}
function MeetingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const queryTitle=searchParams.get("title"),withPerson=searchParams.get("with"),existingMeetingId=searchParams.get("meetingId");
  const [title,setTitle]=useState(queryTitle||(withPerson?`Meeting with ${withPerson}`:"Instant meeting"));
  const [phase, setPhase] = useState<Phase>(queryTitle||withPerson||existingMeetingId?"prejoin":"home");
  const [settings, setSettings] = useState<PreJoinSettings | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(existingMeetingId);
  const [meetingRoom, setMeetingRoom] = useState<string | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(Boolean(existingMeetingId));
  const [joining, setJoining] = useState(false);
  const [meetingError, setMeetingError] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<UpcomingMeeting[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  useEffect(() => {
    const queryTitle = searchParams.get("title");
    const withPerson = searchParams.get("with");
    const existingMeetingId = searchParams.get("meetingId");

    if (!existingMeetingId) return;
    fetch(`/api/meetings/${encodeURIComponent(existingMeetingId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load meeting");
        if (!data.permissions?.canJoin) throw new Error("This meeting cannot be joined now. It may be cancelled, declined or already finished.");
        if (!data.media?.roomName) throw new Error("This meeting does not have a live room yet.");
        setTitle(data.meeting?.title || queryTitle || "Zibuke meeting");
        setMeetingRoom(data.media.roomName);
      })
      .catch((error) => setMeetingError(error instanceof Error ? error.message : "Could not load meeting"))
      .finally(() => setLoadingMeeting(false));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadCalendar() {
      try {
        const response = await fetch(`/api/calendar?t=${Date.now()}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) setCalendarEvents(Array.isArray(data.events) ? data.events : []);
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }
    void loadCalendar();
    return () => { cancelled = true; };
  }, []);

  const now = useNow();
  const upcoming = useMemo(() => {
    return calendarEvents
      .filter((event) => Boolean(event.online) && event.response_status !== "declined" && new Date(event.end_time).getTime() > now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 4);
  }, [calendarEvents, now]);

  async function joinMeeting(options: PreJoinSettings) {
    setJoining(true);
    setMeetingError("");
    try {
      let resolvedRoom = meetingRoom;
      let resolvedId = meetingId;

      if (!resolvedRoom) {
        const inviteeId = searchParams.get("withId") || searchParams.get("userId") || null;
        const response = await fetch("/api/meetings/instant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, inviteeId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not create meeting");
        resolvedRoom = data.meetingRoom;
        resolvedId = data.eventId;
        if (!resolvedId) throw new Error("Meeting ID could not be created");
        setMeetingRoom(resolvedRoom);
        setMeetingId(resolvedId);
        router.replace(`/dashboard/call?title=${encodeURIComponent(title)}&meetingId=${encodeURIComponent(resolvedId)}`);
      }

      if (!resolvedRoom) throw new Error("Meeting room could not be created");
      setSettings(options);
      setPhase("meeting");
    } catch (error) {
      setMeetingError(error instanceof Error ? error.message : "Could not join meeting");
    } finally {
      setJoining(false);
    }
  }

  function openScheduledMeeting(event: UpcomingMeeting) {
    router.push(`/dashboard/call?title=${encodeURIComponent(event.title)}&meetingId=${encodeURIComponent(event.id)}`);
  }

  function leave() {
    setPhase("home");
    setSettings(null);
    setMeetingId(null);
    setMeetingRoom(null);
    setMeetingError("");
    router.replace("/dashboard/call");
  }

  if (phase === "prejoin" && loadingMeeting) return <MeetingLoading title={title} />;
  if (phase === "prejoin" && meetingError) return <MeetingError message={meetingError} onBack={leave} />;
  if (phase === "prejoin") return <PreJoinLobby title={joining ? "Preparing meeting…" : title} user={user} onCancel={leave} onJoin={(options) => void joinMeeting(options)} />;
  if (phase === "meeting" && settings && meetingRoom) return <MeetingRoom title={title} meetingRoom={meetingRoom} jitsiDomain="" user={user} settings={settings} onLeave={leave} />;

  return (
    <main className="min-h-screen bg-[#0B1120] p-5 font-sans text-white sm:p-8 xl:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">Communications</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Meetings</h1><p className="mt-1 text-sm text-gray-400">Start a quick call or join something already on your calendar.</p></div>
          <button onClick={() => router.push("/dashboard/calendar?action=create")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-[#141C2F] px-4 text-xs font-semibold text-gray-200 hover:border-gray-600 hover:bg-[#182238]"><Icon name="calendar" size={15} /> Schedule meeting</button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-2xl border border-white/5 bg-[#141C2F] p-6 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#00DF73]/10 text-[#00DF73]"><Icon name="video" size={22} /></div>
              <span className="rounded-full border border-white/5 bg-[#0B1120] px-3 py-1 text-[10px] font-semibold text-gray-500">Instant meeting</span>
            </div>
            <h2 className="mt-6 text-xl font-semibold">Start a meeting now</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-gray-400">Give the meeting a clear title, check your camera and microphone, then enter the room. You can invite others using the meeting link.</p>
            <label className="mt-6 block"><span className="text-xs font-semibold text-gray-300">Meeting title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Technical check-in" className="mt-2 h-11 w-full rounded-xl border border-gray-700 bg-[#0B1120] px-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]/20" /></label>
            <div className="mt-5 flex flex-wrap gap-3"><button onClick={() => setPhase("prejoin")} disabled={!title.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#00DF73] px-5 text-sm font-bold text-[#07100b] hover:bg-[#00c968] disabled:cursor-not-allowed disabled:opacity-50"><Icon name="video" size={17} /> Start meeting</button><button onClick={() => router.push("/dashboard/calendar")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-700 px-4 text-sm font-semibold text-gray-300 hover:bg-[#0B1120]"><Icon name="calendar" size={16} /> Open calendar</button></div>
            <div className="mt-7 grid gap-3 border-t border-white/5 pt-5 sm:grid-cols-3"><Feature icon="shield" title="Private access" text="Only authorised Zibuke users can open scheduled meetings." /><Feature icon="screen" title="Screen sharing" text="Present your screen directly during the meeting." /><Feature icon="smile" title="Live reactions" text="React without interrupting the speaker." /></div>
          </section>

          <aside className="rounded-2xl border border-white/5 bg-[#141C2F] p-6 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#00DF73]">Your calendar</p><h2 className="mt-2 text-lg font-semibold">Upcoming meetings</h2></div><button onClick={() => router.push("/dashboard/calendar")} className="text-xs font-semibold text-[#00DF73] hover:underline">View all</button></div>
            <div className="mt-5 space-y-2.5">
              {calendarLoading && <div className="rounded-xl border border-white/5 bg-[#0B1120] p-4 text-xs text-gray-500">Loading upcoming meetings…</div>}
              {!calendarLoading && upcoming.length === 0 && <div className="rounded-xl border border-dashed border-gray-700 bg-[#0B1120] p-6 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-gray-500"><Icon name="calendar" size={18} /></span><strong className="mt-3 block text-sm text-gray-200">Nothing scheduled</strong><p className="mt-1 text-xs leading-5 text-gray-500">When a meeting or huddle is added to your calendar, it will appear here.</p></div>}
              {upcoming.map((event) => <UpcomingRow key={event.id} event={event} onJoin={() => openScheduledMeeting(event)} />)}
            </div>
            <button onClick={() => router.push("/dashboard/calendar?action=create")} className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-700 text-xs font-semibold text-gray-300 hover:bg-[#0B1120]"><Icon name="plus" size={14} /> Schedule another meeting</button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function UpcomingRow({ event, onJoin }: { event: UpcomingMeeting; onJoin: () => void }) {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const now = useNow();
  const started = start.getTime() <= now;
  const label = started ? "In progress" : formatUpcoming(start);
  return <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#0B1120] p-3.5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#00DF73]/8 text-[#00DF73]"><Icon name={event.event_type === "huddle" ? "users" : "video"} size={17} /></div><div className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold text-gray-100">{event.title}</strong><span className="mt-1 block truncate text-[10px] text-gray-500">{label} · {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{event.organizer_name ? ` · ${event.organizer_name}` : ""}</span></div><button onClick={onJoin} className="h-8 rounded-lg bg-[#00DF73] px-3 text-[10px] font-bold text-[#07100b] hover:bg-[#00c968]">Join</button></div>;
}
function Feature({ icon, title, text }: { icon: "shield" | "screen" | "smile"; title: string; text: string }) { return <div className="rounded-xl bg-[#0B1120] p-3"><Icon name={icon} size={16} className="text-[#00DF73]" /><strong className="mt-2 block text-xs text-gray-200">{title}</strong><p className="mt-1 text-[10px] leading-4 text-gray-500">{text}</p></div>; }
function MeetingLoading({ title }: { title: string }) { return <main className="min-h-screen bg-[#0B1120] p-8 font-sans text-white"><div className="mx-auto max-w-xl rounded-2xl border border-white/5 bg-[#141C2F] p-10 text-center"><span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-gray-700 border-t-[#00DF73]" /><h1 className="mt-4 text-lg font-semibold">Loading {title}</h1><p className="mt-2 text-sm text-gray-500">Checking meeting access and preparing the room…</p></div></main>; }
function MeetingError({ message, onBack }: { message: string; onBack: () => void }) { return <main className="min-h-screen bg-[#0B1120] p-8 font-sans text-white"><div className="mx-auto max-w-xl rounded-2xl border border-red-900/50 bg-[#141C2F] p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-500/10 text-red-400"><Icon name="videoOff" size={22} /></span><h1 className="mt-4 text-xl font-semibold">Meeting unavailable</h1><p className="mt-2 text-sm leading-6 text-gray-500">{message}</p><button onClick={onBack} className="mt-5 rounded-xl bg-[#00DF73] px-4 py-2.5 text-sm font-bold text-[#0B1120]">Back to meetings</button></div></main>; }
function formatUpcoming(date: Date) { const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1); if (sameDay(date, today)) return "Today"; if (sameDay(date, tomorrow)) return "Tomorrow"; return date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }