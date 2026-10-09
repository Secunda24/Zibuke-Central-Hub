'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';

type TrainingSummary = {assigned:number;completed:number;requiredOutstanding:number;assessments:number;eligible:boolean;isAdmin:boolean};

export default function TrainingHomeCard() {
  const [summary,setSummary]=useState<TrainingSummary|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;
    fetch('/api/training/summary',{cache:'no-store'})
      .then(async response=>{if(!response.ok)throw new Error('Training summary unavailable');return response.json();})
      .then(data=>{if(active)setSummary(data);})
      .catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[]);
  return <section aria-labelledby="my-training-heading" className="mb-8 rounded-2xl border border-emerald-400/40 bg-[#141C2F] p-5 shadow-lg sm:p-7">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Student portal</p>
        <h2 id="my-training-heading" className="mt-2 text-2xl font-bold text-white">My Training</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">Open your courses, complete lessons and quizzes, and track your assessments.</p>
        {summary ? <p className="mt-3 text-sm text-slate-400">{summary.assigned ? `${summary.completed} of ${summary.assigned} courses completed · ${summary.requiredOutstanding} compulsory courses outstanding` : 'No courses assigned yet. Your courses will appear here when your administrator assigns them.'}</p>
          : <p role="status" className="mt-3 text-sm text-slate-400">{failed?'Your progress summary is unavailable. You can still open the training portal.':'Loading your training progress…'}</p>}
        {summary && summary.assessments>0 && <p className={`mt-2 text-sm ${summary.eligible?'text-emerald-300':'text-amber-300'}`}>{summary.assessments} assessment{summary.assessments===1?'':'s'} outstanding · {summary.eligible?'Ready to start':'Complete compulsory training and quizzes to unlock'}</p>}
      </div>
      <Link href="/dashboard/training" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300">Open Training Portal <span aria-hidden="true" className="ml-3">→</span></Link>
    </div>
    {summary?.isAdmin && <p className="mt-5 border-t border-slate-700 pt-4 text-sm text-slate-400">Administrator: <Link className="font-semibold text-emerald-300 underline underline-offset-4" href="/dashboard/training#training-management">Manage courses and assign training</Link></p>}
  </section>;
}
