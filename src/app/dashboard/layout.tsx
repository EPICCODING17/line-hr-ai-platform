import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
