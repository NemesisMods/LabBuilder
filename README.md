# Lab Builder

Adds [ImperfectLab](https://nemesismods.com/#lab) characters into Marvel Nemesis ports.<br />
Runs at [nemesismods.com/builder](https://nemesismods.com/#builder) and requires Chrome or Edge.

Original code by sXe_Wolverine on Discord. Provided to EsotericEngineer to publish.

## Targets

**Xbox Recomp (15Cyber)**: [15Cyber's Windows port](https://github.com/15Cyber/marvel-nemesis-recomp) of the Xbox version. It needs [Turlin Engine](https://github.com/NemesisMods/TurlinEngine) v47 (V1.5) or newer installed in the port.

How it works:

1. Each character is built with ImperfectLab's pipeline from the player's GameCube disc, without `main.dol` (`RECOMP` in `src/recomp/target.ts`).
2. The build is converted to the Xbox formats.
3. It's cut into self-contained pieces in `mods/characters`, which Turlin Engine joins into the game at every start.
4. Features Turlin Engine does not have yet are listed per character and left out (`unsupported` in `src/recomp/target.ts`). Supported features that work differently there are noted too (`limits`).

Keep this app's built-in steps dropdown in line with TurlinEngine's `release/README.txt`, if anything changes there.

Only the GameCube disc and the port's own Xbox image are read. Nothing is uploaded.

## Shared Components

- **Character list:** ImperfectLab's Multi-Character Patch list, through [`@nemesismods/workspace`](https://github.com/NemesisMods/NemesisModsCore). "Add ImperfectLab's list" copies it into Lab Builder's own list (up to 27).
- **Disc:** the GameCube disc linked in either tool.
- **Arenas:** Arena Lab's list. Installing arenas waits on the `.imperfectarena` to `.stage` conversion.

## Develop

```sh
npm install
npm run dev
npm run lint && npm test && npm run build
```

Disc tests run with:

- `IMPERFECTLAB_ISO=<GameCube disc>`
- `IMPERFECTLAB_XBOX=<the port's assets/*.iso>`
- `LABBUILDER_CHARACTER=<a .imperfect file>`