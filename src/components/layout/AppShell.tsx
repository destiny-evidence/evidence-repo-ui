import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { track } from "@/analytics/matomo";
import { useAuth } from "@/auth/AuthContext";
import { useCommunity } from "@/community/CommunityContext";
import { FeedbackFAB } from "@/components/feedback/FeedbackFAB";
import { ResourcesMenu } from "./ResourcesMenu";
import { SiteFrame } from "./SiteFrame";
import { URL_CHANGE_EVENT } from "@/services/navigation";
import { useUrlParams } from "@/hooks/useUrlParams";
import { parseSearchParams, scopedUrl } from "@/services/searchParams";
import "./AppShell.css";

function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const onChange = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onChange);
    window.addEventListener(URL_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(URL_CHANGE_EVENT, onChange);
    };
  }, []);
  return pathname;
}

interface AppShellProps {
  children: ComponentChildren;
}

export function AppShell({ children }: AppShellProps) {
  const { username, logout } = useAuth();
  const community = useCommunity();
  const pathname = usePathname();
  const search = useUrlParams();
  const searchActive =
    community != null &&
    (pathname === `/${community.slug}` ||
      pathname.startsWith(`/${community.slug}/references/`));
  const visualiseActive =
    community != null && pathname === `/${community.slug}/visualise`;
  // Within a community the brand goes to its root; off one (an unknown slug)
  // it goes to the home page, which lists the communities.
  const brandHref = community ? `/${community.slug}` : "/";
  // Moving between Search and Visualise keeps the search; from anywhere else
  // the tabs start fresh.
  const carriesSearch =
    (community != null && pathname === `/${community.slug}`) || visualiseActive;
  const scope = carriesSearch ? parseSearchParams(search) : null;
  const searchPath = community ? `/${community.slug}` : "/";
  const searchHref = scope ? scopedUrl(searchPath, scope) : searchPath;
  const visualisePath = `${searchPath}/visualise`;
  const visualiseHref = scope ? scopedUrl(visualisePath, scope) : visualisePath;
  const trackTab = (name: string) => () =>
    track({ category: "Navigation", action: "Tab Clicked", name });
  return (
    <SiteFrame>
      <header class="app-header">
        <a href={brandHref} class="app-header__brand">
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
        {community && (
          <nav class="app-nav" aria-label="Primary">
            <a
              class={`app-nav__link${searchActive ? " active" : ""}`}
              href={searchHref}
              onClick={trackTab("Search")}
            >
              Search
            </a>
            {community.features.evidenceMap && (
              <a
                class={`app-nav__link${visualiseActive ? " active" : ""}`}
                href={visualiseHref}
                onClick={trackTab("Visualise")}
              >
                Visualise
              </a>
            )}
            {community.externalResources && community.externalResources.length > 0 && (
              <ResourcesMenu resources={community.externalResources} />
            )}
          </nav>
        )}
        <div class="app-header__user">
          {username && <span class="app-header__username">{username}</span>}
          <button type="button" class="app-header__signout" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <main class="app-main">{children}</main>
      <FeedbackFAB />
    </SiteFrame>
  );
}
