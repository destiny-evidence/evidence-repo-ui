import { describe, test, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/preact";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { keycloak } from "@/auth/keycloak";

function Consumer() {
  const { authenticated, username, logout } = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(authenticated)}</span>
      <span data-testid="username">{username ?? ""}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  test("exposes authenticated state and username from keycloak.tokenParsed", () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("username")).toHaveTextContent("Test User");
  });

  test("logout button calls keycloak.logout", () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    screen.getByText("Logout").click();
    expect(keycloak.logout).toHaveBeenCalled();
  });

  test("re-renders when keycloak fires onAuthRefreshSuccess", () => {
    const { rerender } = render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    act(() => {
      (keycloak.tokenParsed as { name: string }).name = "Refreshed User";
      keycloak.onAuthRefreshSuccess?.();
    });
    rerender(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId("username")).toHaveTextContent("Refreshed User");
  });

  test("useAuth throws when rendered outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
