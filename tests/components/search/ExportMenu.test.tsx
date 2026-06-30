import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/preact";
import { ExportMenu } from "@/components/search/ExportMenu";
import type { ExportStatus } from "@/hooks/useSearchExport";

beforeEach(cleanup);

function setup(
  props: Partial<{
    disabled: boolean;
    status: ExportStatus;
    disabledReason: string;
  }> = {},
) {
  const onExport = vi.fn();
  render(
    <ExportMenu
      disabled={props.disabled ?? false}
      status={props.status ?? "idle"}
      onExport={onExport}
      disabledReason={props.disabledReason}
    />,
  );
  return { onExport };
}

function openAndExport(formatLabel?: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
  const panel = screen.getByRole("group", { name: /export format/i });
  if (formatLabel) {
    fireEvent.click(within(panel).getByRole("radio", { name: formatLabel }));
  }
  fireEvent.click(within(panel).getByRole("button", { name: /^export$/i }));
}

describe("ExportMenu", () => {
  test("defaults to the reference list", () => {
    const { onExport } = setup();
    openAndExport();
    expect(onExport).toHaveBeenCalledWith("reference-list");
  });

  test("exports the chosen format", () => {
    const { onExport } = setup();
    openAndExport(/^ris/i);
    expect(onExport).toHaveBeenCalledWith("ris");

    cleanup();
    const second = setup();
    openAndExport(/excel/i);
    expect(second.onExport).toHaveBeenCalledWith("excel");
  });

  test("a disabled trigger doesn't open and explains why via a tooltip", () => {
    setup({ disabled: true, disabledReason: "No results to export." });
    const trigger = screen.getByRole("button", { name: /^export$/i });
    expect(trigger).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(trigger);
    expect(screen.queryByRole("group", { name: /export format/i })).toBeNull();
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
