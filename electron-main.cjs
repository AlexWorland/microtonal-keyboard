// electron-main.cjs
// Electron main process. The renderer is the existing unbundled ES-module web
// app, so we cannot load it over file:// (Chromium blocks module imports there).
// Instead we register a privileged custom scheme `app://` and serve the project
// files from it — no bundler, no build step for the app code.

const { app, BrowserWindow, protocol } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const APP_ROOT = __dirname;
const SCHEME = "app";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// Map a request path to a file inside APP_ROOT, refusing path traversal.
function resolveSafe(reqPathname) {
  let p = decodeURIComponent(reqPathname);
  if (!p || p === "/") p = "/index.html";
  const full = path.normalize(path.join(APP_ROOT, p));
  if (full !== APP_ROOT && !full.startsWith(APP_ROOT + path.sep)) return null;
  return full;
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 640,
    minWidth: 480,
    minHeight: 320,
    backgroundColor: "#1b1d23",
    title: "Microtonal Piano Keyboard",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(`${SCHEME}://local/index.html`);

  // Headless smoke check: launch with SMOKE_TEST=1 to verify the app:// protocol
  // serves the ES modules AND the keyboard actually renders, then quit. A zero
  // key count means a module failed to load over the custom scheme.
  if (process.env.SMOKE_TEST) {
    win.webContents.on("did-finish-load", async () => {
      try {
        const count = await win.webContents.executeJavaScript(
          "document.querySelectorAll('.pkey').length"
        );
        if (count > 0) console.log("SMOKE_OK pkeys=" + count);
        else {
          console.error("SMOKE_FAIL no keys rendered (module load over app:// failed?)");
          process.exitCode = 1;
        }
      } catch (e) {
        console.error("SMOKE_FAIL " + e.message);
        process.exitCode = 1;
      }
      app.quit();
    });
    win.webContents.on("did-fail-load", (_e, code, desc, url) => {
      console.error("SMOKE_FAIL did-fail-load", code, desc, url);
      process.exitCode = 1;
      app.quit();
    });
  }

  return win;
}

app.whenReady().then(() => {
  protocol.handle(SCHEME, async (request) => {
    const filePath = resolveSafe(new URL(request.url).pathname);
    if (!filePath) return new Response("forbidden", { status: 403 });
    try {
      const data = await fs.promises.readFile(filePath);
      const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      return new Response(data, { headers: { "content-type": type } });
    } catch {
      return new Response("not found", { status: 404 });
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
