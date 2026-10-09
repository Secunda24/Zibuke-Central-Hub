"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SearchResult } from "@/src/modules/search/library";

const sources = [{id:"all",label:"All"},{id:"platform",label:"Platform"},{id:"africa",label:"Zibuke Africa"},{id:"oncall",label:"Zibuke OnCall"}];
function SearchIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>; }
export default function GlobalSearch() {
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  function close(){setOpen(false);trigger.current?.focus();}
  useEffect(()=>{
    const handle=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setOpen(value=>!value);}};
    document.addEventListener('keydown',handle);return()=>document.removeEventListener('keydown',handle);
  },[]);
  return <>
    <button ref={trigger} type="button" onClick={()=>setOpen(true)} aria-label="Search platform and company websites" aria-haspopup="dialog" className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-gray-600 bg-[#0B1120] px-3 text-sm text-gray-200 transition hover:border-[#00DF73] hover:text-[#00DF73]">
      <SearchIcon/><span className="hidden sm:inline">Search</span><kbd className="hidden rounded border border-gray-700 px-1 text-[10px] text-gray-500 lg:inline">Ctrl K</kbd>
    </button>
    {open&&<SearchDialog onClose={close}/>}
  </>;
}
function SearchDialog({onClose}:{onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);const input=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');const [source,setSource]=useState('all');const [page,setPage]=useState(1);
  useEffect(()=>{const element=dialog.current;element?.showModal();input.current?.focus();return()=>element?.close();},[]);
  return <dialog ref={dialog} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===dialog.current){const bounds=dialog.current.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onClose();}}} aria-labelledby="global-search-title" className="fixed inset-x-0 top-[10vh] m-auto w-[min(720px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-gray-700 bg-[#0B1120] p-0 font-sans text-white shadow-2xl backdrop:bg-black/70">
    <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4"><div><h2 id="global-search-title" className="font-semibold">Search Zibuke</h2><p className="mt-1 text-xs text-gray-400">Your workspace and both company websites</p></div><button type="button" onClick={onClose} aria-label="Close search" className="rounded-lg border border-gray-700 px-2 py-1 text-xs text-gray-300">Esc</button></div>
    <div className="px-5 pt-4"><label htmlFor="global-search-input" className="sr-only">Search query</label><div className="flex items-center gap-3 rounded-xl border border-gray-600 bg-[#141C2F] px-3 text-[#00DF73]"><SearchIcon/><input id="global-search-input" ref={input} type="search" maxLength={100} value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Search people, messages, files, services..." autoComplete="off" className="h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"/></div>
    <div role="group" aria-label="Search sources" className="my-3 flex flex-wrap gap-2">{sources.map(item=><button key={item.id} type="button" aria-pressed={source===item.id} onClick={()=>{setSource(item.id);setPage(1);}} className={`rounded-full border px-3 py-1.5 text-xs transition ${source===item.id?'border-[#00DF73] bg-[#00DF73]/10 text-[#00DF73]':'border-gray-700 text-gray-300 hover:border-gray-500'}`}>{item.label}</button>)}</div></div>
    <div className="max-h-[min(55vh,520px)] min-h-40 overflow-y-auto px-5 pb-5">
      {query.trim().length<2?<p className="py-8 text-center text-sm text-gray-400">Enter at least 2 characters to search.</p>:<SearchResults key={`${query.trim()}:${source}:${page}`} query={query.trim()} source={source} page={page} onPage={setPage} onClose={onClose}/>}
    </div>
    <p className="border-t border-gray-800 px-5 py-3 text-[11px] text-gray-500">Only content you can access is included. Files are searched by name and folder.</p>
  </dialog>;
}
function SearchResults({query,source,page,onPage,onClose}:{query:string;source:string;page:number;onPage:(page:number)=>void;onClose:()=>void}) {
  const [data,setData]=useState<{results:SearchResult[];total:number;hasMore:boolean;unavailable?:string[];websiteIndexedAt?:string}|null>(null);
  const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    const timeout=setTimeout(async()=>{
      try{const response=await fetch(`/api/search?${new URLSearchParams({q:query,source,page:String(page)})}`,{cache:'no-store',signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.error||'Search failed.');if(!controller.signal.aborted){setData(body);setError('');}}
      catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Search failed. Please retry.');}
    },300);
    return()=>{clearTimeout(timeout);controller.abort();};
  },[query,source,page,attempt]);
  if(error)return <div role="alert" className="py-6 text-sm text-red-300"><p>{error}</p><button type="button" className="mt-3 underline" onClick={()=>{setError('');setAttempt(value=>value+1);}}>Retry search</button></div>;
  if(!data)return <p role="status" className="py-8 text-center text-sm text-gray-400">Searching...</p>;
  return <>
    <p role="status" className="mb-3 text-xs text-gray-400">{data.total?`${data.total} top matches${data.total>20?` - page ${page}`:''}`:'No matching results. Try another name or keyword.'}</p>
    {!!data.unavailable?.length&&<p role="alert" className="mb-3 rounded-lg bg-amber-950/30 p-3 text-xs text-amber-200">Some results are unavailable: {data.unavailable.join(', ')}. Other results are shown below.</p>}
    <ul className="space-y-2">{data.results.map(result=><li key={`${result.source}:${result.type}:${result.id}`}><Link href={result.href} onClick={onClose} target={result.source==='platform'?undefined:'_blank'} rel={result.source==='platform'?undefined:'noopener noreferrer'} className="block rounded-xl border border-gray-800 bg-[#141C2F] p-3 transition hover:border-[#00DF73]/60 focus-visible:outline-2 focus-visible:outline-[#00DF73]"><div className="mb-1 flex flex-wrap gap-2 text-[10px] text-[#00DF73]"><span>{result.type}</span><span className="text-gray-500">{sources.find(s=>s.id===result.source)?.label}</span></div><h3 className="text-sm font-semibold text-white">{result.title}</h3><p className="mt-1 break-words text-xs leading-5 text-gray-400">{result.excerpt}</p></Link></li>)}</ul>
    {(page>1||data.hasMore)&&<div className="mt-4 flex justify-between"><button disabled={page===1} onClick={()=>onPage(page-1)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs disabled:opacity-30">Previous</button><button disabled={!data.hasMore} onClick={()=>onPage(page+1)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs disabled:opacity-30">Next</button></div>}
    {data.websiteIndexedAt&&source!=='platform'&&<p className="mt-4 text-[10px] text-gray-500">Website index updated {new Date(data.websiteIndexedAt).toLocaleDateString()}.</p>}
  </>;
}
