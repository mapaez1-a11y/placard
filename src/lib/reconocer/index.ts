import { PARTE_POR_TIPO, PARTES_COMPLEMENTO, type Clima, type Ocasion, type Tipo } from '../types'
import { colorPrincipal } from './color'

/** Lo que la app cree que es la prenda. Todo es una sugerencia editable. */
export interface Reconocimiento {
  tipo: Tipo | null
  confianza: number
  color: string | null
  tela: string | null
  clima: Clima[]
  ocasiones: Ocasion[]
}

// Frases en inglés: el modelo (CLIP) entiende mejor así. Varias por tipo y se suman.
const FRASES_TIPO: [Tipo, string][] = [
  ['remera', 't-shirt'],
  ['remera', 'tank top'],
  ['remera', 'polo shirt'],
  ['blusa', "women's blouse"],
  ['camisa', 'button-up shirt'],
  ['sweater', 'sweater'],
  ['sweater', 'knit cardigan'],
  ['sweater', 'hoodie sweatshirt'],
  ['pantalón', 'trousers'],
  ['pantalón', 'jeans'],
  ['pantalón', 'leggings'],
  ['short', 'shorts'],
  ['pollera', 'skirt'],
  ['vestido', 'dress'],
  ['abrigo', 'coat'],
  ['abrigo', 'jacket'],
  ['abrigo', 'puffer jacket'],
  ['abrigo', 'blazer'],
  ['calzado', 'shoes'],
  ['calzado', 'sneakers'],
  ['calzado', 'boots'],
  ['calzado', 'sandals'],
  ['calzado', 'high heels'],
  ['cartera', 'handbag'],
  ['cartera', 'purse'],
  ['cartera', 'backpack'],
  ['cartera', 'tote bag'],
  ['aros', 'earrings'],
  ['collar', 'necklace'],
  ['cinturón', 'belt'],
]

const TELAS_ROPA: [string, string][] = [
  ['Jean', 'denim'],
  ['Algodón', 'cotton'],
  ['Lino', 'linen'],
  ['Seda', 'silk or satin'],
  ['Lana', 'knitted wool'],
  ['Cuero', 'leather'],
  ['Gasa', 'sheer chiffon'],
  ['Corderoy', 'corduroy'],
  ['Poliéster', 'shiny synthetic nylon'],
]

const MATERIALES_COMPLEMENTO: [string, string][] = [
  ['Oro', 'gold metal'],
  ['Plata', 'silver metal'],
  ['Perlas', 'pearls'],
  ['Cuero', 'leather'],
  ['Rafia', 'woven straw'],
  ['Tela', 'fabric'],
]

let worker: Worker | null = null
let siguienteId = 1

function obtenerWorker() {
  worker ??= new Worker(new URL('./modelo.worker.ts', import.meta.url), { type: 'module' })
  return worker
}

type Mensaje =
  | { id: number; tipo: 'progreso'; p: number }
  | { id: number; tipo: 'analizando' }
  | { id: number; tipo: 'ok'; respuestas: { label: string; score: number }[][] }
  | { id: number; tipo: 'error'; mensaje: string }

function preguntarAlModelo(
  foto: Blob,
  preguntas: { etiquetas: string[]; plantilla: string }[],
  alProgresar: (p: number) => void,
): Promise<{ label: string; score: number }[][]> {
  const w = obtenerWorker()
  const id = siguienteId++
  return new Promise((resolver, rechazar) => {
    const escuchar = (e: MessageEvent<Mensaje>) => {
      const m = e.data
      if (m.id !== id) return
      if (m.tipo === 'progreso') alProgresar(m.p)
      else if (m.tipo === 'analizando') alProgresar(1)
      else {
        w.removeEventListener('message', escuchar)
        if (m.tipo === 'ok') resolver(m.respuestas)
        else rechazar(new Error(m.mensaje))
      }
    }
    w.addEventListener('message', escuchar)
    w.postMessage({ id, foto, preguntas })
  })
}

/** Color al instante (no necesita el modelo) */
export const reconocerColor = colorPrincipal

/** Tipo y tela con el modelo. La primera vez lo descarga (unos 150 MB) y queda guardado. */
export async function reconocerPrenda(foto: Blob, alProgresar: (p: number) => void): Promise<Omit<Reconocimiento, 'color'>> {
  // 1) ¿Qué es?
  const [rTipo] = await preguntarAlModelo(
    foto,
    [{ etiquetas: FRASES_TIPO.map(([, f]) => f), plantilla: 'a product photo of {}' }],
    alProgresar,
  )
  const puntos = new Map<Tipo, number>()
  for (const r of rTipo) {
    const tipo = FRASES_TIPO.find(([, f]) => f === r.label)?.[0]
    if (tipo) puntos.set(tipo, (puntos.get(tipo) ?? 0) + r.score)
  }
  const [tipo, confianza] = [...puntos.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0]
  if (!tipo || confianza < 0.25) return { tipo: null, confianza, tela: null, clima: [], ocasiones: [] }

  // 2) ¿De qué material?
  const esComplemento = PARTES_COMPLEMENTO.includes(PARTE_POR_TIPO[tipo]) || tipo === 'calzado'
  const opciones = esComplemento ? MATERIALES_COMPLEMENTO : TELAS_ROPA
  const [rTela] = await preguntarAlModelo(
    foto,
    [{ etiquetas: opciones.map(([, f]) => f), plantilla: esComplemento ? 'a photo of an accessory made of {}' : 'a close-up photo of clothing made of {}' }],
    () => {},
  )
  let tela: string | null = null
  const mejor = rTela[0]
  if (mejor && mejor.score >= 0.3) tela = opciones.find(([, f]) => f === mejor.label)?.[0] ?? null
  // Si el modelo dijo "jeans" para el pantalón, la tela es jean aunque la otra pregunta dude
  const dijoJean = rTipo.find((r) => r.label === 'jeans')
  if (tipo === 'pantalón' && dijoJean && dijoJean.score > 0.2) tela = 'Jean'
  if (tela === 'Tela' && esComplemento) tela = null

  return { tipo, confianza, tela, clima: climaSugerido(tipo, tela), ocasiones: ocasionesSugeridas(tipo, tela) }
}

export function climaSugerido(tipo: Tipo, tela: string | null): Clima[] {
  const t = (tela ?? '').toLowerCase()
  if (['calzado', 'cartera', 'aros', 'collar', 'cinturón'].includes(tipo)) return ['Calor', 'Templado', 'Frío']
  if (t === 'lana' || t === 'corderoy' || t === 'cuero') return ['Templado', 'Frío']
  if (t === 'lino' || t === 'gasa') return ['Calor']
  switch (tipo) {
    case 'remera':
    case 'blusa':
    case 'camisa':
      return ['Calor', 'Templado']
    case 'short':
      return ['Calor']
    case 'sweater':
      return ['Templado', 'Frío']
    case 'abrigo':
      return ['Frío', 'Templado']
    case 'pantalón':
      return t === 'jean' ? ['Calor', 'Templado', 'Frío'] : ['Templado', 'Frío']
    case 'pollera':
    case 'vestido':
      return ['Calor', 'Templado']
    default:
      return ['Templado']
  }
}

export function ocasionesSugeridas(tipo: Tipo, tela: string | null): Ocasion[] {
  const jean = (tela ?? '').toLowerCase() === 'jean'
  switch (tipo) {
    case 'blusa':
    case 'camisa':
      return ['Trabajo', 'Salida']
    case 'remera':
      return ['Finde', 'Casa']
    case 'short':
      return ['Finde', 'Casa']
    case 'sweater':
      return ['Trabajo', 'Finde', 'Casa']
    case 'pantalón':
      return jean ? ['Finde', 'Salida'] : ['Trabajo', 'Salida']
    case 'pollera':
    case 'vestido':
      return ['Salida', 'Finde']
    default:
      return ['Trabajo', 'Salida', 'Finde']
  }
}

// ---------- Preferencia: se puede apagar en Ajustes (ahorra datos) ----------
const CLAVE = 'placard.reconocer'
export const reconocimientoActivo = () => {
  try {
    return localStorage.getItem(CLAVE) !== 'no'
  } catch {
    return true
  }
}
export const setReconocimientoActivo = (si: boolean) => {
  try {
    localStorage.setItem(CLAVE, si ? 'si' : 'no')
  } catch {
    /* nada */
  }
}
