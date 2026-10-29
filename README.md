# StandoffX Menu + Online Prototype

Independent browser/Electron project in `standoffX/3d-models`. The separate `standoffX/StandoffX` game repository is only a read-only reference and is not modified by this project.

## Run locally

1. Install a current Node.js LTS release.
2. Clone/download this repository and run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `MONGODB_URI` to a MongoDB Atlas connection string and set `JWT_SECRET` to a long random secret.
5. Set a strong `ADMIN_PASSWORD` before the first production startup. The first created administrator uses nickname `SofterX`.
6. Run `npm run server`.
7. Open **http://localhost:3000**.

The health endpoint is **http://localhost:3000/api/health**. Login/register are disabled until MongoDB connects. Keep the real `.env` file out of GitHub.

## Render + MongoDB Atlas

A `render.yaml` blueprint is included. Create a Render Web Service from this repository and configure the environment variables:

- `MONGODB_URI`: your Atlas connection URI with database name.
- `JWT_SECRET`: a long random secret.
- `ADMIN_PASSWORD`: your initial admin password. Set this before the administrator account is created.
- `ADMIN_NICK`: optional; defaults to `SofterX`.

Allow the Render service to connect from Atlas Network Access. The Web Service itself must run `npm run server`; publishing `index.html` as a static-only site is not enough for online play. All clients need to open the same Node server origin for HTTP APIs and Socket.IO to work.

## Accounts

On an empty database, the server creates the `SofterX` administrator. Its initial password comes from `ADMIN_PASSWORD` (locally, if you do not set it, the default is `SofterX`). The initial ID is usually `10001`, or another available five-digit ID if that one is taken. Change the password for public deployment.

Players register with nickname and password. The server assigns a unique five-digit numeric ID; all future logins use that ID and password. Passwords are stored as bcrypt hashes and sessions use JWT tokens.

## Online match prototype

- Press Play in **Team Fight** or **Allies** to enter a Socket.IO match room. Single players are matched with another player who queues for the same mode and map while the room is open; invited lobby members launch together.
- Movement, yaw/pitch, player health, ammo, kills, respawns, and shots are sent to the server. The server simulates movement and validates fire cooldown/ammo and hit direction, then broadcasts match snapshots about 20 times a second.
- Other players appear as their selected T/CT FBX agent with nameplates and looping animation. The selected map name is stored in lobby/match data; this early network prototype still renders a shared test-range arena rather than the final in-game GLB maps.
- The server keeps active match state in memory (it is not saved in MongoDB); users, friend relations, direct messages, lobby settings, clans, profiles, and owned market items use MongoDB.
- A dropped connection marks the player offline. Reconnecting to the page can resume a still-active match. Exiting the match makes that player leave it.
- Tester mode is solo and can spawn up to three server-simulated bots. The server rejects tester mode and bot configuration for normal player accounts.

## Features

- Restored menu composition: friends at the left, animated agents in the center, event cards on the right, currency + agent/settings buttons at the top, and bottom icons for Friends, Inventory, Market, Clans and Chat.
- Settings and Agent panels close when their button is clicked again.
- Five-digit ID login, nickname registration, server friends, friend invitations, live presence and direct chat over Socket.IO.
- Leader-only lobby mode/map/composition changes, checked on the server.
- Market purchases and inventory are stored in MongoDB.
- Admin panel: database health/counts; edit nick, password, gold, role and owned items; edit/delete clans; promote players to Tester/Admin.
- T uses `OTCChA_D.tga`; CT is configured for `FSB_A_D.tga`. Upload that file to the root of this repository to enable CT atlas texturing.
- AKR uses `Rifles/AKR_JadeStone_D.png`; other weapons still use prototype procedural materials unless their real textures are available.

## Controls

- **WASD / arrow keys** — move
- **Mouse** — look around; click the arena to lock cursor
- **Left mouse button** — fire
- **R** — reload
- **1 / 2** — AKR / USP
- **Space** — jump
- **Esc** — release the mouse cursor
- Touch screens: use the on-screen movement, fire and reload controls and drag to look.

## Electron

With Node.js and `.env` configured, run `npm start` for the Electron app or `npm run dist` / `build-exe.bat` to build a Windows installer. Electron starts the local Node server inside the app. The app still requires the MongoDB connection and internet access for Three.js and remote FBX/TGA assets.
