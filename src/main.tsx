import { render } from "preact";
import { App } from "./App";
import { initKeycloak } from "./auth/keycloak";
import "./styles/reset.css";
import "./styles/variables.css";

const root = document.getElementById("app")!;

initKeycloak()
  .then(() => render(<App />, root))
  .catch((err) => {
    console.error("Authentication initialization failed", err);
    render(
      <div style={{ padding: "2rem" }}>
        <p>Unable to sign in. Please try again.</p>
      </div>,
      root,
    );
  });
