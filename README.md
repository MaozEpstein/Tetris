# Tetris

Classic Tetris built for phones (Samsung/Android first), works on desktop too.
Pure HTML/CSS/JS, no build step. Installable as a PWA and playable offline.

## Controls

| | Phone | Keyboard |
|---|---|---|
| Move | swipe left / right | ← → |
| Rotate | tap | ↑ / X (Z = counter-clockwise) |
| Soft drop | drag down | ↓ |
| Hard drop | quick flick down | Space |
| Hold | swipe up, or tap HOLD box | C / Shift |
| Pause | ❚❚ button | P / Esc |

## Features

SRS rotation + wall kicks, 7-bag randomizer, ghost piece, hold, 3-piece next preview,
lock delay, levels/speed curve, standard scoring, best score saved locally, haptic feedback.

## Run locally

Open `index.html`, or serve the folder (needed for the service worker):
`python -m http.server 8000`

## Publish on GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo → Settings → Pages → Source: `main` branch, `/ (root)`.
3. Open `https://<user>.github.io/<repo>/` on the phone in Chrome / Samsung Internet.
4. Menu → "Add to Home screen" / "Install app" for a full-screen app icon.
