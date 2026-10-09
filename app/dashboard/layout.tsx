import AiAssistant from "@/components/AiAssistant";
import DashboardShell from "./DashboardShell";
import GlobalNotificationPopup from "@/src/modules/shared/GlobalNotificationPopup";
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {verifySession} from '@/src/modules/auth/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if(!await verifySession(await cookies())) redirect('/');
  return (
    <DashboardShell>
      {children}
      <GlobalNotificationPopup />
      <AiAssistant />
    </DashboardShell>
  );
}
