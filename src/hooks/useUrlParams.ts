import { useState, useEffect } from "preact/hooks";
import { URL_CHANGE_EVENT } from "@/services/navigation";

export function useUrlParams(): string {
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onChange = () => setSearch(window.location.search);
    window.addEventListener(URL_CHANGE_EVENT, onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener(URL_CHANGE_EVENT, onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  return search;
}
