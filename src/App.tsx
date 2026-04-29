import Router from "preact-router";
import { AuthProvider } from "./auth/AuthContext";
import { AppShell } from "./components/layout/AppShell";
import { SearchPage } from "./pages/SearchPage";
import { RecordDetailPage } from "./pages/RecordDetailPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function App() {
  return (
    <AuthProvider>
      <AppShell>
        <Router>
          <RecordDetailPage path="/:community/references/:id" />
          <SearchPage path="/:community" />
          <NotFoundPage default />
        </Router>
      </AppShell>
    </AuthProvider>
  );
}
