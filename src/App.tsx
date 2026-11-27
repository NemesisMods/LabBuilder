import { label } from '@nemesismods/imperfectlab-core/game/roster'
import { load } from '@nemesismods/imperfectlab-core/package/imperfect'
import { type Entry, forgetHandle, newId, permission, setHandle, setList } from '@nemesismods/workspace'
import { useEffect, useMemo, useState } from 'react'
import { check, type PortCheck } from './recomp/check'
import { ENGINE_NAME, ENGINE_RELEASES, ENGINE_VERSION } from './recomp/install'
import { RECOMP, unsupported } from './recomp/target'
import { build } from './ui/build'
import { canPick, pickDisc, pickPort, readDisc, type RememberedDisc } from './ui/disc'
import { useHandle, useList } from './ui/useShared'

interface Summary { name: string; detail: string; warnings: string[]; error: string | null }

function summary(e: Entry): Summary {
  try {
    const c = load(e.bytes)
    return { name: c.displayName, detail: `${label(c.base)} · ${c.internalName}`, warnings: unsupported(c), error: null }
  } catch (err) {
    return { name: e.name, detail: e.source, warnings: [], error: (err as Error).message }
  }
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function App() {
  const list = useList('builder-characters')
  const labList = useList('lab-characters')
  const arenas = useList('arenas')
  const [disc] = useHandle<RememberedDisc>('gamecube-disc')
  const [port] = useHandle<FileSystemDirectoryHandle>('recomp-port')
  const [status, setStatus] = useState<{ port: FileSystemDirectoryHandle; access: PermissionState; info: PortCheck | null } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<[number, number]>([0, 0])
  const [log, setLog] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rows = useMemo(() => new Map(list.map((e) => [e.id, summary(e)])), [list])

  const inspect = async (h: FileSystemDirectoryHandle, ask: boolean) => {
    const access = await permission(h, 'readwrite', ask).catch(() => 'denied' as const)
    setStatus({ port: h, access, info: access === 'granted' ? await check(h).catch(() => null) : null })
  }

  useEffect(() => {
    if (!port) return
    let live = true
    void (async () => {
      const access = await permission(port, 'readwrite', false).catch(() => 'denied' as const)
      const info = access === 'granted' ? await check(port).catch(() => null) : null
      if (live) setStatus({ port, access, info })
    })()
    return () => { live = false }
  }, [port])

  const current = port && status?.port === port ? status : null
  const access = current?.access ?? null
  const info = current?.info ?? null

  const save = (next: Entry[]) => void setList('builder-characters', next).catch((e) => setError(errorText(e)))
  const full = list.length >= RECOMP.maxCharacters

  const addLab = () => save([...list, ...labList.map((e) => ({ ...e, id: newId() }))].slice(0, RECOMP.maxCharacters))
  const addFiles = async (files: FileList | null) => {
    const added = await Promise.all([...(files ?? [])].map(async (f) => ({ id: newId(), name: f.name.replace(/\.imperfect$/i, ''), source: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })))
    save([...list, ...added].slice(0, RECOMP.maxCharacters))
  }
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]]
    save(next)
  }

  const linkPort = async () => {
    const h = await pickPort()
    if (h) await setHandle('recomp-port', h)
  }
  const chooseDisc = async () => {
    const d = await pickDisc()
    if (d) await setHandle('gamecube-disc', d)
  }

  const run = async () => {
    if (!port || !disc) return
    setError(null)
    setLog('')
    setBusy('Starting...')
    setProgress([0, 0])
    try {
      if ((await permission(port, 'readwrite', true)) !== 'granted') throw new Error(`no permission to write into ${port.name}`)
      const d = await readDisc(disc)
      const text = await build({ disc: d, port, characters: list.map((e) => e.bytes) }, (stage, done, total) => {
        setBusy(stage)
        setProgress([done, total])
      })
      setLog(text)
      await inspect(port, false)
    } catch (e) {
      setError(errorText(e))
    }
    setBusy(null)
  }

  const engineOk = info !== null && info.engine >= ENGINE_VERSION
  const portOk = info !== null && info.exe && info.iso !== null
  const ready = !busy && list.length > 0 && disc !== null && port !== null && access === 'granted' && portOk && [...rows.values()].every((r) => !r.error)

  return (
    <main className="builder">
      <header>
        <h1>Lab Builder</h1>
        <p className="muted">Puts ImperfectLab characters into a Marvel Nemesis port.</p>
      </header>

      <section className="target">
        <h2>Xbox Recomp (15Cyber)</h2>
        <p className="muted">15Cyber's Windows port of the Xbox version. It needs <a href={ENGINE_RELEASES} target="_blank" rel="noreferrer">{ENGINE_NAME}</a> or newer, installed once.</p>
        {!canPick && <p className="bad">This browser cannot link folders: use Chrome or Edge.</p>}

        <div className="card">
          <h3>Port folder</h3>
          {!port ? <p className="muted">Not linked. Choose the folder with MarvelNemesis.exe in it.</p> : (
            <>
              <p><b>{port.name}</b></p>
              {access !== 'granted' && <p className="muted">Linked before: reconnect to read and write it again.</p>}
              {info && !portOk && <p className="bad">This is not the port folder: it needs MarvelNemesis.exe and the game's .iso in assets.</p>}
              {info && portOk && (engineOk
                ? <p className="good">Turlin Engine is installed (roster extension v{info.engine}).</p>
                : <p className="bad">{info.engine ? `Turlin Engine is too old (v${info.engine}).` : 'Turlin Engine is not installed, or the game has not been started since.'} Install {ENGINE_NAME} from <a href={ENGINE_RELEASES} target="_blank" rel="noreferrer">its releases</a>.</p>)}
              {info && portOk && <p className="muted">In the port: {info.characters.length ? info.characters.join(', ') : 'no added characters'}; {info.stages} added stage{info.stages === 1 ? '' : 's'}.</p>}
            </>
          )}
          <div className="row">
            <button onClick={linkPort} disabled={!!busy || !canPick}>{port ? 'Choose another folder...' : 'Choose the port folder...'}</button>
            {port && access !== 'granted' && <button onClick={() => void inspect(port, true)} disabled={!!busy}>Reconnect</button>}
            {port && access === 'granted' && <button onClick={() => void inspect(port, false)} disabled={!!busy}>Check again</button>}
            {port && <button onClick={() => void forgetHandle('recomp-port')} disabled={!!busy}>Unlink</button>}
          </div>
        </div>

        <div className="card">
          <h3>GameCube disc</h3>
          <p className={disc ? '' : 'muted'}>{disc ? <b>{disc.name}</b> : 'None yet. The characters are built from it, as in ImperfectLab, then converted.'}</p>
          <div className="row"><button onClick={chooseDisc} disabled={!!busy || !canPick}>{disc ? 'Choose another disc...' : 'Choose the disc...'}</button></div>
        </div>

        <div className="card">
          <h3>Characters <span className="muted">{list.length} of {RECOMP.maxCharacters}</span></h3>
          {list.length === 0 && <p className="muted">None yet.</p>}
          <ol className="slots">
            {list.map((e, i) => {
              const r = rows.get(e.id)!
              return (
                <li key={e.id}>
                  <div className="slot-head">
                    <span><b>{r.name}</b> <span className="muted">{r.detail}</span></span>
                    <span className="row tight">
                      <button onClick={() => move(i, -1)} disabled={!!busy || i === 0} aria-label="Move up">↑</button>
                      <button onClick={() => move(i, 1)} disabled={!!busy || i === list.length - 1} aria-label="Move down">↓</button>
                      <button onClick={() => save(list.filter((_, k) => k !== i))} disabled={!!busy}>Remove</button>
                    </span>
                  </div>
                  {r.error && <p className="bad">{r.error}</p>}
                  {r.warnings.length > 0 && <p className="warn">Left out (not on Xbox Recomp yet): {r.warnings.join(', ')}</p>}
                </li>
              )
            })}
          </ol>
          <div className="row">
            <button onClick={addLab} disabled={!!busy || full || labList.length === 0}>Add ImperfectLab's list ({labList.length})</button>
            <label className={`button ${busy || full ? 'disabled' : ''}`}>
              Add .imperfect files...
              <input type="file" accept=".imperfect" multiple hidden disabled={!!busy || full} onChange={(e) => { void addFiles(e.target.files); e.target.value = '' }} />
            </label>
          </div>
        </div>

        <div className="card">
          <h3>Arenas <span className="muted">{arenas.length}</span></h3>
          {arenas.length === 0 ? <p className="muted">None yet: add them in Arena Lab.</p> : <ol>{arenas.map((a) => <li key={a.id}>{a.name}</li>)}</ol>}
          <p className="muted">Installing arenas is not available yet.</p>
        </div>

        <div className="row">
          <button className="primary" onClick={run} disabled={!ready}>Build into the port</button>
          {busy && <span className="muted">{busy}</span>}
        </div>
        {busy && <progress value={progress[1] ? progress[0] : undefined} max={progress[1] || undefined} />}
        {error && <pre className="log bad">{error}</pre>}
        {log && <pre className="log">{log}</pre>}
      </section>
    </main>
  )
}