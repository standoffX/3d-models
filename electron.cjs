"use strict";
const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b1017",
    title: "StandoffX Menu",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
