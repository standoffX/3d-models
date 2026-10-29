# StandoffX Menu + Server

An independent browser/Electron prototype in `standoffX/3d-models`. The separate `standoffX/StandoffX` game repository is a read-only reference and is not modified by this project.

## Run the server locally

1. Install a current Node.js LTS release.
2. Download/clone this repository and run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `MONGODB_URI` to your MongoDB Atlas connection string. Keep the real URI/password in `.env` or the hosting provider's secret Environment settings; never commit them.
5. Set `JWT_SECRET` to a long random secret before deployment. Set a strong `ADMIN_PASSWORD` before the first production startup.
6. Run:

```bash
npm run server
```

Open **http://localhost:3000**. The health endpoint is **http://localhost:3000/api/health**. It reports whether MongoDB is connected. If MongoDB isn't configured, the HTTP page still opens, but account and database operations return a clear connection error.

## Default administrator and accounts

On an empty database, the server creates the admin account:

- Nickname: `SofterX`
- Login ID: `10001` (five digits)
- Initial password: `SofterX`

The ID may be different if `10001` is already in use. Change the bootstrap password before exposing a production instance and change the password from Settings after logging in. The password is stored as a bcrypt hash, not plaintext.

New players register with a nickname and password. The server assigns a unique five-digit ID, which is then used with the password for subsequent logins. The nickname is unique in this prototype.

## Render and MongoDB Atlas

A `render.yaml` blueprint is included. Create a Web Service from this repository, then provide these environment variables in Render:

- `MONGODB_URI`: Atlas connection string with the database name.
- `JWT_SECRET`: a long random secret (the blueprint can generate it).
- `ADMIN_PASSWORD`: the password for the initial `SofterX` admin account. Set this before the admin account is first created.
- `ADMIN_NICK`: optional; defaults to `SofterX`.

In Atlas, make sure the database user has the needed database permissions and the network access list permits connections from your hosting service. Never put a real database credential in a committed file or chat-visible source.

## Server features

- Login by five-digit player ID + password; registration by nickname + password.
- MongoDB collections for users, chat messages, lobbies, and clans.
- Friend list and add-by-ID; invitations to a lobby; lobby state sent through Socket.IO.
- Only the lobby leader can change the mode, map, or team composition. The server checks this too, so a client-side button isn't the only protection.
- Direct chat saved to MongoDB and delivered live through Socket.IO.
- Server-side purchases and inventory for the prototype catalogue.
- Admin panel with database health/counts, account edits (gold, password, nickname, role and owned items), tester permissions and clan moderation.
- Role-gated tester mode and bot setup. Ordinary players cannot request the tester role through the client.
- Passwords are bcrypt hashes; session tokens are JWTs. The MongoDB URI is never returned by the admin API.

## UI and controls

- Restored lobby composition: friends at the left, animated T/CT agents in the center, event cards on the right, currency and Settings/Agent buttons at the top, and bottom icons for Friends, Inventory, Market, Clans and Chat.
- Clicking the Settings or Agent button again returns to the previous panel.
- Mode and map selectors are in the right panel. The server enforces leader-only changes.
- Tester mode has a local 3D shooting range with mouse look, WASD/arrow keys, jump, firing, reload, weapon selection, moving FBX bots and touch controls. The server marks Tester/Admin roles; actual multiplayer match simulation for Team Fight and Allies is not yet implemented.
- T and CT use separate animation/model files. T uses `OTCChA_D.tga`; CT is configured for `FSB_A_D.tga`, but that texture must be uploaded into the repository root to be used. It will not be replaced with the T texture.
- The AKR model uses `Rifles/AKR_JadeStone_D.png`; other weapon surfaces are placeholder procedural finishes until their real textures are supplied.

## Run the Electron build

With Node.js installed and `.env` configured, run `npm install`, then `npm start` to open the local Electron app. To build a Windows installer, run `build-exe.bat` or `npm run dist`. The app needs access to MongoDB and the remote Three.js/model assets.
