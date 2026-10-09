"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/src/modules/shared/Icons";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";

type EventType = "meeting" | "huddle" | "event";
type CalendarFilter = "all" | EventType | "recorded";
type CalendarView = "day" | "week" | "month";
type ResponseStatus = "pending" | "accepted" | "tentative" | "declined" | null;

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  organizer_id: string;
  organizer_name: string | null;
  department: string;
  event_type?: EventType;
  channel_id?: string | null;
  channel_name?: string | null;
  online?: number | boolean;
  recording_url?: string | null;
  recording_duration_seconds?: number | null;
  response_status?: ResponseStatus;
  attendee_count?: number;
  invitee_ids?: string[];
};

type FormState = {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  event_type: EventType;
  channel_id: string | null;
  invitee_ids: string[];
  online: boolean;
};

type Channel = { id: string; name: string; description?: string };
type Person = { id: string; name?: string; first_name?: string; last_name?: string; department?: string };
type AvailabilityPerson = { userId: string; name: string; status: "available" | "busy" | "tentative"; conflictCount: number };
type AvailabilityState = { available: boolean; people: AvailabilityPerson[]; suggestions: { start_time: string; end_time: string }[] };

const DAY_START = 8;
const DAY_END = 17;
const HOUR_HEIGHT = 72;
const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, index) => DAY_START + index);
const TYPE_META: Record<EventType, { label: string; border: string; bg: string; text: string; dot: string }> = {
  meeting: { label: "Meeting", border: "border-blue-500", bg: "bg-blue-500/10", text: "text-blue-300", dot: "bg-blue-400" },
  huddle: { label: "Huddle", border: "border-emerald-400", bg: "bg-emerald-400/10", text: "text-emerald-300", dot: "bg-emerald-400" },
  event: { label: "Event", border: "border-violet-400", bg: "bg-violet-400/10", text: "text-violet-300", dot: "bg-violet-400" },
};

export default function CalendarPage(){const params=useSearchParams();return <CalendarPageContent key={params.toString()}/>;}
function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("meetingId"));
  const [query, setQuery] = useState("");
  const [view, setView] = useState<CalendarView>("week");
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [department, setDepartment] = useState("All departments");
  const [modal, setModal] = useState<{ mode: "create" | "edit"; event?: CalendarEvent; channelId?: string | null; channelName?: string | null } | null>(()=>searchParams.get("action")==="create"?{mode:"create",channelId:searchParams.get("channelId"),channelName:searchParams.get("channel")?.replace(/^#/,"")||null}:null);
  const [toast, setToast] = useState("");

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const selected = events.find((event) => event.id === selectedId) ?? null;
  const departments = useMemo(() => ["All departments", ...Array.from(new Set(events.map((event) => event.department).filter(Boolean))).sort()], [events]);

  const filteredEvents = useMemo(() => {
    const search = query.trim().toLowerCase();
    return events.filter((event) => {
      const type = event.event_type || "meeting";
      const matchesType = filter === "all" || filter === "recorded" ? filter === "all" || Boolean(event.recording_url) : type === filter;
      const matchesSearch = !search || [event.title, event.description, event.organizer_name, event.department, event.channel_name].some((value) => (value || "").toLowerCase().includes(search));
      const matchesDepartment = user?.role !== "admin" || department === "All departments" || event.department === department;
      return matchesType && matchesSearch && matchesDepartment;
    });
  }, [department, events, filter, query, user?.role]);

  const weekEvents = filteredEvents.filter((event) => weekDates.some((date) => sameLocalDate(new Date(event.start_time), date)));
  const dayEvents = filteredEvents.filter((event) => sameLocalDate(new Date(event.start_time), weekDates[activeDay]));

  useEffect(() => { void loadEvents(); }, []);





  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function loadEvents() {
    return fetch('/api/calendar',{cache:'no-store'}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load calendar');
      return data;
    }).then(data=>{
      const items:CalendarEvent[]=data.events||[];setEvents(items);
      const target=items.find(event=>event.id===searchParams.get('meetingId'));
      if(target)setWeekOffset(weekOffsetForDate(new Date(target.start_time)));
    }).catch(error=>setToast(error instanceof Error?error.message:'Could not load calendar')).finally(()=>setLoading(false));
  }

  function canManage(event: CalendarEvent) {
    return Boolean(user && (user.role === "admin" || event.organizer_id === user.id));
  }

  async function saveEvent(form: FormState) {
    const editing = modal?.mode === "edit" && modal.event;
    const endpoint = editing ? `/api/calendar/${editing.id}` : "/api/calendar";
    const response = await fetch(endpoint, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to save calendar item");
    setModal(null);
    await loadEvents();
    if (data.eventId) setSelectedId(data.eventId);
    setToast(editing ? "Calendar item updated everywhere." : form.channel_id ? "Added to the calendar and posted in the selected channel." : "Added to invitees’ calendars.");
  }

  async function cancelSelected() {
    if (!selected || !canManage(selected)) return;
    if (!window.confirm(`Cancel “${selected.title}”? It will disappear from active calendars.`)) return;
    const response = await fetch(`/api/calendar/${selected.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setToast(data.error || "Unable to cancel calendar item."); return; }
    setSelectedId(null);
    await loadEvents();
    setToast("Calendar item cancelled. A linked channel card is marked cancelled too.");
  }

  async function respond(status: Exclude<ResponseStatus, null | "pending">) {
    if (!selected) return;
    const response = await fetch(`/api/calendar/${selected.id}/response`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: status }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setToast(data.error || "Could not update your response."); return; }
    setEvents((items) => items.map((item) => item.id === selected.id ? { ...item, response_status: status } : item));
    setToast(`${status[0].toUpperCase()}${status.slice(1)}. The item stays on your calendar.`);
  }

  function joinMeeting(event: CalendarEvent) {
    if (isPast(event) || event.event_type === "event" || event.online === 0 || event.response_status === "declined") return;
    router.push(`/dashboard/call?title=${encodeURIComponent(event.title)}&meetingId=${encodeURIComponent(event.id)}`);
  }

  function selectDay(index: number) {
    setActiveDay(index);
    setView("day");
  }

  return (
    <main className="min-h-screen bg-[#0B1120] p-5 text-white sm:p-8 xl:p-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">{user?.role === "admin" ? "Organisation calendar" : "My work calendar"}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Calendar</h1>
            <p className="mt-1 text-sm text-gray-400">Meetings, huddles, events and recordings in one place. Empty time is normal 08:00–17:00 work.</p>
          </div>
          <button onClick={() => setModal({ mode: "create" })} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#00DF73] px-4 text-sm font-bold text-[#0B1120] shadow-sm transition hover:bg-[#00c968]"><Icon name="plus" /> New</button>
        </header>

        <CalendarRules role={user?.role || "employee"} />

        <section className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#141C2F] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setWeekOffset((value) => value - 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-700 text-gray-300 hover:bg-[#0B1120] hover:text-[#00DF73]" aria-label="Previous week"><Icon name="chevronLeft" /></button>
            <button onClick={() => { setWeekOffset(0); setActiveDay(Math.min(4, Math.max(0, getTodayWeekdayIndex()))); }} className="h-9 rounded-lg border border-gray-700 px-3 text-xs font-semibold text-gray-300 hover:bg-[#0B1120]">Today</button>
            <button onClick={() => setWeekOffset((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-lg border border-gray-700 text-gray-300 hover:bg-[#0B1120] hover:text-[#00DF73]" aria-label="Next week"><Icon name="chevronRight" /></button>
            <strong className="ml-1 text-sm text-white">{formatWeekRange(weekDates)}</strong>
            {user?.role === "admin" && <select value={department} onChange={(event) => setDepartment(event.target.value)} className="ml-1 h-9 rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-xs font-semibold text-gray-300 outline-none focus:border-[#00DF73]">{departments.map((item) => <option key={item}>{item}</option>)}</select>}
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <label className="flex h-9 min-w-[220px] max-w-sm flex-1 items-center gap-2 rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-gray-500 focus-within:border-[#00DF73]"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, organiser, channel…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600" /></label>
            <div className="flex rounded-lg border border-gray-700 bg-[#0B1120] p-1">{(["day", "week", "month"] as CalendarView[]).map((item) => <button key={item} onClick={() => setView(item)} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${view === item ? "bg-[#00DF73] text-[#0B1120]" : "text-gray-400 hover:text-white"}`}>{item}</button>)}</div>
          </div>
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2">
          {(["all", "meeting", "huddle", "event", "recorded"] as CalendarFilter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${filter === item ? "border-[#00DF73]/60 bg-[#00DF73]/10 text-white" : "border-gray-800 bg-[#141C2F] text-gray-500 hover:text-gray-300"}`}>{item !== "all" && item !== "recorded" && <span className={`h-2 w-2 rounded-full ${TYPE_META[item].dot}`}/>} {item === "recorded" && <Icon name="record" size={12} className="text-red-400"/>}{item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)}</button>)}
          <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-gray-600 md:inline-flex"><Icon name="clock" size={14}/> Empty time = normal work</span>
        </section>

        <div className={`grid gap-4 ${selected ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1"}`}>
          <section className="overflow-hidden rounded-xl border border-gray-800 bg-[#141C2F] shadow-sm">
            {loading ? <CalendarLoading /> : view === "week" ? <WeekGrid dates={weekDates} events={weekEvents} selectedId={selectedId} onSelect={(event) => setSelectedId(event.id)} onDayClick={selectDay} /> : view === "day" ? <DayView dates={weekDates} activeDay={activeDay} setActiveDay={setActiveDay} events={dayEvents} onSelect={(event) => setSelectedId(event.id)} /> : <MonthView anchor={weekDates[0]} events={filteredEvents} onSelect={(event) => setSelectedId(event.id)} />}
          </section>

          {selected && <EventDetail event={selected} currentUserId={user?.id || ""} canManage={canManage(selected)} onClose={() => setSelectedId(null)} onJoin={() => joinMeeting(selected)} onEdit={() => setModal({ mode: "edit", event: selected })} onCancel={() => void cancelSelected()} onRespond={(status) => void respond(status)} onChannel={() => selected.channel_id && router.push(`/dashboard/channels/${selected.channel_id}`)} />}
        </div>
      </div>

      {modal && <MeetingModal role={user?.role || "employee"} mode={modal.mode} event={modal.event} initialChannelId={modal.channelId} initialChannelName={modal.channelName} onClose={() => setModal(null)} onSave={saveEvent} />}
      {toast && <div className="fixed bottom-5 right-5 z-[220] max-w-md rounded-xl border border-gray-700 bg-[#141C2F] px-4 py-3 text-sm font-semibold text-white shadow-2xl"><span className="mr-2 text-[#00DF73]">●</span>{toast}</div>}
    </main>
  );
}

function CalendarRules({ role }: { role: "admin" | "employee" }) {
  const admin = role === "admin";
  return <details className="rounded-xl border border-gray-800 bg-[#141C2F] p-4" open><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#00DF73]/10 text-[#00DF73]"><Icon name={admin ? "settings" : "calendar"} size={17}/></span><div><strong className="block text-sm text-white">{admin ? "Administrator calendar rules" : "Worker calendar rules"}</strong><span className="text-[11px] text-gray-500">Role permissions are enforced by the backend, not a preview switch.</span></div></div><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Rules</span></div></summary><div className="mt-4 grid gap-2 border-t border-gray-800 pt-4 text-xs leading-5 text-gray-400 md:grid-cols-2 xl:grid-cols-4">{admin ? <><Rule text="Create meetings, huddles and organisation events."/><Rule text="Edit, reschedule or cancel any calendar item when necessary."/><Rule text="Filter the organisation calendar by department."/><Rule text="Past sessions cannot be joined; recordings stay on the original item."/></> : <><Rule text="Create internal meetings and huddles up to 60 minutes and 30 days ahead."/><Rule text="Add an agenda and invite people or link a channel."/><Rule text="Edit, reschedule or cancel only sessions you created."/><Rule text="Accept, Tentative or Decline changes status only; the invite remains until cancelled."/></>}</div></details>;
}
function Rule({ text }: { text: string }) { return <div className="flex gap-2"><span className="mt-1 text-[#00DF73]">✓</span><span>{text}</span></div>; }

function EventDetail({ event, currentUserId, canManage, onClose, onJoin, onEdit, onCancel, onRespond, onChannel }: {
  event: CalendarEvent; currentUserId: string; canManage: boolean; onClose: () => void; onJoin: () => void; onEdit: () => void; onCancel: () => void; onRespond: (status: "accepted" | "tentative" | "declined") => void; onChannel: () => void;
}) {
  const type = event.event_type || "meeting";
  const meta = TYPE_META[type];
  const past = isPast(event);
  const own = event.organizer_id === currentUserId;
  const response = own ? "accepted" : event.response_status;
  const canJoin = !past && type !== "event" && event.online !== 0 && response !== "declined";
  return <aside className="h-fit rounded-xl border border-gray-800 bg-[#141C2F] p-5 xl:sticky xl:top-5">
    <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.border} ${meta.bg} ${meta.text}`}>{meta.label}</span>{event.recording_url && <span className="inline-flex items-center gap-1 rounded-full border border-red-900/60 bg-red-950/20 px-2 py-1 text-[10px] font-bold text-red-300"><Icon name="record" size={11}/> Recorded</span>}</div><h2 className="mt-3 text-xl font-bold text-white">{event.title}</h2></div><button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-[#0B1120] hover:text-white"><Icon name="x" /></button></div>
    <div className="mt-5 space-y-3 text-sm"><DetailRow icon="calendar" label="Date" value={formatDate(new Date(event.start_time))}/><DetailRow icon="clock" label="Time" value={`${formatTime(new Date(event.start_time))} – ${formatTime(new Date(event.end_time))}`}/><DetailRow icon="users" label="Organiser" value={event.organizer_name || "Zibuke Central user"}/><DetailRow icon="users" label="People" value={`${event.attendee_count || 1} participant${(event.attendee_count || 1) === 1 ? "" : "s"}`}/>{event.channel_name && <DetailRow icon="hash" label="Channel" value={`#${event.channel_name}`}/>}</div>
    {event.description && <div className="mt-5 rounded-lg border border-gray-800 bg-[#0B1120] p-3 text-sm leading-6 text-gray-300">{event.description}</div>}

    {!own && !past && type !== "event" && <div className="mt-5 rounded-xl border border-amber-700/40 bg-amber-500/5 p-3"><strong className="text-xs text-amber-200">Invitation {response || "pending"}</strong><p className="mt-1 text-[11px] leading-5 text-amber-100/60">Your response changes status only. The item remains on your calendar until the organiser or an administrator cancels it.</p><div className="mt-3 flex flex-wrap gap-2"><ResponseButton active={response === "accepted"} label="Accept" onClick={() => onRespond("accepted")} tone="green"/><ResponseButton active={response === "tentative"} label="Tentative" onClick={() => onRespond("tentative")}/><ResponseButton active={response === "declined"} label="Decline" onClick={() => onRespond("declined")} tone="red"/></div></div>}

    {past ? <div className="mt-5 flex gap-3 rounded-xl border border-gray-800 bg-[#0B1120] p-3 text-xs text-gray-400"><Icon name="clock" size={17}/><div><strong className="block text-gray-300">This session has ended</strong><span>Past sessions cannot be joined.</span></div></div> : response === "declined" ? <div className="mt-5 rounded-xl border border-gray-800 bg-[#0B1120] p-3 text-xs text-gray-500">You declined this invitation. Change to Accepted or Tentative to join.</div> : canJoin ? <button onClick={onJoin} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#00DF73] text-sm font-bold text-[#0B1120] hover:bg-[#00c968]"><Icon name="video"/> Join meeting</button> : null}

    {event.recording_url && <a href={event.recording_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-gray-800 bg-[#0B1120] p-3 transition hover:border-[#00DF73]/40"><span className="grid h-10 w-10 place-items-center rounded-lg bg-red-500/10 text-red-300"><Icon name="record"/></span><span className="min-w-0 flex-1"><strong className="block text-xs text-white">Recording available</strong><small className="text-[10px] text-gray-500">Attached to this calendar item{event.recording_duration_seconds ? ` · ${Math.round(event.recording_duration_seconds / 60)} min` : ""}</small></span><span className="text-[10px] font-bold text-[#00DF73]">Watch</span></a>}

    {event.channel_id && <button onClick={onChannel} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-700 text-xs font-semibold text-gray-300 hover:bg-[#0B1120] hover:text-white"><Icon name="hash" size={15}/> Open linked channel</button>}
    {canManage && <div className="mt-5 flex gap-2 border-t border-gray-800 pt-4"><button onClick={onEdit} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2.5 text-xs font-semibold text-gray-300 hover:bg-[#0B1120]"><Icon name="edit" size={14}/> Edit</button><button onClick={onCancel} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-900/70 px-3 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-950/20"><Icon name="trash" size={14}/> Cancel</button></div>}
  </aside>;
}

function ResponseButton({ active, label, onClick, tone = "neutral" }: { active: boolean; label: string; onClick: () => void; tone?: "neutral" | "green" | "red" }) {
  const activeClass = tone === "green" ? "border-[#00DF73] bg-[#00DF73] text-[#0B1120]" : tone === "red" ? "border-red-500 bg-red-500/15 text-red-300" : "border-white bg-white text-[#0B1120]";
  return <button onClick={onClick} className={`rounded-lg border px-3 py-2 text-xs font-bold ${active ? activeClass : "border-gray-700 bg-[#0B1120] text-gray-400 hover:text-white"}`}>{label}</button>;
}

function WeekGrid({ dates, events, selectedId, onSelect, onDayClick }: { dates: Date[]; events: CalendarEvent[]; selectedId: string | null; onSelect: (event: CalendarEvent) => void; onDayClick: (index: number) => void }) {
  const gridHeight = (DAY_END - DAY_START) * HOUR_HEIGHT;
  return <div className="overflow-x-auto"><div className="min-w-[850px]"><div className="grid grid-cols-[72px_repeat(5,minmax(150px,1fr))] border-b border-gray-800 bg-[#0B1120]"><div className="border-r border-gray-800"/>{dates.map((date, index) => <button key={date.toISOString()} onClick={() => onDayClick(index)} className="border-r border-gray-800 px-3 py-3 text-center transition hover:bg-[#141C2F] last:border-r-0"><div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{date.toLocaleDateString([], { weekday: "short" })}</div><div className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${sameLocalDate(date, new Date()) ? "bg-[#00DF73] text-[#0B1120]" : "text-white"}`}>{date.getDate()}</div></button>)}</div><div className="grid grid-cols-[72px_repeat(5,minmax(150px,1fr))]"><div className="relative border-r border-gray-800 bg-[#0B1120]/55" style={{ height: gridHeight }}>{hours.slice(0, -1).map((hour, index) => <div key={hour} className="absolute left-0 right-0 border-t border-gray-800/80 px-3 pt-1 text-right text-[10px] text-gray-500" style={{ top: index * HOUR_HEIGHT }}>{String(hour).padStart(2, "0")}:00</div>)}</div>{dates.map((date) => <div key={date.toISOString()} className="relative border-r border-gray-800 last:border-r-0" style={{ height: gridHeight }}>{hours.slice(0, -1).map((hour, index) => <div key={hour} className="absolute left-0 right-0 border-t border-gray-800/70" style={{ top: index * HOUR_HEIGHT }}/>) }{events.filter((event) => sameLocalDate(new Date(event.start_time), date)).map((event) => <CalendarBlock key={event.id} event={event} selected={selectedId === event.id} onSelect={() => onSelect(event)}/>)}</div>)}</div></div></div>;
}

function CalendarBlock({ event, selected, onSelect }: { event: CalendarEvent; selected: boolean; onSelect: () => void }) {
  const start = new Date(event.start_time); const end = new Date(event.end_time); const startValue = start.getHours() + start.getMinutes() / 60; const endValue = end.getHours() + end.getMinutes() / 60; const top = Math.max(0, (startValue - DAY_START) * HOUR_HEIGHT); const height = Math.max(34, (endValue - startValue) * HOUR_HEIGHT - 4); const compact = height < 52; const type = event.event_type || "meeting"; const meta = TYPE_META[type];
  return <button title={`${event.title} · ${formatTime(start)}–${formatTime(end)}`} onClick={onSelect} className={`absolute left-1 right-1 overflow-hidden rounded-lg border border-gray-800 border-l-4 px-2 text-left shadow-sm transition ${meta.border} ${meta.bg} ${selected ? "ring-1 ring-[#00DF73]" : "hover:brightness-125"} ${isPast(event) ? "opacity-55" : ""}`} style={{ top: top + 2, height }}>{compact ? <span className="block truncate text-[10px] font-bold text-white">{formatTime(start)} · {event.title}{event.recording_url ? " · ●" : ""}</span> : <><span className={`block text-[9px] font-semibold ${meta.text}`}>{formatTime(start)} – {formatTime(end)}{event.recording_url ? " · ● recorded" : ""}</span><strong className="mt-0.5 block truncate text-[11px] text-white">{event.title}</strong><span className="block truncate text-[9px] text-gray-400">{event.channel_name ? `#${event.channel_name}` : event.department}</span></>}</button>;
}

function DayView({ dates, activeDay, setActiveDay, events, onSelect }: { dates: Date[]; activeDay: number; setActiveDay: (value: number) => void; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  return <div className="p-4 sm:p-5"><div className="mb-5 grid grid-cols-5 gap-2">{dates.map((date, index) => <button key={date.toISOString()} onClick={() => setActiveDay(index)} className={`rounded-lg border px-2 py-2 text-center ${activeDay === index ? "border-[#00DF73]/50 bg-[#00DF73]/10" : "border-gray-800 bg-[#0B1120]"}`}><span className="block text-[9px] uppercase tracking-wider text-gray-500">{date.toLocaleDateString([], { weekday: "short" })}</span><strong className={activeDay === index ? "text-[#00DF73]" : "text-white"}>{date.getDate()}</strong></button>)}</div><h2 className="mb-3 text-sm font-bold text-white">{formatDate(dates[activeDay])}</h2>{events.length ? <div className="space-y-2">{[...events].sort((a,b) => +new Date(a.start_time) - +new Date(b.start_time)).map((event) => { const meta = TYPE_META[event.event_type || "meeting"]; return <button key={event.id} onClick={() => onSelect(event)} className={`flex w-full items-center gap-4 rounded-xl border border-gray-800 border-l-4 bg-[#0B1120] p-4 text-left transition hover:border-gray-700 ${meta.border}`}><div className="w-20 shrink-0"><strong className="block text-sm text-white">{formatTime(new Date(event.start_time))}</strong><span className="text-[10px] text-gray-600">{formatTime(new Date(event.end_time))}</span></div><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-white">{event.title}</strong><span className="text-xs text-gray-500">{TYPE_META[event.event_type || "meeting"].label} · {event.channel_name ? `#${event.channel_name}` : event.department}</span></div><Icon name="chevronRight" size={15} className="text-gray-600"/></button>; })}</div> : <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-gray-800 bg-[#0B1120]/40 text-center"><div><Icon name="clock" size={30} className="mx-auto text-gray-700"/><p className="mt-3 text-sm font-semibold text-gray-400">No scheduled items.</p><p className="mt-1 text-xs text-gray-600">This is normal working time.</p></div></div>}</div>;
}

function MonthView({ anchor, events, onSelect }: { anchor: Date; events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }) {
  const year = anchor.getFullYear(); const month = anchor.getMonth(); const first = new Date(year, month, 1); const days = new Date(year, month + 1, 0).getDate(); const offset = (first.getDay() + 6) % 7; const cells = Array.from({ length: offset + days }, (_, index) => index < offset ? null : index - offset + 1);
  return <div><div className="border-b border-gray-800 bg-[#0B1120] px-5 py-4"><strong className="text-sm text-white">{anchor.toLocaleDateString([], { month: "long", year: "numeric" })}</strong></div><div className="grid grid-cols-7 border-b border-gray-800 bg-[#0B1120]/70">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day) => <span key={day} className="px-2 py-2 text-center text-[9px] font-bold uppercase tracking-wider text-gray-600">{day}</span>)}</div><div className="grid grid-cols-7">{cells.map((day, index) => day === null ? <div key={`empty-${index}`} className="min-h-28 border-b border-r border-gray-800 bg-[#0B1120]/25"/> : <div key={day} className="min-h-28 border-b border-r border-gray-800 p-2"><span className="text-[10px] font-semibold text-gray-500">{day}</span><div className="mt-1 space-y-1">{events.filter((event) => { const date = new Date(event.start_time); return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day; }).slice(0,3).map((event) => <button key={event.id} onClick={() => onSelect(event)} title={event.title} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[9px] font-semibold ${TYPE_META[event.event_type || "meeting"].bg} ${TYPE_META[event.event_type || "meeting"].text}`}>{event.recording_url ? "● " : ""}{event.title}</button>)}</div></div>)}</div></div>;
}

function MeetingModal({ role, mode, event, initialChannelId, initialChannelName, onClose, onSave }: { role: "admin" | "employee"; mode: "create" | "edit"; event?: CalendarEvent; initialChannelId?: string | null; initialChannelName?: string | null; onClose: () => void; onSave: (form: FormState) => Promise<void> }) {
  const defaults = defaultTimes();
  const [form, setForm] = useState<FormState>({ title: event?.title || (initialChannelName ? `${initialChannelName} meeting` : ""), description: event?.description || "", start_time: event?.start_time ? toLocalInput(event.start_time) : defaults.start, end_time: event?.end_time ? toLocalInput(event.end_time) : defaults.end, event_type: event?.event_type || "meeting", channel_id: event?.channel_id || initialChannelId || null, invitee_ids: event?.invitee_ids || [], online: event ? event.online !== 0 : true });
  const [channels, setChannels] = useState<Channel[]>([]); const [people, setPeople] = useState<Person[]>([]); const [inviteQuery, setInviteQuery] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [availabilityResult, setAvailabilityResult] = useState<{key:string;value:AvailabilityState}|null>(null);
  const availabilityKey=JSON.stringify([form.start_time,form.end_time,form.event_type,form.invitee_ids,event?.id]);
  const availability=availabilityResult?.key===availabilityKey?availabilityResult.value:null;
  const setAvailability=(value:AvailabilityState|null)=>setAvailabilityResult(value?{key:availabilityKey,value}:null); const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => { void Promise.all([fetch("/api/channels", { cache: "no-store" }).then((res) => res.json()).then((data) => setChannels(data.channels || [])), fetch("/api/messages", { cache: "no-store" }).then((res) => res.json()).then((data) => setPeople(data.users || []))]); }, []);

  useEffect(() => {
    if (form.event_type === "event" || !form.start_time || !form.end_time) { return; }
    const timer = window.setTimeout(async () => {
      setCheckingAvailability(true);
      try {
        const response = await fetch("/api/calendar/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendeeIds: form.invitee_ids, startTime: form.start_time, endTime: form.end_time, excludeEventId: event?.id || null }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) setAvailability(data);
        else setAvailability(null);
      } finally { setCheckingAvailability(false); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.start_time, form.end_time, form.event_type, form.invitee_ids, event?.id]);
  const allowed: EventType[] = role === "admin" ? ["meeting","huddle","event"] : ["meeting","huddle"];
  const filteredPeople = people.filter((person) => !inviteQuery.trim() || `${personName(person)} ${person.department || ""}`.toLowerCase().includes(inviteQuery.toLowerCase())).slice(0, 12);

  function setDuration(minutes: number) { const start = new Date(form.start_time); if (!Number.isFinite(start.getTime())) return; setForm({ ...form, end_time: toLocalInput(new Date(start.getTime() + minutes * 60000).toISOString()) }); }
  function toggleInvite(id: string) { setForm((current) => ({ ...current, invitee_ids: current.invitee_ids.includes(id) ? current.invitee_ids.filter((item) => item !== id) : [...current.invitee_ids, id] })); }

  async function submit(eventForm: React.FormEvent) { eventForm.preventDefault(); setError(""); if (form.event_type !== "event" && availability && !availability.available) { setError("The system found a calendar conflict. Choose one of the suggested common times before confirming the meeting."); return; } setSaving(true); try { await onSave(form); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save calendar item"); } finally { setSaving(false); } }

  function applySuggestedSlot(slot: { start_time: string; end_time: string }) { setForm((current) => ({ ...current, start_time: toLocalInput(slot.start_time), end_time: toLocalInput(slot.end_time) })); }

  return <div className="fixed inset-0 z-[210] grid place-items-center bg-black/75 p-4" onMouseDown={onClose}><form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-[#141C2F] p-5 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">{mode === "edit" ? "Edit" : "Schedule"}</p><h2 className="mt-1 text-xl font-bold text-white">{mode === "edit" ? "Update calendar item" : "New calendar item"}</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-[#0B1120] hover:text-white"><Icon name="x"/></button></div>
    {error && <div className="mt-4 rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-xs text-red-400">{error}</div>}
    <div className="mt-5 grid gap-2 sm:grid-cols-3">{allowed.map((type) => <button key={type} type="button" onClick={() => setForm({ ...form, event_type: type, online: type === "event" ? false : form.online })} className={`rounded-xl border p-3 text-left transition ${form.event_type === type ? `${TYPE_META[type].border}${TYPE_META[type].bg}` : "border-gray-800 bg-[#0B1120]"}`}><span className={`h-2 w-2 rounded-full ${TYPE_META[type].dot} inline-block mr-2`}/><strong className="text-sm text-white">{TYPE_META[type].label}</strong><small className="mt-1 block text-[10px] text-gray-500">{type === "meeting" ? "Planned collaboration" : type === "huddle" ? "Short working session" : "Organisation event"}</small></button>)}</div>
    <div className="mt-5 space-y-4"><label className="block"><span className="text-xs font-semibold text-gray-300">Title</span><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-sm text-white outline-none focus:border-[#00DF73]" placeholder="Weekly technical review" required/></label><div className="grid gap-3 sm:grid-cols-2"><label><span className="text-xs font-semibold text-gray-300">Starts</span><input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-[#00DF73]" required/></label><label><span className="text-xs font-semibold text-gray-300">Ends</span><input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="mt-1 h-11 w-full rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-[#00DF73]" required/></label></div><div className="flex flex-wrap gap-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 self-center">Quick duration</span>{[15,30,60,...(role === "admin" ? [90,120] : [])].map((minutes) => <button key={minutes} type="button" onClick={() => setDuration(minutes)} className="rounded-full border border-gray-800 bg-[#0B1120] px-2.5 py-1 text-[10px] text-gray-400 hover:border-[#00DF73]/50 hover:text-white">{minutes < 60 ? `${minutes} min` : `${minutes/60} hr`}</button>)}</div>
      <label className="block"><span className="text-xs font-semibold text-gray-300">Agenda / purpose</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full resize-none rounded-lg border border-gray-700 bg-[#0B1120] p-3 text-sm text-white outline-none focus:border-[#00DF73]" placeholder="What should participants prepare or discuss?"/></label>
      <label className="block"><span className="text-xs font-semibold text-gray-300">Linked channel <em className="font-normal text-gray-500">optional</em></span><select value={form.channel_id || ""} onChange={(e) => setForm({ ...form, channel_id: e.target.value || null })} className="mt-1 h-11 w-full rounded-lg border border-gray-700 bg-[#0B1120] px-3 text-sm text-white outline-none focus:border-[#00DF73]"><option value="">No linked channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select><small className="mt-1 block text-[10px] text-gray-600">Linked sessions automatically appear as a meeting card in that channel.</small></label>
      {form.event_type !== "event" && <div className="rounded-xl border border-gray-800 bg-[#0B1120] p-3"><div className="flex items-center justify-between gap-3"><div><strong className="text-xs text-white">Online meeting</strong><p className="mt-0.5 text-[10px] text-gray-500">Users see Join Meeting; the Jitsi room will plug into this item.</p></div><button type="button" onClick={() => setForm({ ...form, online: !form.online })} className={`relative h-6 w-11 rounded-full transition ${form.online ? "bg-[#00DF73]" : "bg-gray-700"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${form.online ? "left-6" : "left-1"}`}/></button></div></div>}
      {form.event_type !== "event" && <div><div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-300">Invite people</span><span className="text-[10px] text-gray-600">{form.invitee_ids.length} selected</span></div><label className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-gray-700 bg-[#0B1120] px-3 focus-within:border-[#00DF73]"><Icon name="search" size={14} className="text-gray-600"/><input value={inviteQuery} onChange={(e) => setInviteQuery(e.target.value)} placeholder="Search people" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-gray-600"/></label><div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-gray-800 bg-[#0B1120] p-1">{filteredPeople.map((person) => { const selected = form.invitee_ids.includes(person.id); return <button key={person.id} type="button" onClick={() => toggleInvite(person.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${selected ? "bg-[#00DF73]/10" : "hover:bg-[#141C2F]"}`}><span className={`grid h-5 w-5 place-items-center rounded border ${selected ? "border-[#00DF73] bg-[#00DF73] text-[#0B1120]" : "border-gray-700"}`}>{selected && <Icon name="check" size={12}/>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-white">{personName(person)}</strong><small className="text-[10px] text-gray-600">{person.department || "General"}</small></span></button>; })}{!filteredPeople.length && <p className="p-3 text-xs text-gray-600">No people found.</p>}</div></div>}
      {form.event_type !== "event" && <div className={`rounded-xl border p-3 ${availability?.available ? "border-[#00DF73]/30 bg-[#00DF73]/5" : availability ? "border-amber-700/50 bg-amber-950/15" : "border-gray-800 bg-[#0B1120]"}`}><div className="flex items-start justify-between gap-3"><div><strong className="text-xs text-white">System availability check</strong><p className="mt-1 text-[10px] leading-4 text-gray-500">Zibuke checks the organiser and selected invitees automatically before the meeting can be confirmed.</p></div>{checkingAvailability ? <span className="text-[10px] font-semibold text-amber-300">Checking…</span> : availability?.available ? <span className="text-[10px] font-semibold text-[#00DF73]">Available</span> : availability ? <span className="text-[10px] font-semibold text-amber-300">Conflict</span> : null}</div>{availability && <div className="mt-3 flex flex-wrap gap-2">{availability.people.map((person) => <span key={person.userId} className={`rounded-full border px-2.5 py-1 text-[10px] ${person.status === "available" ? "border-[#00DF73]/25 bg-[#00DF73]/5 text-[#67dca3]" : person.status === "tentative" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>{person.name}: {person.status}</span>)}</div>}{availability && !availability.available && availability.suggestions.length > 0 && <div className="mt-3 border-t border-gray-800 pt-3"><span className="text-[10px] font-semibold text-gray-400">Common times suggested by the system</span><div className="mt-2 flex flex-wrap gap-2">{availability.suggestions.slice(0,4).map((slot) => <button key={slot.start_time} type="button" onClick={() => applySuggestedSlot(slot)} className="rounded-lg border border-gray-700 bg-[#0B1120] px-2.5 py-2 text-[10px] text-gray-300 hover:border-[#00DF73]/50 hover:text-white">{new Date(slot.start_time).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} · {formatTime(new Date(slot.start_time))}</button>)}</div></div>}</div>}
    </div>
    <div className="mt-5 rounded-xl border border-gray-800 bg-[#0B1120] p-3 text-[11px] leading-5 text-gray-500">{role === "admin" ? "Admin: meetings, huddles and organisation events are allowed. You can manage any calendar item." : "Worker: meetings/huddles only, maximum 60 minutes, up to 30 days ahead. Add an agenda and invite people or link a channel."}</div>
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:bg-[#0B1120]">Cancel</button><button disabled={saving} className="rounded-lg bg-[#00DF73] px-4 py-2.5 text-sm font-bold text-[#0B1120] hover:bg-[#00c968] disabled:opacity-50">{saving ? "Saving…" : mode === "edit" ? "Save changes" : `Create ${TYPE_META[form.event_type].label}`}</button></div>
  </form></div>;
}

function DetailRow({ icon, label, value }: { icon: "calendar" | "clock" | "users" | "hash"; label: string; value: string }) { return <div className="flex items-start gap-3"><span className="mt-0.5 text-[#00DF73]"><Icon name={icon} size={16}/></span><div><span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</span><strong className="text-xs font-semibold text-gray-300">{value}</strong></div></div>; }
function CalendarLoading() { return <div className="grid min-h-[540px] place-items-center"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-[#00DF73]"/><p className="mt-3 text-xs text-gray-500">Loading calendar…</p></div></div>; }
function getWeekDates(offset: number) { const now = new Date(); const day = now.getDay(); const mondayOffset = day === 0 ? -6 : 1 - day; const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset + offset * 7); monday.setHours(0,0,0,0); return Array.from({ length: 5 }, (_, index) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)); }
function getTodayWeekdayIndex() { const day = new Date().getDay(); return day === 0 ? 0 : day - 1; }
function weekOffsetForDate(date: Date) { const currentMonday = getWeekDates(0)[0]; const targetDay = date.getDay(); const targetMondayOffset = targetDay === 0 ? -6 : 1 - targetDay; const targetMonday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + targetMondayOffset); targetMonday.setHours(0,0,0,0); return Math.round((targetMonday.getTime() - currentMonday.getTime()) / 604800000); }
function sameLocalDate(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function formatTime(date: Date) { return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function formatDate(date: Date) { return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function formatWeekRange(dates: Date[]) { return `${dates[0].toLocaleDateString([], { day: "numeric", month: "short" })} – ${dates[4].toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`; }
function toLocalInput(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0,16); }
function defaultTimes() { const start = new Date(); start.setSeconds(0,0); start.setMinutes(start.getMinutes() < 30 ? 30 : 0); if (start.getMinutes() === 0) start.setHours(start.getHours() + 1); if (start.getHours() < DAY_START) start.setHours(DAY_START,0,0,0); if (start.getHours() >= DAY_END) { start.setDate(start.getDate() + 1); start.setHours(DAY_START,0,0,0); } const end = new Date(start.getTime() + 30 * 60000); return { start: toLocalInput(start.toISOString()), end: toLocalInput(end.toISOString()) }; }
function isPast(event: CalendarEvent) { return new Date(event.end_time).getTime() < Date.now(); }
function personName(person: Person) { return person.name || [person.first_name, person.last_name].filter(Boolean).join(" ") || "Zibuke user"; }