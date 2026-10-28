# StandoffX Menu Prototype

Independent menu/UI prototype stored in **standoffX/3d-models**. It does not change the separate StandoffX game repository.

## Open as a website / on a phone

To publish this prototype through GitHub Pages, open the repository **Settings → Pages**, select **Deploy from a branch**, choose branch `main` and folder `/(root)`, then save. When GitHub Pages reports that the site is published, open `https://standoffx.github.io/3d-models/` on the PC or phone. The Pages site must be enabled first; adding `index.html` to the repository does not enable hosting by itself.

## Run in a browser

Open `index.html` in a modern browser. The full 3D animation loader works best when the page is served over HTTP/HTTPS, because it imports Three.js from a CDN and loads FBX files from this public repository. If WebGL, the network, or an animation file is unavailable, an SVG agent placeholder stays visible.

For a local server with Python installed, run this from the repository folder:

```bat
py -m http.server 8000
```

Then open http://localhost:8000.

## Build a Windows EXE

1. Install **Node.js 24 LTS** from https://nodejs.org/ and reopen the terminal.
2. Download or clone this repository.
3. Double-click `build-exe.bat`.
4. The script installs Electron build dependencies and runs the Windows NSIS build.
5. Find the installer inside `release/`.

The build needs internet access on first run to download npm packages. The menu's 3D models and font are also loaded online; an offline asset bundle can be added later.

## Prototype behaviour

- Responsive desktop and phone layouts, including bottom mobile navigation.
- Demo modes: КБ, Союзники, Тренировка.
- Demo lobby, friend invitations, and a simulated invitation acceptance.
- Local avatar upload/compression, theme, language, sensitivity, animation, and low-performance settings.
- Demo records are in `DEMO_DATA` in `index.html`. Settings and profile edits remain in the current browser/app storage.
- Real authentication, real invitations, shared settings, and match start require a backend/API and Socket.IO integration.

## Models

The page attempts to load `Excited.fbx`, `Talking On Phone.fbx`, and `Illegal Elbow Punch.fbx` from this repository. Whether each FBX includes a visible rigged mesh depends on how it was exported; the placeholder is kept as a fallback.
