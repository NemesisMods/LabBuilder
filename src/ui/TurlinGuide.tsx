import { useState } from 'react'
import { ENGINE_NAME, ENGINE_RELEASES } from '../recomp/install'

export function TurlinGuide({ needed }: { needed: boolean }) {
  const [chosen, setChosen] = useState<boolean | null>(null)
  const open = chosen ?? needed
  return (
    <details className="guide" open={open} onToggle={(e) => { if (e.currentTarget.open !== open) setChosen(e.currentTarget.open) }}>
      <summary>How to install Turlin Engine</summary>
      <ol className="steps">
        <li>
          <b>Download</b> the zip from <a href={`${ENGINE_RELEASES}/latest`} target="_blank" rel="noreferrer">the latest release</a> ({ENGINE_NAME} or newer).
          <span className="muted"> Under 1 MB, with no game code in it.</span>
        </li>
        <li>
          <b>Get the port ready.</b>
          <span className="muted"> On a new port, start MarvelNemesis.exe once, let its preparation window finish, then close the game.</span>
        </li>
        <li>
          <b>Unzip it into the port folder,</b> so "Install Turlin Engine.bat" sits next to MarvelNemesis.exe.
          <span className="muted"> Replace files if Windows asks.</span>
        </li>
        <li>
          <b>Run "Install Turlin Engine.bat"</b> and wait for "Turlin Engine installed" (a few minutes).
          <span className="muted"> It needs Node.js once and offers to install it. If Windows says it protected your PC, choose More info, then Run anyway.</span>
        </li>
        <li>
          <b>Start the game once,</b> then link the port folder above, or press "Check again".
          <span className="muted"> The character select is now 15 × 3 and the stage select 2 × 12.</span>
        </li>
      </ol>
      <h4>After it's installed</h4>
      <ul>
        <li>"Build into the port" writes each character into mods/characters on its own, so the ones already there stay. Up to 27 join the 18 originals.</li>
        <li>To take one out, delete its .character file in mods/characters. The select-screen order is mods/characters/order.txt.</li>
        <li>A stage download is a mods folder to copy into the port. Up to 17 join the 7 originals.</li>
        <li>Z-button actions are on the right bumper.</li>
      </ul>
      <h4>Updating, removing, trouble</h4>
      <ul>
        <li>To update, do steps 1, 3 and 4 again with the new zip. There's no need to uninstall first.</li>
        <li>"Uninstall Turlin Engine.bat" puts the port back as it was and leaves the characters' and stages' own files in mods.</li>
        <li>If the installer stops, it changes nothing and says why in turlin_build/install_log.txt. If the memory upgrade doesn't fit your release of the port, run "Install Turlin Engine (no memory upgrade).bat".</li>
      </ul>
    </details>
  )
}