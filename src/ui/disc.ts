import { permission } from '@nemesismods/workspace'
import type { Disc } from '../worker/protocol'

// must match the shape ImperfectLab stores, as both tools share the disc
export interface RememberedDisc {
  kind: 'file' | 'folder'
  name: string
  handle: FileSystemHandle
}

type Entries = { entries(): AsyncIterable<[string, FileSystemHandle]> }

async function walk(dir: FileSystemDirectoryHandle, at: string, out: [string, File][]) {
  for await (const [name, h] of (dir as unknown as Entries).entries()) {
    if (h.kind === 'file') out.push([at + name, await (h as FileSystemFileHandle).getFile()])
    else await walk(h as FileSystemDirectoryHandle, `${at}${name}/`, out)
  }
}

export async function readDisc(d: RememberedDisc): Promise<Disc> {
  if ((await permission(d.handle, 'read', true)) !== 'granted') throw new Error(`no permission to read ${d.name}`)
  if (d.kind === 'file') return { kind: 'file', file: await (d.handle as FileSystemFileHandle).getFile() }
  const files: [string, File][] = []
  await walk(d.handle as FileSystemDirectoryHandle, '', files)
  return { kind: 'folder', name: d.name, files }
}

type Pickers = {
  showOpenFilePicker?: (o: object) => Promise<FileSystemFileHandle[]>
  showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle>
}
const pickers = window as unknown as Pickers

export const canPick = Boolean(pickers.showOpenFilePicker && pickers.showDirectoryPicker)

export async function pickDisc(): Promise<RememberedDisc | null> {
  try {
    const [handle] = await pickers.showOpenFilePicker!({ id: 'gamecube-disc', types: [{ description: 'GameCube disc', accept: { 'application/octet-stream': ['.iso', '.gcm', '.ciso'] } }] })
    return { kind: 'file', name: handle.name, handle }
  } catch {
    return null
  }
}

export async function pickPort(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await pickers.showDirectoryPicker!({ id: 'recomp-port', mode: 'readwrite' })
  } catch {
    return null
  }
}