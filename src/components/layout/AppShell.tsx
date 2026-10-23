import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { track } from "@/analytics/matomo";
import { useAuth } from "@/auth/AuthContext";
import { useCommunity } from "@/community/CommunityContext";
import { FeedbackLink } from "@/components/feedback/FeedbackLink";
import { MenuIcon } from "@/components/common/icons";
import { NewTabLink } from "@/components/common/NewTabLink";
import { ResourcesMenu } from "./ResourcesMenu";
import { SiteFrame } from "./SiteFrame";
import { URL_CHANGE_EVENT } from "@/services/navigation";
import { FEEDBACK_FORM_URL } from "@/config";
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
  const searchActive =
    community != null &&
    (pathname === `/${community.slug}` ||
      pathname.startsWith(`/${community.slug}/references/`));
  const visualiseActive =
    community != null && pathname === `/${community.slug}/visualise`;
  // Within a community the brand goes to its root; off one (an unknown slug)
  // it goes to the home page, which lists the communities.
  const brandHref = community ? `/${community.slug}` : "/";
  const resources = community?.externalResources ?? [];
  const trackTab = (name: string) => () =>
    track({ category: "Navigation", action: "Tab Clicked", name });

  // Narrow screens fold the nav and user controls behind a menu button; on wide
  // ones CSS shows them inline whatever this says.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      menuToggleRef.current?.focus();
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);
  return (
    <SiteFrame>
      <header class="app-header">
        <a href={brandHref} class="app-header__brand">
          <span class="app-header__logo-mark" aria-hidden="true">E</span>
          <span class="app-header__brand-text">
            <span class="app-header__brand-name">Evidence Repository</span>
            {community && (
              <span class="app-header__brand-community">{community.name}</span>
            )}
          </span>
        </a>
        <div class="app-header__menu-wrap" ref={menuWrapRef}>
          <button
            type="button"
            class="app-header__menu-toggle"
            aria-expanded={menuOpen ? "true" : "false"}
            aria-controls={menuId}
            onClick={() => setMenuOpen((v) => !v)}
            ref={menuToggleRef}
          >
            Menu
            <MenuIcon size={16} />
          </button>
          <div
            id={menuId}
            class={`app-header__menu${menuOpen ? " is-open" : ""}`}
            // A link to the current path (Search from a query) leaves the
            // pathname unchanged, so the effect above wouldn't close the menu.
            onClick={(e) =>
              (e.target as Element).closest("a") && setMenuOpen(false)
            }
          >
            {(community || FEEDBACK_FORM_URL) && (
              <nav class="app-nav" aria-label="Primary">
                {community && (
                  <>
                    <a
                      class={`app-nav__link${searchActive ? " active" : ""}`}
                      href={`/${community.slug}`}
                      onClick={trackTab("Search")}
                    >
                      Search
                    </a>
                    {community.features.evidenceMap && (
                      <a
                        class={`app-nav__link${visualiseActive ? " active" : ""}`}
                        href={`/${community.slug}/visualise`}
                        onClick={trackTab("Visualise")}
                      >
                        Visualise
                      </a>
                    )}
                    {resources.length > 0 && (
                      <ResourcesMenu resources={resources} />
                    )}
                  </>
                )}
                <FeedbackLink />
              </nav>
            )}
            {/* Flat stand-in for the Resources dropdown; CSS shows one or the other. */}
            {resources.length > 0 && (
              <div class="app-header__menu-resources">
                <span class="app-header__menu-label">Resources</span>
                {resources.map((r) => (
                  <NewTabLink
                    key={r.href}
                    class="app-header__menu-resource"
                    href={r.href}
                    event={{
                      category: "Resources",
                      action: "Link Clicked",
                      name: r.title,
                    }}
                  >
                    {r.title}
                  </NewTabLink>
                ))}
              </div>
            )}
            <div class="app-header__user">
              {username && <span class="app-header__username">{username}</span>}
              <button type="button" class="app-header__signout" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main class="app-main">{children}</main>
    </SiteFrame>
  );
}
