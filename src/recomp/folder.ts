import type { ReadAt } from '@nemesismods/imperfectlab-core/game/disc'
import { blobReader } from '@nemesismods/imperfectlab-core/web'
import type { PortFolder } from './install'

type Entries = { entries(): AsyncIterable<[string, FileSystemHandle]> }

async function dirAt(root: FileSystemDirectoryHandle, parts: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
  let d = root
  try {
    for (const p of parts) d = await d.getDirectoryHandle(p, { create })
  } catch (e) {
    if (!create && (e as DOMException).name === 'NotFoundError') return null
    throw e
  }
  return d
}

const failed = (path: string, e: unknown) => new Error(`${path}: ${(e as Error).name}: ${(e as Error).message}`)

export function portFolder(root: FileSystemDirectoryHandle): PortFolder {
  const split = (path: string): [string[], string] => { const parts = path.split('/'); return [parts.slice(0, -1), parts[parts.length - 1]] }
  return {
    async read(path) {
      const [dirs, name] = split(path)
      const d = await dirAt(root, dirs, false)
      if (!d) return null
      let f: File
      try {
        f = await (await d.getFileHandle(name)).getFile()
      } catch (e) {
        if ((e as DOMException).name === 'NotFoundError') return null
        throw failed(path, e)
      }
      try {
        return new Uint8Array(await f.arrayBuffer())
      } catch (e) {
        try {
          return new Uint8Array(new FileReaderSync().readAsArrayBuffer(f))
        } catch {
          throw failed(path, e)
        }
      }
    },
    async write(path, data) {
      const [dirs, name] = split(path)
      const d = await dirAt(root, dirs, true)
      const w = await (await d!.getFileHandle(name, { create: true })).createWritable()
      await w.write(data as BufferSource)
      await w.close()
    },
    async remove(path) {
      const [dirs, name] = split(path)
      const d = await dirAt(root, dirs, false)
      if (d) await d.removeEntry(name).catch(() => {})
    },
    async list(dir) {
      const d = await dirAt(root, dir.split('/').filter(Boolean), false)
      if (!d) return []
      const out: string[] = []
      for await (const [name, h] of (d as unknown as Entries).entries()) if (h.kind === 'file') out.push(name)
      return out
    },
  }
}

export async function portFile(root: FileSystemDirectoryHandle, path: string): Promise<ReadAt> {
  const parts = path.split('/')
  const d = await dirAt(root, parts.slice(0, -1), false)
  if (!d) throw new Error(`${path} is missing`)
  return blobReader(await (await d.getFileHandle(parts[parts.length - 1])).getFile())
}