# Kart Duo

A retro PS1-style kart racer for two players online, in the browser. No server and no install: the two browsers connect directly (WebRTC via PeerJS).

## How to play

1. Open the game, enter a name, pick a racer and press **Create room**.
2. Copy the link and send it to your partner. They open it and press **JOIN!**
3. In the room each player picks a racer; track, mode (EASY / HARD) and laps are chosen together. Both press **READY!** and the race starts.
4. After the race **BACK TO ROOM** returns you both to the same room.

Controls: arrows / WASD to steer, gas and brake. **SPACE** drifts (hold while turning, release for a turbo: blue sparks = TURBO, orange = SUPER TURBO). **SHIFT** fires nitro (blue cans on the track). 1–4 send emojis. Phones get on-screen buttons.

## Tracks

Red Canyon, Sunny Coast, Sunset Forest, Night Pass, Neon City, Volcano Rush, Jungle Ruins, Sky Road. Tunnels, bridges over water, lava fields, ice, rainbow arches, ramps, boost pads, oil and mud, rolling obstacles. **HARD** adds more obstacles, faster movers and narrow road sections.

## Characters

Fox, Bunny, Bulldog, Raccoon: sprites in `assets/chars` (source sheet in `assets/src`).

## Run locally

```
python3 -m http.server 8000
```
Then open http://localhost:8000

## Code

- `js/chars.js`: character frames, size normalisation, frame choice by steering angle
- `js/sprites.js`: procedural scenery and obstacles
- `js/tracks.js`: the 8 tracks (layout, zones, obstacles, EASY/HARD, textures, backdrops, minimap)
- `js/game.js`: 2.5D renderer, physics (steering, drift, jumps), HUD, lobby, sync
- `js/net.js`: the two-player connection
