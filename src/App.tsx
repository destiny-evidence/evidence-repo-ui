import Router from "preact-router";
import { AppShell } from "./components/layout/AppShell";
import { SearchPage } from "./pages/SearchPage";
import { RecordDetailPage } from "./pages/RecordDetailPage";

export function App() {
  return (
    <AppShell>
      <Router>
        <RecordDetailPage path="/:community/references/:id" />
        <SearchPage path="/:community" />
      </Router>
    </AppShell>
  );
}
