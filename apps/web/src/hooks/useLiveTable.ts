import { useEffect, useRef } from "react";
import { subscribe } from "../lib/api";

export function useLiveTable(
  tables: string | string[],
  reload: () => void | Promise<void>
) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  useEffect(() => {
    const tableList = Array.isArray(tablesRef.current)
      ? tablesRef.current
      : [tablesRef.current];
    const wanted = new Set(tableList);

    const unsubscribe = subscribe((msg) => {
      if (msg.type === "changed" && wanted.has(msg.table)) {
        reloadRef.current();
      }
    });

    return unsubscribe;
  }, [tables]);
}
