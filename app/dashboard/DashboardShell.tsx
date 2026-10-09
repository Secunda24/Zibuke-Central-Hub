"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch";
import { useCurrentUser } from "@/src/modules/shared/useCurrentUser";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // FIX: Grab the currently logged in user to check their role
  const { user } = useCurrentUser();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Poll the API every 5 seconds to instantly catch new notifications
  useEffect(() => {
    let isMounted = true;

    async function checkNotifications() {
      try {
        const res = await fetch(`/api/notifications?t=${Date.now()}`, { cache: "no-store" });
        const data = await res.json();
        if (data.unreadCount !== undefined && isMounted) {
          setHasUnread(data.unreadCount > 0);
        }
      } catch (error) {
        console.error("Failed to check notifications", error);
      }
    }
    
    // Initial check
    checkNotifications();

    // Background polling interval
    const intervalId = setInterval(checkNotifications, 5000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  };

  // FIX: The Admin tab is now conditionally added based on the user's secure role
  const baseNavItems = [
    { name: "Home", href: "/dashboard" },
    { name: "My Training", href: "/dashboard/training" },
    { name: "Log Metrics", href: "/dashboard/crm/my-metrics" },
    { name: "My Team", href: "/dashboard/crm/team" },
    { name: "Messages", href: "/dashboard/messages" },
    { name: "Channels", href: "/dashboard/channels" },
    { name: "Files", href: "/dashboard/files" },
    { name: "Announcements", href: "/dashboard/announcements" },
    { name: "Calendar", href: "/dashboard/calendar" },
    { name: "People", href: "/dashboard/people" },
    { name: "Birthdays", href: "/dashboard/birthdays" },
    { name: "Reports", href: "/dashboard/reports" },
  ];

  const navItems = user?.role === "admin" 
    ? [...baseNavItems, { name: "Admin", href: "/dashboard/admin" }, { name: "Training Wizard", href: "/dashboard/admin/training-wizard" }] 
    : baseNavItems;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0B1120] text-white">
      
      {navigationOpen && <button aria-label="Close navigation" onClick={()=>setNavigationOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
      <aside id="main-navigation" className={`fixed inset-y-0 left-0 z-50 w-64 flex-col bg-[#141C2F] text-white border-r border-gray-800 md:static md:flex md:shrink-0 ${navigationOpen ? "flex" : "hidden"}`}>
        <div className="flex items-center gap-4 border-b border-gray-800 px-6 py-8">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#0B1120] text-sm font-bold text-[#00DF73] border border-gray-800 shadow-sm">
            ZC
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-white">
              Zibuke Central
            </p>
            <p className="text-[11px] text-gray-500 tracking-wide uppercase mt-0.5">Enterprise Access</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                onClick={()=>setNavigationOpen(false)}
                key={item.name}
                href={item.href}
                className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#00DF73] text-[#0B1120] font-bold shadow-sm"
                    : "text-gray-400 hover:bg-[#0B1120] hover:text-white"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        
        <header className="flex h-16 flex-shrink-0 items-center justify-between gap-2 border-b border-gray-800 bg-[#141C2F] px-3 shadow-sm sm:px-6">
          <button type="button" aria-label="Open navigation" aria-controls="main-navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(true)} className="shrink-0 rounded-lg border border-gray-700 px-3 py-2 text-sm font-semibold text-white md:hidden">Menu</button>
          <div className="hidden md:block" />
          
          <div className="flex min-w-0 items-center gap-2 text-gray-400 sm:gap-4">
            
            <GlobalSearch />
            {/* Zibuke OnCall Bridge */}
            <a 
              href="https://zibukeoncall.co.za/employee-portal" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1.5 rounded-full bg-[#CCFF00] px-4 py-1.5 text-sm font-bold text-black transition hover:bg-[#b8e600] shadow-[0_0_10px_rgba(204,255,0,0.15)]"
              aria-label="Switch to Zibuke OnCall"
            >
              <span className="hidden sm:inline">OnCall Portal</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>

            <Link href="/dashboard/call" className="rounded-full p-2 transition hover:bg-[#0B1120] hover:text-[#00DF73]" aria-label="Start Call">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75v-4.5m0 4.5h4.5m-4.5 0l6-6m-3 18c-8.284 0-15-6.716-15-15V4.5A2.25 2.25 0 014.5 2.25h1.372c.516 0 .966.351 1.091.852l1.106 4.423c.11.44-.054.902-.417 1.173l-1.293.97a1.062 1.062 0 00-.38 1.21 12.035 12.035 0 007.143 7.143c.441.162.928-.004 1.21-.38l.97-1.293a1.125 1.125 0 011.173-.417l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25z" />
              </svg>
            </Link>
            
            <Link href="/dashboard/notifications" className="relative rounded-full p-2 transition hover:bg-[#0B1120] hover:text-[#00DF73]" aria-label="Notifications">
              {/* Dynamic Notification Dot */}
              {hasUnread && (
                <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600"></span>
                </span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </Link>
            
            <div className="relative ml-2" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0B1120] text-sm font-bold text-[#00DF73] border border-gray-800 shadow-md ring-2 ring-transparent transition hover:border-[#00DF73] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[#0B1120] focus:ring-[#00DF73]"
                aria-label="User menu"
              >
                {!imgError ? (
                  <img 
                    src={`/api/settings/avatar`} 
                    alt="Me" 
                    className="h-full w-full object-cover" 
                    onError={() => setImgError(true)} 
                  />
                ) : (
                  "Me"
                )}
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right z-50 rounded-xl bg-[#141C2F] border border-gray-800 py-1 shadow-2xl focus:outline-none">
                  <div className="border-b border-gray-800 px-4 py-3">
                    <p className="text-xs text-gray-400">Signed in to</p>
                    <p className="truncate text-sm font-bold text-white">Zibuke Central</p>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-[#0B1120] hover:text-[#00DF73] transition-colors"
                    >
                      Account Settings
                    </Link>
                  </div>

                  <div className="border-t border-gray-800 py-1">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm font-medium text-red-500 hover:bg-[#0B1120] hover:text-red-400 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

      </div>
    </div>
  );
}
