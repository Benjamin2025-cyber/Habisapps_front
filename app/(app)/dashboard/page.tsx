import type { Metadata } from "next";
import { getTranslations } from "@/lib/i18n/server";
import { DashboardPlaceholder } from "./_components/DashboardPlaceholder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("dashboard.pageTitle") };
}

export default function DashboardPage() {
  return <DashboardPlaceholder />;
}
