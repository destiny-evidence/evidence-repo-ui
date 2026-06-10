import { login, register } from "./keycloak";

export function Landing() {
  return (
    <div class="auth-gate">
      <div class="auth-gate__panel">
        <p>Welcome to the Evidence Repository.</p>
        <div class="auth-gate__actions">
          <button
            type="button"
            class="auth-gate__button auth-gate__button--primary"
            onClick={login}
          >
            Sign in
          </button>
          <button type="button" class="auth-gate__button" onClick={register}>
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div class="auth-gate">
      <p>Signing you in…</p>
    </div>
  );
}

export function AuthError() {
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
