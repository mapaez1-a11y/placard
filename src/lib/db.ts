import Dexie, { type EntityTable } from 'dexie'
import type { Look, Prenda, Uso, Viaje } from './types'

export const db = new Dexie('placard') as Dexie & {
  prendas: EntityTable<Prenda, 'id'>
  looks: EntityTable<Look, 'id'>
  usos: EntityTable<Uso, 'id'>
  viajes: EntityTable<Viaje, 'id'>
}

db.version(1).stores({
  prendas: 'id, parte, synced, deleted, fechaAlta',
  looks: 'id, fecha, synced, deleted',
  usos: 'id, fecha, lookId, synced, deleted',
})

db.version(2).stores({
  viajes: 'id, desde, synced, deleted',
})

// v3: las carteras pasan a la parte "Accesorio"
db.version(3)
  .stores({})
  .upgrade((tx) =>
    tx
      .table('prendas')
      .where('parte')
      .equals('Cartera')
      .modify((p) => {
        p.parte = 'Accesorio'
        p.updatedAt = Date.now()
        p.synced = 0
      }),
  )

export const nuevoId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

/** Pide al navegador que no borre los datos si se queda sin espacio. */
export async function pedirPersistencia(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
