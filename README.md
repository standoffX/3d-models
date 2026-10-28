# StandoffX Menu Prototype

Independent menu prototype in **standoffX/3d-models**. It does not modify the separate StandoffX game repository.

## Preview on desktop or phone

To publish this prototype using GitHub Pages, open the repository **Settings → Pages**, select **Deploy from a branch**, choose branch `main` and folder `/(root)`, then save. After GitHub Pages reports that the site is published, open `https://standoffx.github.io/3d-models/` on desktop or phone. Pages must be enabled first.

## Run locally

Open `index.html` in a modern browser. For the 3D FBX loader, it is better to serve the project over HTTP/HTTPS because Three.js and model files are loaded online.

With Python installed, run:

```bat
py -m http.server 8000
```

Then open http://localhost:8000.

## Build a Windows EXE

1. Install Node.js from https://nodejs.org/ and reopen the terminal.
2. Download or clone this repository.
3. Double-click `build-exe.bat`.
4. The script installs Electron build dependencies and runs the Windows installer build.
5. Find the installer in `release/`.

The first build needs internet access for npm packages. Three.js, FBX animations, and other remote assets also require internet access when the app runs.

## Menu behaviour

- Standoff-style composition: persistent friends list on the left, animated squad in the center, account and activity panels on the right.
- No modal overlays: mode selection, lobby, settings, and profile render inside the main interface.
- The `Excited.fbx` animation loops for the local agent. When a demo friend accepts an invite, their FBX agent is loaded next to the local player and its animation loops independently.
- If an FBX has no visible rigged mesh/animation or WebGL is unavailable, the menu shows an animated visual fallback for each person.
- Responsive desktop and phone layout. On phones, the friends list becomes a horizontal strip above the scene.
- Avatar upload and compression, theme, language, sensitivity, animation, and low-performance settings save locally.
- Friend acceptance is simulated in the prototype. Replace this timer with the real invite/lobby event from a future API or Socket.IO server.
- Demo records are in `DEMO_DATA` near the top of `index.html`.

## Models used

The menu loads `Excited.fbx`, `Talking On Phone.fbx`, and `Illegal Elbow Punch.fbx` from this repository. Their animations are repeated continuously while the agents are visible.
