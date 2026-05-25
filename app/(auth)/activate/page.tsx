import type { Metadata } from "next";
import { AuthTopBar } from "../_components/AuthTopBar";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { getTranslations } from "@/lib/i18n/server";
import { ActivationWizard } from "./_components/ActivationWizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("auth.activate.pageTitle") };
}

export default function ActivatePage() {
  return (
    <>
      <AuthTopBar showBack backHref="/login" />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="flex w-full max-w-xl flex-col items-center gap-10">
          <BrandLogo />

          <section
            aria-labelledby="activate-heading"
            className="w-full rounded-[var(--radius-card)] bg-background p-8 shadow-[0_24px_60px_-30px_rgba(20,6,47,0.25)] sm:p-10"
          >
            <ActivationWizard />
          </section>
        </div>
      </main>
    </>
  );
}
