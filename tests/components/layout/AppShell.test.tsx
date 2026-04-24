import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/preact";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/auth/AuthContext";
import { keycloak } from "@/auth/keycloak";

function renderShell() {
  return render(
    <AuthProvider>
      <AppShell>
        <div>child</div>
      </AppShell>
    </AuthProvider>,
  );
}

describe("AppShell header", () => {
  test("renders the username and Sign out button when authenticated", () => {
    renderShell();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  test("Sign out button calls keycloak.logout", () => {
    renderShell();
    screen.getByRole("button", { name: "Sign out" }).click();
    expect(keycloak.logout).toHaveBeenCalled();
  });
});
