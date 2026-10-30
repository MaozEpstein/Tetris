# Tetris

Classic Tetris built for phones (Samsung/Android first), works on desktop too.
Pure HTML/CSS/JS, no build step. Installable as a PWA and playable offline.

**Play:** https://maozepstein.github.io/Tetris/

## Modes

- **Classic** – endless. Speed keeps rising with lines *and* time. Five difficulties set how fast it ramps up:
  Easy · Normal · Hard · Expert · Insane (each has its own leaderboard).
- **Sprint** – clear 40 lines as fast as you can.
- **Zen** – no game over (a full board is wiped), calm pace. Pause → Finish to log your session.

## Controls

| | Phone | Keyboard |
|---|---|---|
| Move | swipe left / right | ← → |
| Rotate | tap | ↑ / X (Z = counter-clockwise) |
| Soft drop | drag down | ↓ |
| Slam | quick flick down, or long-press | Space |
| Hold | swipe up, or tap HOLD box | C / Shift |
| Pause | ❚❚ button | P / Esc |

## Features

SRS rotation + wall kicks, 7-bag randomizer, ghost piece, hold, 3-piece preview, lock delay,
combo / back-to-back / perfect-clear scoring, animated slam and line-clear effects, 5 themes,
records per mode and difficulty, haptics, offline support.

## Run locally

Open `index.html`, or serve the folder (needed for the service worker):
`python -m http.server 8000`
