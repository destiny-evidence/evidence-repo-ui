import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/preact";
import { ExportMenu, type ExportScopeOption } from "@/components/search/ExportMenu";
import type { ExportStatus } from "@/hooks/useSearchExport";

beforeEach(cleanup);

function setup(
  props: Partial<{
    disabled: boolean;
    status: ExportStatus;
    disabledReason: string;
    scopes: ExportScopeOption[];
    capNote: string;
  }> = {},
) {
  const onExport = vi.fn();
  render(
    <ExportMenu
      disabled={props.disabled ?? false}
      status={props.status ?? "idle"}
      onExport={onExport}
      disabledReason={props.disabledReason}
      scopes={props.scopes}
      capNote={props.capNote}
    />,
  );
  return { onExport };
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
  return screen.getByRole("group", { name: /export options/i });
}

function openAndExport(formatLabel?: RegExp) {
  const panel = openPanel();
  if (formatLabel) {
    fireEvent.click(within(panel).getByRole("radio", { name: formatLabel }));
  }
  fireEvent.click(within(panel).getByRole("button", { name: /^export$/i }));
}

describe("ExportMenu", () => {
  test("defaults to Excel and 'all' scope", () => {
    const { onExport } = setup();
    openAndExport();
    expect(onExport).toHaveBeenCalledWith("excel", "all");
  });

  test("exports the chosen format", () => {
    const { onExport } = setup();
    openAndExport(/^ris/i);
    expect(onExport).toHaveBeenCalledWith("ris", "all");

    cleanup();
    const second = setup();
    openAndExport(/excel/i);
    expect(second.onExport).toHaveBeenCalledWith("excel", "all");
  });

  test("prefers 'selected' scope when available, else falls back to 'all'", () => {
    const scopes: ExportScopeOption[] = [
      { value: "selected", label: "Selected (3)", available: true },
      { value: "all", label: "All results (900)", available: true },
    ];
    const { onExport } = setup({ scopes, capNote: "Exports are limited to 10,000 references." });
    openAndExport();
    expect(onExport).toHaveBeenCalledWith("excel", "selected");
  });

  test("sends 'all' when 'selected' is unavailable, and disables that radio", () => {
    const scopes: ExportScopeOption[] = [
      {
        value: "selected",
        label: "Selected (0)",
        available: false,
        reason: "Select references to export just those.",
      },
      { value: "all", label: "All results (900)", available: true },
    ];
    const { onExport } = setup({ scopes });
    const panel = openPanel();
    expect(within(panel).getByRole("radio", { name: /selected/i })).toBeDisabled();
    fireEvent.click(within(panel).getByRole("button", { name: /^export$/i }));
    expect(onExport).toHaveBeenCalledWith("excel", "all");
  });

  test("a disabled trigger doesn't open and explains why via a tooltip", () => {
    setup({ disabled: true, disabledReason: "No results to export." });
    const trigger = screen.getByRole("button", { name: /^export$/i });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("group", { name: /export options/i })).toBeNull();
    expect(trigger.parentElement).toHaveAttribute(
      "data-tooltip",
      "No results to export.",
    );
  });

  test("shows a busy label while an export is in progress", () => {
    setup({ status: "polling", disabled: true });
    expect(screen.getByRole("button", { name: /preparing/i })).toBeDefined();
  });
});
