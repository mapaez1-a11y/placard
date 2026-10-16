import { useState } from 'react'
import { LookCard } from '../components/LookCard'
import { PrendaCard } from '../components/PrendaCard'
import { Chip, Encabezado, Esquinas, IconoMas, Rotulo, Segmentado } from '../components/ui'
import { useLooks, usePrendas } from '../lib/hooks'
import type { Parte, Prenda, Tipo } from '../lib/types'
import { useNav } from '../nav'

const FILTROS = ['Todo', 'Arriba', 'Abajo', 'Abrigo', 'Calzado', 'Carteras', 'Accesorios', 'Cinturones'] as const
type Filtro = (typeof FILTROS)[number]

/** Secciones del placard: qué partes entran y con qué tipo se agrega una nueva */
const SECCIONES: { filtro: Filtro; titulo: string; partes: Parte[]; tipo: Tipo; vacio: string }[] = [
  { filtro: 'Todo', titulo: 'Ropa', partes: ['Arriba', 'Abajo', 'Entero', 'Abrigo'], tipo: 'remera', vacio: 'Agregar prenda' },
  { filtro: 'Calzado', titulo: 'Calzado', partes: ['Calzado'], tipo: 'calzado', vacio: 'Agregar calzado' },
  { filtro: 'Carteras', titulo: 'Carteras', partes: ['Cartera'], tipo: 'cartera', vacio: 'Agregar cartera' },
  { filtro: 'Accesorios', titulo: 'Accesorios · aros y collares', partes: ['Accesorio'], tipo: 'aros', vacio: 'Agregar accesorio' },
  { filtro: 'Cinturones', titulo: 'Cinturones', partes: ['Cinturón'], tipo: 'cinturón', vacio: 'Agregar cinturón' },
]

export default function Placard() {
  const { abrir } = useNav()
  const prendas = usePrendas()
  const looks = useLooks()
  const [filtro, setFiltro] = useState<Filtro>('Todo')
  const [soloFavs, setSoloFavs] = useState<'Todos' | 'Favoritos'>('Todos')

  if (!prendas || !looks) return null
  const guardados = looks.filter((l) => l.guardado || l.favorito).filter((l) => soloFavs === 'Todos' || l.favorito)
  const ropa = prendas.filter((p) => SECCIONES[0].partes.includes(p.parte))

  // Qué secciones mostrar según el filtro
  const secciones =
    filtro === 'Todo'
      ? SECCIONES.map((sec) => ({ ...sec, prendas: prendas.filter((p) => sec.partes.includes(p.parte)) }))
      : filtro === 'Arriba' || filtro === 'Abajo' || filtro === 'Abrigo'
        ? [{ ...SECCIONES[0], titulo: filtro, tipo: (filtro === 'Arriba' ? 'remera' : filtro === 'Abajo' ? 'pantalón' : 'abrigo') as Tipo, prendas: ropa.filter((p) => p.parte === filtro || (filtro === 'Arriba' && p.parte === 'Entero')) }]
        : SECCIONES.filter((sec) => sec.filtro === filtro).map((sec) => ({ ...sec, prendas: prendas.filter((p) => sec.partes.includes(p.parte)) }))

  return (
    <div className="aparecer">
      <Encabezado
        sub={`${prendas.length} ${prendas.length === 1 ? 'prenda' : 'prendas'}`}
        titulo="Placard"
      />
      <div className="space-y-4">
        <div className="carrusel flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTROS.map((f) => (
            <Chip key={f} activo={filtro === f} onClick={() => setFiltro(f)}>
              {f}
            </Chip>
          ))}
        </div>

        <div className="space-y-6 px-4">
          {secciones.map((sec) => (
            <Seccion
              key={sec.titulo}
              titulo={sec.titulo}
              prendas={sec.prendas}
              textoAgregar={sec.vacio}
              mostrarTitulo={filtro === 'Todo'}
              onAgregar={() => abrir({ tipo: 'nueva', tipoInicial: sec.tipo })}
            />
          ))}
        </div>

      <div className="space-y-3 px-4">
        <section className="space-y-3 pt-4">
          <Rotulo>Looks guardados</Rotulo>
          <Segmentado etiqueta="Mostrar looks" opciones={['Todos', 'Favoritos'] as const} valor={soloFavs} onChange={setSoloFavs} />
          {guardados.length === 0 ? (
            <p className="text-[14px] leading-snug text-gris">
              {soloFavs === 'Favoritos'
                ? 'Marcá con la estrella los looks que más te gustan.'
                : 'Todavía no guardaste looks. Armalos en la pestaña Armar.'}
            </p>
          ) : (
            <div className="space-y-2">
              {guardados.map((l) => (
                <LookCard key={l.id} look={l} prendas={prendas} />
              ))}
            </div>
          )}
        </section>
      </div>
      </div>
    </div>
  )
}

function Seccion({
  titulo,
  prendas,
  textoAgregar,
  mostrarTitulo,
  onAgregar,
}: {
  titulo: string
  prendas: Prenda[]
  textoAgregar: string
  mostrarTitulo: boolean
  onAgregar: () => void
}) {
  return (
    <section className="space-y-3">
      {mostrarTitulo && (
        <Rotulo>
          {titulo} · {prendas.length}
        </Rotulo>
      )}
      <div className="grid grid-cols-2 gap-3">
        {prendas.map((p) => (
          <PrendaCard key={p.id} prenda={p} />
        ))}
        <button
          onClick={onAgregar}
          className={`relative flex flex-col items-center justify-center gap-2 border border-dashed border-tinta/50 text-tinta active:bg-papel ${prendas.length ? 'min-h-[236px]' : 'col-span-2 min-h-[88px] !flex-row'}`}
        >
          <Esquinas />
          <IconoMas className="h-6 w-6" />
          <span className="titulo text-[15px]">{textoAgregar}</span>
        </button>
      </div>
    </section>
  )
}
