import { render } from "preact";
import { App } from "./App";
import { AuthError, Loading } from "./auth/AuthGate";
import { initKeycloak } from "./auth/keycloak";
import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/auth-gate.css";

const root = document.getElementById("app")!;

render(<Loading />, root);

initKeycloak()
  .then(() => render(<App />, root))
  .catch((err) => {
    console.error("Authentication initialization failed", err);
    render(<AuthError />, root);
  });
