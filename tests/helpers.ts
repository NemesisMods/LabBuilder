import { openSync, readSync, statSync } from 'node:fs'
import type { ReadAt } from '@nemesismods/imperfectlab-core/game/disc'
import type { PortFolder } from '../src/recomp/install'

export const ISO = process.env.IMPERFECTLAB_ISO
export const XBOX = process.env.IMPERFECTLAB_XBOX
export const CHARACTER = process.env.LABBUILDER_CHARACTER

export function fileReader(path: string): ReadAt {
  const fd = openSync(path, 'r')
  return {
    size: statSync(path).size,
    read(offset, n) {
      const out = new Uint8Array(n)
      let got = 0
      while (got < n) {
        const k = readSync(fd, out, got, n - got, offset + got)
        if (k <= 0) break
        got += k
      }
      return got === n ? out : out.subarray(0, got)
    },
  }
}

export class MemoryFolder implements PortFolder {
  files = new Map<string, Uint8Array>()
  async read(path: string) { return this.files.get(path) ?? null }
  async write(path: string, data: Uint8Array) { this.files.set(path, data) }
  async remove(path: string) { this.files.delete(path) }
  async list(dir: string) {
    const p = dir.replace(/\/?$/, '/')
    return [...this.files.keys()].filter((k) => k.startsWith(p) && !k.slice(p.length).includes('/')).map((k) => k.slice(p.length))
  }
}

export const ascii = (t: string) => Uint8Array.from(t, (c) => c.charCodeAt(0))
export const str = (b: Uint8Array | null | undefined) => (b ? String.fromCharCode(...b) : '')