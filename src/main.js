// src/main.ts
import { ThreeApp } from "./threeScene";
import { dispatch, interceptLinks, setRouteHandler } from "./router";
const canvas = document.getElementById("three-canvas");
const app = new ThreeApp(canvas);
const routeIndicator = document.getElementById("route-indicator");
setRouteHandler(async ({ id }) => {
    routeIndicator.textContent = id ? `/${id}` : "/";
    await app.loadIdea(id);
});
interceptLinks();
dispatch();
