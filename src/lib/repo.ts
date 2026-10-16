import { db, nuevoId } from './db'
import { claveLook } from './suggest'
import { programarSync } from './sync'
import type { Look, Ocasion, Prenda, Viaje } from './types'

export type DatosPrenda = Omit<
  Prenda,
  'id' | 'foto' | 'vecesUsada' | 'ultimoUso' | 'fechaAlta' | 'updatedAt' | 'synced' | 'deleted' | 'fotoPath'
>

export async function crearPrenda(datos: DatosPrenda, foto: Blob): Promise<string> {
  const ahora = Date.now()
  const id = nuevoId()
  await db.prendas.add({
    ...datos,
    id,
    foto,
    vecesUsada: 0,
    ultimoUso: null,
    fechaAlta: ahora,
    updatedAt: ahora,
    synced: 0,
    deleted: 0,
    fotoPath: null,
  })
  programarSync()
  return id
}

export async function editarPrenda(id: string, datos: DatosPrenda, fotoNueva?: Blob) {
  await db.prendas.update(id, {
    ...datos,
    ...(fotoNueva ? { foto: fotoNueva, fotoPath: null } : {}),
    updatedAt: Date.now(),
    synced: 0,
  })
  programarSync()
}

export async function borrarPrenda(id: string) {
  const ahora = Date.now()
  await db.transaction('rw', db.prendas, db.looks, async () => {
    // Queda una "lápida" sin foto para que el borrado viaje a los otros dispositivos
    await db.prendas.update(id, { deleted: 1, foto: null, updatedAt: ahora, synced: 0 })
    const looks = await db.looks.filter((l) => !l.deleted && l.prendaIds.includes(id)).toArray()
    for (const l of looks) await db.looks.update(l.id, { deleted: 1, updatedAt: ahora, synced: 0 })
  })
  const viajes = await db.viajes.filter((v) => !v.deleted && v.prendaIds.includes(id)).toArray()
  for (const v of viajes) await db.viajes.update(v.id, { prendaIds: v.prendaIds.filter((x) => x !== id), updatedAt: ahora, synced: 0 })
  programarSync()
}

export async function guardarLook(prendaIds: string[], ocasion: Ocasion, nota: string): Promise<'nuevo' | 'existente'> {
  const ahora = Date.now()
  const existente = await buscarLook(prendaIds)
  if (existente) {
    await db.looks.update(existente.id, {
      guardado: true,
      ocasion,
      nota: nota || existente.nota,
      updatedAt: ahora,
      synced: 0,
    })
    programarSync()
    return existente.guardado ? 'existente' : 'nuevo'
  }
  await db.looks.add(nuevoLook(prendaIds, ocasion, nota, true, ahora))
  programarSync()
  return 'nuevo'
}

export async function toggleFavorito(look: Look) {
  await db.looks.update(look.id, { favorito: !look.favorito, guardado: true, updatedAt: Date.now(), synced: 0 })
  programarSync()
}

export async function borrarLook(id: string) {
  await db.looks.update(id, { deleted: 1, updatedAt: Date.now(), synced: 0 })
  programarSync()
}

/** Registra que usaste estas prendas hoy: +1 a cada una, último uso y entrada en el historial. */
export async function usarLook(prendaIds: string[], extras: string[], ocasion: Ocasion) {
  const ahora = Date.now()
  await db.transaction('rw', db.prendas, db.looks, db.usos, async () => {
    const todas = [...prendaIds, ...extras]
    let look = await buscarLook(todas)
    if (!look) {
      look = nuevoLook(todas, ocasion, '', false, ahora)
      await db.looks.add(look)
    } else {
      await db.looks.update(look.id, { fecha: ahora, updatedAt: ahora, synced: 0 })
    }
    await db.usos.add({ id: nuevoId(), fecha: ahora, lookId: look.id, updatedAt: ahora, synced: 0, deleted: 0 })
    for (const id of todas) {
      const p = await db.prendas.get(id)
      if (p) await db.prendas.update(id, { vecesUsada: p.vecesUsada + 1, ultimoUso: ahora, updatedAt: ahora, synced: 0 })
    }
  })
  programarSync()
}

async function buscarLook(prendaIds: string[]) {
  const clave = claveLook(prendaIds)
  return db.looks.filter((l) => !l.deleted && claveLook(l.prendaIds) === clave).first()
}

function nuevoLook(prendaIds: string[], ocasion: Ocasion, nota: string, guardado: boolean, ahora: number): Look {
  return {
    id: nuevoId(),
    prendaIds,
    ocasion,
    nota,
    fecha: ahora,
    favorito: false,
    guardado,
    updatedAt: ahora,
    synced: 0,
    deleted: 0,
  }
}

/** Borra todo (y, si hay sesión, también en la nube al sincronizar). */
export async function borrarTodo() {
  const ahora = Date.now()
  const lapida = { deleted: 1 as const, updatedAt: ahora, synced: 0 as const }
  await db.transaction('rw', [db.prendas, db.looks, db.usos, db.viajes], async () => {
    await db.prendas.toCollection().modify({ ...lapida, foto: null })
    await db.looks.toCollection().modify(lapida)
    await db.usos.toCollection().modify(lapida)
    await db.viajes.toCollection().modify(lapida)
  })
  programarSync(0)
}

// ---------- Viajes ----------

export type DatosViaje = Pick<Viaje, 'nombre' | 'destino' | 'lat' | 'lon' | 'desde' | 'hasta'>

export async function crearViaje(datos: DatosViaje, ocasion: Ocasion): Promise<string> {
  const ahora = Date.now()
  const id = nuevoId()
  await db.viajes.add({ ...datos, id, ocasion, prendaIds: [], pronostico: [], pronosticoAt: null, updatedAt: ahora, synced: 0, deleted: 0 })
  programarSync()
  return id
}

export async function actualizarViaje(id: string, cambios: Partial<Omit<Viaje, 'id' | 'updatedAt' | 'synced' | 'deleted'>>) {
  await db.viajes.update(id, { ...cambios, updatedAt: Date.now(), synced: 0 })
  programarSync()
}

/** El pronóstico se guarda en el dispositivo (para verlo sin señal) pero no cuenta como cambio a sincronizar */
export async function guardarPronostico(id: string, pronostico: Viaje['pronostico']) {
  await db.viajes.update(id, { pronostico, pronosticoAt: Date.now() })
}

export async function borrarViaje(id: string) {
  await db.viajes.update(id, { deleted: 1, updatedAt: Date.now(), synced: 0 })
  programarSync()
}
