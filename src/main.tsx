import { createRoot } from "react-dom/client";

(async function bootstrap() {
	try {
		const [{ default: App }] = await Promise.all([import("./App.tsx")]);
		await import("./index.css");
		const client = await import("react-dom/client");
		const createRootFn = client.createRoot ?? (client.default && client.default.createRoot);
		if (!createRootFn) throw new Error("createRoot not found on react-dom/client");
		const ReactMod = await import("react");
		const ReactNS = ReactMod.default ?? ReactMod;
		createRootFn(document.getElementById("root")!).render(/*#__PURE__*/ ReactNS.createElement(App));
	} catch (err) {
		// Render a readable error to the page root so we can see import/runtime errors
		const root = document.getElementById("root");
		const message = err && err.stack ? err.stack : String(err);
		if (root) {
			root.innerHTML = `<div style="padding:24px"><h2>Startup error</h2><pre style="white-space:pre-wrap">${message}</pre></div>`;
		}
		// eslint-disable-next-line no-console
		console.error(err);
	}
})();
