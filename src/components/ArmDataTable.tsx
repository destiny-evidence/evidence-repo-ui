import type {
  ArmData,
  ControlConditionData,
  InterventionData,
} from "@/types/investigation";
import "./ArmDataTable.css";

interface ArmDataTableProps {
  arms: ArmData[];
  intervention: InterventionData | null;
  control: ControlConditionData | null;
}

const COLUMNS = [
  { key: "n", label: "n", integer: true },
  { key: "mean", label: "Mean", integer: false },
  { key: "sd", label: "SD", integer: false },
  { key: "se", label: "SE", integer: false },
  { key: "preMean", label: "Pre mean", integer: false },
  { key: "preSd", label: "Pre SD", integer: false },
  { key: "clusterCount", label: "Clusters", integer: true },
  { key: "icc", label: "ICC", integer: false },
  { key: "events", label: "Events", integer: true },
] as const;

// Union of every `key` literal in COLUMNS, e.g. "n" | "mean" | "sd" | ...
type ColumnKey = (typeof COLUMNS)[number]["key"];

function armLabel(
  arm: ArmData,
  intervention: InterventionData | null,
  control: ControlConditionData | null,
  index: number,
): string {
  if (arm.conditionRef) {
    if (intervention && arm.conditionRef === intervention.id) {
      return intervention.name?.trim() || "Intervention";
    }
    if (control && arm.conditionRef === control.id) {
      return "Control";
    }
  }
  return `Arm ${index + 1}`;
}

function formatCell(value: number | undefined, integer: boolean): string {
  if (value === undefined) return "—";
  if (integer) return String(Math.round(value));
  return String(value);
}

export function ArmDataTable({
  arms,
  intervention,
  control,
}: ArmDataTableProps) {
  if (arms.length === 0) return null;

  const visibleColumns = COLUMNS.filter((col) =>
    arms.some((arm) => arm[col.key as ColumnKey] !== undefined),
  );
  if (visibleColumns.length === 0) return null;

  return (
    <div class="arm-data">
      <h4 class="arm-data__heading">Arm data</h4>
      <table class="arm-data__table">
        <thead>
          <tr>
            <th class="arm-data__header">Arm</th>
            {visibleColumns.map((col) => (
              <th key={col.key} class="arm-data__header">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {arms.map((arm, i) => (
            <tr key={arm.id || `arm-${i}`}>
              <td class="arm-data__cell arm-data__cell--name">
                {armLabel(arm, intervention, control, i)}
              </td>
              {visibleColumns.map((col) => (
                <td key={col.key} class="arm-data__cell arm-data__cell--data">
                  {formatCell(arm[col.key as ColumnKey], col.integer)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
