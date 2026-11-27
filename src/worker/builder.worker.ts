/// <reference lib="webworker" />
import { LabError } from '@nemesismods/imperfectlab-core/errors'
import { load } from '@nemesismods/imperfectlab-core/package/imperfect'
import { loadModel, openGameFolder, openGameImage } from '@nemesismods/imperfectlab-core/web'
import { XboxDisc } from '@nemesismods/imperfectlab-core/xbox/disc'
import { exportRecomp } from '../recomp/export'
import { portFile, portFolder } from '../recomp/folder'
import { ENGINE_NAME, ENGINE_VERSION, engineVersion, findXboxImage, install } from '../recomp/install'
import type { BuildReply, BuildRequest } from './protocol'

declare const self: DedicatedWorkerGlobalScope

const send = (m: BuildReply) => self.postMessage(m)

self.onmessage = async ({ data: { id, disc, port, characters } }: MessageEvent<BuildRequest>) => {
  let last = 0
  const progress = (stage: string, done = 0, total = 0) => {
    const now = Date.now()
    if (now - last < 80 && done < total) return
    last = now
    send({ id, progress: [stage, done, total] })
  }
  try {
    const source = disc.kind === 'file' ? openGameImage(disc.file, disc.file.name) : openGameFolder(disc.files, disc.name)
    const folder = portFolder(port)
    const xbox = new XboxDisc(await portFile(port, await findXboxImage(folder)))
    const chars = characters.map((b) => load(b))
    const models = await Promise.all(chars.map((c) => (c.glb ? loadModel(c.glb) : undefined)))
    const ex = exportRecomp(source, xbox, chars, progress, models)
    const notes = [...ex.notes, ...(await install(folder, ex, progress))]
    const engine = await engineVersion(folder)
    const lines = [`Wrote ${ex.files.size} files into mods: ${chars.map((c) => c.displayName).join(', ')}.`]
    if (engine < ENGINE_VERSION) lines.unshift(`${ENGINE_NAME} or newer is needed for these to appear (${engine ? `found roster extension v${engine}` : 'not found, or the game has not been started since'}).`, '')
    send({ id, result: [...lines, '', ...notes.map((n) => `• ${n}`)].join('\n') })
  } catch (e) {
    send({ id, error: e instanceof LabError ? e.message : `${(e as Error).message}\n${(e as Error).stack ?? ''}` })
  }
}