"use strict";
const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { startServer, stopServer, server } = require("./server.js");

let mainWindow = null;
let backendStarted = false;

async function createWindow() {
  if (!backendStarted) {
    await startServer({ port: Number(process.env.PORT || 0) });
    backendStarted = true;
  }
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("StandoffX local server did not start.");
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 360, minHeight: 560,
    show: false, autoHideMenuBar: true, backgroundColor: "#0b1017",
    title: "StandoffX Menu",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  await mainWindow.loadURL("http://127.0.0.1:" + address.port);
  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => createWindow()).catch(error => {
  console.error("[electron]", error);
  app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error);
});
app.on("before-quit", () => { stopServer().catch(console.error); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
