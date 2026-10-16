import { db } from './db'
import { blobADataURL, dataURLABlob } from './image'
import { prefs } from './prefs'
import { programarSync } from './sync'
import type { Look, Prenda, Uso, Viaje } from './types'

interface Backup {
  app: 'placard'
  version: 1
  exportado: string
  prendas: (Omit<Prenda, 'foto'> & { foto: string | null })[]
  looks: Look[]
  usos: Uso[]
  viajes?: Viaje[]
  preferencias: ReturnType<typeof prefs.todas>
}

export async function exportarBackup() {
  const prendas = await db.prendas.where('deleted').equals(0).toArray()
  const looks = await db.looks.where('deleted').equals(0).toArray()
  const usos = await db.usos.where('deleted').equals(0).toArray()
  const viajes = await db.viajes.where('deleted').equals(0).toArray()
  const data: Backup = {
    app: 'placard',
    version: 1,
    exportado: new Date().toISOString(),
    prendas: await Promise.all(prendas.map(async (p) => ({ ...p, foto: p.foto ? await blobADataURL(p.foto) : null }))),
    looks,
    usos,
    viajes,
    preferencias: prefs.todas(),
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const fecha = new Date().toISOString().slice(0, 10)
  const nombre = `placard-backup-${fecha}.json`

  // En el celular, si se puede, abrimos el menú de compartir (guardar en Archivos, Drive, etc.)
  const archivo = new File([blob], nombre, { type: 'application/json' })
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: 'Backup de Placard' })
      return prendas.length
    } catch (e) {
      if ((e as Error).name === 'AbortError') return prendas.length
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return prendas.length
}

export async function importarBackup(file: File): Promise<{ prendas: number; looks: number }> {
  const data = JSON.parse(await file.text()) as Backup
  if (data.app !== 'placard' || !Array.isArray(data.prendas)) throw new Error('El archivo no es un backup de Placard')
  const ahora = Date.now()
  const prendas: Prenda[] = await Promise.all(
    data.prendas.map(async (p) => ({
      ...p,
      foto: p.foto ? await dataURLABlob(p.foto) : null,
      fotoPath: null,
      synced: 0 as const,
      deleted: 0 as const,
      updatedAt: Math.max(p.updatedAt ?? 0, ahora),
    })),
  )
  const marcar = <T extends { updatedAt: number }>(x: T) => ({ ...x, synced: 0 as const, deleted: 0 as const, updatedAt: Math.max(x.updatedAt ?? 0, ahora) })
  await db.transaction('rw', [db.prendas, db.looks, db.usos, db.viajes], async () => {
    await db.prendas.bulkPut(prendas)
    await db.looks.bulkPut((data.looks ?? []).map(marcar))
    await db.usos.bulkPut((data.usos ?? []).map(marcar))
    await db.viajes.bulkPut((data.viajes ?? []).map(marcar))
  })
  if (data.preferencias) prefs.restaurar(data.preferencias)
  programarSync(0)
  return { prendas: prendas.length, looks: (data.looks ?? []).filter((l) => l.guardado).length }
}
