import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db'

export function usePrendas() {
  return useLiveQuery(async () => {
    const ps = await db.prendas.where('deleted').equals(0).toArray()
    return ps.sort((a, b) => b.fechaAlta - a.fechaAlta)
  })
}

export function useLooks() {
  return useLiveQuery(async () => {
    const ls = await db.looks.where('deleted').equals(0).toArray()
    return ls.sort((a, b) => b.fecha - a.fecha)
  })
}

export function useViajes() {
  return useLiveQuery(async () => {
    const vs = await db.viajes.where('deleted').equals(0).toArray()
    return vs.sort((a, b) => a.desde.localeCompare(b.desde))
  })
}

export function useUsos() {
  return useLiveQuery(() => db.usos.where('deleted').equals(0).toArray())
}

/** URL temporal para mostrar un Blob en un <img>, liberada al desmontar. */
export function useBlobUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return setUrl(null)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "Martes 7 oct" */
export function fechaCorta(d = new Date()) {
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`
}

export function textoUso(veces: number) {
  if (veces === 0) return 'Nunca usado'
  if (veces === 1) return 'Usada 1 vez'
  return `Usada ${veces} veces`
}

export function haceCuanto(ts: number | null) {
  if (!ts) return 'Nunca'
  const dias = Math.floor((Date.now() - ts) / 86_400_000)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}

export const esHoy = (ts: number) => new Date(ts).toDateString() === new Date().toDateString()
