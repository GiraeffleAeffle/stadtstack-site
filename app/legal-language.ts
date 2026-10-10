"use client";

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

export function usePageLanguage() {
  const language = useSyncExternalStore<"de" | "en">(subscribe, () => window.location.hash.startsWith("#en") ? "en" : "de", () => "de");
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return {
    language,
    ready,
    selectLanguage(next: "de" | "en") {
      window.history.replaceState(null, "", `#${next}`);
      window.dispatchEvent(new Event("hashchange"));
    },
  };
}
