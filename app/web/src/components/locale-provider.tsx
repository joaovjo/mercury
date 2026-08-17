import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import enUS from "@/locales/en-US.json";
import ptBR from "@/locales/pt-BR.json";

export type SupportedLocale = "en-US" | "pt-BR";

export const MESSAGES: Record<SupportedLocale, Record<string, string>> = {
  "en-US": enUS,
  "pt-BR": ptBR,
};

export interface LocaleOption {
  code: SupportedLocale;
  label: string;
  flag: string;
}

export const LOCALES: LocaleOption[] = [
  { code: "en-US", label: "English", flag: "🇺🇸" },
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
];

interface LocaleProviderProps {
  children: ReactNode;
  defaultLocale?: SupportedLocale;
  storageKey?: string;
}

interface LocaleContextState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  availableLocales: LocaleOption[];
}

const initialState: LocaleContextState = {
  locale: "en-US",
  setLocale: () => null,
  availableLocales: LOCALES,
};

const LocaleContext = createContext<LocaleContextState>(initialState);

function detectBrowserLocale(): SupportedLocale {
  if (typeof window === "undefined" || !navigator.language) return "en-US";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("pt")) return "pt-BR";
  return "en-US";
}

export function LocaleProvider({
  children,
  defaultLocale,
  storageKey = "mercury-locale",
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(storageKey) as SupportedLocale | null;
      if (stored && (stored === "en-US" || stored === "pt-BR")) {
        return stored;
      }
    }
    return defaultLocale ?? detectBrowserLocale();
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = (newLocale: SupportedLocale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, newLocale);
    }
    setLocaleState(newLocale);
  };

  const messages = MESSAGES[locale] || MESSAGES["en-US"];

  return (
    <LocaleContext.Provider value={{ locale, setLocale, availableLocales: LOCALES }}>
      <IntlProvider locale={locale} messages={messages} defaultLocale="en-US">
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
