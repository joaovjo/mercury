import { GlobeIcon, CheckIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale, LOCALES, type SupportedLocale } from "@/components/locale-provider";
import { useIntl } from "react-intl";

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const intl = useIntl();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="relative flex items-center justify-center text-xs font-semibold"
            title={intl.formatMessage({ id: "app.locale.toggle", defaultMessage: "Change language" })}
          >
            <GlobeIcon className="size-4" />
            <span className="sr-only">
              {intl.formatMessage({ id: "app.locale.toggle", defaultMessage: "Change language" })}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        {LOCALES.map((item) => (
          <DropdownMenuItem
            key={item.code}
            onClick={() => setLocale(item.code as SupportedLocale)}
            className="flex items-center justify-between cursor-pointer text-xs"
          >
            <span className="flex items-center gap-2">
              <span className="text-sm">{item.flag}</span>
              <span>{item.label}</span>
            </span>
            {locale === item.code && <CheckIcon className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
