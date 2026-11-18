import { useCallback } from "react";
import { langOf, translate, type Language, type Vars } from "./i18n";
import { useStore } from "../store";

/** The interface language, from the stored setting. Re-renders the caller when it changes. */
export function useLang(): Language {
  return useStore((s) => langOf(s.settings));
}

/** The `t` function bound to the current language. The caller re-renders when the language changes. */
export function useT(): (key: string, vars?: Vars) => string {
  const lang = useLang();
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
}
