import { render } from "preact";
import { App } from "./App";
import { initMatomo, initSpaPageviews, trackSpaPageView } from "./analytics/matomo";
import { AuthError, Landing, Loading } from "./auth/AuthGate";
import { SiteFrame } from "./components/layout/SiteFrame";
import { initKeycloak } from "./auth/keycloak";
import { MATOMO_SITE_ID, MATOMO_URL } from "./config";
import { HomePage } from "./pages/HomePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { isReservedPath, pathSlug } from "./services/navigation";
import "./styles/reset.css";
import "./styles/fonts.css";
import "./styles/variables.css";
import "./styles/checkbox.css";
import "./styles/auth-gate.css";

const root = document.getElementById("app")!;

render(<Loading />, root);

initMatomo(MATOMO_URL, MATOMO_SITE_ID);
initSpaPageviews();

if (isReservedPath()) {
  // The privacy policy has to be readable by anyone, so it must not reach
  // initKeycloak, whose non-signup mode is login-required.
  render(
    <SiteFrame>
      <PrivacyPage />
    </SiteFrame>,
    root,
  );
  trackSpaPageView();
} else if (pathSlug() === undefined) {
  // The slug-less root belongs to no community, so it has no sign-in mode to
  // pick: render the signpost without touching Keycloak.
  render(
    <SiteFrame>
      <HomePage />
    </SiteFrame>,
    root,
  );
  trackSpaPageView();
} else {
  initKeycloak()
    .then((authenticated) => {
      render(authenticated ? <App /> : <Landing />, root);
      trackSpaPageView();
    })
    .catch((err) => {
      console.error("Authentication initialization failed", err);
      render(<AuthError />, root);
    });
}
