import { esCapa, type Clima, type DiaClima, type Look, type Ocasion, type Prenda, type Uso } from './types'
import { climaPorTemp, desdeIso, esLluvia } from './weather'

const DIA = 86_400_000

export interface Sugerencia {
  prendas: Prenda[] // [arriba, abajo] o [entero]
  abrigo: Prenda | null
  calzado: Prenda | null
  /** cartera, aros, collar y cinturón, si tenés */
  complementos: Prenda[]
  motivo: string
  avisoFrio: string | null
  aviso: string | null // si hubo que relajar filtros
}

export interface ResultadoSugerencias {
  opciones: Sugerencia[]
  faltan: string | null // por qué no se puede sugerir
  clima: Clima
}

export const claveLook = (ids: string[]) => [...ids].sort().join('|')

/** Más alto = más conviene usarla: poco usada o hace mucho que no sale del placard. */
function puntaje(p: Prenda, ahora: number) {
  const dias = p.ultimoUso ? (ahora - p.ultimoUso) / DIA : 45
  return Math.min(dias, 45) - p.vecesUsada * 1.5 + (p.vecesUsada === 0 ? 8 : 0)
}

/** Pseudoaleatorio estable por día, para desempatar sin que cambie a cada render */
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

function filtrar(prendas: Prenda[], clima: Clima, ocasion: Ocasion) {
  const ambos = prendas.filter((p) => p.clima.includes(clima) && p.ocasiones.includes(ocasion))
  return ambos
}

export function sugerir(
  prendas: Prenda[],
  looks: Look[],
  usos: Uso[],
  temps: { max: number; min: number },
  ocasion: Ocasion,
  ahora = Date.now(),
): ResultadoSugerencias {
  const clima = climaPorTemp(temps.max)
  const arribaTodas = prendas.filter((p) => p.parte === 'Arriba')
  const abajoTodas = prendas.filter((p) => p.parte === 'Abajo')
  const enteroTodas = prendas.filter((p) => p.parte === 'Entero')

  if (!(arribaTodas.length && abajoTodas.length) && !enteroTodas.length) {
    const falta = !arribaTodas.length && !abajoTodas.length ? 'una prenda de arriba y una de abajo' : !arribaTodas.length ? 'una prenda de arriba' : 'una prenda de abajo'
    return { opciones: [], clima, faltan: `Para armar looks necesitás al menos ${falta}.` }
  }

  // Filtro por clima + ocasión; si no alcanza, relajamos de a poco.
  const niveles: { set: (ps: Prenda[]) => Prenda[]; aviso: string | null }[] = [
    { set: (ps) => filtrar(ps, clima, ocasion), aviso: null },
    { set: (ps) => ps.filter((p) => p.clima.includes(clima)), aviso: `No tenés suficientes prendas marcadas para ${ocasion.toLowerCase()}: te muestro opciones para el clima.` },
    { set: (ps) => ps.filter((p) => p.ocasiones.includes(ocasion)), aviso: `No tenés suficientes prendas para ${clima.toLowerCase()}: te muestro opciones para la ocasión.` },
    { set: (ps) => ps, aviso: 'Pocas prendas coinciden con el clima y la ocasión: te muestro todo lo que tenés.' },
  ]

  // Looks usados en los últimos 3 días
  const lookPorId = new Map(looks.map((l) => [l.id, l]))
  const recientes = new Set(
    usos
      .filter((u) => ahora - u.fecha < 3 * DIA)
      .map((u) => lookPorId.get(u.lookId))
      .filter((l): l is Look => !!l)
      .map((l) => claveLook(l.prendaIds.filter((id) => prendas.find((p) => p.id === id && (p.parte === 'Arriba' || p.parte === 'Abajo' || p.parte === 'Entero'))))),
  )

  const semillaDia = new Date(ahora).toDateString() + ocasion

  for (const nivel of niveles) {
    const arriba = nivel.set(arribaTodas)
    const abajo = nivel.set(abajoTodas)
    const entero = nivel.set(enteroTodas)

    const combos: { prendas: Prenda[]; score: number }[] = []
    for (const a of arriba) for (const b of abajo) combos.push({ prendas: [a, b], score: (puntaje(a, ahora) + puntaje(b, ahora)) / 2 })
    for (const e of entero) combos.push({ prendas: [e], score: puntaje(e, ahora) })

    let validos = combos.filter((c) => !recientes.has(claveLook(c.prendas.map((p) => p.id))))
    if (!validos.length) continue
    validos = validos
      .map((c) => ({ ...c, score: c.score + hash(semillaDia + claveLook(c.prendas.map((p) => p.id))) * 3 }))
      .sort((x, y) => y.score - x.score)
      .slice(0, 60)

    // Mucho frío: primero abrigo; fresco: primero chaqueta
    const prefiere = temps.min < 10 ? 'Abrigo' : 'Chaqueta'
    const abrigos = elegirAccesorios(prendas.filter(esCapa), ocasion, ahora, ['Frío', 'Templado']).sort(
      (a, b) => Number(b.parte === prefiere) - Number(a.parte === prefiere),
    )
    const calzados = elegirAccesorios(prendas.filter((p) => p.parte === 'Calzado'), ocasion, ahora, [clima])
    const necesitaAbrigo = temps.min < 16
    const porTipo = (tipo: string) => elegirComplementos(prendas.filter((p) => p.tipo === tipo), ocasion, ahora)
    const carteras = porTipo('cartera')
    const aros = porTipo('aros')
    const collares = porTipo('collar')
    const cinturones = porTipo('cinturón')
    const rota = (lista: Prenda[], i: number) => (lista.length ? [lista[i % lista.length]] : [])

    const opciones = validos.map((c, i): Sugerencia => {
      const abrigo = necesitaAbrigo && abrigos.length ? abrigos[i % abrigos.length] : null
      // El cinturón va con pantalón, pollera o vestido; no con una remera sola
      const llevaCinturon = c.prendas.some((p) => p.tipo === 'pantalón' || p.tipo === 'pollera' || p.tipo === 'vestido' || p.tipo === 'short')
      return {
        prendas: c.prendas,
        abrigo,
        calzado: calzados.length ? calzados[i % calzados.length] : null,
        complementos: [...rota(carteras, i), ...rota(aros, i), ...rota(collares, i), ...(llevaCinturon ? rota(cinturones, i) : [])],
        motivo: motivo(c.prendas, clima, ahora),
        avisoFrio: necesitaAbrigo
          ? abrigo
            ? `A la mañana hace frío: sumá ${abrigo.parte === 'Chaqueta' ? 'una chaqueta' : 'un abrigo'}.`
            : 'A la mañana hace frío: sumá un abrigo (todavía no cargaste ninguno).'
          : null,
        aviso: nivel.aviso,
      }
    })
    return { opciones, clima, faltan: null }
  }

  return {
    opciones: [],
    clima,
    faltan: 'Ya usaste todas tus combinaciones en los últimos 3 días. Sumá prendas o probá otra ocasión.',
  }
}

/** Carteras y accesorios: no dependen del clima, solo de la ocasión */
function elegirComplementos(ps: Prenda[], ocasion: Ocasion, ahora: number) {
  const mejores = ps.filter((p) => p.ocasiones.includes(ocasion))
  const base = mejores.length ? mejores : ps
  return [...base].sort((a, b) => puntaje(b, ahora) - puntaje(a, ahora))
}

/** Todo lo que se suma a la base del look */
export const extrasDe = (s: Sugerencia) => [s.abrigo, s.calzado, ...s.complementos].filter((p): p is Prenda => !!p)

function elegirAccesorios(ps: Prenda[], ocasion: Ocasion, ahora: number, climas: Clima[]) {
  const mejores = ps.filter((p) => p.ocasiones.includes(ocasion) && p.clima.some((c) => climas.includes(c)))
  const base = mejores.length ? mejores : ps
  return [...base].sort((a, b) => puntaje(b, ahora) - puntaje(a, ahora))
}

const CIERRE: Record<Clima, string> = {
  Calor: 'frescos para el mediodía',
  Templado: 'livianos para un día templado',
  Frío: 'abrigados para un día frío',
}

const CIERRE_UNA: Record<Clima, string> = {
  Calor: 'fresco para el mediodía',
  Templado: 'liviano para un día templado',
  Frío: 'abrigado para un día frío',
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function describe(p: Prenda) {
  return p.tela ? `${p.tipo} de ${p.tela.toLowerCase()}` : p.nombre.toLowerCase()
}

function motivo(ps: Prenda[], clima: Clima, ahora: number) {
  let base: string
  if (ps.length === 1) base = `${cap(describe(ps[0]))}: ${CIERRE_UNA[clima]}`
  else {
    const [a, b] = ps
    base =
      a.tela && b.tela && a.tela.toLowerCase() !== b.tela.toLowerCase()
        ? `${cap(a.tipo)} de ${a.tela.toLowerCase()} y ${b.tela.toLowerCase()}: ${CIERRE[clima]}`
        : `${cap(describe(a))} y ${describe(b)}: ${CIERRE[clima]}`
  }
  const nueva = ps.find((p) => p.vecesUsada === 0)
  if (nueva) return `${base}. ${cap(nueva.nombre)}: todavía sin estrenar.`
  const olvidada = ps.find((p) => p.ultimoUso && ahora - p.ultimoUso > 14 * DIA)
  if (olvidada) return `${base}. Hace ${Math.floor((ahora - olvidada.ultimoUso!) / DIA)} días que no usás ${olvidada.nombre.toLowerCase()}.`
  return `${base}.`
}

/** Nota corta sobre una combinación, para la pantalla Armar */
const NEUTROS = ['negro', 'blanco', 'beige', 'gris', 'crema', 'camel', 'azul marino', 'marino', 'jean', 'denim', 'natural', 'arena', 'hueso', 'nude']

export function notaCombinacion(a: Prenda, b: Prenda | null): string {
  if (!b) return a.parte === 'Entero' ? 'Una sola prenda resuelve el look: sumale calzado y listo.' : ''
  const ca = a.color.trim().toLowerCase()
  const cb = b.color.trim().toLowerCase()
  const climasComunes = a.clima.filter((c) => b.clima.includes(c))
  const ocasComunes = a.ocasiones.filter((o) => b.ocasiones.includes(o))
  const partes: string[] = []

  if (ca && ca === cb) partes.push(`Total look ${ca}: alargá la silueta`)
  else if (NEUTROS.some((n) => ca.includes(n)) && NEUTROS.some((n) => cb.includes(n))) partes.push('Dos neutros: base segura que combina con todo')
  else if (NEUTROS.some((n) => ca.includes(n) || cb.includes(n))) partes.push('Un neutro equilibra el color de la otra prenda')
  else if (ca && cb) partes.push(`${cap(ca)} con ${cb}: contraste con personalidad`)

  if (a.tela && b.tela && a.tela.toLowerCase() === b.tela.toLowerCase()) partes.push(`misma tela (${a.tela.toLowerCase()})`)

  if (!climasComunes.length && a.clima.length && b.clima.length) partes.push('ojo: no comparten clima')
  else if (climasComunes.length) partes.push(`ideal para ${climasComunes.join(' / ').toLowerCase()}`)

  if (ocasComunes.length) partes.push(`sirve para ${ocasComunes.join(', ').toLowerCase()}`)

  const s = partes.join('; ')
  return s ? cap(s) + '.' : ''
}

// ---------- Viajes ----------

export interface DiaPlan {
  dia: DiaClima
  sugerencia: Sugerencia | null
  faltan: string | null
}

/** Arma un look por día con lo que hay en la valija, rotando para no repetir. */
export function planViaje(valija: Prenda[], dias: DiaClima[], ocasion: Ocasion): DiaPlan[] {
  // Copias: "usamos" las prendas en la simulación para que la rotación sea pareja
  const copias = new Map(valija.map((p) => [p.id, { ...p }]))
  const usados = new Set<string>()
  return dias.map((dia) => {
    const ahora = desdeIso(dia.fecha).getTime() + 12 * 3_600_000
    const r = sugerir([...copias.values()], [], [], { max: dia.max, min: dia.min }, ocasion, ahora)
    if (!r.opciones.length) return { dia, sugerencia: null, faltan: r.faltan }
    let elegida = r.opciones.find((o) => !usados.has(claveLook(o.prendas.map((p) => p.id))))
    if (!elegida) {
      usados.clear()
      elegida = r.opciones[0]
    }
    usados.add(claveLook(elegida.prendas.map((p) => p.id)))
    for (const p of [...elegida.prendas, ...extrasDe(elegida)]) {
      const c = copias.get(p.id)
      if (c) {
        c.vecesUsada += 1
        c.ultimoUso = ahora
      }
    }
    return { dia, sugerencia: elegida, faltan: null }
  })
}

/** Avisos sobre lo que falta en la valija según el pronóstico */
export function faltantesValija(valija: Prenda[], dias: DiaClima[]): string[] {
  if (!dias.length) return []
  const avisos: string[] = []
  const base = valija.filter((p) => p.parte === 'Arriba' || p.parte === 'Abajo' || p.parte === 'Entero')
  const climas = [...new Set(dias.map((d) => climaPorTemp(d.max)))]
  for (const c of climas) {
    const n = dias.filter((d) => climaPorTemp(d.max) === c).length
    if (!base.some((p) => p.clima.includes(c))) avisos.push(`No llevás ropa para ${n === 1 ? 'el día' : `los ${n} días`} de ${c.toLowerCase()}.`)
  }
  const tieneArriba = base.some((p) => p.parte === 'Arriba')
  const tieneAbajo = base.some((p) => p.parte === 'Abajo')
  const tieneEntero = base.some((p) => p.parte === 'Entero')
  if (!tieneEntero && tieneArriba !== tieneAbajo) avisos.push(tieneArriba ? 'Te falta algo de abajo para combinar.' : 'Te falta algo de arriba para combinar.')
  const frias = dias.filter((d) => d.min < 16).length
  if (frias && !valija.some(esCapa)) avisos.push(`${frias === 1 ? 'Una mañana baja' : `${frias} mañanas bajan`} de 16°: sumá un abrigo o una chaqueta.`)
  const lluvia = dias.filter((d) => esLluvia(d.codigo)).length
  if (lluvia) avisos.push(`Pronostican lluvia ${lluvia === 1 ? 'un día' : `${lluvia} días`}: llevá calzado cerrado y paraguas.`)
  if (!valija.some((p) => p.parte === 'Calzado')) avisos.push('No elegiste calzado.')
  return avisos
}

/** Propone qué llevar: lo más versátil para los climas del viaje y la ocasión */
export function sugerirValija(placard: Prenda[], dias: DiaClima[], ocasion: Ocasion): string[] {
  const n = Math.max(dias.length, 1)
  const climas = [...new Set(dias.map((d) => climaPorTemp(d.max)))]
  const hayFrio = dias.some((d) => d.min < 16)
  const versatil = (p: Prenda) =>
    p.clima.filter((c) => climas.includes(c)).length * 3 + (p.ocasiones.includes(ocasion) ? 4 : 0) + p.ocasiones.length - p.vecesUsada * 0.05
  const tomar = (parte: Prenda['parte'], cant: number, exigirClima = true) => {
    const deEsaParte = placard.filter((p) => p.parte === parte).sort((a, b) => versatil(b) - versatil(a))
    const paraElClima = deEsaParte.filter((p) => !exigirClima || !climas.length || p.clima.some((c) => climas.includes(c)))
    // Si no tenés nada para ese clima, igual llevamos lo más versátil (abajo de un abrigo sirve)
    return (paraElClima.length ? paraElClima : deEsaParte.slice(0, Math.min(cant, 2))).slice(0, cant)
  }
  const elegidas = [
    ...tomar('Arriba', Math.min(Math.ceil(n * 0.7) + 1, 8)),
    ...tomar('Abajo', Math.min(Math.ceil(n / 2) + 1, 5)),
    ...tomar('Entero', Math.min(Math.ceil(n / 3), 3)),
    ...(hayFrio ? tomar(dias.some((d) => d.min < 10) ? 'Abrigo' : 'Chaqueta', 1, false) : []),
    ...(hayFrio && n > 4 ? tomar(dias.some((d) => d.min < 10) ? 'Chaqueta' : 'Abrigo', 1, false) : []),
    ...tomar('Calzado', n > 3 ? 2 : 1, false),
    ...placard.filter((p) => p.tipo === 'cartera').sort((a, b) => versatil(b) - versatil(a)).slice(0, 1),
    ...placard.filter((p) => p.parte === 'Accesorio' && p.tipo !== 'cartera').sort((a, b) => versatil(b) - versatil(a)).slice(0, 2),
    ...tomar('Cinturón', 1, false),
  ]
  return elegidas.map((p) => p.id)
}
