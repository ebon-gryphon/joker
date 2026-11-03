// Storage can be unavailable (private browsing, quota, or embedded browser policy).
// A failed write must never interrupt a game or remove its last valid snapshot.
export function readRun(key, storage) {
  try {
    const source = storage ?? globalThis.localStorage
    return JSON.parse(source?.getItem(key) || 'null')
  } catch {
    return null
  }
}

export function writeRun(key, payload, storage) {
  if (!payload) return false
  try {
    const source = storage ?? globalThis.localStorage
    if (!source) return false
    source.setItem(key, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
