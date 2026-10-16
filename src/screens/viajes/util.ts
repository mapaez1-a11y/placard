import type { Viaje } from '../../lib/types'
import { desdeIso, isoDia } from '../../lib/weather'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const diaCorto = (iso: string) => {
  const d = desdeIso(iso)
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}
export const diaSemana = (iso: string) => DIAS[desdeIso(iso).getDay()]

export const rangoFechas = (v: Pick<Viaje, 'desde' | 'hasta'>) =>
  v.desde === v.hasta ? diaCorto(v.desde) : `${diaCorto(v.desde)} – ${diaCorto(v.hasta)}`

export function estadoViaje(v: Pick<Viaje, 'desde' | 'hasta'>): { texto: string; tipo: 'futuro' | 'ahora' | 'pasado' } {
  const hoy = desdeIso(isoDia(new Date())).getTime()
  const ini = desdeIso(v.desde).getTime()
  const fin = desdeIso(v.hasta).getTime()
  const dia = 86_400_000
  if (hoy < ini) {
    const n = Math.round((ini - hoy) / dia)
    return { texto: n === 1 ? 'Mañana' : `En ${n} días`, tipo: 'futuro' }
  }
  if (hoy <= fin) {
    const total = Math.round((fin - ini) / dia) + 1
    const n = Math.round((hoy - ini) / dia) + 1
    return { texto: `En curso · día ${n} de ${total}`, tipo: 'ahora' }
  }
  return { texto: 'Terminado', tipo: 'pasado' }
}

/** El pronóstico se vuelve a pedir si tiene más de 3 horas o no cubre todas las fechas */
export const pronosticoViejo = (v: Viaje, cantDias: number) =>
  !v.pronosticoAt || Date.now() - v.pronosticoAt > 3 * 3_600_000 || v.pronostico.length < cantDias
