const { app, BrowserWindow, Menu, dialog } = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 4000;
const SERVER_DIR = path.join(__dirname, "..", "server");
const HEALTH_URL = `http://localhost:${PORT}/api/health`;
const APP_URL = `http://localhost:${PORT}`;

let serverProcess = null;
let mainWindow = null;

function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, res => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - startedAt > timeoutMs) {
            reject(new Error("Server did not start in time."));
            return;
          }
          setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

function startServer() {
  // process.execPath is the Electron binary, not plain node — spawning it
  // directly would launch a second Electron instance instead of running the
  // script. ELECTRON_RUN_AS_NODE makes Electron's bundled Node run the file
  // like a normal `node` process instead (documented Electron behavior).
  serverProcess = spawn(process.execPath, ["src/index.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(PORT) },
    stdio: "inherit"
  });

  serverProcess.on("exit", code => {
    if (code && code !== 0 && mainWindow) {
      dialog.showErrorBox("POS server stopped", `The background server exited unexpectedly (code ${code}). Restart the app.`);
    }
  });
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "Grocery POS",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadURL(APP_URL);
}

// A cash register doesn't need File/Edit/View/Window menus.
Menu.setApplicationMenu(null);

app.whenReady().then(async () => {
  console.log("[desktop] app ready, starting server...");
  startServer();
  try {
    await waitForServer(HEALTH_URL);
    console.log("[desktop] server is up, opening window");
  } catch (err) {
    console.error("[desktop] server failed to start:", err.message);
    dialog.showErrorBox("Could not start POS", err.message);
    app.quit();
    return;
  }
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopServer);
