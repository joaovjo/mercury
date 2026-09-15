import type { WsMessage } from "../types";

// Token comes from the URL (?token=...) that the CLI opens.
const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
export const TOKEN = params.get("token") ?? "";

export async function api<T>(path: string): Promise<T> {
  const query = TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "";
  const res = await fetch(`/api/${path}${query}`);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error ?? `${path}: HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function post<T = unknown>(path: string, body?: unknown): Promise<T> {
  const query = TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "";
  const res = await fetch(`/api/${path}${query}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json as T;
}

type WsSubscriber = (msg: WsMessage) => void;
type ConnListener = (connected: boolean) => void;

const subs = new Set<WsSubscriber>();
const connListeners = new Set<ConnListener>();
let sharedWs: WebSocket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let connected = false;

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  for (const fn of connListeners) {
    try {
      fn(connected);
    } catch {
      // Ignore listener error
    }
  }
}

function ensureWs() {
  if (typeof window === "undefined") return;
  if (sharedWs && (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const query = TOKEN ? `?token=${encodeURIComponent(TOKEN)}` : "";
  try {
    sharedWs = new WebSocket(`${protocol}//${window.location.host}/ws${query}`);
  } catch {
    setConnected(false);
    return;
  }

  sharedWs.onopen = () => {
    setConnected(true);
  };

  sharedWs.onmessage = (e) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    for (const fn of subs) {
      try {
        fn(msg);
      } catch {
        // Ignore subscriber error
      }
    }
  };

  sharedWs.onclose = () => {
    setConnected(false);
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(ensureWs, 2000);
  };

  sharedWs.onerror = () => {
    setConnected(false);
  };
}

export function subscribe(fn: WsSubscriber): () => void {
  ensureWs();
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/**
 * Observe live socket connectivity. Calls fn(true/false) immediately with the
 * current state, then on every change. Returns an unsubscribe fn.
 */
export function onConnection(fn: ConnListener): () => void {
  ensureWs();
  connListeners.add(fn);
  fn(connected);
  return () => {
    connListeners.delete(fn);
  };
}

/** Fire onChange(table) only on DB change events. */
export function liveUpdates(onChange: (table: string) => void): () => void {
  return subscribe((msg) => {
    if (msg.type === "changed") {
      onChange(msg.table);
    }
  });
}
