import "./ViewToggle.css";

export type MapView = "bubble" | "table";

interface ViewToggleProps {
  value: MapView;
  onChange: (view: MapView) => void;
}

const OPTIONS: { view: MapView; label: string }[] = [
  { view: "bubble", label: "Bubble" },
  { view: "table", label: "Table" },
];

/** Segmented control switching the map between bubble and table rendering. */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div class="view-toggle" role="group" aria-label="Map view">
      {OPTIONS.map((option) => {
        const active = option.view === value;
        return (
          <button
            key={option.view}
            type="button"
            class={`view-toggle__option${active ? " active" : ""}`}
            aria-pressed={active}
            onClick={() => onChange(option.view)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
