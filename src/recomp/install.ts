import { LabError } from '@nemesismods/imperfectlab-core/errors'

// abstract so tests can run without File System Access handles
export interface PortFolder {
  read(path: string): Promise<Uint8Array | null>
  write(path: string, data: Uint8Array): Promise<void>
  remove(path: string): Promise<void>
  list(dir: string): Promise<string[]>
}

export interface RecompExport { files: Map<string, Uint8Array>; notes: string[] }

export const ENGINE_VERSION = 47
export const ENGINE_NAME = 'Turlin Engine V1.5'
export const ENGINE_RELEASES = 'https://github.com/NemesisMods/TurlinEngine/releases'
// written by ImperfectLab exports before 1.82
const OLD_LIST = 'mods/characters/imperfectlab-files.txt'
const MARK = 'roster extension v'

export async function findXboxImage(port: PortFolder): Promise<string> {
  const isos = (await port.list('assets')).filter((n) => /\.(iso|xiso)$/i.test(n))
  if (!isos.length) throw new LabError("no .iso in the port's assets folder: this does not look like the Xbox Recomp folder")
  return `assets/${isos[0]}`
}

export function extensionVersion(dll: Uint8Array): number {
  const mark = Array.from(MARK, (c) => c.charCodeAt(0))
  outer: for (let i = 0; i + mark.length + 2 <= dll.length; i++) {
    for (let k = 0; k < mark.length; k++) if (dll[i + k] !== mark[k]) continue outer
    let v = 0, j = i + mark.length
    while (dll[j] >= 0x30 && dll[j] <= 0x39) v = v * 10 + dll[j++] - 0x30
    return v
  }
  return 0
}

export async function engineVersion(port: PortFolder): Promise<number> {
  try {
    const dll = await port.read('MarvelNemesis.dll')
    const v = dll ? extensionVersion(dll) : 0
    if (v) return v
  } catch {
    // browsers may refuse to read a .dll: fall through to the log
  }
  const log = await port.read('logs/roster.log').catch(() => null)
  const m = log && /roster extension v(\d+)/.exec(String.fromCharCode(...log.subarray(0, 4096)))
  return m ? Number(m[1]) : 0
}

const lines = (d: Uint8Array | null) => (d ? String.fromCharCode(...d).split(/\r?\n/).filter((l) => l && !l.startsWith('#')) : [])
const ascii = (t: string) => Uint8Array.from(t, (c) => c.charCodeAt(0) & 255)

// re-exporting a character removes only files it wrote before and no longer needs
export async function install(port: PortFolder, ex: RecompExport, progress: (stage: string, done: number, total: number) => void = () => {}): Promise<string[]> {
  const notes: string[] = []
  const now = new Set([...ex.files.keys()].map((p) => p.toLowerCase()))
  const mine = [...ex.files.keys()].filter((p) => /^characters\/[^/]+\.files\.txt$/i.test(p))
  const stale: string[] = []
  for (const list of mine) for (const p of lines(await port.read(`mods/${list}`).catch(() => null))) if (!now.has(p.toLowerCase())) stale.push(p)
  const legacy = lines(await port.read(OLD_LIST).catch(() => null))
  for (const p of legacy) if (!now.has(p.toLowerCase())) stale.push(p)
  let i = 0
  for (const [path, data] of ex.files) {
    progress('Writing to the port', i++, ex.files.size)
    await port.write(`mods/${path}`, data)
  }
  let removed = 0
  for (const p of new Set(stale)) {
    try {
      await port.remove(`mods/${p}`)
      removed++
    } catch {
      // gone already
    }
  }
  if (legacy.length) {
    await port.remove(OLD_LIST).catch(() => {})
    notes.push('removed the files an ImperfectLab export older than 1.82 wrote: characters from it need building again')
  } else if (removed) notes.push(`removed ${removed} file${removed > 1 ? 's' : ''} an earlier build of these characters wrote that this one does not need`)
  const names = mine.map((p) => p.slice('characters/'.length, -'.files.txt'.length))
  const order = lines(await port.read('mods/characters/order.txt').catch(() => null))
  const have = new Set(order.map((n) => n.toLowerCase()))
  const add = names.filter((n) => !have.has(n.toLowerCase()))
  if (add.length) await port.write('mods/characters/order.txt', ascii(['# the added characters in select-screen order (new ones go at the end)', ...order, ...add].join('\r\n') + '\r\n'))
  return notes
}