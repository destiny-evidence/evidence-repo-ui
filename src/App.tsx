import Router from "preact-router";
import { AuthProvider } from "./auth/AuthContext";
import { CommunityProvider } from "./community/CommunityContext";
import { AiSummaryProvider } from "./components/ai-summary/AiSummaryProvider";
import { SelectionProvider } from "./components/search/SelectionProvider";
import { AppShell } from "./components/layout/AppShell";
import { SearchPage } from "./pages/SearchPage";
import { VisualisePage } from "./pages/VisualisePage";
import { RecordDetailPage } from "./pages/RecordDetailPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { URL_CHANGE_EVENT } from "./services/navigation";

// preact-router intercepts internal <a href="/..."> clicks and updates the
// URL via history.pushState without firing popstate or our URL_CHANGE_EVENT.
// Bridging Router onChange into URL_CHANGE_EVENT keeps our URL subscribers
// in sync with router-driven navigation.
function emitUrlChange() {
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

export function App() {
  return (
    <AuthProvider>
      <CommunityProvider>
        <AiSummaryProvider>
          <SelectionProvider>
            <AppShell>
              <Router onChange={emitUrlChange}>
                <RecordDetailPage path="/:community/references/:id" />
                <VisualisePage path="/:community/visualise" />
                <SearchPage path="/:community" />
                <NotFoundPage default />
              </Router>
            </AppShell>
          </SelectionProvider>
        </AiSummaryProvider>
      </CommunityProvider>
    </AuthProvider>
  );
}
