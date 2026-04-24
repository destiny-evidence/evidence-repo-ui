import { render } from "preact";
import { App } from "./App";
import { initKeycloak } from "./auth/keycloak";
import "./styles/reset.css";
import "./styles/variables.css";
import "./styles/auth-gate.css";

const root = document.getElementById("app")!;

function Loading() {
  return (
    <div class="auth-gate">
      <p>Signing you in…</p>
    </div>
  );
}

function AuthError() {
  return (
    <div class="auth-gate">
      <div class="auth-gate__panel">
        <p>Unable to sign in.</p>
        <button
          type="button"
          class="auth-gate__retry"
          onClick={() => location.reload()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

render(<Loading />, root);

initKeycloak()
  .then(() => render(<App />, root))
  .catch((err) => {
    console.error("Authentication initialization failed", err);
    render(<AuthError />, root);
  });
