import { extensionVersion } from './install'

export interface PortCheck {
  exe: boolean
  iso: string | null
  engine: number
  characters: string[]
  stages: number
}

type Entries = { entries(): AsyncIterable<[string, FileSystemHandle]> }
const entries = (d: FileSystemDirectoryHandle) => (d as unknown as Entries).entries()

async function child(dir: FileSystemDirectoryHandle, name: string): Promise<FileSystemHandle | null> {
  for await (const [n, h] of entries(dir)) if (n.toLowerCase() === name.toLowerCase()) return h
  return null
}

async function at(root: FileSystemDirectoryHandle, path: string): Promise<FileSystemHandle | null> {
  let h: FileSystemHandle | null = root
  for (const part of path.split('/')) h = h?.kind === 'directory' ? await child(h as FileSystemDirectoryHandle, part) : null
  return h
}

async function text(root: FileSystemDirectoryHandle, path: string): Promise<File | null> {
  const h = await at(root, path)
  return h?.kind === 'file' ? (h as FileSystemFileHandle).getFile() : null
}

async function files(root: FileSystemDirectoryHandle, path: string): Promise<[string, FileSystemFileHandle][]> {
  const d = await at(root, path)
  if (d?.kind !== 'directory') return []
  const out: [string, FileSystemFileHandle][] = []
  for await (const [n, h] of entries(d as FileSystemDirectoryHandle)) if (h.kind === 'file') out.push([n, h as FileSystemFileHandle])
  return out
}

export async function check(root: FileSystemDirectoryHandle): Promise<PortCheck> {
  const exe = (await text(root, 'MarvelNemesis.exe')) !== null
  const iso = (await files(root, 'assets')).map(([n]) => n).find((n) => /\.(iso|xiso)$/i.test(n)) ?? null
  let engine = 0
  try {
    const dll = await text(root, 'MarvelNemesis.dll')
    if (dll) engine = extensionVersion(new Uint8Array(await dll.arrayBuffer()))
  } catch {
    // browsers may refuse to read a .dll: the log has it too
  }
  if (!engine) {
    const log = await text(root, 'logs/roster.log').catch(() => null)
    const m = log && /roster extension v(\d+)/.exec((await log.text()).slice(0, 4096))
    if (m) engine = Number(m[1])
  }
  const characters: string[] = []
  for (const [n, h] of await files(root, 'mods/characters')) {
    if (!/\.character$/i.test(n)) continue
    const m = /^NAME[ \t]+(.+)$/mi.exec(await (await h.getFile()).text())
    characters.push(m ? m[1].trim() : n.replace(/\.character$/i, ''))
  }
  const stages = (await files(root, 'mods/Stages')).filter(([n]) => /\.stage$/i.test(n)).length
  return { exe, iso, engine, characters: characters.sort((a, b) => a.localeCompare(b)), stages }
}