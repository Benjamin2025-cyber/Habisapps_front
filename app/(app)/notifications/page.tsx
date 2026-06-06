"use client";

import { Suspense } from "react";
import { NotificationsView } from "./_components/NotificationsView";

/**
 * Notifications screen (#26). Master-detail feed reached from the top-bar bell's
 * "view all". `NotificationsView` reads `?selected=` via `useSearchParams`, so it
 * is wrapped in a Suspense boundary per Next's prerendering requirement.
 */
export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsView />
    </Suspense>
  );
}
