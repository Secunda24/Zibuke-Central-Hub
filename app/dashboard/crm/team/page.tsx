"use client";

import { useEffect, useState } from "react";

type TeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  department: string;
  job_title: string | null;
  log_count: number;
  last_logged_at: string | null;
};

type Entry = { id: string; metric_type: string; metric_value: string; notes: string; logged_at: string };

type Detail = {
  employee: { id: string; first_name: string | null; last_name: string | null; email: string; department: string; job_title: string | null };
  entries: Entry[];
};

const fullName = (first: string | null, last: string | null) => `${first || ""} ${last || ""}`.replace(/\s+/g, " ").trim() || "Unnamed employee";

function EmployeeAvatar({ userId, firstName }: { userId: string; firstName: string | null }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#00DF73]/10 text-lg font-bold text-[#00DF73]">
        {firstName ? firstName.charAt(0).toUpperCase() : "?"}
      </div>
    );
  }
  return (
    <img
      src={`/api/settings/avatar?userId=${userId}`}
      alt={firstName || "Employee"}
      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-gray-700"
      onError={() => setError(true)}
    />
  );
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [managerName, setManagerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm/team?t=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok) {
          setTeam(Array.isArray(data.team) ? data.team : []);
          setManagerName(String(data.managerName || ""));
        } else {
          setError(data.error || "Could not load your team.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your team.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openEmployee(member: TeamMember) {
    setSelected(member);
    setDetail(null);
    setDetailError("");
    setIsDetailLoading(true);
    fetch(`/api/crm/team/${member.id}`, { cache: "no-store" })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (ok) setDetail(data as Detail);
        else setDetailError(data.error || "Could not load that employee's metrics.");
      })
      .catch(() => setDetailError("Could not load that employee's metrics."))
      .finally(() => setIsDetailLoading(false));
  }

  function closeModal() {
    setSelected(null);
    setDetail(null);
    setDetailError("");
  }

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">Internal CRM</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">My team</h1>
          <p className="mt-2 text-gray-400">
            {managerName ? `Employees assigned to ${managerName}.` : "Employees assigned to you."} Select someone to review their logged metrics.
          </p>
        </header>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-gray-800 bg-[#141C2F]">
            <p className="text-gray-500">Loading your team...</p>
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-red-800 bg-red-900/20 p-6 text-center">
            <p className="mb-2 font-bold text-red-500">Error Loading Data</p>
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : team.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-800 bg-[#141C2F] py-16 text-center">
            <p className="font-medium text-gray-300">No one is assigned to you yet</p>
            <p className="mt-1 text-sm text-gray-500">This view lists employees whose appointed manager is your name.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <button
                type="button"
                key={member.id}
                onClick={() => openEmployee(member)}
                className="relative rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm transition flex flex-col justify-between text-left hover:border-[#00DF73]/30 hover:shadow-lg"
              >
                <div>
                  <div className="mb-4 flex items-start justify-between">
                    <EmployeeAvatar userId={member.id} firstName={member.first_name} />
                    <span className="rounded-full bg-gray-700/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-300 ring-1 ring-gray-600">
                      {member.log_count} {member.log_count === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{fullName(member.first_name, member.last_name)}</h3>
                    <p className="text-sm font-medium text-amber-500">{member.department}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#00DF73]">{member.job_title || "Pending Job Title"}</p>
                    <p className="mt-1 truncate text-sm text-gray-400">{member.email}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {member.last_logged_at ? `Last logged ${new Date(member.last_logged_at).toLocaleDateString()}` : "Nothing logged yet"}
                    </p>
                  </div>
                </div>
                <div className="mt-6 border-t border-gray-800 pt-4 text-sm font-semibold text-[#00DF73]">View metrics</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[210] grid place-items-center bg-black/75 p-4" onMouseDown={closeModal}>
          <div
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-700 bg-[#141C2F] p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00DF73]">Logged metrics</p>
                <h2 className="mt-1 text-xl font-bold text-white">{fullName(selected.first_name, selected.last_name)}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {selected.department}
                  {selected.job_title ? ` · ${selected.job_title}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-[#0B1120] hover:text-white"
              >
                ✕
              </button>
            </div>

            {isDetailLoading ? (
              <p className="py-10 text-center text-sm text-gray-500">Loading entries...</p>
            ) : detailError ? (
              <div className="mt-4 rounded-lg border border-red-900 bg-red-950/20 px-3 py-2 text-xs text-red-400">{detailError}</div>
            ) : !detail || detail.entries.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">This employee has not logged any metrics yet.</p>
            ) : (
              <ul className="mt-5 divide-y divide-gray-800">
                {detail.entries.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#00DF73]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#00DF73] ring-1 ring-[#00DF73]/30">
                          {entry.metric_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-semibold text-white">{entry.metric_value}</span>
                      </div>
                      {entry.notes && <p className="mt-1 text-sm text-gray-400">{entry.notes}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">{new Date(entry.logged_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-700 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-[#0B1120]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
