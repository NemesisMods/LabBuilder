import { defaultLaser, newCharacter } from '@nemesismods/imperfectlab-core/package/imperfect'
import { describe, expect, it } from 'vitest'
import { engineVersion, findXboxImage, install } from '../src/recomp/install'
import { limits, unsupported } from '../src/recomp/target'
import { ascii, MemoryFolder, str } from './helpers'

describe('Xbox Recomp', () => {
  it('lists the main.dol features Turlin Engine does not have yet', () => {
    const c = newCharacter()
    expect(unsupported(c)).toEqual([])
    c.baseMoves = { air_throw: true, throw_return: true }
    c.gameplay = { energy_regen: 0 }
    expect(unsupported(c)).toEqual(['air baton throw', 'baton return'])
  })

  it('notes how supported features differ on Xbox Recomp', () => {
    const c = newCharacter()
    expect(limits(c)).toEqual([])
    c.zButton = { stealth: null, costume: null, stats: null, size: null, bullet: null, gun: null, laser: defaultLaser(), impersonate: null, requires: {} }
    expect(limits(c)).toEqual(['the laser beam stops at breakable props without breaking them'])
  })

  it('finds the Xbox image and the engine version', async () => {
    const port = new MemoryFolder()
    await expect(findXboxImage(port)).rejects.toThrow(/assets/)
    port.files.set('assets/game.xiso.iso', new Uint8Array(1))
    expect(await findXboxImage(port)).toBe('assets/game.xiso.iso')
    expect(await engineVersion(port)).toBe(0)
    port.files.set('logs/roster.log', ascii('roster extension v46\r\n'))
    expect(await engineVersion(port)).toBe(46)
    port.files.set('MarvelNemesis.dll', ascii('MZ....roster extension v47 ...'))
    expect(await engineVersion(port)).toBe(47)
  })

  it('installs a character, drops what its last build wrote and no longer needs, and keeps the order', async () => {
    const port = new MemoryFolder()
    port.files.set('mods/characters/order.txt', ascii('# order\r\nOther\r\n'))
    port.files.set('mods/characters/Other.character', ascii('NAME OTHER'))
    const first = new Map([['characters/Synth.character', ascii('a')], ['Bundles/Synth.nmb', ascii('b')], ['Bundles/Synth_old.nnb', ascii('c')], ['characters/Synth.files.txt', ascii('characters/Synth.character\r\nBundles/Synth.nmb\r\nBundles/Synth_old.nnb\r\n')]])
    await install(port, { files: first, notes: [] })
    expect(port.files.has('mods/Bundles/Synth_old.nnb')).toBe(true)
    const second = new Map([['characters/Synth.character', ascii('a2')], ['Bundles/Synth.nmb', ascii('b')], ['characters/Synth.files.txt', ascii('characters/Synth.character\r\nBundles/Synth.nmb\r\n')]])
    const notes = await install(port, { files: second, notes: [] })
    expect(port.files.has('mods/Bundles/Synth_old.nnb')).toBe(false)
    expect(port.files.has('mods/characters/Other.character')).toBe(true)
    expect(notes.join()).toMatch(/removed 1 file/)
    expect(str(port.files.get('mods/characters/order.txt')).split(/\r\n/).filter((l) => l && !l.startsWith('#'))).toEqual(['Other', 'Synth'])
  })
})