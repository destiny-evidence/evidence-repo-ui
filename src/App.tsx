import Router from "preact-router";
import { AuthProvider } from "./auth/AuthContext";
import { CommunityProvider } from "./community/CommunityContext";
import { AppShell } from "./components/layout/AppShell";
import { SearchPage } from "./pages/SearchPage";
import { RecordDetailPage } from "./pages/RecordDetailPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { URL_CHANGE_EVENT } from "./services/navigation";

// preact-router intercepts internal <a href="/..."> clicks and updates the
// URL via history.pushState without firing popstate or our URL_CHANGE_EVENT.
// Bridging Router onChange into URL_CHANGE_EVENT keeps subscribers
// (CommunityProvider, useUrlParams) in sync with router-driven navigation.
function emitUrlChange() {
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

export function App() {
  return (
    <AuthProvider>
      <CommunityProvider>
        <AppShell>
          <Router onChange={emitUrlChange}>
            <RecordDetailPage path="/:community/references/:id" />
            <SearchPage path="/:community" />
            <NotFoundPage default />
          </Router>
        </AppShell>
      </CommunityProvider>
    </AuthProvider>
  );
}
