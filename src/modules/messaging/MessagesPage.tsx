"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/src/modules/shared/Icons";

type Colleague = { id: string; first_name?: string; last_name?: string; name?: string; department?: string };

export default function MessagesPage() {
  const [people, setPeople] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`/api/messages?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setPeople(data.users || []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((person) => !q || `${displayName(person)} ${person.department || ""}`.toLowerCase().includes(q));
  }, [people, query]);

  const grouped = useMemo(() => filtered.reduce<Record<string, Colleague[]>>((acc, person) => {
    const department = person.department || "General";
    (acc[department] ||= []).push(person);
    return acc;
  }, {}), [filtered]);

  return (
    <main className="min-h-screen bg-[#0B1120] p-5 text-white sm:p-8 xl:p-10">
      <div className="mx-auto flex max-w-6xl flex-col">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">Direct messages</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Chat</h1>
          <p className="mt-1 text-sm text-gray-400">Private one-to-one conversations with people in Zibuke Central.</p>
        </header>

        <section className="grid min-h-[620px] overflow-hidden rounded-xl border border-gray-800 bg-[#141C2F] shadow-sm lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-gray-800 lg:border-b-0 lg:border-r">
            <div className="border-b border-gray-800 p-4">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-700 bg-[#0B1120] px-3 focus-within:border-[#00DF73]"><Icon name="search" size={16} className="text-gray-500"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600" /></label>
            </div>
            <div className="max-h-[620px] overflow-y-auto p-3">
              {loading ? <div className="p-4 text-sm text-gray-500">Loading conversations…</div> : Object.keys(grouped).length === 0 ? <div className="p-4 text-sm text-gray-500">No people found.</div> : Object.entries(grouped).map(([department, members]) => (
                <div key={department} className="mb-5">
                  <h2 className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">{department}</h2>
                  <div className="space-y-1">
                    {members.map((person) => <Link key={person.id} href={`/dashboard/messages/${encodeURIComponent(person.id)}`} className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition hover:bg-[#0B1120]">
                      <Avatar name={displayName(person)} />
                      <div className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold text-gray-200">{displayName(person)}</strong><span className="block truncate text-xs text-gray-500">Direct message</span></div>
                      <Icon name="chevronRight" size={15} className="text-gray-600"/>
                    </Link>)}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="grid place-items-center bg-[#0B1120]/45 p-8 text-center">
            <div className="max-w-sm"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-gray-800 bg-[#141C2F] text-[#00DF73]"><Icon name="chat" size={30}/></div><h2 className="mt-5 text-lg font-bold text-white">Choose a conversation</h2><p className="mt-2 text-sm leading-6 text-gray-500">Select a person from the directory to start or continue a private conversation. Team discussions stay in Channels.</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}

function displayName(person: Colleague) { return person.name || [person.first_name, person.last_name].filter(Boolean).join(" ") || "Zibuke user"; }
function Avatar({ name }: { name: string }) { const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ZU"; return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gray-700 bg-[#0B1120] text-xs font-bold text-[#00DF73]">{initials}</span>; }
