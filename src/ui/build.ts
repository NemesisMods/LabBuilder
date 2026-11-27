import type { BuildReply, BuildRequest } from '../worker/protocol'

let worker: Worker | null = null
let next = 0

export function build(req: Omit<BuildRequest, 'id'>, onProgress: (stage: string, done: number, total: number) => void): Promise<string> {
  worker ??= new Worker(new URL('../worker/builder.worker.ts', import.meta.url), { type: 'module' })
  const w = worker, id = ++next
  return new Promise((resolve, reject) => {
    const on = ({ data }: MessageEvent<BuildReply>) => {
      if (data.id !== id) return
      if ('progress' in data) return onProgress(...data.progress)
      w.removeEventListener('message', on)
      if ('result' in data) resolve(data.result)
      else reject(new Error(data.error))
    }
    w.addEventListener('message', on)
    w.postMessage({ ...req, id } satisfies BuildRequest)
  })
}