import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/preact";
import { AuthError, Loading } from "@/auth/AuthGate";

describe("AuthGate", () => {
  test("Loading shows the signing-in message", () => {
    render(<Loading />);
    expect(screen.getByText("Signing you in…")).toBeInTheDocument();
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
