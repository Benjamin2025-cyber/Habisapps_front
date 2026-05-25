import type { Metadata } from "next";
import { getTranslations } from "@/lib/i18n/server";
import { DashboardContent } from "./_components/DashboardContent";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("dashboard.pageTitle") };
}

export default function DashboardPage() {
  return <DashboardContent />;
}
