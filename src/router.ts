// src/router.ts
type Params = { id?: string };
type RouteResolver = (match: RegExpMatchArray) => Params;
type RouteHandler = (params: Params) => void;

const routes: { pattern: RegExp; resolve: RouteResolver }[] = [
  { pattern: /^\/$/, resolve: () => ({}) },
  { pattern: /^\/(\d{3})$/, resolve: (match) => ({ id: match[1] }) },
];

let onRoute: RouteHandler = () => {};
export function setRouteHandler(fn: RouteHandler) { onRoute = fn; }

export function navigate(path: string) {
  if (location.pathname !== path) history.pushState({}, "", path);
  dispatch();
}

export function dispatch() {
  const path = location.pathname;
  for (const r of routes) {
    const match = path.match(r.pattern);
    if (match) {
      onRoute(r.resolve(match));
      return true;
    }
  }
  history.replaceState({}, "", "/");
  onRoute({});
  return false;
}

export function interceptLinks() {
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement)?.closest("a[data-link]") as HTMLAnchorElement | null;
    if (a && a.href.startsWith(location.origin)) {
      e.preventDefault();
      navigate(a.pathname);
    }
  });
}

window.addEventListener("popstate", dispatch);
