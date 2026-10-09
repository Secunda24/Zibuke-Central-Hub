'use client';
import {FormEvent, useState} from 'react';
export type FileDepartment = {id:string;name:string};
const input = 'mt-1 block w-full rounded-md border border-gray-700 bg-[#0B1120] p-2.5 text-sm text-white focus:border-[#00DF73]';
const button = 'rounded-md bg-[#00DF73] px-4 py-2.5 text-sm font-bold text-[#0B1120] disabled:opacity-50';
export default function DepartmentManager({departments,onSaved}:{departments:FileDepartment[];onSaved:()=>Promise<void>}) {
  const [name,setName]=useState(''), [editing,setEditing]=useState<FileDepartment|null>(null);
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [notice,setNotice]=useState('');
  async function save(event:FormEvent) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/files/departments',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:editing?.id,name})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Unable to save department.');
      setNotice(editing?'Department renamed. Existing files and access are preserved.':'Department created. It is now available in the folder dropdown.');
      setName('');setEditing(null);await onSaved();
    } catch(error) {setError(error instanceof Error?error.message:'Unable to save department.');}
    finally {setBusy(false);}
  }
  return <details className="mb-8 rounded-xl border border-gray-800 bg-[#141C2F] p-6">
    <summary className="cursor-pointer text-lg font-semibold">Manage departments</summary>
    <p className="mt-3 text-sm text-gray-400">Create or rename file folders. Renaming preserves file access and does not change employee departments. General remains shared with everyone; other folders remain available to their department and administrators.</p>
    <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1">{editing?'Rename department':'New department name'}<input className={input} value={name} onChange={e=>setName(e.target.value)} required maxLength={150} disabled={busy}/></label>
      <button className={button} disabled={busy||!name.trim()}>{busy?'Saving...':editing?'Save name':'Create department'}</button>
      {editing&&<button type="button" disabled={busy} className="px-3 py-2 text-sm underline" onClick={()=>{setEditing(null);setName('');setError('');}}>Cancel</button>}
    </form>
    {error&&<p role="alert" className="mt-3 text-red-400">{error}</p>}
    {notice&&<p role="status" className="mt-3 text-emerald-300">{notice}</p>}
    <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{departments.map(d=><li key={d.id} className="flex items-center justify-between gap-3 rounded border border-gray-700 p-3"><span className="min-w-0 break-words">{d.name}{d.id==='General'&&<span className="block text-xs text-gray-400">Shared with everyone</span>}</span><button type="button" className="shrink-0 text-sm text-[#00DF73] underline" disabled={busy} aria-label={'Rename '+d.name} onClick={()=>{setEditing(d);setName(d.name);setError('');setNotice('');}}>Rename</button></li>)}</ul>
  </details>;
}
