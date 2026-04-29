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
