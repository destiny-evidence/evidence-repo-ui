import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { useRef } from "preact/hooks";
import { useDismiss } from "@/hooks/useDismiss";

function Menu({ setOpen }: { setOpen: (open: boolean) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useDismiss(true, setOpen, containerRef, triggerRef);
  return (
    <>
      <div ref={containerRef}>
        <button ref={triggerRef}>Trigger</button>
        <button>Stay</button>
        {/* Stands in for a control whose click re-renders it away (the map
            search's Clear) before the click reaches the document. */}
        <button onClick={(e) => e.currentTarget.remove()}>Vanish</button>
      </div>
      <p>Outside</p>
    </>
  );
}

describe("useDismiss", () => {
  test("closes on a click outside", () => {
    const setOpen = vi.fn();
    render(<Menu setOpen={setOpen} />);
    fireEvent.click(screen.getByText("Outside"));
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("stays open on a click inside", () => {
    const setOpen = vi.fn();
    render(<Menu setOpen={setOpen} />);
    fireEvent.click(screen.getByText("Stay"));
    expect(setOpen).not.toHaveBeenCalled();
  });

  test("stays open when the clicked control removes itself", () => {
    const setOpen = vi.fn();
    render(<Menu setOpen={setOpen} />);
    fireEvent.click(screen.getByText("Vanish"));
    expect(setOpen).not.toHaveBeenCalled();
  });

  test("closes on Escape and returns focus to the trigger", () => {
    const setOpen = vi.fn();
    render(<Menu setOpen={setOpen} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(screen.getByText("Trigger")).toHaveFocus();
  });
});
