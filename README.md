# Chai & Cassette

A 3D, fully playable two-in-one cassette deck in a 1980s Indian living room at night.
Procedural scene (no model/texture/audio assets), real tape physics, a Web Audio "worn tape" effects chain.

**Status: Phases 1 + 2.** Phases 3–8 (radio, free libraries, tape abuse, recording/mixtapes, Spotify, power cuts…) are architected but not built — see below.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm test           # state-machine tests
```

> The npm scripts call `node node_modules/...` directly because a `&` in the folder name breaks the `.cmd` shims on Windows.

## Use it

| Do this | To get this |
|---|---|
| Drag an MP3/WAV onto the page (or **choose a file** in `?`) | A labelled tape is generated and put in your hand; saved to IndexedDB |
| Click a cassette, drag it to the door | Door springs open, tape drops in, door latches |
| `1`–`9`, `L`, or the tape chips | Load a tape without dragging (ejects the current one first) |
| `Space` / `P`, `S`, `E`, hold `←` `→`, `R` | Play-pause, stop, stop→eject, rewind/FF (held while playing = review/cue), record (needs PLAY) |
| `F` / double-click / wheel while holding a tape | Flip / spin it; `Esc` puts it back |
| Drag a knob up/down | Volume, bass, treble, balance, pitch (±12 %, centre detent) |
| Click toggles / slider | Dolby, auto-reverse, low battery, tape type I / II / IV |
| Click the deck, rack or chai | Camera glides to a clean front-on **focus view** (controls only respond once you're in it) |
| View bar (top) or `V` | Jump between Room · Deck · Tape · Controls · Radio · Meters · Shelf · Chai |
| Double-click a part | Frame that sub-part directly (e.g. only the meters) |
| Click empty space, `Esc`, or **Room** | Back to the free-look room |

## Architecture

```
src/
  state/       machine.ts (pure transition table + tests) · store.ts (zustand) · live.ts (per-frame values, no re-renders)
  controller/  deck.ts — glue: state machine → keys, door, sfx, audio, tape bookkeeping; per-frame tick()
  audio/       AudioEngine.ts (one AudioContext, motor model, position clock, analysers) · effects.ts (chain)
  sources/     TapeSource interface · LocalFileSource · stubs for Radio/Archive/Jamendo/Spotify/Mic
  sfx/         sfx.ts — every mechanical sound is synthesised (clacks, door spring, clunk, detents…)
  deck/        DeckBody, CassetteDoor, PianoKeys, TapeWindow, Reels, VUMeters, TapeCounter, Knobs, Switches, RadioSection, Speakers
  tapes/       Cassette, TapeShelf, generator, label/J-card textures, demo tape synth, IndexedDB persistence
  scene/       Room, Table, Chai, Fan, Window, Lamp, Lighting (+tod presets), Camera, PostFX, textures
  ui/          HUD, LoadingScreen, keyboard map
public/worklets/tape-processor.js   AudioWorklet: dropouts, stereo drift, hiss
```

### Audio chain

`source → pitch/speed (motor model) → wow & flutter (modulated delay) → saturation → HF rolloff → [worklet: dropouts · stereo drift · hiss] → tape-type EQ → Dolby shelf → bass/treble → balance → volume → limiter → analysers`

Wear, tape type, Dolby, pitch and the low-battery switch all feed this chain. Sources with `supportsEffects = false` (Spotify/DRM) skip the tape stage and the HUD says **FX BYPASSED**.

### Tape physics

Pack radii come from real cassette formats (C30–C120: tape thickness, 4.76 cm/s, hub radius); the right reel grows and the left shrinks with ribbon position. Reels, capstan, pinch roller and the 3-wheel counter all turn at speeds derived from the current radii.

## Third-party assets (CC0)

Photo-scanned textures, models and the lighting HDRI come from [Poly Haven](https://polyhaven.com) (CC0 1.0 — no attribution required, credited here anyway). They live in `public/assets/`; `public/assets/ASSETS.json` lists every file with its source URL.

| Kind | Assets |
|---|---|
| HDRI (reflections / ambient light) | `warm_restaurant_night` (1K) |
| PBR textures (1K) | `wood_table_001` · `dark_wood` · `old_wooden_floor_02` · `painted_plaster_wall` · `rough_linen` |
| Models (1K) | `potted_plant_01`, `potted_plant_02`, `calathea_orbifolia_01`, `WoodenChair_01`, `ArmChair_01`, `wicker_basket_01`, `brass_diya_lantern`, `vintage_radio_transceiver`, `Ukulele_01`, `mantel_clock_01` |

The deck, cassettes, doilies, rug, book spines and rain are still procedural. `src/scene/assets.tsx` has the `usePbr()` and `<Model>` helpers for adding more.

### Quality tiers

Top-bar button cycles **Low → High → Ultra**. Low: bloom + grain. High: adds SMAA and full textures. Ultra: adds depth of field, 4× MSAA and **N8AO ambient occlusion** (needs a strong GPU). Phones start on Low.

## Notes

- Quality: auto-selects **low** on touch/narrow screens (no DoF, basic shadows, fewer particles, dpr 1). Toggle in the top bar.
- `prefers-reduced-motion` disables camera sway and shortens camera moves.
- REC latches with PLAY and lights the REC lamp, but microphone recording is Phase 7 — the tape just plays.
- The radio dial, band switch, tuning knob and antenna move but are silent until Phase 4.
- Console shows one `THREE.Clock deprecated` warning; it comes from inside `@react-three/fiber`.
