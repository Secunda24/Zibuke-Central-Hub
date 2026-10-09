"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DIVISIONS = ["Zibuke Africa Office", "Zibuke Africa Sales", "Zibuke OnCall"];

type EmployeeOption = { id: string; first_name: string | null; last_name: string | null; department: string };

type PopiDocument = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  employee_id: string | null;
  employee_name: string | null;
  employee_department: string | null;
};

type CreatedAccount = { name: string; email: string; password: string };

const PASSWORD_CLASSES = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%^&*()-_=+[]{}?"];

function randomInt(max: number) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

// 24 characters drawn from crypto.getRandomValues, guaranteed to contain at least one
// lower-case, upper-case, digit and symbol, then shuffled so the classes aren't positional.
function generateSecurePassword(length = 24) {
  const all = PASSWORD_CLASSES.join("");
  const chars: string[] = PASSWORD_CLASSES.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function employeeLabel(employee: { first_name: string | null; last_name: string | null }) {
  return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || "Unnamed employee";
}

export default function PopiCredentialsPanel() {
  const [documents, setDocuments] = useState<PopiDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [vaultMessage, setVaultMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentsOnly, setDocumentsOnly] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [jobTitle, setJobTitle] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/popi?t=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok) setDocuments(Array.isArray(data.documents) ? data.documents : []);
        else setVaultMessage({ type: "error", text: data.error || "Could not load the vault." });
      })
      .catch(() => {
        if (!cancelled) setVaultMessage({ type: "error", text: "Could not load the vault." });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Active employees for the picker. /api/people already excludes archived accounts.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/people?t=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (cancelled || !ok || !Array.isArray(data.people)) return;
        setEmployees(
          data.people.map((person: EmployeeOption) => ({
            id: person.id,
            first_name: person.first_name,
            last_name: person.last_name,
            department: person.department,
          }))
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const employeeMatches = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    const matches = term
      ? employees.filter(
          (employee) => employeeLabel(employee).toLowerCase().includes(term) || (employee.department || "").toLowerCase().includes(term)
        )
      : employees;
    // Every match is listed — the container scrolls. The old 8-item cap is why only a handful of
    // names ever appeared here.
    return matches;
  }, [employees, employeeSearch]);

  // Every active employee appears with their documents attached, so the vault reads as a complete
  // roster instead of only the people who happen to have filed something. The roster comes from the
  // live employee list, so a new hire appears automatically the next time this panel loads.
  const groups = useMemo(() => {
    const term = documentSearch.trim().toLowerCase();
    const byEmployee = new Map<string, PopiDocument[]>();
    const unassigned: PopiDocument[] = [];
    for (const document of documents) {
      if (!document.employee_id) { unassigned.push(document); continue; }
      const list = byEmployee.get(document.employee_id) || [];
      list.push(document);
      byEmployee.set(document.employee_id, list);
    }
    const rows = employees.map((employee) => ({
      key: employee.id,
      title: employeeLabel(employee),
      department: employee.department || "",
      docs: byEmployee.get(employee.id) || [],
    }));
    if (unassigned.length) rows.push({ key: "__unassigned__", title: "Unassigned", department: "", docs: unassigned });
    const filtered = term
      ? rows.filter((row) => row.title.toLowerCase().includes(term) || row.department.toLowerCase().includes(term))
      : rows;
    const visible = documentsOnly ? filtered.filter((row) => row.docs.length > 0) : filtered;
    return visible.sort((left, right) => {
      if (left.key === "__unassigned__") return 1;
      if (right.key === "__unassigned__") return -1;
      return left.title.localeCompare(right.title);
    });
  }, [documents, employees, documentSearch, documentsOnly]);

  async function refreshVault() {
    try {
      const res = await fetch(`/api/admin/popi?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data.documents)) setDocuments(data.documents);
    } catch {
      // Keep the current list; the message below already reports the outcome.
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return;
    if (!selectedEmployee) {
      setVaultMessage({ type: "error", text: "Select an employee before uploading a document." });
      return;
    }
    setIsUploading(true);
    setVaultMessage(null);
    const formData = new FormData();
    formData.append("employee_id", selectedEmployee.id);
    formData.append("file", file);
    try {
      const res = await fetch("/api/admin/popi", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.document) {
        await refreshVault();
        setVaultMessage({
          type: "success",
          text: `${data.document.filename} filed under ${employeeLabel(selectedEmployee)}.`,
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setVaultMessage({ type: "error", text: data.error || "Upload failed." });
      }
    } catch {
      setVaultMessage({ type: "error", text: "Upload failed." });
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  }

  async function removeDocument(document: PopiDocument) {
    if (!window.confirm(`Permanently delete ${document.filename} from the POPI vault? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/popi/${document.id}`, { method: "DELETE" });
    if (res.ok) {
      setDocuments((prev) => prev.filter((entry) => entry.id !== document.id));
      setVaultMessage({ type: "success", text: `${document.filename} removed.` });
    } else {
      const data = await res.json().catch(() => ({}));
      setVaultMessage({ type: "error", text: data.error || "Could not remove the document." });
    }
  }

  async function copyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setCredentialMessage({ type: "error", text: "Generate a secure password first." });
      return;
    }
    setIsSubmitting(true);
    setCredentialMessage(null);
    try {
      const res = await fetch("/api/admin/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, division, jobTitle, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreated({ name, email, password });
        setCredentialMessage({ type: "success", text: `Account created for ${name}. Hand over the password below.` });
        setName("");
        setEmail("");
        setJobTitle("");
        setPassword("");
      } else {
        setCredentialMessage({ type: "error", text: data.error || "Could not create the account." });
      }
    } catch {
      setCredentialMessage({ type: "error", text: "Could not create the account." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const canUpload = Boolean(selectedEmployee);

  return (
    <div className="space-y-8">
      {/* ---------- POPI VAULT ---------- */}
      <section className="rounded-lg border border-amber-900/40 bg-amber-900/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-amber-300">POPI Vault</h2>
            <p className="mt-1 text-xs text-amber-200/70">
              Restricted compliance storage. Documents are filed per employee in an isolated R2 bucket and only visible
              to the three designated super admins. Handle with care — POPI regulated.
            </p>
          </div>
          <span className="shrink-0 rounded border border-red-500/30 bg-red-900/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-300">
            Confidential
          </span>
        </div>

        {/* Employee picker — required before a file can be filed */}
        <div className="mt-5">
          <span className="text-sm font-medium text-amber-200">
            File this document under <span className="text-red-400">*</span>
          </span>
          {selectedEmployee ? (
            <div className="mt-1 flex items-center justify-between gap-3 rounded-md border border-gray-700 bg-[#1E232B] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{employeeLabel(selectedEmployee)}</p>
                <p className="truncate text-xs text-gray-500">{selectedEmployee.department}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEmployee(null);
                  setEmployeeSearch("");
                }}
                className="shrink-0 text-xs font-medium text-amber-300 transition hover:text-amber-200"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder="Search employees by name or department..."
                className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]"
              />
              <ul className="mt-2 max-h-72 divide-y divide-gray-800 overflow-y-auto rounded-md border border-gray-800 bg-[#1E232B]">
                {employeeMatches.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-gray-500">No matching employees.</li>
                ) : (
                  employeeMatches.map((employee) => (
                    <li key={employee.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployee(employee);
                          setEmployeeSearch("");
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-white/5"
                      >
                        <span className="truncate text-sm text-white">{employeeLabel(employee)}</span>
                        <span className="shrink-0 text-xs text-gray-500">{employee.department}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>

        <div
          onDragOver={(event) => {
            if (!canUpload) return;
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            if (!canUpload) return;
            event.preventDefault();
            void uploadFile(event.dataTransfer.files?.[0]);
          }}
          onClick={() => {
            if (canUpload) fileInputRef.current?.click();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (canUpload && (event.key === "Enter" || event.key === " ")) fileInputRef.current?.click();
          }}
          className={`mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
            !canUpload
              ? "cursor-not-allowed border-gray-700 bg-black/20"
              : isDragging
                ? "cursor-pointer border-amber-400 bg-amber-900/20"
                : "cursor-pointer border-amber-900/50 hover:border-amber-700"
          }`}
        >
          <p className={`text-sm font-medium ${canUpload ? "text-amber-200" : "text-gray-500"}`}>
            {isUploading ? "Encrypting and uploading..." : canUpload ? "Drag & drop a document here" : "Select an employee first"}
          </p>
          <p className={`mt-1 text-xs ${canUpload ? "text-amber-200/60" : "text-gray-600"}`}>
            {canUpload ? "PDF, JPEG or PNG · up to 10 MB · or click to browse" : "Choose the employee this document belongs to above."}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(event) => void uploadFile(event.target.files?.[0])}
          />
        </div>

        {vaultMessage && (
          <div className={`mt-4 rounded-md border p-3 text-sm ${vaultMessage.type === "success" ? "border-green-800 bg-green-900/30 text-green-400" : "border-red-800 bg-red-900/30 text-red-400"}`}>
            {vaultMessage.text}
          </div>
        )}

        {/* Search + grouped document list */}
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><h3 className="text-sm font-semibold text-amber-200">Employees ({employees.length})</h3><button type="button" onClick={() => setDocumentsOnly((value) => !value)} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${documentsOnly ? "border-[#00DF73]/50 text-[#00DF73]" : "border-gray-700 text-gray-400 hover:text-white"}`}>{documentsOnly ? "Showing only employees with documents" : "Showing all employees"}</button></div>
            <input
              type="text"
              value={documentSearch}
              onChange={(event) => setDocumentSearch(event.target.value)}
              placeholder="Filter by employee name..."
              className="w-full max-w-xs rounded-md border border-gray-700 bg-[#0B1120] px-3 py-2 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]"
            />
          </div>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-gray-400">Loading vault contents...</p>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              {documentsOnly ? "No POPI documents stored yet." : "No employees match that filter."}
            </p>
          ) : (
            <div className="mt-3 space-y-4">
              {groups.map((group) => (
                <div key={group.key} className="overflow-hidden rounded-lg border border-gray-700 bg-[#1E232B]">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-700 bg-black/20 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{group.title}</p>
                      {group.department && <p className="truncate text-xs text-gray-500">{group.department}</p>}
                    </div>
                    <span className="shrink-0 rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                      {group.docs.length} {group.docs.length === 1 ? "file" : "files"}
                    </span>
                  </div>
                  <ul className="divide-y divide-gray-800">
                    {group.docs.map((document) => (
                      <li key={document.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{document.filename}</p>
                          <p className="text-xs text-gray-500">
                            {formatSize(document.size)} · {new Date(document.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          <a href={`/api/admin/popi/${document.id}`} className="text-sm font-medium text-[#00DF73] transition hover:text-[#00c968]">
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => void removeDocument(document)}
                            className="text-sm font-medium text-red-500 transition hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- CREDENTIAL GENERATOR ---------- */}
      <section className="rounded-lg border border-gray-800 bg-[#1E232B] p-6">
        <h2 className="text-lg font-bold text-white">New Hire Credentials</h2>
        <p className="mt-1 text-xs text-gray-400">
          Creates the account immediately with the password you generate. Share it over a secure channel and ask them to
          change it after first login.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white">Full Name</span>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} required className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-white">Email Address</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]" />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white">Division</span>
              <select value={division} onChange={(event) => setDivision(event.target.value)} className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]">
                {DIVISIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-white">Job Title</span>
              <input type="text" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} required className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]" />
            </label>
          </div>

          <div className="rounded-lg border border-gray-800 bg-[#0B1120] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">Secure Password</span>
              <button type="button" onClick={() => { setPassword(generateSecurePassword()); setCopied(false); }} className="rounded-md bg-[#00DF73] px-4 py-2 text-sm font-bold text-[#0B1120] transition hover:bg-[#00c968]">
                Generate Secure Password
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <code className="flex-1 overflow-x-auto rounded-md border border-gray-700 bg-[#1E232B] px-3 py-2 font-mono text-sm text-green-500">
                {password || "No password generated yet"}
              </code>
              <button type="button" onClick={() => void copyPassword()} disabled={!password} className="rounded-md border border-gray-700 px-3 py-2 text-sm font-medium text-gray-300 transition hover:text-white disabled:opacity-40">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">24 characters, mixing letters, numbers and symbols.</p>
          </div>

          {credentialMessage && (
            <div className={`rounded-md border p-3 text-sm ${credentialMessage.type === "success" ? "border-green-800 bg-green-900/30 text-green-400" : "border-red-800 bg-red-900/30 text-red-400"}`}>
              {credentialMessage.text}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-[#00DF73] py-2.5 text-sm font-bold text-[#0B1120] transition hover:bg-[#00c968] disabled:bg-gray-800 disabled:text-gray-500">
            {isSubmitting ? "Creating account..." : "Create Employee Account"}
          </button>
        </form>

        {created && (
          <div className="mt-5 rounded-lg border border-green-800 bg-green-900/20 p-4">
            <p className="text-sm font-bold text-green-400">Credentials ready to share</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2"><dt className="w-20 text-gray-400">Name</dt><dd className="text-white">{created.name}</dd></div>
              <div className="flex gap-2"><dt className="w-20 text-gray-400">Email</dt><dd className="text-white">{created.email}</dd></div>
              <div className="flex gap-2"><dt className="w-20 text-gray-400">Password</dt><dd className="font-mono text-green-500">{created.password}</dd></div>
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}
