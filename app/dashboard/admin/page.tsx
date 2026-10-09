"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import Link from "next/link";
import EmployeeDocuments from "@/src/modules/documents/EmployeeDocuments";
import { isSuperAdmin } from "@/src/modules/admin/superadmin";
import PopiCredentialsPanel from "@/src/modules/admin/PopiCredentialsPanel";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department: string;
  job_title?: string;
  internship_status?: string | null;
};

// --- ORGANOGRAM DEFINITIONS ---
// Map official departments to their specific job titles and auto-assign the correct access role.
// Administrator access is deliberately narrow: the Founder, Anja (Head of People & Systems),
// Developers (Software Developer) and Zimasa (People & Systems Intern). Everything else is an
// employee. Super-admin rights are separate and live in src/modules/admin/superadmin.ts.
const KEEP_TITLE = "__keep__";
const ORGANOGRAM = {
  "Zibuke Africa Office": {
    "Founder": "admin",
    "Head of People & Systems": "admin",
    "People & Systems Intern": "admin",
    "Software Developer": "admin",
    "Marketing Manager": "employee",
    "Head of Signaling": "employee",
    "Community Relations Manager": "employee",
    "Software Engineer": "employee",
    "Administrator": "employee",
    "Social Media Content Creator": "employee",
    "Marketing & Signaling Assistant": "employee",
    "Employee": "employee",
    "Intern": "employee"
  },
  "Zibuke Africa Sales": {
    "Founder": "admin",
    "Head of People & Systems": "admin",
    "Signaling Manager": "employee",
    "Signaling Accounts Executive": "employee",
    "Business Developer": "employee",
    "Employee": "employee",
    "Intern": "employee"
  },
  "Zibuke OnCall": {
    "Founder": "admin",
    "Head of People & Systems": "admin",
    "People & Systems Intern": "admin",
    "Technician Manager": "employee",
    "Sales Manager": "employee",
    "Signaling Manager": "employee",
    "Signaling Accounts Executive": "employee",
    "Business Developer": "employee",
    "Community Relations Manager": "employee",
    "Content Creator": "employee",
    "Sales Representative": "employee",
    "Service Coordinator": "employee",
    "Plumber": "employee",
    "Handyman": "employee",
    "Carpenter": "employee",
    "Driver": "employee",
    "Landscaper": "employee",
    "Appliance Repair Technician": "employee",
    "Employee": "employee",
    "Intern": "employee"
  }
} as const;

// Every job title the platform knows, collapsed ACROSS divisions, so the Job Title dropdown offers
// the full list no matter which division is selected (previously it showed only that division's
// titles, which hid e.g. "Sales Manager" unless you first picked Zibuke OnCall). The access role is
// resolved from this map instead of the division: a title that any division marks admin wins, which
// keeps Founder / Head of People & Systems / People & Systems Intern / Software Developer the only
// administrators.
const ROLE_BY_TITLE: Record<string, "admin" | "employee"> = {};
for (const division of Object.values(ORGANOGRAM)) {
  for (const [title, role] of Object.entries(division)) {
    if (role === "admin" || ROLE_BY_TITLE[title] === undefined) ROLE_BY_TITLE[title] = role;
  }
}
const ALL_TITLES = Object.keys(ROLE_BY_TITLE).sort((left, right) => left.localeCompare(right));

type DepartmentName = keyof typeof ORGANOGRAM;

export default function AdminPage() {
  const { user } = useCurrentUser();
  const superAdmin = isSuperAdmin(user?.email);
  const [activeTab, setActiveTabState] = useState<"single" | "bulk" | "manage" | "popi">("single");
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editInternshipStatus, setEditInternshipStatus] = useState<string | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<DepartmentName>("Zibuke Africa Office");
  // Default to the first available title in the selected department
  const [jobTitleValue, setJobTitle] = useState<string>("Software Developer");
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "employee">("employee");
  
  const idInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Manage Directory State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingManage, setIsLoadingManage] = useState(false);

  const validTitles=ALL_TITLES;
  // A job title the organogram does not list is PRESERVED rather than replaced. The old fallback to
  // the first title in the list silently rewrote the person's job title and — because
  // "Zibuke Africa Sales" lists "Founder" first — could quietly grant administrator access on save.
  const jobTitle=jobTitleValue===KEEP_TITLE?KEEP_TITLE:(validTitles.includes(jobTitleValue)?jobTitleValue:validTitles[0]);
  const organogramRole:"admin"|"employee"=jobTitle===KEEP_TITLE?editRole:(ROLE_BY_TITLE[jobTitle]??"employee");
  const resolvedJobTitle=jobTitle===KEEP_TITLE?(editTitle||""):jobTitle;
  const isActiveIntern=Boolean(editUserId)&&editInternshipStatus==="active";
  const accessLabel=isActiveIntern?"INTERN":(organogramRole?.toUpperCase()||"UNKNOWN");
  function setActiveTab(tab:"single"|"bulk"|"manage"|"popi"){setIsLoadingManage(tab==="manage");setActiveTabState(tab);}

  // Fetch employees when the Manage tab is opened
  useEffect(() => {
    if (activeTab === "manage") {
      fetch(`/api/people?t=${Date.now()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.people) setEmployees(data.people);
        })
        .catch(() => setMessage({ type: "error", text: "Failed to load directory." }))
        .finally(() => setIsLoadingManage(false));
    }
  }, [activeTab]);

  function handleEditClick(user: Employee) {
    setEditUserId(user.id);
    setName(`${user.first_name} ${user.last_name}`);
    setEmail(user.email);
    
    // Safety check: if they belong to an old department not in the organogram, default to Office
    const safeDept = (Object.keys(ORGANOGRAM).includes(user.department) ? user.department : "Zibuke Africa Office") as DepartmentName;
    setDepartment(safeDept);
    
    // Safety check: attempt to map their old role to a new job title
    const validTitles = ALL_TITLES;
    // If they have a job title saved, try to use it, otherwise fallback
    setEditTitle(user.job_title || "");
    setEditRole(user.role === "admin" ? "admin" : "employee");
    setJobTitle(user.job_title && validTitles.includes(user.job_title) ? user.job_title : KEEP_TITLE);
    setEditInternshipStatus(user.internship_status ?? null);
    
    setMessage(null);
    setActiveTab("single");
  }

  function cancelEdit() {
    setEditUserId(null);
    setEditInternshipStatus(null);
    setName("");
    setEmail("");
    setDepartment("Zibuke Africa Office");
    setJobTitle("Software Developer");
    setMessage(null);
  }

  async function markInternQualified() {
    if (!editUserId) return;
    const evidence = window.prompt(
      "Qualification evidence / note (stored on the internship record):",
      "Completed required training and assessments."
    );
    if (evidence === null) return;
    const [first_name, ...lastNameParts] = name.split(" ");
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/people/${editUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name,
          last_name: lastNameParts.join(" "),
          email,
          role: organogramRole,
          department,
          job_title: resolvedJobTitle,
          internship_status: "qualified",
          internship_evidence: evidence,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEditInternshipStatus("qualified");
        setEmployees((prev) => prev.map((p) => (p.id === editUserId ? { ...p, internship_status: "qualified" } : p)));
        setMessage({ type: "success", text: `${name} has been marked as qualified. Their access now shows as EMPLOYEE.` });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to mark intern as qualified." });
      }
    } catch {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteClick(id: string, fullName: string) {
    if (!window.confirm(`Archive ${fullName}? They will be removed from the directory and can no longer sign in. Their history is kept and an administrator can restore them later.`)) return;

    try {
      const res = await fetch(`/api/people/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEmployees((prev) => prev.filter((p) => p.id !== id));
        setMessage({ type: "success", text: `${fullName} has been archived and removed from the directory.` });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to remove employee." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    }
  }

  async function handleSingleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    // Auto-calculate the system role (admin vs employee) based on the chosen job title
    const systemRole = jobTitle === KEEP_TITLE ? editRole : (ROLE_BY_TITLE[jobTitle] ?? "employee");

    // --- UPDATE EXISTING EMPLOYEE ---
    if (editUserId) {
      const [first_name, ...lastNameParts] = name.split(" ");
      const last_name = lastNameParts.join(" ");

      try {
        const res = await fetch(`/api/people/${editUserId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            first_name, 
            last_name, 
            email, 
            role: systemRole, 
            department,
            job_title: resolvedJobTitle 
          }),
        });
        
        const data = await res.json();
        if (res.ok) {
          setMessage({ type: "success", text: `${name} has been successfully updated.` });
          cancelEdit();
          setActiveTab("manage"); 
        } else {
          setMessage({ type: "error", text: data.error || "Failed to update employee." });
        }
      } catch (error) {
        setMessage({ type: "error", text: "An unexpected error occurred during update." });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // --- ADD NEW EMPLOYEE ---
    const idFile = idInputRef.current?.files?.[0];
    if (!idFile) {
      setMessage({ type: "error", text: "ID Document is strictly required for new single hires." });
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append("action", "single_hire");
    formData.append("name", name);
    formData.append("email", email);
    formData.append("role", systemRole);
    formData.append("department", department);
    formData.append("job_title", resolvedJobTitle);
    formData.append("idDocument", idFile);

    try {
      const res = await fetch("/api/admin/users", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        cancelEdit();
        setMessage({
          type: "success",
          text: `${name} has been added as ${jobTitle}. Temp password: ${data.tempPassword} — share it securely.`,
        });
        if (idInputRef.current) idInputRef.current.value = "";
      } else {
        setMessage({ type: "error", text: data.error || "Failed to add employee." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBulkSubmit(e: FormEvent) {
    e.preventDefault();
    const csvFile = csvInputRef.current?.files?.[0];
    if (!csvFile) return;

    setIsSubmitting(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("file", csvFile);

    try {
      const res = await fetch("/api/admin/bulk-import", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        const issued: { email: string; tempPassword: string }[] = Array.isArray(data.credentials) ? data.credentials : [];
        const issuedDetail = issued.length ? ` Passwords — ${issued.map((c) => `${c.email}:${c.tempPassword}`).join("; ")}` : "";

        setMessage({
          type: "success",
          text: `Successfully imported ${data.count} employees.${issuedDetail}`,
        });
        if (csvInputRef.current) csvInputRef.current.value = "";
      } else {
        setMessage({ type: "error", text: data.error || "Bulk import failed." });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">
              System Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Access Management
            </h1>
            <p className="mt-2 text-gray-400">
              Control your organizational roster, manage permissions, and enforce compliance across Zibuke.
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-gray-800 bg-[#141C2F] shadow-sm overflow-hidden">
          
          {/* Tabs */}
          <div className="flex border-b border-gray-800 bg-[#0B1120]">
            <button
              onClick={() => { setActiveTab("single"); setMessage(null); if(!editUserId) cancelEdit(); }}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${activeTab === "single" ? "bg-[#141C2F] text-[#00DF73] border-b-2 border-[#00DF73]" : "text-gray-400 hover:text-white"}`}
            >
              {editUserId ? "Edit Employee Profile" : "Add Single Employee"}
            </button>
            <button
              onClick={() => { setActiveTab("bulk"); setMessage(null); cancelEdit(); }}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${activeTab === "bulk" ? "bg-[#141C2F] text-[#00DF73] border-b-2 border-[#00DF73]" : "text-gray-400 hover:text-white"}`}
            >
              Bulk Import (CSV)
            </button>
            <button
              onClick={() => { setActiveTab("manage"); setMessage(null); cancelEdit(); }}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${activeTab === "manage" ? "bg-[#141C2F] text-[#00DF73] border-b-2 border-[#00DF73]" : "text-gray-400 hover:text-white"}`}
            >
              Manage Directory
            </button>
            {superAdmin && (
              <button
                onClick={() => { setActiveTab("popi"); setMessage(null); cancelEdit(); }}
                className={`flex-1 px-6 py-4 text-sm font-medium transition ${activeTab === "popi" ? "bg-[#141C2F] text-[#00DF73] border-b-2 border-[#00DF73]" : "text-gray-400 hover:text-white"}`}
              >
                POPI & Credentials
              </button>
            )}
          </div>

          <div className="p-8">
            {message && (
              <div className={`mb-6 rounded-md p-4 text-sm ${message.type === "success" ? "bg-green-900/30 text-green-400 border border-green-800" : "bg-red-900/30 text-red-400 border border-red-800"}`}>
                {message.text}
              </div>
            )}

            {/* MANAGE TAB */}
            {activeTab === "manage" && (
              <div>
                {isLoadingManage ? (
                  <p className="text-gray-400 text-center py-10">Loading active personnel...</p>
                ) : employees.length === 0 ? (
                  <p className="text-gray-500 text-center py-10">No employees found in the directory.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-800">
                    <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
                      <thead className="bg-[#0B1120]">
                        <tr>
                          <th className="px-6 py-4 font-semibold text-gray-300">Employee</th>
                          <th className="px-6 py-4 font-semibold text-gray-300">System Access</th>
                          <th className="px-6 py-4 font-semibold text-gray-300">Division</th>
                          <th className="px-6 py-4 font-semibold text-right text-gray-300">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 bg-[#141C2F]">
                        {employees.map((emp) => (
                          <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-white">{emp.first_name} {emp.last_name}</div>
                              <div className="text-gray-500 text-xs">{emp.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              {emp.internship_status === "active" ? (
                                <span className="px-2 py-1 rounded text-xs uppercase tracking-wider font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  Intern
                                </span>
                              ) : (
                                <span className={`px-2 py-1 rounded text-xs uppercase tracking-wider font-bold ${emp.role === "admin" ? "bg-[#00DF73]/10 text-[#00DF73] border border-[#00DF73]/20" : "bg-gray-800 text-gray-400 border border-gray-700"}`}>
                                  {emp.role}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-amber-500/80">{emp.department}</div>
                              {emp.job_title && <div className="text-gray-500 text-xs">{emp.job_title}</div>}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => handleEditClick(emp)} className="text-[#00DF73] hover:text-[#00c968] font-medium mr-4 transition">
                                Edit
                              </button>
                              <button onClick={() => handleDeleteClick(emp.id, `${emp.first_name} ${emp.last_name}`)} className="text-red-500 hover:text-red-400 font-medium transition">
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SINGLE HIRE / EDIT TAB */}
            {activeTab === "single" && (
              <form onSubmit={handleSingleSubmit} className="space-y-5">
                {editUserId && (
                  <div className="flex items-center justify-between bg-amber-900/10 border border-amber-900/30 p-4 rounded-lg mb-6">
                    <p className="text-sm text-amber-500 font-medium">You are currently editing an existing employee record.</p>
                    <button type="button" onClick={cancelEdit} className="text-xs text-amber-400 hover:text-amber-300 underline">Cancel Edit</button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-white">Full Name</span>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] text-white p-2.5 text-sm outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]" required />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-white">Email Address</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] text-white p-2.5 text-sm outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]" required />
                  </label>
                </div>
                
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-white">Division / Organogram</span>
                    <select value={department} onChange={(e) => setDepartment(e.target.value as DepartmentName)} className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] text-white p-2.5 text-sm outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]">
                      {Object.keys(ORGANOGRAM).map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-medium text-white">Job Title</span>
                      <span className="text-xs text-gray-500">
                        Access: <strong className={isActiveIntern ? "text-amber-300" : organogramRole === "admin" ? "text-[#00DF73]" : "text-gray-400"}>
                          {accessLabel}
                        </strong>
                      </span>
                    </div>
                    <select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] text-white p-2.5 text-sm outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]">
                      {editUserId && <option value={KEEP_TITLE}>Keep current title ({editTitle || "unchanged"})</option>}
                      {ALL_TITLES.map((title) => (
                        <option key={title} value={title}>{title}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {isActiveIntern && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-900/40 bg-amber-900/10 p-4">
                    <div>
                      <p className="text-sm font-medium text-amber-300">Active intern — in training</p>
                      <p className="text-xs text-amber-200/70">Mark as qualified once their required training and assessments are complete. Their access then shows as EMPLOYEE everywhere.</p>
                    </div>
                    <button type="button" onClick={markInternQualified} disabled={isSubmitting} className="rounded-md bg-[#00DF73] px-4 py-2 text-sm font-bold text-[#0B1120] transition hover:bg-[#00c968] disabled:bg-gray-800 disabled:text-gray-500">
                      Mark as Qualified
                    </button>
                  </div>
                )}
                {editUserId && <a className="block my-4 text-emerald-400 underline" href={`/dashboard/training?userId=${encodeURIComponent(editUserId)}`}>View training, assessments and reporting requirements</a>}
                {editUserId && <EmployeeDocuments key={editUserId} userId={editUserId} admin />}
                {!editUserId && (
                  <label className="block border-t border-gray-800 pt-5">
                    <span className="text-sm font-medium text-white">ID Document <span className="text-red-500">*</span></span>
                    <p className="text-xs text-gray-400 mb-2">Required for all new single entries.</p>
                    <input type="file" ref={idInputRef} className="block w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-[#00DF73]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#00DF73] hover:file:bg-[#00DF73]/20 cursor-pointer" accept=".pdf,.jpg,.jpeg,.png" required />
                  </label>
                )}

                <button type="submit" disabled={isSubmitting} className="mt-4 w-full rounded-md bg-[#00DF73] py-2.5 text-sm font-bold text-[#0B1120] shadow-sm transition hover:bg-[#00c968] disabled:bg-gray-800 disabled:text-gray-500">
                  {isSubmitting ? "Processing..." : editUserId ? "Update Employee Profile" : "Add to Directory"}
                </button>
              </form>
            )}

            {/* BULK UPLOAD TAB */}
            {activeTab === "bulk" && (
              <form onSubmit={handleBulkSubmit} className="space-y-5">
                <div className="rounded-md bg-amber-900/20 p-4 border border-amber-800/50">
                  <h3 className="text-sm font-bold text-amber-500">Legacy Exemption Notice</h3>
                  <p className="mt-1 text-xs text-amber-200/70">
                    Importing via CSV bypasses the strict ID document upload requirement. Users will be marked as &quot;LEGACY_EXEMPT&quot;. Ensure your CSV includes a &quot;job_title&quot; column matching the official organogram to set correct permissions.
                  </p>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-white">Upload Roster (.csv or .xlsx)</span>
                  <input type="file" ref={csvInputRef} className="mt-2 block w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-[#00DF73]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#00DF73] hover:file:bg-[#00DF73]/20 cursor-pointer" accept=".csv,.xlsx,.xlsm,.xls" required />
                </label>

                <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-[#00DF73] py-2.5 text-sm font-bold text-[#0B1120] shadow-sm transition hover:bg-[#00c968] disabled:bg-gray-800 disabled:text-gray-500">
                  {isSubmitting ? "Importing..." : "Process Bulk Upload"}
                </button>
              </form>
            )}

            {/* POPI & CREDENTIALS — rendered only for the three super-admin emails */}
            {activeTab === "popi" && superAdmin && <PopiCredentialsPanel />}

          </div>
        </div>
      </div>
    </main>
  );
}
