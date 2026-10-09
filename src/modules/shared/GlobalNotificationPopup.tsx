"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/src/modules/shared/Icons";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  link?: string;
  type?: "message" | "mention" | "announcement" | "meeting";
};

export default function GlobalNotificationPopup() {
  const router = useRouter();
  const [notification, setNotification] = useState<AppNotification | null>(null);
  const [visible, setVisible] = useState(false);
  
  const lastIdRef = useRef<string | null>(null);
  const initialCheckDone = useRef(false);

  useEffect(() => {
    console.log("🔔 NOTIFICATION LISTENER MOUNTED - Polling starting...");
    
    const interval = setInterval(async () => {
      try {
        console.log("🔔 POLL: Fetching latest notification...");
        const res = await fetch(`/api/notifications/latest?t=${Date.now()}`, { cache: "no-store" });
        
        // FIX: Capture and log the specific text of the server error
        if (!res.ok) {
          const errorText = await res.text();
          console.error(`🔴 POLL ERROR ${res.status}:`, errorText);
          return;
        }

        const data = await res.json();
        console.log("🟢 POLL SUCCESS. Backend returned:", data, "| Last ID was:", lastIdRef.current);
        
        if (data.notification) {
          const incomingId = data.notification.id;
          
          if (!initialCheckDone.current) {
            console.log("🔔 POLL: Initial check complete. Silently ignoring old message:", incomingId);
            lastIdRef.current = incomingId;
            initialCheckDone.current = true;
            return;
          }

          if (incomingId !== lastIdRef.current) {
            console.log("🚨 POLL: NEW MESSAGE DETECTED! Triggering popup.", incomingId);
            setNotification(data.notification);
            setVisible(true);
            lastIdRef.current = incomingId;
            
            setTimeout(() => {
              console.log("🔔 POLL: Auto-hiding popup");
              setVisible(false);
            }, 6000);
          } else {
             console.log("🔔 POLL: No new message. IDs match.");
          }
        } else {
          initialCheckDone.current = true;
          console.log("🔔 POLL: No messages exist in database for this user.");
        }
      } catch (e) {
         console.error("🔴 POLL NETWORK ERROR:", e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!notification) return null;

  return (
    <div 
      className={`fixed right-5 top-5 z-[9999] w-80 max-w-[calc(100vw-40px)] transform transition-all duration-500 ease-out ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0 pointer-events-none"
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-gray-700 bg-[#141C2F] p-4 shadow-2xl shadow-black/60">
        <div className="flex items-start gap-4">
          <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#00DF73]/10 text-[#00DF73]">
            <Icon name={notification.type === 'message' ? 'chat' : notification.type === 'announcement' ? 'bell' : 'calendar'} size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00DF73]">
              {notification.type === 'message' ? 'New Message' : 'New Notification'}
            </p>
            <h4 className="mt-0.5 truncate text-sm font-bold text-white">{notification.title}</h4>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">{notification.message}</p>
            
            {notification.link && (
              <button 
                onClick={() => {
                  setVisible(false);
                  router.push(notification.link!);
                }}
                className="mt-3 inline-flex h-8 items-center rounded-lg bg-[#00DF73] px-3 text-[10px] font-bold text-[#0B1120] transition hover:bg-[#00c968]"
              >
                View Details
              </button>
            )}
          </div>
          <button onClick={() => setVisible(false)} className="shrink-0 text-gray-500 hover:text-white">
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}