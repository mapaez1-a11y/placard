import { useSyncExternalStore } from 'react'
import { db } from './db'
import { BUCKET, supabase } from './supabase'
import type { Look, Prenda, Uso, Viaje } from './types'

/*
  Sincronización local-first:
  - Todo se escribe primero en IndexedDB con synced = 0.
  - push: sube lo pendiente (filas a la base, fotos a Storage).
  - pull: baja lo que cambió en el servidor desde el último cursor (server_updated_at).
  - Conflictos: gana la versión con updatedAt más nuevo.
  - Borrados: "lápidas" (deleted = 1) que viajan como cualquier cambio.
*/

export type EstadoSync =
  | { tipo: 'sin-config' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'listo'; ultimo: number | null }
  | { tipo: 'sincronizando' }
  | { tipo: 'offline' }
  | { tipo: 'error'; mensaje: string }

let estado: EstadoSync = supabase ? { tipo: 'sin-sesion' } : { tipo: 'sin-config' }
const oyentes = new Set<() => void>()
function setEstado(e: EstadoSync) {
  estado = e
  oyentes.forEach((f) => f())
}
export function useEstadoSync() {
  return useSyncExternalStore(
    (f) => (oyentes.add(f), () => oyentes.delete(f)),
    () => estado,
  )
}

const KEY_CURSOR = 'placard.sync.cursor'
const KEY_UID = 'placard.sync.uid'
const KEY_ULTIMO = 'placard.sync.ultimo'
type Tabla = 'prendas' | 'looks' | 'usos' | 'viajes'
type Cursores = Partial<Record<Tabla, string>>
const leerCursores = (): Cursores => JSON.parse(localStorage.getItem(KEY_CURSOR) || '{}')
const guardarCursores = (c: Cursores) => localStorage.setItem(KEY_CURSOR, JSON.stringify(c))

let timer: ReturnType<typeof setTimeout> | null = null
let enCurso: Promise<void> | null = null
let otraVez = false

export function programarSync(ms = 1500) {
  if (!supabase) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void sincronizar(), ms)
}

export async function sincronizar(): Promise<void> {
  if (!supabase) return
  if (enCurso) {
    otraVez = true
    return enCurso
  }
  enCurso = (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user.id
      if (!uid) return setEstado({ tipo: 'sin-sesion' })
      if (!navigator.onLine) return setEstado({ tipo: 'offline' })
      setEstado({ tipo: 'sincronizando' })
      await prepararUsuario(uid)
      await pull(uid)
      await push(uid)
      await repararFotos()
      const ahora = Date.now()
      localStorage.setItem(KEY_ULTIMO, String(ahora))
      setEstado({ tipo: 'listo', ultimo: ahora })
    } catch (e) {
      console.error(e)
      setEstado(navigator.onLine ? { tipo: 'error', mensaje: e instanceof Error ? e.message : String(e) } : { tipo: 'offline' })
    } finally {
      enCurso = null
      if (otraVez) {
        otraVez = false
        programarSync(500)
      }
    }
  })()
  return enCurso
}

/** Si en este dispositivo entra otra cuenta (o es la primera vez), subimos todo lo local y bajamos todo. */
async function prepararUsuario(uid: string) {
  if (localStorage.getItem(KEY_UID) === uid) return
  guardarCursores({})
  await marcarTodoPendiente()
  localStorage.setItem(KEY_UID, uid)
}

async function marcarTodoPendiente() {
  await db.transaction('rw', [db.prendas, db.looks, db.usos, db.viajes], async () => {
    await db.prendas.toCollection().modify({ synced: 0, fotoPath: null })
    await db.looks.toCollection().modify({ synced: 0 })
    await db.usos.toCollection().modify({ synced: 0 })
    await db.viajes.toCollection().modify({ synced: 0 })
  })
}

/** Al cerrar sesión los datos quedan en el celular; la próxima vez que entres se vuelven a subir. */
export async function alCerrarSesion() {
  localStorage.removeItem(KEY_UID)
  guardarCursores({})
  await marcarTodoPendiente()
  setEstado({ tipo: 'sin-sesion' })
}

export function ultimoSync(): number | null {
  const v = localStorage.getItem(KEY_ULTIMO)
  return v ? Number(v) : null
}

// ---------- PULL ----------

async function bajar(tabla: Tabla) {
  const cursores = leerCursores()
  // 2 min de solapamiento por transacciones que confirmaron tarde; aplicar dos veces no hace daño
  const desde = cursores[tabla] ? new Date(new Date(cursores[tabla]!).getTime() - 120_000).toISOString() : null
  const filas: Record<string, unknown>[] = []
  for (let i = 0; ; i += 1000) {
    let q = supabase!.from(tabla).select('*').order('server_updated_at', { ascending: true }).range(i, i + 999)
    if (desde) q = q.gt('server_updated_at', desde)
    const { data, error } = await q
    if (error) throw error
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return filas
}

function avanzarCursor(tabla: Tabla, filas: Record<string, unknown>[]) {
  if (!filas.length) return
  const c = leerCursores()
  c[tabla] = filas[filas.length - 1].server_updated_at as string
  guardarCursores(c)
}

async function pull(_uid: string) {
  // Prendas
  const fPrendas = await bajar('prendas')
  for (const r of fPrendas) {
    const local = await db.prendas.get(r.id as string)
    const remota = Number(r.updated_at)
    if (local && local.synced === 0 && local.updatedAt > remota) continue
    let foto: Blob | null = null
    const path = (r.foto_path as string | null) ?? null
    if (!r.deleted) {
      if (local?.foto && local.fotoPath === path) foto = local.foto
      else if (path) foto = await descargarFoto(path)
      else foto = local?.foto ?? null
    }
    const p: Prenda = {
      id: r.id as string,
      nombre: (r.nombre as string) ?? '',
      tipo: r.tipo as Prenda['tipo'],
      parte: r.parte as Prenda['parte'],
      color: (r.color as string) ?? '',
      tela: (r.tela as string) ?? '',
      clima: (r.clima as Prenda['clima']) ?? [],
      ocasiones: (r.ocasiones as Prenda['ocasiones']) ?? [],
      vecesUsada: Number(r.veces_usada ?? 0),
      ultimoUso: r.ultimo_uso != null ? Number(r.ultimo_uso) : null,
      fechaAlta: Number(r.fecha_alta),
      updatedAt: remota,
      deleted: r.deleted ? 1 : 0,
      synced: 1,
      foto,
      fotoPath: path,
    }
    await db.prendas.put(p)
  }
  avanzarCursor('prendas', fPrendas)

  // Looks
  const fLooks = await bajar('looks')
  for (const r of fLooks) {
    const local = await db.looks.get(r.id as string)
    const remota = Number(r.updated_at)
    if (local && local.synced === 0 && local.updatedAt > remota) continue
    const l: Look = {
      id: r.id as string,
      prendaIds: (r.prenda_ids as string[]) ?? [],
      ocasion: r.ocasion as Look['ocasion'],
      nota: (r.nota as string) ?? '',
      fecha: Number(r.fecha),
      favorito: !!r.favorito,
      guardado: !!r.guardado,
      updatedAt: remota,
      deleted: r.deleted ? 1 : 0,
      synced: 1,
    }
    await db.looks.put(l)
  }
  avanzarCursor('looks', fLooks)

  // Usos
  const fUsos = await bajar('usos')
  for (const r of fUsos) {
    const local = await db.usos.get(r.id as string)
    const remota = Number(r.updated_at)
    if (local && local.synced === 0 && local.updatedAt > remota) continue
    const u: Uso = {
      id: r.id as string,
      fecha: Number(r.fecha),
      lookId: r.look_id as string,
      updatedAt: remota,
      deleted: r.deleted ? 1 : 0,
      synced: 1,
    }
    await db.usos.put(u)
  }
  avanzarCursor('usos', fUsos)

  // Viajes
  const fViajes = await bajar('viajes')
  for (const r of fViajes) {
    const local = await db.viajes.get(r.id as string)
    const remota = Number(r.updated_at)
    if (local && local.synced === 0 && local.updatedAt > remota) continue
    const mismasFechas = local && local.desde === r.desde && local.hasta === r.hasta && local.lat === Number(r.lat) && local.lon === Number(r.lon)
    const v: Viaje = {
      id: r.id as string,
      nombre: (r.nombre as string) ?? '',
      destino: r.destino as string,
      lat: Number(r.lat),
      lon: Number(r.lon),
      desde: r.desde as string,
      hasta: r.hasta as string,
      prendaIds: (r.prenda_ids as string[]) ?? [],
      ocasion: (r.ocasion as Viaje['ocasion']) ?? 'Finde',
      pronostico: mismasFechas ? local!.pronostico : [],
      pronosticoAt: mismasFechas ? local!.pronosticoAt : null,
      updatedAt: remota,
      deleted: r.deleted ? 1 : 0,
      synced: 1,
    }
    await db.viajes.put(v)
  }
  avanzarCursor('viajes', fViajes)
}

async function descargarFoto(path: string): Promise<Blob | null> {
  const { data, error } = await supabase!.storage.from(BUCKET).download(path)
  if (error) {
    console.warn('No se pudo bajar la foto', path, error)
    return null
  }
  return data
}

async function repararFotos() {
  const faltan = await db.prendas.filter((p) => !p.deleted && !p.foto && !!p.fotoPath).toArray()
  for (const p of faltan) {
    const foto = await descargarFoto(p.fotoPath!)
    if (foto) await db.prendas.update(p.id, { foto })
  }
}

// ---------- PUSH ----------

/** Marca como sincronizado solo si nadie lo volvió a tocar mientras subíamos. */
async function marcarSubido<T extends { updatedAt: number }>(
  tabla: typeof db.prendas | typeof db.looks | typeof db.usos | typeof db.viajes,
  id: string,
  updatedAt: number,
  extra: Partial<T> = {},
) {
  await db.transaction('rw', tabla, async () => {
    const actual = (await (tabla as typeof db.looks).get(id)) as unknown as T | undefined
    if (actual && actual.updatedAt === updatedAt) await (tabla as typeof db.looks).update(id, { ...extra, synced: 1 })
    else if (actual && Object.keys(extra).length) await (tabla as typeof db.looks).update(id, extra)
  })
}

async function push(uid: string) {
  const sb = supabase!

  const prendas = await db.prendas.where('synced').equals(0).toArray()
  for (const p of prendas) {
    let fotoPath = p.fotoPath
    if (p.deleted) {
      if (fotoPath) await sb.storage.from(BUCKET).remove([fotoPath])
    } else if (p.foto && !fotoPath) {
      const ext = p.foto.type === 'image/webp' ? 'webp' : 'jpg'
      fotoPath = `${uid}/${p.id}-${p.updatedAt}.${ext}`
      const { error } = await sb.storage.from(BUCKET).upload(fotoPath, p.foto, { contentType: p.foto.type, upsert: true })
      if (error) throw error
    }
    const { error } = await sb.from('prendas').upsert({
      user_id: uid,
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      parte: p.parte,
      color: p.color,
      tela: p.tela,
      clima: p.clima,
      ocasiones: p.ocasiones,
      veces_usada: p.vecesUsada,
      ultimo_uso: p.ultimoUso,
      fecha_alta: p.fechaAlta,
      foto_path: p.deleted ? null : fotoPath,
      updated_at: p.updatedAt,
      deleted: !!p.deleted,
    })
    if (error) throw error
    await marcarSubido<Prenda>(db.prendas, p.id, p.updatedAt, { fotoPath: p.deleted ? null : fotoPath })
  }

  const looks = await db.looks.where('synced').equals(0).toArray()
  if (looks.length) {
    const { error } = await sb.from('looks').upsert(
      looks.map((l) => ({
        user_id: uid,
        id: l.id,
        prenda_ids: l.prendaIds,
        ocasion: l.ocasion,
        nota: l.nota,
        fecha: l.fecha,
        favorito: l.favorito,
        guardado: l.guardado,
        updated_at: l.updatedAt,
        deleted: !!l.deleted,
      })),
    )
    if (error) throw error
    for (const l of looks) await marcarSubido<Look>(db.looks, l.id, l.updatedAt)
  }

  const usos = await db.usos.where('synced').equals(0).toArray()
  if (usos.length) {
    const { error } = await sb.from('usos').upsert(
      usos.map((u) => ({
        user_id: uid,
        id: u.id,
        fecha: u.fecha,
        look_id: u.lookId,
        updated_at: u.updatedAt,
        deleted: !!u.deleted,
      })),
    )
    if (error) throw error
    for (const u of usos) await marcarSubido<Uso>(db.usos, u.id, u.updatedAt)
  }

  const viajes = await db.viajes.where('synced').equals(0).toArray()
  if (viajes.length) {
    const { error } = await sb.from('viajes').upsert(
      viajes.map((v) => ({
        user_id: uid,
        id: v.id,
        nombre: v.nombre,
        destino: v.destino,
        lat: v.lat,
        lon: v.lon,
        desde: v.desde,
        hasta: v.hasta,
        prenda_ids: v.prendaIds,
        ocasion: v.ocasion,
        updated_at: v.updatedAt,
        deleted: !!v.deleted,
      })),
    )
    if (error) throw error
    for (const v of viajes) await marcarSubido<Viaje>(db.viajes, v.id, v.updatedAt)
  }
}

// ---------- ARRANQUE ----------

export function iniciarSync() {
  if (!supabase) return
  supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION') programarSync(300)
  })
  window.addEventListener('online', () => programarSync(300))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') programarSync(300)
  })
  const ultimo = ultimoSync()
  if (ultimo) setEstado({ tipo: 'listo', ultimo })
}
