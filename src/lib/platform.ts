// Informazioni sull'ambiente: app installata o Safari, archiviazione persistente.

/** true se l'app è aperta dall'icona sulla schermata Home (non dentro Safari). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

/**
 * Chiede al browser di non cancellare i dati dell'app.
 * Restituisce true/false, oppure null se il browser non lo supporta.
 */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

export async function isStoragePersisted(): Promise<boolean | null> {
  if (!navigator.storage?.persisted) return null
  try {
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}
