"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { Sidebar } from "./_components/Sidebar";
import { TopBar } from "./_components/TopBar";
import { ShellLoader } from "./_components/ShellLoader";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "habis.shell.sidebarCollapsed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const [collapsed, setCollapsed] = usePersistentState<boolean>(
    SIDEBAR_COLLAPSE_STORAGE_KEY,
    false,
  );

  // Auth guard: bounce anonymous visitors to /login as soon as we know they
  // aren't authenticated. The "loading" state covers the localStorage hydration
  // window so we never flash the shell with a missing user.
  useEffect(() => {
    if (session.status === "anonymous") {
      router.replace("/login");
    }
  }, [session.status, router]);

  if (session.status !== "authenticated") {
    return <ShellLoader />;
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((current) => !current)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={session.user}
          onToggleSidebar={() => setCollapsed((current) => !current)}
        />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
