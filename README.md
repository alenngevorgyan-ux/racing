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

## Двое (`duo/`): level checks

Levels 16–29 come with scripted runs: a bot plays each level with both characters, through the real `levels.js` and `game.js` in Node (no browser), and must reach both doors with every gem and the secret, without a single fall. Each level is played at 60, 30 and 144 fps and six more times with random key delays of up to 4 frames.

```
node duo/tests/run.js            # all scripted levels
node duo/tests/run.js sawmill    # one level
node duo/tests/render_smoke.js   # every level through the renderer, looking for errors
```

Medium: 16 Piggyback, 17 Thin Ice, 18 Ferry, 19 Mirror Hall, 20 Post Office, 21 Swap Meet, 22 Cable Car. Hard: 23 Shadow Ladder, 24 Sawmill, 25 Crawlspace, 26 Gravity Well, 27 Parcel, 28 Pistons, 29 Both of Us.
