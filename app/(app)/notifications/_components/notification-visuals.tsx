import type { ComponentType, SVGProps } from "react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
} from "@/components/ui/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export type NotificationTone = "success" | "warning" | "danger" | "info";

export type NotificationVisual = {
  /** Lucide-style glyph for the notification type. */
  Icon: IconComponent;
  /** Maps to the Badge / semantic colour tokens. */
  tone: NotificationTone;
  /** Tailwind classes for the round icon chip (background + text). */
  chipClass: string;
  /** Small status dot colour (used in compact rows). */
  dotClass: string;
  /** i18n key suffix under `notifications.type.*`. */
  labelKey: string;
};

const VISUALS: Record<string, NotificationVisual> = {
  success: {
    Icon: CheckCircleIcon,
    tone: "success",
    chipClass: "bg-success/12 text-success",
    dotClass: "bg-success",
    labelKey: "success",
  },
  warning: {
    Icon: AlertTriangleIcon,
    tone: "warning",
    chipClass: "bg-warning/12 text-warning",
    dotClass: "bg-warning",
    labelKey: "warning",
  },
  error: {
    Icon: AlertCircleIcon,
    tone: "danger",
    chipClass: "bg-danger/12 text-danger",
    dotClass: "bg-danger",
    labelKey: "error",
  },
  info: {
    Icon: InfoIcon,
    tone: "info",
    chipClass: "bg-info/12 text-info",
    dotClass: "bg-info",
    labelKey: "info",
  },
};

/** Resolve the icon + colour treatment for a notification type. Unknown types
 *  fall back to the neutral "info" treatment so nothing renders blank. */
export function notificationVisual(type: string | null | undefined): NotificationVisual {
  return VISUALS[type ?? ""] ?? VISUALS.info;
}
