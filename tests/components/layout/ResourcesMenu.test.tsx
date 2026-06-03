import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { ResourcesMenu } from "@/components/layout/ResourcesMenu";

const RESOURCES = [
  {
    title: "Onboarding toolkit",
    description: "What to do this month.",
    href: "https://example.org/onboarding",
  },
];

describe("ResourcesMenu", () => {
  test("starts collapsed and opens on button click", () => {
    render(<ResourcesMenu resources={RESOURCES} />);
    const button = screen.getByRole("button", { name: /Resources/ });
    const panelId = button.getAttribute("aria-controls")!;
    const panel = document.getElementById(panelId);

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(panel?.hidden).toBe(true);

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.hidden).toBe(false);
    expect(screen.getByRole("link", { name: /Onboarding toolkit/ })).toBeInTheDocument();
    expect(screen.getByText("What to do this month.")).toBeInTheDocument();
  });

  test("collapses again on a second button click", () => {
    render(<ResourcesMenu resources={RESOURCES} />);
    const button = screen.getByRole("button", { name: /Resources/ });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  test("Escape closes the panel and returns focus to the button", () => {
    render(<ResourcesMenu resources={RESOURCES} />);
    const button = screen.getByRole("button", { name: /Resources/ });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  test("clicking outside the container closes the panel", () => {
    render(
      <div>
        <button type="button">outside</button>
        <ResourcesMenu resources={RESOURCES} />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: /Resources/ });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "outside" }));

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  test("aria-controls points at a panel that exists in the DOM when collapsed", () => {
    render(<ResourcesMenu resources={RESOURCES} />);
    const button = screen.getByRole("button", { name: /Resources/ });
    const controlsId = button.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).not.toBeNull();
  });

  test("each resource link opens externally with safe rel", () => {
    render(<ResourcesMenu resources={RESOURCES} />);
    fireEvent.click(screen.getByRole("button", { name: /Resources/ }));
    const link = screen.getByRole("link", { name: /Onboarding toolkit/ });
    expect(link.getAttribute("href")).toBe("https://example.org/onboarding");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
