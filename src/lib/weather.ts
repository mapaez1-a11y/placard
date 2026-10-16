import { prefs, type CiudadPref } from './prefs'
import type { Clima, DiaClima } from './types'

export interface ClimaHoy {
  ciudad: string
  actual: number
  min: number
  max: number
  codigo: number
  actualizado: number
  /** gps = ubicación actual del celular; respaldo = ciudad elegida en Ajustes o la última conocida */
  fuente: 'gps' | 'respaldo'
  offline?: boolean
}

const BUENOS_AIRES: CiudadPref = { modo: 'auto', nombre: 'Buenos Aires', lat: -34.6037, lon: -58.3816 }

/** ≥ 20° Calor, 14–19° Templado, < 14° Frío */
export function climaPorTemp(t: number): Clima {
  const r = Math.round(t)
  if (r >= 20) return 'Calor'
  if (r >= 14) return 'Templado'
  return 'Frío'
}

export function descripcionCodigo(c: number): string {
  if (c === 0) return 'Despejado'
  if (c <= 2) return 'Algo nublado'
  if (c === 3) return 'Nublado'
  if (c <= 48) return 'Niebla'
  if (c <= 57) return 'Llovizna'
  if (c <= 67) return 'Lluvia'
  if (c <= 77) return 'Nieve'
  if (c <= 82) return 'Chaparrones'
  return 'Tormenta'
}

export const esLluvia = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 99)

function posicion(): Promise<GeolocationPosition | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null)
    navigator.geolocation.getCurrentPosition(res, () => res(null), {
      timeout: 10000,
      maximumAge: 5 * 60 * 1000, // ubicación fresca: si viajaste, se entera al abrir
      enableHighAccuracy: false,
    })
  })
}

async function nombreCiudad(lat: number, lon: number): Promise<string> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`,
    )
    const j = await r.json()
    return j.city || j.locality || j.principalSubdivision || 'Tu ubicación'
  } catch {
    return 'Tu ubicación'
  }
}

/** Siempre intenta la ubicación actual. Si no hay permiso, usa la ciudad de respaldo. */
async function ubicacion(): Promise<{ lugar: CiudadPref; fuente: 'gps' | 'respaldo' }> {
  const pos = await posicion()
  if (pos) {
    const lat = +pos.coords.latitude.toFixed(3)
    const lon = +pos.coords.longitude.toFixed(3)
    const ultima = prefs.getUltimaUbicacion()
    // Si casi no te moviste, no volvemos a buscar el nombre de la ciudad
    if (ultima && Math.abs(ultima.lat - lat) < 0.05 && Math.abs(ultima.lon - lon) < 0.05) return { lugar: ultima, fuente: 'gps' }
    const lugar: CiudadPref = { modo: 'auto', nombre: await nombreCiudad(lat, lon), lat, lon }
    prefs.setUltimaUbicacion(lugar)
    return { lugar, fuente: 'gps' }
  }
  return { lugar: prefs.getCiudad() ?? prefs.getUltimaUbicacion() ?? BUENOS_AIRES, fuente: 'respaldo' }
}

export async function obtenerClima(): Promise<ClimaHoy> {
  const cache = prefs.getClimaCache<ClimaHoy>()
  try {
    const { lugar: u, fuente } = await ubicacion()
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${u.lat}&longitude=${u.lon}` +
      `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&forecast_days=1`
    const r = await fetch(url)
    if (!r.ok) throw new Error('clima')
    const j = await r.json()
    const clima: ClimaHoy = {
      ciudad: u.nombre,
      actual: Math.round(j.current.temperature_2m),
      codigo: j.current.weather_code,
      min: Math.round(j.daily.temperature_2m_min[0]),
      max: Math.round(j.daily.temperature_2m_max[0]),
      actualizado: Date.now(),
      fuente,
    }
    prefs.setClimaCache(clima)
    return clima
  } catch {
    if (cache) return { ...cache, offline: true }
    return { ciudad: 'Sin conexión', actual: 18, min: 14, max: 20, codigo: 2, actualizado: Date.now(), fuente: 'respaldo', offline: true }
  }
}

export async function buscarCiudad(nombre: string): Promise<CiudadPref[]> {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nombre)}&count=6&language=es`,
  )
  const j = await r.json()
  return (j.results ?? []).map((c: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }) => ({
    modo: 'manual' as const,
    nombre: [c.name, c.admin1 && c.admin1 !== c.name ? c.admin1 : null, c.country].filter(Boolean).join(', '),
    lat: c.latitude,
    lon: c.longitude,
  }))
}

// ---------- Pronóstico para un viaje ----------

const DIA = 86_400_000
export const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const desdeIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  const fin = desdeIso(hasta).getTime()
  for (let t = desdeIso(desde).getTime(); t <= fin && out.length < 31; t += DIA) out.push(isoDia(new Date(t)))
  return out
}

type Diario = { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] }

/**
 * Hasta 16 días adelante usa el pronóstico real.
 * Más lejos, estima con lo que hizo esos mismos días el año pasado.
 */
export async function pronosticoViaje(lat: number, lon: number, desde: string, hasta: string): Promise<DiaClima[]> {
  const dias = diasEntre(desde, hasta)
  const hoy = desdeIso(isoDia(new Date())).getTime()
  const limite = hoy + 15 * DIA
  const cercanos = dias.filter((d) => desdeIso(d).getTime() <= limite && desdeIso(d).getTime() >= hoy)
  const lejanos = dias.filter((d) => !cercanos.includes(d))
  const res = new Map<string, DiaClima>()
  const params = `latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`

  if (cercanos.length) {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}&start_date=${cercanos[0]}&end_date=${cercanos[cercanos.length - 1]}`)
    if (!r.ok) throw new Error('No pude traer el pronóstico')
    const j = (await r.json()).daily as Diario
    j.time.forEach((t, i) =>
      res.set(t, { fecha: t, min: Math.round(j.temperature_2m_min[i]), max: Math.round(j.temperature_2m_max[i]), codigo: j.weather_code[i] ?? 2, estimado: false }),
    )
  }

  if (lejanos.length) {
    const haceUnAnio = (s: string) => {
      const d = desdeIso(s)
      d.setFullYear(d.getFullYear() - 1)
      // si el viaje es en el pasado reciente (archivo con demora), seguimos un año antes igual
      return isoDia(d)
    }
    const ini = haceUnAnio(lejanos[0])
    const fin = haceUnAnio(lejanos[lejanos.length - 1])
    const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}&start_date=${ini}&end_date=${fin}`)
    if (!r.ok) throw new Error('No pude estimar el clima')
    const j = (await r.json()).daily as Diario
    const porFecha = new Map(j.time.map((t, i) => [t, i]))
    for (const d of lejanos) {
      const i = porFecha.get(haceUnAnio(d))
      if (i === undefined || j.temperature_2m_max[i] == null) continue
      res.set(d, { fecha: d, min: Math.round(j.temperature_2m_min[i]), max: Math.round(j.temperature_2m_max[i]), codigo: j.weather_code[i] ?? 2, estimado: true })
    }
  }
  return dias.map((d) => res.get(d)).filter((x): x is DiaClima => !!x)
}
