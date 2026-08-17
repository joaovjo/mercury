import { Button } from "@/components/ui/button";
import { WarningOctagonIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";

interface ErrorStateProps {
  error?: string | null;
  onretry?: () => void | Promise<void>;
}

export function ErrorState({
  error = "Something went wrong.",
  onretry,
}: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6 shadow-xs">
      <div className="flex items-center gap-2 text-destructive font-semibold">
        <WarningOctagonIcon className="size-5 shrink-0" />
        <span>Couldn't load this section.</span>
      </div>
      <p className="text-muted-foreground text-sm mt-2 break-words font-mono text-xs bg-background/50 p-2.5 rounded-md border border-border">
        {error}
      </p>
      <p className="text-muted-foreground text-xs mt-2">
        If this persists, make sure the LinkedIn MCP is reachable and you're logged in to LinkedIn in your browser session, then retry.
      </p>
      {onretry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onretry}
          className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10"
        >
          <ArrowClockwiseIcon className="size-3.5 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}
