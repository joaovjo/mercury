import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { FormattedMessage } from "react-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-xs" className="relative">
            <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">
              <FormattedMessage id="app.theme.toggle" defaultMessage="Toggle theme" />
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <FormattedMessage id="app.theme.light" defaultMessage="Light" />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <FormattedMessage id="app.theme.dark" defaultMessage="Dark" />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <FormattedMessage id="app.theme.system" defaultMessage="System" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}