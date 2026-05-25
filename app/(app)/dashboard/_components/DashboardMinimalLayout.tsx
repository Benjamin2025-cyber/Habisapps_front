"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTranslations } from "@/lib/i18n/I18nProvider";

/**
 * Layout shown to users whose roles do not unlock any business panels yet
 * (just the generic `staff` role). Friendly landing with a "contact admin"
 * hint and a sign-out escape hatch.
 */
export function DashboardMinimalLayout() {
  const t = useTranslations();
  const router = useRouter();
  const session = useSession();

  if (session.status !== "authenticated") return null;

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 rounded-[var(--radius-card)] border border-border bg-background px-8 py-12 text-center shadow-[0_8px_30px_-20px_rgba(20,6,47,0.15)]">
      <BrandLogo wordmarkClassName="text-2xl" iconClassName="h-10 w-10" />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("dashboard.minimal.title", { name: session.user.name.split(" ")[0] })}
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("dashboard.minimal.body")}
        </p>
      </header>

      <p className="text-xs text-muted-foreground">
        {t("dashboard.minimal.contactAdmin")}
      </p>

      <Button
        variant="outline"
        size="md"
        onClick={async () => {
          await session.signOut();
          router.replace("/login");
        }}
      >
        {t("shell.userMenu.signOut")}
      </Button>
    </section>
  );
}
