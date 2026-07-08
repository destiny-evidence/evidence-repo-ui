import { describe, test, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/preact";
import { useEffect, useState } from "preact/hooks";
import {
  SelectionProvider,
  useSelectionContext,
} from "@/components/search/SelectionProvider";

// A stand-in for SearchPage: reports its search identity and reflects the
// selected count, and can be unmounted to simulate a route change.
function Consumer({ identity }: { identity: string }) {
  const sel = useSelectionContext();
  const { syncSearchIdentity } = sel;
  useEffect(() => {
    syncSearchIdentity(identity);
  }, [syncSearchIdentity, identity]);
  return (
    <div>
      <span data-testid="count">{sel.count(1000)}</span>
      <button type="button" onClick={() => sel.toggle("a")}>
        toggle-a
      </button>
    </div>
  );
}

function Harness() {
  const [identity, setIdentity] = useState("hpv|q=x");
  const [mounted, setMounted] = useState(true);
  return (
    <SelectionProvider>
      {mounted && <Consumer identity={identity} />}
      <button type="button" onClick={() => setMounted((m) => !m)}>
        toggle-mount
      </button>
      <button type="button" onClick={() => setIdentity("hpv|q=y")}>
        new-search
      </button>
    </SelectionProvider>
  );
}

describe("SelectionProvider", () => {
  test("keeps the selection when the consumer remounts (navigation)", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("toggle-a"));
    expect(screen.getByTestId("count").textContent).toBe("1");

    // Unmount + remount the consumer with the same identity — as a route change
    // would. The selection must survive.
    fireEvent.click(screen.getByText("toggle-mount"));
    fireEvent.click(screen.getByText("toggle-mount"));
    expect(screen.getByTestId("count").textContent).toBe("1");
  });

  test("clears the selection when the search identity changes", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("toggle-a"));
    expect(screen.getByTestId("count").textContent).toBe("1");

    act(() => {
      fireEvent.click(screen.getByText("new-search"));
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
