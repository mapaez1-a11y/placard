import type { Ocasion } from './types'

// localStorage solo para preferencias chicas.
const K = {
  ocasion: 'placard.ocasion',
  ciudad: 'placard.ciudad',
  clima: 'placard.climaCache',
  syncCursor: 'placard.syncCursor',
}

function leer<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function escribir(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* sin espacio o modo privado: no pasa nada */
  }
}

export interface CiudadPref {
  modo: 'auto' | 'manual'
  nombre: string
  lat: number
  lon: number
}

export const prefs = {
  getOcasion: () => leer<Ocasion>(K.ocasion, 'Trabajo'),
  setOcasion: (o: Ocasion) => escribir(K.ocasion, o),
  getCiudad: () => leer<CiudadPref | null>(K.ciudad, null),
  setCiudad: (c: CiudadPref | null) => escribir(K.ciudad, c),
  getUltimaUbicacion: () => leer<CiudadPref | null>('placard.ultimaUbicacion', null),
  setUltimaUbicacion: (c: CiudadPref) => escribir('placard.ultimaUbicacion', c),
  getClimaCache: <T>() => leer<T | null>(K.clima, null),
  setClimaCache: (c: unknown) => escribir(K.clima, c),
  getSyncCursor: () => leer<string | null>(K.syncCursor, null),
  setSyncCursor: (c: string | null) => escribir(K.syncCursor, c),
  todas: () => ({ ocasion: leer(K.ocasion, null), ciudad: leer(K.ciudad, null) }),
  restaurar: (p: { ocasion?: unknown; ciudad?: unknown }) => {
    if (p.ocasion) escribir(K.ocasion, p.ocasion)
    if (p.ciudad) escribir(K.ciudad, p.ciudad)
  },
}
