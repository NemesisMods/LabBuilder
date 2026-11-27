import { readFileSync } from 'node:fs'
import { ImageDisc } from '@nemesismods/imperfectlab-core/game/disc'
import { GameSource } from '@nemesismods/imperfectlab-core/game/source'
import { load } from '@nemesismods/imperfectlab-core/package/imperfect'
import { XboxDisc } from '@nemesismods/imperfectlab-core/xbox/disc'
import { describe, expect, it } from 'vitest'
import { exportRecomp } from '../src/recomp/export'
import { CHARACTER, fileReader, ISO, str, XBOX } from './helpers'

describe.skipIf(!ISO || !XBOX || !CHARACTER)('Xbox Recomp export', () => {
  it('writes a self-contained character that lists every file it wrote', () => {
    const c = load(readFileSync(CHARACTER!))
    const ex = exportRecomp(new GameSource(new ImageDisc(fileReader(ISO!), ISO!)), new XboxDisc(fileReader(XBOX!)), [c])
    const I = c.internalName
    const info = str(ex.files.get(`characters/${I}.character`))
    expect(info).toMatch(new RegExp(`^NAME ${c.displayName}$`, 'm'))
    expect(info).toMatch(/^STATS /m)
    const listed = str(ex.files.get(`characters/${I}.files.txt`)).split(/\r\n/).filter((l) => l && !l.startsWith('#'))
    expect(new Set(listed)).toEqual(new Set([...ex.files.keys()].filter((p) => p !== 'characters/impersonate.bin')))
    expect([...ex.files.keys()].some((p) => /^Bundles\/.+\.nmb$/i.test(p))).toBe(true)
    expect([...ex.files.keys()].some((p) => /^Bundles\/.+\.xpr$/i.test(p))).toBe(true)
    expect([...ex.files.keys()].some((p) => /^Misc\/(Global\.not|game\.nfx)$/i.test(p))).toBe(false)
  })
})