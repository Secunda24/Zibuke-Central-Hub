"use client";

import { useState, useEffect, FormEvent, useRef } from "react";

import DepartmentManager, {type FileDepartment} from '@/src/modules/files/DepartmentManager';

type FileRecord = {
  id: string;
  filename: string;
  file_path: string;
  uploaded_by: string;
  uploader_name: string;
  department: string;
  department_name: string;
  size_bytes: number;
  created_at: string;
};

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [departments,setDepartments] = useState<FileDepartment[]>([]);
  const [isAdmin,setIsAdmin] = useState(false);
  const [loading,setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserDept, setCurrentUserDept] = useState("");
  
  const [editingFile, setEditingFile] = useState<FileRecord | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editDept, setEditDept] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [department, setDepartment] = useState("General");

  useEffect(() => {
    fetchFiles();
  }, []);

  async function fetchFiles() {
    try {
      const res = await fetch("/api/files", {cache:"no-store"});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to load files.');
      if (data.files) {
        setDepartments(data.departments);
        setIsAdmin(data.isAdmin);
        setError('');
        setFiles(data.files);
        setCurrentUserId(data.currentUserId);
        setCurrentUserDept(data.currentUserDept);
      }
    } catch (error) {
      setError(error instanceof Error?error.message:'Unable to load files.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    const selectedFile = fileInputRef.current?.files?.[0];
    if (!selectedFile) return;

    setUploading(true);
    setError("");
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("department", department);

    try {
      const res = await fetch("/api/files", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        setDepartment("General");
        fetchFiles();
      } else {
        setError(data.error || "Failed to upload file");
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this file permanently?")) return;
    try {
      const res = await fetch(`/api/files?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchFiles();
    } catch (error) {
      console.error("Failed to delete", error);
    }
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editingFile) return;

    try {
      const res = await fetch("/api/files", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingFile.id, filename: editFilename, department: editDept })
      });
      if (res.ok) {
        setEditingFile(null);
        fetchFiles();
      }
    } catch (error) {
      setError(error instanceof Error?error.message:'Unable to update file.');
    }
  }

  function openEditModal(file: FileRecord) {
    setEditingFile(file);
    setEditFilename(file.filename);
    setEditDept(file.department);
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">Document Vault</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Company Files</h1>
          <p className="mt-2 text-gray-400">Securely upload and share documents across departments.</p>
        </header>

        {isAdmin&&<DepartmentManager departments={departments} onSaved={fetchFiles}/>}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
          <aside>
            <form onSubmit={handleUpload} className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-white">Upload File</h2>
              {error && <div role="alert" className="mb-4 rounded-md border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">{error}</div>}

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-white">Select Document</span>
                  <input type="file" ref={fileInputRef} required className="mt-1 block w-full text-sm text-gray-400 file:mr-4 file:rounded-md file:border-0 file:bg-[#00DF73]/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#00DF73] hover:file:bg-[#00DF73]/20 cursor-pointer" />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white">Department Folder</span>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73]">
                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>

                <button type="submit" disabled={uploading||loading||!departments.length} className="mt-2 w-full rounded-md bg-[#00DF73] py-2.5 text-sm font-bold text-[#0B1120] shadow-sm transition hover:bg-[#00c968] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500">
                  {uploading ? "Uploading..." : "Upload to Vault"}
                </button>
              </div>
            </form>
          </aside>

          <section className="space-y-4">
            {files.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-800 bg-[#141C2F] py-16 text-center">
                <p className="text-sm font-medium text-gray-400">{loading?'Loading files...':error?'Unable to load files. Please refresh to retry.':'No files are available in your departments.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#141C2F] shadow-sm">
                <table className="w-full text-left text-sm text-gray-300 min-w-[700px]">
                  <thead className="bg-[#0B1120] text-xs uppercase text-gray-400 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 font-medium">Filename</th>
                      <th className="px-6 py-4 font-medium">Department</th>
                      <th className="px-6 py-4 font-medium">Size</th>
                      <th className="px-6 py-4 font-medium">Uploaded By</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {files.map((file) => {
                      const canModify = file.uploaded_by === currentUserId || currentUserDept === 'Executive' || isAdmin;
                      return (
                        <tr key={file.id} className="transition hover:bg-[#0B1120]">
                          <td className="px-6 py-4 font-medium text-white break-all">{file.filename}</td>
                          <td className="px-6 py-4">
                            <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-300">{file.department_name || file.department}</span>
                          </td>
                          <td className="px-6 py-4">{formatBytes(file.size_bytes)}</td>
                          <td className="px-6 py-4">{file.uploader_name}</td>
                          <td className="px-6 py-4 text-right space-x-3 whitespace-nowrap">
                            <a href={file.file_path} target="_blank" rel="noreferrer" className="text-[#00DF73] hover:underline font-semibold">Open</a>
                            {canModify && (
                              <>
                                <button onClick={() => openEditModal(file)} className="text-blue-400 hover:underline font-semibold">Edit</button>
                                <button onClick={() => handleDelete(file.id)} className="text-red-500 hover:underline font-semibold">Delete</button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Edit Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-[#141C2F] p-6 border border-gray-800 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Edit File Metadata</h3>
            {error&&<p role="alert" className="mb-3 text-red-400">{error}</p>}
            <form onSubmit={handleUpdate} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-400">Filename</span>
                <input type="text" value={editFilename} onChange={(e) => setEditFilename(e.target.value)} required className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-400">Department</span>
                <select value={editDept} onChange={(e) => setEditDept(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white outline-none focus:border-[#00DF73]">
                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <div className="flex gap-3 justify-end mt-6">
                <button type="button" onClick={() => setEditingFile(null)} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" className="rounded-md bg-[#00DF73] px-4 py-2 text-sm font-bold text-[#0B1120] hover:bg-[#00c968]">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}