export const URL_CHANGE_EVENT = "urlchange";

export function navigate(
  url: string,
  options: { mode?: "push" | "replace"; state?: unknown } = {},
): void {
  const mode = options.mode ?? "push";
  // Defaults to null — matches preact-router's own pushState calls so a plain
  // navigation clears any state left by a previous one.
  const state = options.state ?? null;
  if (mode === "replace") {
    history.replaceState(state, "", url);
  } else {
    history.pushState(state, "", url);
  }
  // Our own subscribers (useUrlParams, CommunityContext) listen for this.
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
  // preact-router only re-evaluates its matched route on popstate (or its own
  // anchor-click / route() navigations) — it ignores manual pushState. Without
  // this nudge a programmatic *cross-route* jump (e.g. a map cell → Search)
  // changes the address bar but leaves the previous page mounted. A synthetic
  // popstate makes the Router re-route to the URL we just wrote; it neither
  // moves history nor touches the entry's state.
  window.dispatchEvent(new Event("popstate"));
}
