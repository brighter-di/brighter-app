import { useEffect } from "react";

const HOME = "Brighter — Strategy portfolios";

/** Sets the browser tab title for a page: "<title> · Brighter", or the site title. */
export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Brighter` : HOME;
  }, [title]);
}
