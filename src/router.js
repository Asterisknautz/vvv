const routes = [
    { pattern: /^\/$/, resolve: () => ({}) },
    { pattern: /^\/(\d{3})$/, resolve: (match) => ({ id: match[1] }) },
];
let onRoute = () => { };
export function setRouteHandler(fn) { onRoute = fn; }
export function navigate(path) {
    if (location.pathname !== path)
        history.pushState({}, "", path);
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
        const a = e.target?.closest("a[data-link]");
        if (a && a.href.startsWith(location.origin)) {
            e.preventDefault();
            navigate(a.pathname);
        }
    });
}
window.addEventListener("popstate", dispatch);
