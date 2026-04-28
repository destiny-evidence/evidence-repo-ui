import { useState, useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { URL_CHANGE_EVENT } from "@/services/navigation";
import { findCommunity } from "@/services/communities";
import type { Community } from "@/types/models";
import "./AppShell.css";

interface AppShellProps {
  children: ComponentChildren;
}

// Header-only need: react to pathname changes (not just search) so the
// community badge updates on route transitions.
function useCurrentCommunity(): Community | undefined {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPathname(window.location.pathname);
    window.addEventListener(URL_CHANGE_EVENT, onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener(URL_CHANGE_EVENT, onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);
  const slug = pathname.split("/").filter(Boolean)[0];
  return slug ? findCommunity(slug) : undefined;
}

// Brand link target: there's no real "/" landing page yet — the router only
// matches /:community/* — so point at the lone live community root. Revisit
// when a multi-community switcher or a true root page lands.
const BRAND_HREF = "/esea";

export function AppShell({ children }: AppShellProps) {
  const community = useCurrentCommunity();
  return (
    <div class="app-shell">
      <header class="app-header">
        <a href={BRAND_HREF} class="app-header__brand">
          <span class="app-header__logo-mark" aria-hidden="true">E</span>
          <span class="app-header__brand-text">
            <span class="app-header__brand-name">Evidence Repository</span>
            {community && (
              <>
                <span class="app-header__brand-sep" aria-hidden="true">/</span>
                <span class="app-header__brand-community">{community.name}</span>
              </>
            )}
          </span>
        </a>
        <div class="app-header__auth" aria-label="Sign in placeholder">
          Sign in
        </div>
      </header>
      <main class="app-main">{children}</main>
    </div>
  );
}
