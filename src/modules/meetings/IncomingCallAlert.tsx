"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";

export default function IncomingCallAlert() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<{ id: string; caller_name: string; room_name: string } | null>(null);
  const [responseError, setResponseError] = useState("");
  const [responding, setResponding] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    audioRef.current = new Audio("/sounds/ringtone.mp3"); 
    audioRef.current.loop = true;

    const controller = new AbortController();
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/calls/signal?userId=${user.id}&t=${Date.now()}`, { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (controller.signal.aborted) return;
        
        if (data.incoming && !incomingCall) {
          setResponseError("");
          setIncomingCall(data.incoming);
          
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Incoming Call", {
              body: `${data.incoming.caller_name} is calling you on Zibuke Meet`,
              requireInteraction: true,
            });
          }

          audioRef.current?.play().catch(() => {});
        } else if (!data.incoming && incomingCall) {
          setIncomingCall(null);
          audioRef.current?.pause();
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error("Polling error", error);
      }
    }, 3000);

    return () => {
      controller.abort();
      clearInterval(interval);
      audioRef.current?.pause();
    };
  }, [user, incomingCall]);

  async function handleCallResponse(status: "answered" | "declined") {
    if (!incomingCall || responding) return;
    setResponding(true);
    setResponseError("");
    const roomName = incomingCall.room_name;
    if (status === "answered" && !roomName) {
      setResponseError("This invitation has no meeting room. Ask the caller to call again.");
      setResponding(false);
      return;
    }
    
    try {
      // 1. Tell the database to stop ringing immediately
      const response = await fetch("/api/calls/signal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId: incomingCall.id, status })
      });
      if (!response.ok) throw new Error("Could not answer the call. Please retry.");
    } catch {
      setResponseError("Could not update the call. Please retry.");
      setResponding(false);
      return;
    }

    // 2. Stop the local audio and save the caller data before clearing state
    audioRef.current?.pause();
    setIncomingCall(null);
    setResponding(false);

    // 3. Route to the exact same LiveKit room the caller is waiting in
    if (status === "answered" && user?.id) {
      router.push(`/dashboard/call?room=${encodeURIComponent(roomName)}`);
    }
  }

  if (!incomingCall) return null;

  return (
    <div className="fixed bottom-10 right-10 z-[999] rounded-2xl bg-[#141C2F] p-6 shadow-2xl border border-[#00DF73]/30">
      <h3 className="text-lg font-bold text-white mb-2">Incoming Call</h3>
      <p className="text-gray-400 text-sm mb-4">{incomingCall.caller_name} is calling you...</p>
      {responseError && <p role="alert" className="mb-3 text-sm text-red-400">{responseError}</p>}
      <div className="flex gap-3">
        <button 
          disabled={responding}
          onClick={() => handleCallResponse("answered")}
          className="px-4 py-2 bg-[#00DF73] text-black font-bold rounded-lg transition hover:bg-[#00c968]"
        >
          Accept
        </button>
        <button 
          disabled={responding}
          onClick={() => handleCallResponse("declined")}
          className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg transition hover:bg-red-700"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
