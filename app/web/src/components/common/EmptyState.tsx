import { TrayIcon } from "@phosphor-icons/react";

interface EmptyStateProps {
  message?: string;
  skill?: string;
}

export function EmptyState({
  message = "Nothing here yet.",
  skill,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/60 p-10 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground shadow-xs">
      <div className="size-10 rounded-full bg-muted/50 border border-border flex items-center justify-center text-muted-foreground/80 mb-1">
        <TrayIcon className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {skill && (
        <p className="text-xs text-muted-foreground">
          Run the <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.75rem] text-primary">{skill}</code> skill to populate this view.
        </p>
      )}
    </div>
  );
}
