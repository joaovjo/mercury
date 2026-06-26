import type { Flags } from "./flags.ts";
import { getUpdateStatus } from "../update-check.ts";

const BOOTSTRAP_URL =
  process.env.MERCURY_BOOTSTRAP_URL ??
  "https://raw.githubusercontent.com/Daniel-Boll/mercury/main/bootstrap.sh";

export type UpdateEvent =
  | { type: "line"; stream: "stdout" | "stderr"; text: string }
  | { type: "done"; code: number };

export async function runUpdate(onEvent?: (event: UpdateEvent) => void): Promise<number> {
  const url = `'${BOOTSTRAP_URL.replaceAll("'", "'\\''")}'`;
  const proc = Bun.spawn(["bash", "-c", `set -o pipefail; curl -fsSL ${url} | bash`], {
    stdin: "inherit",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  await Promise.all([
    forward(proc.stdout, "stdout", onEvent),
    forward(proc.stderr, "stderr", onEvent),
  ]);

  const code = await proc.exited;
  onEvent?.({ type: "done", code });
  return code;
}

export async function updateCmd(flags: Flags = {}): Promise<void> {
  if (flags.force !== true) {
    const status = await getUpdateStatus();
    if (!status.updateAvailable) {
      const latest = status.latest ?? status.current;
      console.log(`Mercury is already up to date (${latest}).`);
      console.log("Run `mercury update --force` to reinstall the latest release.");
      return;
    }
    console.log(`Updating Mercury ${status.current} → ${status.latest}...`);
  }

  const code = await runUpdate((event) => {
    if (event.type === "line") {
      const out = event.stream === "stderr" ? process.stderr : process.stdout;
      out.write(event.text);
    }
  });
  if (code !== 0) process.exit(code);
}

async function forward(
  stream: ReadableStream<Uint8Array>,
  name: "stdout" | "stderr",
  onEvent?: (event: UpdateEvent) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onEvent?.({ type: "line", stream: name, text: decoder.decode(value, { stream: true }) });
  }
  const rest = decoder.decode();
  if (rest) onEvent?.({ type: "line", stream: name, text: rest });
}
