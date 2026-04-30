import { createContext, type ComponentChildren } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";
import { findCommunity } from "@/services/communities";
import { URL_CHANGE_EVENT } from "@/services/navigation";
import type { Community } from "@/types/models";

// undefined default lets useCommunity() distinguish "outside provider"
// (programming error) from "URL slug doesn't match a known community"
// (legitimate null result).
const CommunityContext = createContext<Community | null | undefined>(undefined);

function getSlug(): string | undefined {
  return window.location.pathname.split("/").filter(Boolean)[0];
}

export function CommunityProvider({ children }: { children: ComponentChildren }) {
  const [slug, setSlug] = useState<string | undefined>(getSlug);

  useEffect(() => {
    const onChange = () => setSlug(getSlug());
    window.addEventListener("popstate", onChange);
    window.addEventListener(URL_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(URL_CHANGE_EVENT, onChange);
    };
  }, []);

  const community = slug ? (findCommunity(slug) ?? null) : null;
  return (
    <CommunityContext.Provider value={community}>
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity(): Community | null {
  const value = useContext(CommunityContext);
  if (value === undefined) {
    throw new Error("useCommunity must be used within a CommunityProvider");
  }
  return value;
}
