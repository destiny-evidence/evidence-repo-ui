export const URL_CHANGE_EVENT = "urlchange";

export function navigate(
  url: string,
  options: { mode?: "push" | "replace" } = {},
): void {
  const mode = options.mode ?? "push";
  if (mode === "replace") {
    history.replaceState(null, "", url);
  } else {
    history.pushState(null, "", url);
  }
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}
