import { useEffect, useRef, useState } from 'react'
import { Boton, Chip, Encabezado, Esquinas, Foto, IconoFlechaDer, IconoFlechaIzq, Rotulo, Segmentado, Tarjeta } from '../components/ui'
import { usePrendas } from '../lib/hooks'
import { prefs } from '../lib/prefs'
import { guardarLook } from '../lib/repo'
import { notaCombinacion } from '../lib/suggest'
import { esBase, OCASIONES, type Ocasion, type Prenda } from '../lib/types'
import { useNav } from '../nav'

export default function Armar() {
  const { ir, aviso } = useNav()
  const prendas = usePrendas()
  const [iArriba, setIArriba] = useState(0)
  const [iAbajo, setIAbajo] = useState(0)
  const [ocasion, setOcasion] = useState<Ocasion>(prefs.getOcasion())
  const [nota, setNota] = useState('')
  const [extras, setExtras] = useState<string[]>([])

  if (!prendas) return null
  const arriba = prendas.filter((p) => p.parte === 'Arriba' || p.parte === 'Entero')
  const abajo = prendas.filter((p) => p.parte === 'Abajo')
  const complementos = prendas.filter((p) => !esBase(p))
  const extrasValidos = extras.filter((id) => complementos.some((p) => p.id === id))

  const a = arriba[Math.min(iArriba, arriba.length - 1)]
  const esEntero = a?.parte === 'Entero'
  const b = esEntero ? null : abajo[Math.min(iAbajo, abajo.length - 1)] ?? null

  const guardar = async () => {
    if (!a) return
    const ids = [...(b ? [a.id, b.id] : [a.id]), ...extrasValidos]
    const r = await guardarLook(ids, ocasion, nota.trim())
    setNota('')
    setExtras([])
    aviso(r === 'nuevo' ? 'Combinación guardada' : 'Ya la tenías guardada: la actualicé')
  }

  const puedeArmar = arriba.length > 0 && (abajo.length > 0 || arriba.some((p) => p.parte === 'Entero'))

  return (
    <div className="aparecer">
      <Encabezado sub="Probá combinaciones" titulo="Armar" />
      {!puedeArmar ? (
        <div className="px-4">
          <Tarjeta className="px-5 py-8 text-center">
            <div className="titulo text-[22px]">Faltan prendas</div>
            <p className="mx-auto mt-2 max-w-[270px] text-[14px] text-gris">
              Para combinar necesitás al menos una prenda de arriba y una de abajo (o un vestido).
            </p>
            <Boton className="mt-5 w-full" onClick={() => ir('agregar')}>
              Agregar prenda
            </Boton>
          </Tarjeta>
        </div>
      ) : (
        <div className="space-y-3 px-4">
          <Carrusel titulo="Arriba" prendas={arriba} indice={iArriba} onCambio={setIArriba} />
          <div className="relative">
            <Carrusel titulo="Abajo" prendas={abajo} indice={iAbajo} onCambio={setIAbajo} apagado={esEntero} />
            {esEntero && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="titulo bg-crema px-3 py-2 text-[15px]">Es una prenda entera: no hace falta</span>
              </div>
            )}
          </div>

          {a && (
            <section className="space-y-3 pt-2">
              <div className="flex flex-wrap gap-1.5">
                {[a, b]
                  .filter((p): p is Prenda => !!p)
                  .flatMap((p) => [p.tela, p.color].filter(Boolean).map((t) => ({ t: t.toLowerCase(), k: p.id + t })))
                  .filter((x, i, arr) => arr.findIndex((y) => y.t === x.t) === i)
                  .map((x) => (
                    <Chip key={x.k}>{x.t}</Chip>
                  ))}
              </div>
              <p className="text-[15px] leading-snug">{notaCombinacion(a, b)}</p>

              {complementos.length > 0 && (
                <>
                  <Rotulo className="pt-2">Sumá complementos</Rotulo>
                  <div className="carrusel -mx-4 flex gap-2 overflow-x-auto px-4">
                    {complementos.map((p) => {
                      const activo = extrasValidos.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          aria-pressed={activo}
                          onClick={() => setExtras(activo ? extras.filter((x) => x !== p.id) : [...extras, p.id])}
                          className={`w-[84px] shrink-0 border bg-papel text-left ${activo ? 'border-acento outline outline-1 outline-acento' : 'border-linea'}`}
                        >
                          <div className="aspect-square p-1.5">
                            <Foto blob={p.foto} alt={p.nombre} className="h-full w-full" />
                          </div>
                          <div className={`truncate border-t px-1.5 py-1 text-[11px] font-medium ${activo ? 'border-acento bg-acento text-papel' : 'border-linea'}`}>{p.nombre}</div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <Rotulo className="pt-2">Guardar como look</Rotulo>
              <Segmentado etiqueta="Ocasión del look" opciones={OCASIONES} valor={ocasion} onChange={setOcasion} />
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Nota (opcional): con zapatillas blancas"
                className="min-h-12 w-full border border-linea bg-papel px-3 outline-none placeholder:text-gris/70 focus:border-tinta"
              />
              <Boton className="w-full" onClick={guardar}>
                Guardar combinación
              </Boton>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function Carrusel({
  titulo,
  prendas,
  indice,
  onCambio,
  apagado,
}: {
  titulo: string
  prendas: Prenda[]
  indice: number
  onCambio: (i: number) => void
  apagado?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const i = Math.min(indice, Math.max(prendas.length - 1, 0))

  useEffect(() => {
    if (indice !== i) onCambio(i)
  }, [indice, i, onCambio])

  const irA = (n: number) => {
    const el = ref.current
    if (!el || !prendas.length) return
    const destino = (n + prendas.length) % prendas.length
    el.scrollTo({ left: destino * el.clientWidth, behavior: 'smooth' })
  }

  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const n = Math.round(el.scrollLeft / el.clientWidth)
    if (n !== i) onCambio(n)
  }

  const actual = prendas[i]

  return (
    <div className={`relative border border-linea bg-papel ${apagado ? 'opacity-30' : ''}`}>
      <Esquinas />
      <div className="flex items-center justify-between border-b border-linea px-3 py-2">
        <span className="rotulo">{titulo}</span>
        <span className="rotulo">
          {prendas.length ? `${i + 1} / ${prendas.length}` : 'Vacío'}
        </span>
      </div>
      {prendas.length === 0 ? (
        <div className="flex h-[190px] items-center justify-center text-[14px] text-gris">Sin prendas en esta parte</div>
      ) : (
        <>
          <div ref={ref} onScroll={onScroll} className="carrusel flex h-[190px] overflow-x-auto">
            {prendas.map((p) => (
              <div key={p.id} className="h-full w-full shrink-0 p-3">
                <Foto blob={p.foto} alt={p.nombre} className="h-full w-full" />
              </div>
            ))}
          </div>
          <div className="flex items-center border-t border-linea">
            <button aria-label={`${titulo}: anterior`} disabled={apagado} onClick={() => irA(i - 1)} className="flex h-11 w-12 items-center justify-center border-r border-linea">
              <IconoFlechaIzq className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 truncate px-3 text-center text-[14px] font-medium">{actual?.nombre}</div>
            <button aria-label={`${titulo}: siguiente`} disabled={apagado} onClick={() => irA(i + 1)} className="flex h-11 w-12 items-center justify-center border-l border-linea">
              <IconoFlechaDer className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
