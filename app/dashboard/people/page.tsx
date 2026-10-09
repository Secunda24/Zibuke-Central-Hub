"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department: string;
  job_title?: string;
  appointed_manager?: string | null;
  internship_status?: string | null;
  qualified_at?: string | null;
  has_id_document: boolean;
  id_verified: boolean;
  identity_information_supplied: boolean;
  created_at: string;
  phone?: string; 
};

function EmployeeAvatar({ userId, firstName }: { userId: string; firstName: string }) {
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
      alt={firstName}
      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-gray-700"
      onError={() => setError(true)}
    />
  );
}

export default function PeopleDirectoryPage() {
  const router = useRouter();
  const [people, setPeople] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("employee");
  const [currentUser, setCurrentUser] = useState<{id:string;role:string;first_name?:string;last_name?:string}|null>(null);
  const [isCalling, setIsCalling] = useState<string | null>(null);
  const [selectedSubDept, setSelectedSubDept] = useState<string>("All");
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Synthetic job-title option: interns are marked by an active internship record, not by their
  // job title, so "Intern" as a literal title would miss everyone training in another role.
  const INTERNS_OPTION = "__interns__";

  const divisions = ["All", "Zibuke OnCall", "Zibuke Africa Office", "Zibuke Africa Sales"];

  useEffect(() => {
    async function fetchData() {
      try {
        const peopleRes = await fetch(`/api/people?t=${Date.now()}`, { cache: "no-store" });
        const peopleData = await peopleRes.json();
        if (peopleData.people) setPeople(peopleData.people);

        const profileRes = await fetch(`/api/settings/profile`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.user) {
            setCurrentUser(profileData.user);
            if (profileData.user.role) setCurrentUserRole(profileData.user.role.toLowerCase());
          }
        }
      } catch (error) {
        console.error("Failed to load directory data", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  async function handleCall(person: Employee) {
    if (!currentUser) return;
    setIsCalling(person.id);
    
    try {
      const roomName = `Zibuke-Direct-${crypto.randomUUID()}`;
      const response = await fetch("/api/calls/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerId: currentUser.id,
          callerName: `${currentUser.first_name} ${currentUser.last_name || ""}`.trim(),
          targetUserId: person.id,
          roomName: roomName
        })
      });
      if (!response.ok) throw new Error("Could not send the call invitation. Please retry.");
      router.push(`/dashboard/call?room=${encodeURIComponent(roomName)}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not start the call.");
    } finally {
      setIsCalling(null);
    }
  }

  const tabPeople = activeTab === "All"
    ? people
    : people.filter((p) => p.department && p.department.includes(activeTab));

  // Sub-department options come from the people in the active tab; job titles narrow to the chosen
  // sub-department so the second dropdown only offers titles that actually exist in the first.
  const subDepartments = useMemo(
    () => Array.from(new Set(tabPeople.map((p) => p.department).filter(Boolean) as string[])).sort(),
    [tabPeople]
  );
  const jobTitles = useMemo(
    () => Array.from(new Set(
      tabPeople
        .filter((p) => selectedSubDept === "All" || p.department === selectedSubDept)
        .map((p) => p.job_title)
        .filter(Boolean) as string[]
    )).sort(),
    [tabPeople, selectedSubDept]
  );

  const filteredPeople = tabPeople.filter((p) => {
    if (selectedSubDept !== "All" && p.department !== selectedSubDept) return false;
    if (selectedJobTitle === INTERNS_OPTION) {
      if (p.internship_status !== "active") return false;
    } else if (selectedJobTitle !== "All" && (p.job_title || "") !== selectedJobTitle) return false;
    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed) {
      // Search across everything shown on the card, not just the name, so a job title, division,
      // email or manager can be typed to find someone.
      const haystack = [
        p.first_name,
        p.last_name,
        p.job_title,
        p.department,
        p.email,
        p.appointed_manager,
        p.internship_status === "active" ? "intern interns in training" : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(trimmed)) return false;
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">Company Directory</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">People & Systems</h1>
            <p className="mt-2 text-gray-400">Find colleagues and contact details across all Zibuke divisions.</p>
          </div>
          {currentUserRole === "admin" && (
            <Link href="/dashboard/admin" className="rounded-md bg-[#00DF73] px-4 py-2 text-sm font-bold text-[#0B1120] transition hover:bg-[#00c968]">
              + Add Employee
            </Link>
          )}
        </header>

        <div className="mb-4 flex space-x-2 border-b border-gray-800 pb-px">
          {divisions.map((division) => (
            <button key={division} onClick={() => { setActiveTab(division); setSelectedSubDept("All"); setSelectedJobTitle("All"); }} className={`px-4 py-2.5 text-sm font-medium transition-colors ${activeTab === division ? "border-b-2 border-[#00DF73] text-[#00DF73]" : "text-gray-500 hover:text-white"}`}>
              {division}
            </button>
          ))}
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <select value={selectedSubDept} onChange={(e) => { setSelectedSubDept(e.target.value); setSelectedJobTitle("All"); }} className="h-10 rounded-lg border border-gray-700 bg-[#1E232B] px-3 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]">
            <option value="All">All Sub-Departments</option>
            {subDepartments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
          </select>
          <select value={selectedJobTitle} onChange={(e) => setSelectedJobTitle(e.target.value)} className="h-10 rounded-lg border border-gray-700 bg-[#1E232B] px-3 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]">
            <option value="All">All Job Titles</option>
            <option value={INTERNS_OPTION}>Interns (in training)</option>
            {jobTitles.map((title) => <option key={title} value={title}>{title}</option>)}
          </select>
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name, title, division or email..." className="h-10 w-full max-w-xs rounded-lg border border-gray-700 bg-[#1E232B] px-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]" />
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-gray-800 bg-[#141C2F]">
            <p className="text-gray-500">Loading directory...</p>
          </div>
        ) : filteredPeople.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-800 bg-[#141C2F] py-16 text-center">
            <p className="text-sm font-medium text-gray-400">No employees found in this division.</p>
            <p className="mt-1 text-xs text-gray-500">Users added via the Admin panel will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPeople.map((person) => (
              <div key={person.id} className="relative rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm transition flex flex-col justify-between hover:border-[#00DF73]/30 hover:shadow-lg">
                
                <div>
                  <div className="mb-4 flex items-start justify-between">
                    <EmployeeAvatar userId={person.id} firstName={person.first_name} />
                    {person.internship_status === "active" && (
                      <span className="rounded-full bg-[#00DF73]/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#00DF73] ring-1 ring-[#00DF73]/40">Intern</span>
                    )}
                    {person.internship_status === "qualified" && (
                      <span className="rounded-full bg-gray-700/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-300 ring-1 ring-gray-600">Qualified</span>
                    )}

                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-white">{[person.first_name, person.last_name].flatMap(value => (value || "").trim().split(/\s+/)).filter(value => value && !/^(null|undefined)$/i.test(value)).join(" ")}</h3>
                    <p className="text-sm font-medium text-amber-500">{person.department}</p>
                    <p className="mt-0.5 text-xs font-semibold text-[#00DF73]">{person.job_title || "Pending Job Title"}{person.appointed_manager ? ` (Manager: ${person.appointed_manager})` : ""}</p>
                    {person.internship_status==='active'&&<p className="mt-1 text-xs text-amber-200/90">In training until qualified</p>}
                    <p className="mt-1 truncate text-sm text-gray-400">{person.email}</p>
                    {person.phone && <p className="mt-1 text-sm text-gray-400">{person.phone}</p>}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end border-t border-gray-800 pt-4">
                  <div className="flex items-center gap-1.5">
                    <Link href={`/dashboard/messages/${person.id}`} className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-800 text-gray-400 transition hover:bg-[#00DF73] hover:text-[#0B1120]">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" /></svg>
                    </Link>
                    <a href={`mailto:${person.email}`} className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-800 text-gray-400 transition hover:bg-[#00DF73] hover:text-[#0B1120]">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                    </a>
                    <button onClick={() => handleCall(person)} disabled={isCalling === person.id} className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-800 text-gray-400 transition hover:bg-[#00DF73] hover:text-[#0B1120] disabled:opacity-50" title={`Call ${person.first_name}`}>
                      {isCalling === person.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" /> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.48-4.18-7.076-7.076l1.293-.97c.362-.271.527-.733.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>}
                    </button>
                    {person.phone ? (
                      <a href={`https://wa.me/${person.phone.replace(/\D/g, "").replace(/^0(?=\d{9}$)/, "27")}`} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-md bg-[#25D366]/20 text-[#25D366] transition hover:bg-[#25D366] hover:text-[#0B1120]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12.031 21.173c-1.583 0-3.125-.426-4.48-1.233l-4.975 1.306 1.328-4.851c-.886-1.423-1.353-3.076-1.353-4.783 0-4.945 4.025-8.97 8.97-8.97 4.946 0 8.971 4.025 8.971 8.97s-4.025 8.97-8.97 8.97zm0-16.14c-3.953 0-7.172 3.22-7.172 7.172 0 1.265.33 2.502.955 3.593l-.841 3.072 3.146-.826c1.05.572 2.234.873 3.46.873 3.953 0 7.17-3.22 7.17-7.17s-3.217-7.171-7.17-7.171zm3.931 9.774c-.216-.108-1.275-.629-1.472-.701-.197-.073-.341-.108-.485.108-.143.217-.554.701-.679.845-.125.144-.251.162-.467.054-1.047-.525-1.921-1.098-2.651-2.115-.187-.26-.021-.402.086-.508.097-.096.216-.252.324-.378.108-.126.144-.216.216-.36.072-.144.036-.271-.018-.378-.054-.108-.485-1.171-.665-1.603-.175-.421-.353-.364-.485-.37-.125-.006-.269-.006-.413-.006-.144 0-.378.054-.576.271-.197.216-.755.738-.755 1.799s.773 2.088.881 2.232c.108.144 1.523 2.325 3.689 3.262 1.341.58 1.834.629 2.505.534.549-.077 1.275-.521 1.455-1.025.18-.504.18-.936.126-1.025-.054-.09-.198-.144-.414-.252z" /></svg>
                      </a>
                    ) : (
                      <button disabled className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-800 text-gray-600 cursor-not-allowed">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12.031 21.173c-1.583 0-3.125-.426-4.48-1.233l-4.975 1.306 1.328-4.851c-.886-1.423-1.353-3.076-1.353-4.783 0-4.945 4.025-8.97 8.97-8.97 4.946 0 8.971 4.025 8.971 8.97s-4.025 8.97-8.97 8.97zm0-16.14c-3.953 0-7.172 3.22-7.172 7.172 0 1.265.33 2.502.955 3.593l-.841 3.072 3.146-.826c1.05.572 2.234.873 3.46.873 3.953 0 7.17-3.22 7.17-7.17s-3.217-7.171-7.17-7.171zm3.931 9.774c-.216-.108-1.275-.629-1.472-.701-.197-.073-.341-.108-.485.108-.143.217-.554.701-.679.845-.125.144-.251.162-.467.054-1.047-.525-1.921-1.098-2.651-2.115-.187-.26-.021-.402.086-.508.097-.096.216-.252.324-.378.108-.126.144-.216.216-.36.072-.144.036-.271-.018-.378-.054-.108-.485-1.171-.665-1.603-.175-.421-.353-.364-.485-.37-.125-.006-.269-.006-.413-.006-.144 0-.378.054-.576.271-.197.216-.755.738-.755 1.799s.773 2.088.881 2.232c.108.144 1.523 2.325 3.689 3.262 1.341.58 1.834.629 2.505.534.549-.077 1.275-.521 1.455-1.025.18-.504.18-.936.126-1.025-.054-.09-.198-.144-.414-.252z" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
