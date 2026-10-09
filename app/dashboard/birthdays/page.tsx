"use client";

import { useState, useEffect, FormEvent } from "react";

type EmployeeBirthday = {
  id: string;
  name: string;
  department: string;
  date_of_birth: string; // Expected format: YYYY-MM-DD
};

export default function BirthdaysPage() {
  const [birthdays, setBirthdays] = useState<EmployeeBirthday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // For the self-update form
  const [myDob, setMyDob] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    fetchBirthdays();
  }, []);

  async function fetchBirthdays() {
    try {
      const res = await fetch("/api/birthdays");
      const data = await res.json();
      if (data.birthdays) setBirthdays(data.birthdays);
    } catch (error) {
      console.error("Failed to load birthdays", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateDob(e: FormEvent) {
    e.preventDefault();
    if (!myDob) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/birthdays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_of_birth: myDob }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Birthday updated successfully!" });
        setMyDob("");
        fetchBirthdays();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to update birthday." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Helper to format the date nicely (e.g., "Oct 24")
  function formatBirthday(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-5xl">
        
        <header className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">
              Team Culture
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Upcoming Birthdays
            </h1>
            <p className="mt-2 text-gray-400">
              Celebrate your colleagues and track upcoming milestones across the company.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
          
          {/* Add Your Birthday Form */}
          <aside>
            <form onSubmit={handleUpdateDob} className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-white">Add Your Birthday</h2>
              <p className="mb-4 text-sm text-gray-400">
                Missing from the calendar? Add your birth date so the team can celebrate with you.
              </p>
              
              {message && (
                <div className={`mb-4 rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-900/30 text-green-400 border border-green-800" : "bg-red-900/30 text-red-400 border border-red-800"}`}>
                  {message.text}
                </div>
              )}

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-white">Date of Birth</span>
                  <input
                    type="date"
                    value={myDob}
                    onChange={(e) => setMyDob(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73] [color-scheme:dark]"
                    required
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || !myDob}
                  className="mt-2 w-full rounded-md bg-[#00DF73] py-2.5 text-sm font-bold text-[#0B1120] shadow-sm transition hover:bg-[#00c968] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {isSubmitting ? "Updating..." : "Update Profile"}
                </button>
              </div>
            </form>
          </aside>

          {/* Birthdays Directory */}
          <section className="space-y-4">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center rounded-xl border border-gray-800 bg-[#141C2F] shadow-sm">
                <p className="text-gray-400">Loading calendar...</p>
              </div>
            ) : birthdays.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-800 bg-[#141C2F] py-16 text-center">
                <p className="text-sm font-medium text-gray-400">No birthdays recorded yet.</p>
                <p className="mt-1 text-xs text-gray-500">Use the form to add yours to the calendar!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {birthdays.map((person) => (
                  <div key={person.id} className="flex items-center gap-4 rounded-xl border border-gray-800 bg-[#141C2F] p-5 shadow-sm transition hover:border-[#00DF73]/50 hover:shadow-md">
                    <div className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-[#00DF73]/10 font-bold text-[#00DF73]">
                      <span className="text-[10px] uppercase leading-none">
                        {new Date(person.date_of_birth).toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="text-lg leading-tight mt-1">
                        {new Date(person.date_of_birth).getDate()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{person.name}</h3>
                      <p className="text-xs font-medium text-amber-500">{person.department}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}