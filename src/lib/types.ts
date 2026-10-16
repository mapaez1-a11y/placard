export const TIPOS = ['blusa', 'camisa', 'remera', 'sweater', 'pantalón', 'short', 'pollera', 'vestido', 'abrigo', 'calzado', 'cartera', 'aros', 'collar', 'cinturón'] as const
export type Tipo = (typeof TIPOS)[number]

export const PARTES = ['Arriba', 'Abajo', 'Entero', 'Abrigo', 'Calzado', 'Cartera', 'Accesorio', 'Cinturón'] as const
export type Parte = (typeof PARTES)[number]

export const CLIMAS = ['Calor', 'Templado', 'Frío'] as const
export type Clima = (typeof CLIMAS)[number]

export const OCASIONES = ['Trabajo', 'Salida', 'Finde', 'Casa'] as const
export type Ocasion = (typeof OCASIONES)[number]

/** 0/1 en vez de boolean para poder indexar en IndexedDB */
type Flag = 0 | 1

export interface Prenda {
  id: string
  foto: Blob | null
  nombre: string
  tipo: Tipo
  parte: Parte
  color: string
  tela: string
  clima: Clima[]
  ocasiones: Ocasion[]
  vecesUsada: number
  ultimoUso: number | null
  fechaAlta: number
  // sincronización
  updatedAt: number
  synced: Flag
  deleted: Flag
  fotoPath: string | null // ruta en Supabase Storage de la foto ya subida
}

export interface Look {
  id: string
  prendaIds: string[]
  ocasion: Ocasion
  nota: string
  fecha: number
  favorito: boolean
  /** true = guardado por vos; false = solo quedó en el historial al usarlo */
  guardado: boolean
  updatedAt: number
  synced: Flag
  deleted: Flag
}

export interface Uso {
  id: string
  fecha: number
  lookId: string
  updatedAt: number
  synced: Flag
  deleted: Flag
}

export const PARTE_POR_TIPO: Record<Tipo, Parte> = {
  blusa: 'Arriba',
  camisa: 'Arriba',
  remera: 'Arriba',
  sweater: 'Arriba',
  pantalón: 'Abajo',
  short: 'Abajo',
  pollera: 'Abajo',
  vestido: 'Entero',
  abrigo: 'Abrigo',
  calzado: 'Calzado',
  cartera: 'Cartera',
  aros: 'Accesorio',
  collar: 'Accesorio',
  cinturón: 'Cinturón',
}

/** Partes que forman la base del look (lo que va "puesto") */
export const PARTES_BASE: Parte[] = ['Arriba', 'Abajo', 'Entero']
export const esBase = (p: { parte: Parte }) => PARTES_BASE.includes(p.parte)
/** Carteras, accesorios y cinturones: no dependen del clima */
export const PARTES_COMPLEMENTO: Parte[] = ['Cartera', 'Accesorio', 'Cinturón']

export interface DiaClima {
  fecha: string // YYYY-MM-DD
  min: number
  max: number
  codigo: number
  /** true = estimado con el clima del año pasado (viaje a más de 16 días) */
  estimado: boolean
}

export interface Viaje {
  id: string
  nombre: string
  destino: string
  lat: number
  lon: number
  desde: string // YYYY-MM-DD
  hasta: string
  prendaIds: string[]
  ocasion: Ocasion
  pronostico: DiaClima[]
  pronosticoAt: number | null
  updatedAt: number
  synced: Flag
  deleted: Flag
}
