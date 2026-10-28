# StandoffX Menu Prototype

Independent browser prototype in **standoffX/3d-models**. The private `standoffX/StandoffX` game repository is used only as a read-only reference and is not modified by this project.

## Run locally

The page imports Three.js modules and loads FBX/TGA assets over HTTP, so do not open `index.html` directly using `file://`.

On Windows, open a terminal in this repository and run:

```bat
py -m http.server 8000
```

Then open **http://localhost:8000** in a modern browser. The browser needs internet access for Three.js and the repository's remote models/textures.

To publish it, open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, and save. Open the Pages URL after GitHub confirms publication.

## Current prototype features

- Left sidebar contains Home, Inventory, Market, Clans, Events, and Modes; friends are not shown in this version.
- Profile/avatar and ID are on the left on desktop. Currency and general Settings stay in the header.
- The **Agent** button beside currency opens T/CT selection and the three uploaded animation options.
- The Market and Inventory use local demo data. Purchases, selected weapon, theme, and agent choices are saved in this browser's `localStorage`; this is not a server-backed economy.
- **Tester Mode** opens a small local 3D shooting range with WASD movement, mouse look, jump, a crosshair, reload, weapon switching, bot targets, and mobile touch controls.
- The tester bots use the uploaded FBX character animation files. Weapon models are loaded from the `Pistols`, `Rifles`, and `Gloves` folders. AKR uses `Rifles/AKR_JadeStone_D.png`; other weapons receive a procedural surface texture for the prototype.
- T uses `OTCChA_D.tga`. The code is ready to use `FSB_A_D.tga` for CT, but that file is currently missing from the repository root. Upload it there to enable the CT texture. The CT model is not covered with the T atlas.
- **Team Fight** and **Allies** are visible in the mode selector but are not implemented as playable multiplayer modes in this release. The tester range is local-only, with simple bot behaviour; it does not connect to a server and the client-side tester label is not secure authentication.

## Current character animation files

- T: `Excited.fbx`, `Illegal Elbow Punch.fbx`, `Talking On Phone.fbx`
- CT: `Excited_CT.fbx`, `Illegal Elbow Punch_CT.fbx`, `Talking On Phone _CT.fbx`

## Controls in Tester Mode

- **WASD / arrow keys** — move
- **Mouse** — look around; click the scene to lock the cursor
- **Left mouse button** — fire
- **R** — reload
- **1 / 2** — AKR / USP
- **Space** — jump
- **Esc** — release the mouse cursor
- On touch screens, use the directional pad, Fire and Reload controls; drag on the scene to look around.

All game state is local and is reset when you start a new tester run. This is an early prototype; full Teams/Allies match flow and server-backed testing permissions remain future work.
