import { useCallback, useEffect, useRef, useState } from "react";

export type ResourceStatus = "loading" | "error" | "ready";

export interface ResourceResult<T> {
  status: ResourceStatus;
  data: T;
  error: string | null;
  refreshing: boolean;
  reload: () => Promise<void>;
}

export function useResource<T>(
  fetcher: () => Promise<T>,
  initial: T,
  deps: React.DependencyList = []
): ResourceResult<T> {
  const [status, setStatus] = useState<ResourceStatus>("loading");
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const runIdRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    const id = ++runIdRef.current;
    setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    setRefreshing(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      if (id !== runIdRef.current) return;
      setData(result);
      setStatus("ready");
    } catch (err) {
      if (id !== runIdRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      if (id === runIdRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    status,
    data,
    error,
    refreshing,
    reload,
  };
}
