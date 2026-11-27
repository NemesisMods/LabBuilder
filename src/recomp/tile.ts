// Turlin Engine's .ctile: 'CTL1', u32 record length, then a select tile's unselected and selected picture records.
import { LabError } from '@nemesismods/imperfectlab-core/errors'
import type { RgbaImage } from '@nemesismods/imperfectlab-core/image/rgba'
import * as SX from '@nemesismods/imperfectlab-core/xbox/shpx'
import { tileImages, tileRecord } from '@nemesismods/imperfectlab-core/xbox/tiles'

// select id 4's tile is the mold every new tile copies
const MOLD = 4

export function ctile(recs: Uint8Array[]): Uint8Array {
  if (recs.length !== 2 || recs[0].length !== recs[1].length) throw new LabError('a tile needs two picture records of one size')
  const n = recs[0].length, out = new Uint8Array(8 + 2 * n)
  out.set([0x43, 0x54, 0x4c, 0x31, n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]); out.set(recs[0], 8); out.set(recs[1], 8 + n)
  return out
}

export function tileSize(stockThumbs: Uint8Array): [number, number] {
  return SX.recordSize(tileRecord(stockThumbs, tileImages(stockThumbs, MOLD)[0]))
}

export function tileFile(stockThumbs: Uint8Array, pics: [RgbaImage, RgbaImage]): Uint8Array {
  const mold = tileImages(stockThumbs, MOLD).map((i) => tileRecord(stockThumbs, i))
  return ctile(pics.map((im, k) => SX.encodeRecord(mold[k], im)))
}