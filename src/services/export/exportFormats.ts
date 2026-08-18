/**
 * UI export choices.
 */
export type ExportFormat = "excel" | "ris" | "reference-list";

export interface ExportFormatSpec {
  /** Menu option text. Travels through to analytics as the format's name. */
  label: string;
  /** Filename stem: `evidence-repository-<stem>-<slug>-YYYYMMDD.<ext>`. */
  stem: string;
  ext: string;
}

export const EXPORT_FORMATS: Record<ExportFormat, ExportFormatSpec> = {
  excel: { label: "Excel spreadsheet", stem: "export", ext: "xlsx" },
  "reference-list": { label: "Reference list", stem: "references", ext: "pdf" },
  ris: { label: "RIS", stem: "references", ext: "ris" },
};

export const EXPORT_FORMAT_ORDER: ExportFormat[] = [
  "excel",
  "reference-list",
  "ris",
];
