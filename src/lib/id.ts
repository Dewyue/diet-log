export function createId(): string {
  if (globalThis.crypto?.randomUUID) {
    try {
      return globalThis.crypto.randomUUID()
    } catch {
      // randomUUID requires secure context (HTTPS / localhost)
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
