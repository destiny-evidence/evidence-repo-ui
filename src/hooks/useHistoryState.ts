import { useState, useEffect } from "preact/hooks";
import { URL_CHANGE_EVENT } from "@/services/navigation";

// Reactive read of history.state. State only changes alongside a navigation, so
// the same events useUrlParams watches keep this in sync — popstate included, so
// the browser restoring a prior entry's state on back/forward is picked up too.
export function useHistoryState(): unknown {
  const [state, setState] = useState(() => window.history.state);
  useEffect(() => {
    const onChange = () => setState(window.history.state);
    window.addEventListener(URL_CHANGE_EVENT, onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener(URL_CHANGE_EVENT, onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);
  return state;
}
