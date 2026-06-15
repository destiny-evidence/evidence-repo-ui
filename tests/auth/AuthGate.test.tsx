import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/preact";
import { AuthError, Landing, Loading } from "@/auth/AuthGate";
import { login, register } from "@/auth/keycloak";

describe("AuthGate", () => {
  test("Loading shows an animated spinner", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector(".spinner")).toBeInTheDocument();
  });

  describe("Landing", () => {
    beforeEach(() => {
      vi.mocked(login).mockClear();
      vi.mocked(register).mockClear();
    });

    test("Sign in triggers keycloak login", () => {
      render(<Landing />);
      screen.getByRole("button", { name: "Sign in" }).click();
      expect(login).toHaveBeenCalledOnce();
      expect(register).not.toHaveBeenCalled();
    });

    test("Create account triggers keycloak registration", () => {
      render(<Landing />);
      screen.getByRole("button", { name: "Create account" }).click();
      expect(register).toHaveBeenCalledOnce();
      expect(login).not.toHaveBeenCalled();
    });
  });

  test("AuthError shows the failure message and a retry button", () => {
    render(<AuthError />);
    expect(screen.getByText("Unable to sign in.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  test("AuthError retry button reloads the page", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    render(<AuthError />);
    screen.getByRole("button", { name: "Try again" }).click();
    expect(reload).toHaveBeenCalled();
  });
});
