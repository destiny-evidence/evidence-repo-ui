import { describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/auth/AuthContext";
import { CommunityProvider } from "@/community/CommunityContext";
import { keycloak } from "@/auth/keycloak";

function renderShell() {
  return render(
    <AuthProvider>
      <CommunityProvider>
        <AppShell>
          <div>child</div>
        </AppShell>
      </CommunityProvider>
    </AuthProvider>,
  );
}

describe("AppShell header", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/");
  });

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

  test("renders the community name in the brand when on a community route", () => {
    history.replaceState(null, "", "/esea");
    renderShell();
    expect(screen.getByText("Education")).toBeInTheDocument();
  });

  test("omits the community name when not on a community route", () => {
    history.replaceState(null, "", "/");
    renderShell();
    expect(screen.queryByText("Education")).not.toBeInTheDocument();
  });
});
