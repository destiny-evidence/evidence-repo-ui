import { describe, test, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/preact";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { keycloak } from "@/auth/keycloak";

function Consumer() {
  const { authenticated, username, aiSummaryWriter, logout } = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(authenticated)}</span>
      <span data-testid="username">{username ?? ""}</span>
      <span data-testid="ai-summary-writer">{String(aiSummaryWriter)}</span>
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

  test("aiSummaryWriter is false when the role is absent from the token", () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId("ai-summary-writer")).toHaveTextContent("false");
  });

  test("aiSummaryWriter is true when ai_summary.writer is in realm_access.roles", () => {
    (
      keycloak.tokenParsed as { realm_access?: { roles: string[] } }
    ).realm_access = { roles: ["ai_summary.writer"] };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId("ai-summary-writer")).toHaveTextContent("true");
  });

  test("useAuth throws when rendered outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
