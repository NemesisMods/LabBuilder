import { type Entry, getHandle, getList, type HandleKey, type ListKey, subscribe } from '@nemesismods/workspace'
import { useEffect, useState } from 'react'

export function useList(key: ListKey): Entry[] {
  const [list, set] = useState<Entry[]>([])
  useEffect(() => {
    const load = () => void getList(key).then(set, () => set([]))
    load()
    return subscribe(key, load)
  }, [key])
  return list
}

export function useHandle<T>(key: HandleKey): [T | null, () => void] {
  const [value, set] = useState<T | null>(null)
  const [n, reload] = useState(0)
  useEffect(() => {
    const load = () => void getHandle<T>(key).then(set, () => set(null))
    load()
    return subscribe(key, load)
  }, [key, n])
  return [value, () => reload((k) => k + 1)]
}