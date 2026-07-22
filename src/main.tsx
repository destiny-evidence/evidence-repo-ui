import { render } from "preact";
import { App } from "./App";
import { initMatomo } from "./analytics/matomo";
import { AuthError, Landing, Loading } from "./auth/AuthGate";
import { initKeycloak } from "./auth/keycloak";
import { MATOMO_SITE_ID, MATOMO_URL } from "./config";
import "./styles/reset.css";
import "./styles/fonts.css";
import "./styles/variables.css";
import "./styles/checkbox.css";
import "./styles/auth-gate.css";

const root = document.getElementById("app")!;

render(<Loading />, root);

initMatomo(MATOMO_URL, MATOMO_SITE_ID);

initKeycloak()
  .then((authenticated) =>
    render(authenticated ? <App /> : <Landing />, root),
  )
  .catch((err) => {
    console.error("Authentication initialization failed", err);
    render(<AuthError />, root);
  });
