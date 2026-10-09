import type {DatabaseRows} from "@/src/modules/backend/database-rows";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifySession } from "@/src/modules/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession(await cookies());
  if (!session) redirect("/");
  const { env } = await getCloudflareContext({ async: true });
  const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
    .bind(session.userId).first<Pick<DatabaseRows["users"], "role">>();
  if (user?.role !== "admin") redirect("/dashboard");
  return children;
}
