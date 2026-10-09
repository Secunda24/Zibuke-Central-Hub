"use client";

import { useState, useEffect, useRef } from "react";
import TrainingPage from '@/src/modules/training/TrainingPage';

type ReportData = {
  training: null | {newCourses:number;recentCourses:{id:string;title:string;description:string;status:string}[];outstanding:number;employees:number;overdue:number};
  metrics: {
    users: number;
    files: number;
    channels: number;
    announcements: number;
    crmLogs: number;
    managedTeams: number;
  };
  departments: {
    department: string;
    count: number;
  }[];
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Use a ref to strictly prevent React StrictMode double-fetching loops
  const hasFetched = useRef(false);

  useEffect(() => {
    // If we've already fetched, exit immediately to stop the loop
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function fetchReports() {
      try {
        const res = await fetch("/api/reports");
        const json = await res.json();
        
        if (res.ok && json.metrics && json.departments) {
          setData(json);
        } else {
          setErrorMsg(json.error || "Received incomplete data from the server.");
        }
      } catch (error) {
        console.error("Failed to load reports", error);
        setErrorMsg(error instanceof Error ? error.message : "Network error while fetching reports.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchReports();
  }, []); // Empty dependency array ensures this only runs once

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">
            System Analytics
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Platform Reports
          </h1>
          <p className="mt-2 text-gray-400">
            Live cross-department metrics and platform usage statistics.
          </p>
        </header>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-gray-800 bg-[#141C2F]">
            <p className="text-gray-500">Loading metrics...</p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col h-40 items-center justify-center rounded-xl border border-red-800 bg-red-900/20 p-6 text-center">
            <p className="font-bold text-red-500 mb-2">Error Loading Data</p>
            <p className="text-sm text-red-400">Server says: {errorMsg}</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Top Level Stats */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm transition hover:border-[#00DF73]/50">
                <p className="text-sm font-medium text-gray-400">Total Employees</p>
                <p className="mt-2 text-4xl font-bold text-white">{data.metrics.users}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm transition hover:border-[#00DF73]/50">
                <p className="text-sm font-medium text-gray-400">Vault Files</p>
                <p className="mt-2 text-4xl font-bold text-[#00DF73]">{data.metrics.files}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm transition hover:border-[#00DF73]/50">
                <p className="text-sm font-medium text-gray-400">Active Channels</p>
                <p className="mt-2 text-4xl font-bold text-amber-500">{data.metrics.channels}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm transition hover:border-[#00DF73]/50">
                <p className="text-sm font-medium text-gray-400">Announcements</p>
                <p className="mt-2 text-4xl font-bold text-rose-500">{data.metrics.announcements}</p>
              </div>
              {data.training && <>
                <section className="rounded-xl border border-gray-800 bg-[#141C2F] p-6">
                  <h2 className="text-sm font-medium text-gray-400">New Courses</h2>
                  <p className="mt-2 text-4xl font-bold text-sky-400">{data.training.newCourses}</p>
                  <p className="mt-2 text-xs text-gray-400">Created in the last 30 days, including drafts</p>
                  <ul className="mt-3 space-y-3 text-xs">{data.training.recentCourses.map(course=><li key={course.id}><a href="/dashboard/training#training-management" className="font-semibold text-sky-300 underline">{course.title}</a><span className="ml-1 text-gray-400">({course.status})</span>{course.description&&<p className="mt-1 line-clamp-2 text-gray-400">{course.description}</p>}</li>)}</ul>
                  {!data.training.newCourses&&<p className="mt-3 text-xs text-gray-400">No new courses yet.</p>}
                </section>
                <section className="rounded-xl border border-gray-800 bg-[#141C2F] p-6">
                  <h2 className="text-sm font-medium text-gray-400">Outstanding Training</h2>
                  <p className="mt-2 text-4xl font-bold text-amber-400">{data.training.outstanding}</p>
                  <p className="mt-2 text-xs text-gray-400">Incomplete course assignments across {data.training.employees} employees</p>
                  <p className="mt-3 text-sm text-rose-300">{data.training.overdue} overdue</p>
                  <a href="#training-report" className="mt-3 inline-block text-xs text-emerald-300 underline">Search and review training</a>
                </section>
              </>}
              <div className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm transition hover:border-[#00DF73]/50">
                <p className="text-sm font-medium text-gray-400">Total CRM Logs</p>
                <p className="mt-2 text-4xl font-bold text-sky-400">{data.metrics.crmLogs}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm transition hover:border-[#00DF73]/50">
                <p className="text-sm font-medium text-gray-400">Active Managed Teams</p>
                <p className="mt-2 text-4xl font-bold text-violet-400">{data.metrics.managedTeams}</p>
              </div>
            </div>

            {/* Department Breakdown */}
            <section className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm">
              <h2 className="mb-6 text-lg font-semibold text-white">Headcount by Division</h2>
              <div className="divide-y divide-gray-800">
                {data.departments.map((dept, idx) => (
                  <div key={idx} className="flex items-center justify-between py-4 first:pt-0 last:pb-0 hover:bg-[#0B1120] transition-colors -mx-6 px-6">
                    <span className="font-medium text-gray-300">{dept.department}</span>
                    <span className="rounded-full bg-gray-800 px-3 py-1 text-sm font-semibold text-gray-400">
                      {dept.count} {dept.count === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                ))}
                {data.departments.length === 0 && (
                  <p className="py-4 text-sm text-gray-500">No department data available.</p>
                )}
              </div>
            </section>
          </div>
        ) : null}
        <div className="mt-8"><TrainingPage reportOnly /></div>
      </div>
    </main>
  );
}
