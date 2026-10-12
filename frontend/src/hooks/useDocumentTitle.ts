import { useEffect } from "react";

export const APP_NAME = "EquityLens";

/** Sets document.title for the current route ("Page · EquityLens"). */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
