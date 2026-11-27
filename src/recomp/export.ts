import { type Batch, buildBatch, withVoices } from '@nemesismods/imperfectlab-core/build/batch'
import { Effects } from '@nemesismods/imperfectlab-core/build/effects'
import { impersonationData } from '@nemesismods/imperfectlab-core/build/impersonate'
import { colorInt, healthCharacters, type Progress, zCharacters } from '@nemesismods/imperfectlab-core/build/patch'
import * as ui from '@nemesismods/imperfectlab-core/build/ui'
import { LabError } from '@nemesismods/imperfectlab-core/errors'
import * as D from '@nemesismods/imperfectlab-core/game/dol'
import * as R from '@nemesismods/imperfectlab-core/game/roster'
import type { GameSource } from '@nemesismods/imperfectlab-core/game/source'
import { resizeLanczos } from '@nemesismods/imperfectlab-core/image/resample'
import type { RgbaImage } from '@nemesismods/imperfectlab-core/image/rgba'
import * as nottool from '@nemesismods/imperfectlab-core/mnroi/nottool'
import type { Model } from '@nemesismods/imperfectlab-core/model/glb'
import { renameBig } from '@nemesismods/imperfectlab-core/xbox/big'
import { type Converted, convertFiles, convertHud, convertSounds, gcFiles } from '@nemesismods/imperfectlab-core/xbox/convert'
import type { XboxDisc } from '@nemesismods/imperfectlab-core/xbox/disc'
import { sfxValues } from '@nemesismods/imperfectlab-core/xbox/movie'
import * as SX from '@nemesismods/imperfectlab-core/xbox/shpx'
import { ghostTexture } from '@nemesismods/imperfectlab-core/xbox/textures'
import { gcArchive, gcPictures, gcTilePictures, tilePictures } from '@nemesismods/imperfectlab-core/xbox/tiles'
import { readXpr, writeXpr } from '@nemesismods/imperfectlab-core/xbox/xpr'
import { ENGINE_NAME, ENGINE_VERSION, type RecompExport } from './install'
import { EFFECT_CACHE, RECOMP, unsupported } from './target'
import { tileFile, tileSize } from './tile'

const P = ui.P
const text = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join('')
const bytes = (t: string) => Uint8Array.from(t, (ch) => ch.charCodeAt(0) & 255)
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

// seconds: how long a full energy bar lasts (0 never drains); flags: as in dol.ts zTable; world speed -1 keeps the game's
const Z_LIFT: Record<string, number> = { light: 0, medium: 0x10, heavy: 0x20 }
function zButtonText(zs: ReturnType<typeof zCharacters>): string {
  const lines = ['# internal\tseconds\tflags\tvisible\tdamage1-5\ttaken\tlift\trun\tsprint\tsize\tworld speed']
  const n = (v: number | null) => (v === null ? '-1' : String(Math.round(v * 10000) / 10000))
  for (const c of zs) {
    const stats = c.damage.some((v) => v !== null) || c.taken !== null || c.lift !== null || c.run !== null || c.sprint !== null
    const speeds = c.run !== null || c.sprint !== null
    const flags = (c.regen ? 1 : 0) | (c.undetected ? 2 : 0) | (c.untouchable ? 4 : 0) | (c.costume ? 8 : 0) | (stats ? 16 : 0) | (c.size !== null ? 32 : 0)
      | (c.slow !== null ? 64 : 0) | (c.gun ? 128 : 0) | (speeds ? 256 : 0) | (c.laser ? D.LASER_FLAG : 0) | (c.impersonate?.moves ? D.IMP_MOVES : 0)
    lines.push([c.internal, n(c.seconds), String(flags), n(c.visible), ...c.damage.map(n), n(c.taken), c.lift === null ? '-1' : String(Z_LIFT[c.lift]), n(c.run), n(c.sprint), n(c.size), n(c.slow)].join('\t'))
  }
  return lines.join('\r\n') + '\r\n'
}

// The port's lit shaders ignore model alpha, so the fade is baked into a texture copy on a `shader alpha` material.
function ghostMaterials(nsa: string, prefix: string, have: (texture: string) => boolean): [string, [string, string][]] {
  const done: [string, string][] = []
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const out = nsa.replace(new RegExp(`^(${esc}(?!o)[^\\s{]*)([ \\t]*\\r?\\n\\{[ \\t]*\\r?\\n)([\\s\\S]*?)(^\\})`, 'gmi'), (all, name: string, open: string, body: string, close: string) => {
    const tex = /^\s*texture\s+(\S+)/mi.exec(body)?.[1]
    if (!tex || !have(tex)) return all
    done.push([name, tex])
    return `${name}${open}\tshader alpha\r\n\ttexture ${name}g\r\n${close}`
  })
  return [out, done]
}

function exportTogether(source: GameSource, xbox: XboxDisc, chars: Batch, progress: Progress, models: (Model | undefined)[]): RecompExport {
  const r = buildBatch(source, chars, progress, models, RECOMP)
  if (r.cache !== null && r.cache > EFFECT_CACHE) throw new LabError(`these characters need a ${r.cache.toLocaleString('en-US')}-byte effect cache, more than Turlin Engine gives (${EFFECT_CACHE.toLocaleString('en-US')}): use fewer aura tints`)
  const [batch] = withVoices(chars)
  const out: Converted = { files: new Map(), done: new Set(), notes: [...r.notes] }
  if (r.cache !== null) out.notes.push(`effect cache: ${r.cache.toLocaleString('en-US')} bytes needed, within Turlin Engine's ${EFFECT_CACHE.toLocaleString('en-US')}`)
  for (const c of batch) {
    const missing = unsupported(c)
    if (missing.length) out.notes.push(`${c.displayName}: not on Xbox Recomp yet, left out: ${missing.join(', ')}`)
  }
  const files = out.files
  const gc = gcFiles(r)
  const take = (k: string) => { out.done.add(k.toLowerCase()); return gc.get(k.toLowerCase())?.[1] }

  progress('Models and animations', 0, 0)
  convertFiles(source, xbox, gc, out)

  const ghosts = new Map<string, number>()
  const nsaPath = [...files.keys()].find((k) => /shaders\.nsa$/i.test(k))
  for (const c of batch) {
    const vis = c.zButton?.stealth?.visible
    if (vis == null || vis >= 1 || vis <= 0 || !nsaPath) continue
    let n = 0
    for (const alt of [false, true]) {
      const xp = [...files.keys()].find((k) => k.toLowerCase() === `bundles/${c.internalName}${alt ? '_alt' : ''}.xpr`.toLowerCase())
      if (!xp) continue
      const texs = readXpr(files.get(xp)!)
      const find = (t: string) => texs.find((x) => x.name.toLowerCase() === t.toLowerCase())
      const [nsa, done] = ghostMaterials(text(files.get(nsaPath)!), c.internalName + (alt ? '_altz' : '_z'), (t) => !!find(t) && ghostTexture(find(t)!, '', 0) !== null)
      if (!done.length) continue
      for (const [name, tex] of done) texs.push(ghostTexture(find(tex)!, name + 'g', Math.round(vis * 255))!)
      files.set(xp, writeXpr(texs))
      files.set(nsaPath, bytes(nsa))
      n += done.length
    }
    ghosts.set(c.internalName, n)
  }

  // Turlin Engine fills in the select screens from each character's .character, tile and portraits
  progress('Select screen', 0, 0)
  const xThumbs = xbox.entry(P + 'screens/clashCharSelect_thumbs.big')
  const gcThumbs = take(P + 'screens/clashCharSelect_thumbs.big')
  take(P + 'screens/clashCharSelect.big'); take(P + 'main.big'); take(P + 'mainBE.big')
  const sfx = sfxValues(xbox.entry(P + 'main.big'))
  const [tileW, tileH] = tileSize(xThumbs)
  const C = (c: { internalName: string }, tail: string) => `characters/${c.internalName}${tail}`
  batch.forEach((c, i) => {
    const id = ui.NEW_ID + i, baseSel = R.BASES[c.base][1]
    const info = [`# ${c.displayName}`, `COLOR ${colorInt(c.nameColor)}`]
    if (c.ui.ready_voice) {
      if (!sfx.has(c.ui.ready_voice)) throw new LabError(`the Xbox select screen has no voice ${c.ui.ready_voice}`)
      info.push(`VOICE ${sfx.get(c.ui.ready_voice)!}`)
    }
    files.set(C(c, '.character'), bytes(info.join('\r\n') + '\r\n'))
    const pics = (gcThumbs ? gcTilePictures(gcThumbs, id, baseSel) : null) ?? tilePictures(xThumbs, baseSel)
    const fit = pics.map((im) => (im.width === tileW && im.height === tileH ? im : resizeLanczos(im, tileW, tileH))) as [RgbaImage, RgbaImage]
    files.set(C(c, '_tile.ctile'), tileFile(xThumbs, fit))
  })

  progress('Portraits and HUD', 0, 0)
  const gcSrcC4 = gcArchive(source.entry(P + 'portraits/c4_p0.big')).get('apt')!
  batch.forEach((c, i) => {
    const id = ui.NEW_ID + i, baseSel = R.BASES[c.base][1]
    const gcC = take(P + `portraits/c${id}_p0.big`)
    if (gcC && same(gcArchive(gcC).get('apt')!, gcSrcC4)) {
      files.set(C(c, '_p0.big'), renameBig(xbox.entry(P + 'portraits/c4_p0.big'), 'c4_p0', `c${id}_p0`, gcPictures(gcArchive(gcC).get('gsh')!)))
      for (const alt of ['', '_alt']) {
        const g = take(P + `portraits/cvs${id}${alt}.big`)
        if (!g) throw new LabError(`${c.displayName}: no loading portrait${alt ? ' for the alternate costume' : ''}`)
        files.set(C(c, `_vs${alt}.big`), renameBig(xbox.entry(P + `portraits/cvs4${alt}.big`), `cvs4${alt}`, `cvs${id}${alt}`, gcPictures(gcArchive(g).get('gsh')!)))
      }
    } else {
      for (const [kind, alt] of [['c', ''], ['cvs', ''], ['cvs', '_alt']] as const) {
        const from = kind === 'c' ? `c${baseSel}_p0` : `cvs${baseSel}${alt}`, to = kind === 'c' ? `c${id}_p0` : `cvs${id}${alt}`
        take(P + `portraits/${to}.big`)
        if (xbox.has(P + `portraits/${from}.big`)) files.set(C(c, kind === 'c' ? '_p0.big' : `_vs${alt}.big`), renameBig(xbox.entry(P + `portraits/${from}.big`), from, to))
      }
    }
    // portraits only the Xbox has (other screens): the base character's
    for (const [from, to, tail] of [[`c${baseSel}_p1`, `c${id}_p1`, '_p1.big'], [`ccs${baseSel}`, `ccs${id}`, '_ccs.big'], [`csm${baseSel}`, `csm${id}`, '_csm.big']])
      if (xbox.has(P + `portraits/${from}.big`)) files.set(C(c, tail), renameBig(xbox.entry(P + `portraits/${from}.big`), from, to))
  })
  convertHud(source, xbox, gc, out)

  progress('Sound banks', 0, 0)
  convertSounds(xbox, batch, out)

  progress('Roster', 0, 0)
  const lines = ['# internal\tdisplay\tstats\talt stats']
  for (const c of batch) {
    if (/[\t\r\n]/.test(c.displayName + c.internalName)) throw new LabError(`${c.displayName}: names cannot hold tabs or line breaks`)
    lines.push([c.internalName, c.displayName, c.stats.normal.join(','), c.stats.alt.join(',')].join('\t'))
  }
  files.set('characters/roster.txt', bytes(lines.join('\r\n') + '\r\n'))
  if (chars.some((c) => c.zButton?.impersonate?.moves)) files.set('characters/impersonate.bin', D.impersonationTableXbox(source.dol, impersonationData()))
  const hs = healthCharacters(batch, RECOMP)
  if (hs.length) files.set('characters/health.bin', D.healthTableLE(hs))
  const zs = zCharacters(batch)
  if (zs.length) {
    files.set('characters/zbutton.txt', bytes(zButtonText(zs)))
    if (r.guns.length) files.set('characters/gun.bin', D.gunTableLE(r.guns))
    if (r.lasers.length) files.set('characters/laser.bin', D.laserTableLE(r.lasers))
    for (const c of batch) {
      const vis = c.zButton?.stealth?.visible
      if (vis == null || vis >= 1 || vis <= 0) continue
      const n = ghosts.get(c.internalName)
      out.notes.push(`${c.displayName}: Z is the right bumper; ${n ? `the fade is drawn with ${n} see-through material${n > 1 ? 's' : ''}` : 'no see-through materials could be made, so the fade is full invisibility'}`)
    }
  }
  for (const [k, [path]] of gc) if (!out.done.has(k)) out.notes.push(`${path}: not converted (no Xbox equivalent yet)`)
  return { files, notes: out.notes }
}

function suffix(stock: Uint8Array, now: Uint8Array, what: string): string {
  const a = text(stock), b = text(now)
  if (!b.startsWith(a)) throw new LabError(`${what}: the character's part is not simply added at the end, so it cannot be taken out on its own`)
  return b.slice(a.length)
}

// cuts each shared game file down to what the character adds, which the engine appends to the game's own
function pieces(source: GameSource, xbox: XboxDisc, c: Batch[number], ex: RecompExport): RecompExport {
  const out = new Map<string, Uint8Array>(), notes = [...ex.notes]
  const I = c.internalName, C = (tail: string) => `characters/${I}${tail}`
  const info: string[] = []
  const take = (path: string) => {
    const k = [...ex.files.keys()].find((p) => p.toLowerCase() === path.toLowerCase())
    if (!k) return null
    const d = ex.files.get(k)!
    ex.files.delete(k)
    return d
  }
  const line = (d: Uint8Array | null) => (d ? text(d).split(/\r?\n/).filter((l) => l && !l.startsWith('#')) : [])
  const [rl] = line(take('characters/roster.txt'))
  if (!rl) throw new LabError(`${c.displayName}: no roster line`)
  const [, display, stats, alt] = rl.split('\t')
  info.push(`NAME ${display}`, `STATS ${stats}`, `ALTSTATS ${alt}`)
  for (const l of line(take('characters/zbutton.txt'))) info.push(`Z ${l.split('\t').slice(1).join(' ')}`)
  info.push(...line(take(C('.character'))))
  const not = take('Misc/Global.not')
  if (not) {
    const stock = nottool.parse(source.entry('Misc/Global.not')), now = nottool.parse(not)
    const have = new Set(stock.map((t) => t.name.toLowerCase()))
    if (now.length < stock.length || stock.some((t, i) => now[i].name !== t.name)) throw new LabError("Global.not: the game's own templates were moved")
    const added = now.slice(stock.length)
    if (added.some((t) => have.has(t.name.toLowerCase()))) throw new LabError("Global.not: a new template has the name of one of the game's")
    if (added.length) out.set(C('.not'), nottool.build(added))
  }
  const nfx = take('Misc/game.nfx')
  if (nfx) {
    const stock = source.entry('Misc/game.nfx'), add = suffix(stock, nfx, 'game.nfx')
    if (add.trim()) {
      out.set(C('.nfx'), bytes(add))
      const base = new Effects(stock).used()
      info.push(`EFFECTS ${new Effects(nfx).used() - base} ${base}`)
    }
  }
  const list = take('Misc/nvblist.txt')
  if (list) for (const l of suffix(source.entry('Misc/nvblist.txt'), list, 'nvblist.txt').split(/\r?\n/)) if (l.trim()) info.push(`LIST ${l.trim()}`)
  const nsa = take('Materials/Shaders/shaders.nsa')
  if (nsa) {
    const add = suffix(source.entry('Materials/Shaders/shaders.nsa'), nsa, 'shaders.nsa')
    if (add.trim()) out.set(C('.nsa'), bytes(add))
  }
  // every language's HUD bank gets the same added pictures
  let hud: Uint8Array | null = null
  for (const p of [...ex.files.keys()].filter((k) => /^hud\/[^/]+\.xsh$/i.test(k))) {
    const now = SX.readBank(take(p)!), stock = SX.readBank(xbox.entry(p))
    const names = now.names.filter((n) => !stock.recs.has(n))
    if (stock.names.some((n) => !same(stock.recs.get(n)!, now.recs.get(n)!))) throw new LabError(`${p}: one of the game's own HUD pictures was changed`)
    const piece = SX.buildBank({ magic: now.magic, names, recs: new Map(names.map((n) => [n, now.recs.get(n)!])), tag: new Uint8Array(0), padEnd: false })
    if (hud && !same(hud, piece)) throw new LabError(`${p}: this language's HUD pictures differ from the others'`)
    hud = piece
  }
  if (hud) out.set(C('_hud.xsh'), hud)
  for (const [file, ext] of [['gun.bin', '.gun'], ['laser.bin', '.laser'], ['health.bin', '.health']]) {
    const d = take(`characters/${file}`)
    if (d) out.set(C(ext), d)
  }
  for (const [p, d] of ex.files) out.set(p, d)
  out.set(C('.character'), bytes([`# ${c.displayName} (${I}): read by Turlin Engine when the game starts`, ...info].join('\r\n') + '\r\n'))
  const mine = [...out.keys()].filter((p) => p.toLowerCase() !== 'characters/impersonate.bin')
  out.set(C('.files.txt'), bytes(['# files Lab Builder wrote into mods for this character', ...mine, C('.files.txt')].join('\r\n') + '\r\n'))
  return { files: out, notes }
}

export function exportRecomp(source: GameSource, xbox: XboxDisc, chars: Batch, progress: Progress = () => {}, models: (Model | undefined)[] = []): RecompExport {
  if (chars.length > RECOMP.maxCharacters) throw new LabError(`Xbox Recomp takes up to ${RECOMP.maxCharacters} new characters, not ${chars.length}`)
  const files = new Map<string, Uint8Array>(), notes: string[] = []
  const low = new Set<string>()
  chars.forEach((c, i) => {
    if (low.has(c.internalName.toLowerCase())) throw new LabError(`two characters have the internal name ${c.internalName}: one of them needs another`)
    low.add(c.internalName.toLowerCase())
    const each: Progress = (stage, done, total) => progress(chars.length > 1 ? `${c.displayName}: ${stage}` : stage, done, total)
    const one = pieces(source, xbox, c, exportTogether(source, xbox, [c], each, [models[i]]))
    for (const [p, d] of one.files) files.set(p, d)
    for (const n of one.notes) if (!notes.includes(n)) notes.push(n)
  })
  notes.push(`each character is self-contained in mods/characters; ${ENGINE_NAME} or newer (roster extension v${ENGINE_VERSION}) joins them when the game starts`)
  return { files, notes }
}