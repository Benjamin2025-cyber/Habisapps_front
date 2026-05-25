"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";

/**
 * Placeholder landing page after a successful login. Will be replaced by the
 * real shell + dashboard in P2 / P3.
 */
export default function DashboardPlaceholderPage() {
  const t = useTranslations();
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.status === "anonymous") {
      router.replace("/login");
    }
  }, [session.status, router]);

  if (session.status !== "authenticated") {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <BrandLogo />
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-primary">
            {t("dashboard.placeholder.greeting", {
              name: session.user.name.split(" ")[0],
            })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.placeholder.intro")}
          </p>
        </header>

        <Button
          variant="outline"
          size="md"
          onClick={async () => {
            await session.signOut();
            router.replace("/login");
          }}
        >
          {t("dashboard.placeholder.signOut")}
        </Button>
      </div>
    </main>
  );
}
