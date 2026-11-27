import type { DolFeature } from '@nemesismods/imperfectlab-core/build/features'
import { dolFeatures } from '@nemesismods/imperfectlab-core/build/features'
import type { BuildTarget } from '@nemesismods/imperfectlab-core/build/target'
import { CACHE_SIZE } from '@nemesismods/imperfectlab-core/mnroi/nfxtool'
import type { Character } from '@nemesismods/imperfectlab-core/package/imperfect'

// Turlin Engine's effect cache and tuning list (the game's are 300,000 bytes and 0x200)
export const EFFECT_CACHE = 450000

export const RECOMP: BuildTarget = {
  maxCharacters: 27,
  effectCacheMax: EFFECT_CACHE,
  tintLimit: EFFECT_CACHE - CACHE_SIZE - 8192,
  listBuffer: 0x1000,
  ghostTwins: true,
  wholeNamePrefixes: true,
  patchDol: false,
}

const LABELS: Record<DolFeature, string> = {
  long_throw: 'long baton throw', stretch_return: 'stretched return hits', charge_rate: 'energy charge rate', air_throw: 'air baton throw',
  shield_throw: 'shield throw', throw_return: 'baton return', throw_damage: 'baton throw damage', sounds: 'own sounds',
  z_energy: 'Z energy drain', z_stealth: 'Z fade and stealth', z_costume: 'Z costume change', z_stats: 'Z stat change', z_size: 'Z size change',
  z_bullet_time: 'Bullet Time', damage_stages: 'damage stages', gun: 'gun', laser: 'laser beam',
  impersonate_moves: "impersonation's moves", impersonate_model: "impersonation's model", impersonate_stats: "impersonation's stats",
}

// what Turlin Engine v47 does in place of ImperfectLab's main.dol patches
export const SUPPORTED: ReadonlySet<DolFeature> = new Set<DolFeature>([
  'long_throw', 'stretch_return', 'charge_rate', 'throw_damage', 'sounds', 'z_energy', 'z_stealth', 'z_costume', 'z_stats', 'z_size',
  'z_bullet_time', 'damage_stages', 'gun', 'laser', 'impersonate_moves',
])

export function unsupported(c: Character): string[] {
  return dolFeatures(c).filter((f) => !SUPPORTED.has(f)).map((f) => LABELS[f])
}