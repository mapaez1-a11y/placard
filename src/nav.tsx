import type { Tipo } from './lib/types'
import { createContext, useContext } from 'react'

export type Tab = 'hoy' | 'armar' | 'placard' | 'viajes' | 'favoritos' | 'agregar'
export type Capa = { tipo: 'prenda'; id: string } | { tipo: 'editar'; id: string } | { tipo: 'ajustes' } | { tipo: 'look'; id: string }
  | { tipo: 'nueva'; tipoInicial: Tipo }
  | { tipo: 'viaje'; id: string }
  | { tipo: 'viaje-editar'; id?: string }
  | { tipo: 'valija'; id: string }

export interface Nav {
  tab: Tab
  ir: (t: Tab) => void
  abrir: (c: Capa) => void
  cerrar: () => void
  /** Cambia la capa de arriba por otra, sin sumar un paso al botón atrás */
  reemplazar: (c: Capa) => void
  aviso: (texto: string) => void
}

export const NavContext = createContext<Nav>(null!)
export const useNav = () => useContext(NavContext)
