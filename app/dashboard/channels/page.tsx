"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";

type Channel = {
  id: string;
  name: string;
  description: string;
  creator_name: string;
  created_by: string;
  created_at: string;
};

export default function ChannelsPage() {
  // Using 'any' to bypass strict TS checks for custom role/email properties
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const userRole = String(user?.role || "").toLowerCase();
  const userEmail = String(user?.email || "").toLowerCase();
  const isAdmin = userRole === "admin" || userEmail === "jayjacobs@zibukeafrica.co.za";
  const currentUserId = user?.id;

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    try {
      const res = await fetch(`/api/channels?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.channels) setChannels(data.channels);
    } catch (error) {
      console.error("Failed to load channels", error);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.toLowerCase().replace(/\s+/g, '-'), description }),
      });

      const data = await res.json();

      if (res.ok) {
        setName("");
        setDescription("");
        if (data.channelId) {
           router.push(`/dashboard/channels/${data.channelId}`);
        } else {
           fetchChannels();
        }
      } else {
        setError(data.error || "Failed to create channel");
      }
    } catch (error) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string, channelName: string) {
    if (!window.confirm(`Are you sure you want to delete #${channelName}? This will permanently erase all chat history in this channel.`)) return;

    try {
      const res = await fetch(`/api/channels/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete channel.");
      }
    } catch (error) {
      alert("An unexpected error occurred while deleting the channel.");
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1120] p-6 text-white sm:p-12">
      <div className="mx-auto max-w-5xl">
        
        <header className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#00DF73]">
              Group Chat
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Company Channels
            </h1>
            <p className="mt-2 text-gray-400">
              Join a department channel or create a new topic for the team.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
          
          <aside>
            <form onSubmit={handleSubmit} className="rounded-xl border border-gray-800 bg-[#141C2F] p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-white">Create Channel</h2>
              
              {error && (
                <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-white">Channel Name</span>
                  <div className="relative mt-1 flex items-center">
                    <span className="absolute left-3 text-gray-500">#</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                      placeholder="e.g. general-chat"
                      className="block h-10 w-full rounded-md border border-gray-700 bg-[#0B1120] pl-8 pr-3 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white">Description</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this channel about?"
                    className="mt-1 block w-full resize-none rounded-md border border-gray-700 bg-[#0B1120] p-3 text-sm text-white outline-none focus:border-[#00DF73] focus:ring-1 focus:ring-[#00DF73]"
                    rows={3}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="mt-2 w-full rounded-md bg-[#00DF73] py-2.5 text-sm font-bold text-[#0B1120] shadow-sm transition hover:bg-[#00c968] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {isSubmitting ? "Creating..." : "Create Channel"}
                </button>
              </div>
            </form>
          </aside>

          <section className="space-y-4">
            {channels.length === 0 && !loading ? (
              <div className="rounded-xl border-2 border-dashed border-gray-800 bg-[#141C2F] py-16 text-center">
                <p className="text-sm font-medium text-gray-400">No channels exist yet.</p>
                <p className="mt-1 text-xs text-gray-500">Use the form to create the first one!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {channels.map((channel) => (
                  <div key={channel.id} className="group relative flex flex-col justify-between rounded-xl border border-gray-800 bg-[#141C2F] p-5 shadow-sm transition hover:border-[#00DF73]/50 hover:shadow-lg">
                    
                    {/* Delete Button (Visible only to Admins or the Channel Creator) */}
                    {(isAdmin || currentUserId === channel.created_by) && (
                      <button 
                        onClick={() => handleDelete(channel.id, channel.name)}
                        className="absolute right-4 top-4 rounded-md p-1.5 text-gray-500 transition hover:bg-red-900/30 hover:text-red-400"
                        title="Delete Channel"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}

                    <div>
                      <div className="mb-2 flex items-center justify-between pr-8">
                        <h3 className="font-bold text-white">#{channel.name}</h3>
                      </div>
                      <p className="min-h-[2.5rem] text-sm text-gray-400 line-clamp-2">
                        {channel.description || "No description provided."}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-gray-800 pt-3 text-xs font-medium text-gray-500">
                      <span>Created by {channel.creator_name}</span>
                      <Link 
                        href={`/dashboard/channels/${channel.id}`} 
                        className="rounded-md bg-[#0B1120] px-3 py-1.5 text-gray-400 transition hover:bg-[#00DF73] hover:text-[#0B1120]"
                      >
                        Join Chat
                      </Link>
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