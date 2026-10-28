# StandoffX Menu Prototype

Independent Standoff 2-style lobby/menu prototype in **standoffX/3d-models**. It does not modify the separate StandoffX game repository.

## Preview on desktop or phone

To publish this prototype through GitHub Pages, open the repository **Settings → Pages**, select **Deploy from a branch**, choose branch \`main\` and folder \`/(root)\`, then save. After GitHub Pages reports that the site is published, open \`https://standoffx.github.io/3d-models/\` on desktop or phone. Pages must be enabled first.

## Run locally

Open \`index.html\` in a modern browser. For 3D loading, serve the project over HTTP/HTTPS because Three.js and the FBX/TGA assets are loaded online.

With Python installed, run:

\`\`\`bat
py -m http.server 8000
\`\`\`

Then open http://localhost:8000.

## Build a Windows EXE

1. Install Node.js from https://nodejs.org/ and reopen the terminal.
2. Download or clone this repository.
3. Double-click \`build-exe.bat\`.
4. The script installs Electron build dependencies and builds the Windows installer.
5. Find the installer in \`release/\`.

The first build needs internet access for npm packages. Three.js and the remote 3D assets also require internet access when the app runs.

## Menu behaviour

- Main composition inspired by the Standoff 2 lobby: account/currency in the header, friends list on the left, animated team in the center, event/pass cards on the right, and mode selection plus a green Play button in the bottom-right corner.
- No modal dialogs: mode selection, team lobby, profile, and settings appear in the right-side panel while the main lobby remains visible.
- The local \`Excited.fbx\` character animation loops. Inviting a demo friend simulates acceptance; that player's animated FBX character appears alongside the local agent.
- The FBX loader also registers the repository's \`OTCChA_D.tga\` texture format. If WebGL or an animated model is unavailable, an animated fallback character remains visible.
- Responsive desktop/phone layout. On phones, the friends list becomes a horizontal strip above the character scene.
- Avatar upload/compression, themes, language choice, sensitivity, animation toggle, and low-performance setting are stored locally.
- Friend acceptance is simulated in the prototype. Real invitations and shared lobby state require an API/Socket.IO server.
- Demo data lives in \`DEMO_DATA\` in \`index.html\`.

## Models used

- \`Excited.fbx\` — local player's idle/selected animation
- \`Talking On Phone.fbx\` — demo friend animation
- \`Illegal Elbow Punch.fbx\` — another demo friend animation
- \`OTCChA_D.tga\` — character texture loaded through \`TGALoader\`
