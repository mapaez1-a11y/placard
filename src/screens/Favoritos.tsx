import { useState } from 'react'
import { Boton, Chip, Encabezado, Esquinas, Foto, IconoEstrella, Tarjeta } from '../components/ui'
import { useLooks, usePrendas, useUsos } from '../lib/hooks'
import { toggleFavorito, usarLook } from '../lib/repo'
import { esBase, OCASIONES, type Look, type Ocasion, type Prenda } from '../lib/types'
import { useNav } from '../nav'

type Filtro = 'Todas' | Ocasion

export default function Favoritos() {
  const { ir } = useNav()
  const looks = useLooks()
  const prendas = usePrendas()
  const usos = useUsos()
  const [filtro, setFiltro] = useState<Filtro>('Todas')

  if (!looks || !prendas || !usos) return null
  const favoritos = looks.filter((l) => l.favorito)
  const visibles = filtro === 'Todas' ? favoritos : favoritos.filter((l) => l.ocasion === filtro)
  const ocasionesConFavs = OCASIONES.filter((o) => favoritos.some((l) => l.ocasion === o))

  return (
    <div className="aparecer">
      <Encabezado sub={`${favoritos.length} ${favoritos.length === 1 ? 'look' : 'looks'}`} titulo="Favoritos" />
      {favoritos.length === 0 ? (
        <div className="px-4">
          <Tarjeta className="px-5 py-8 text-center">
            <IconoEstrella className="mx-auto h-10 w-10" />
            <div className="titulo mt-3 text-[22px]">Todavía no tenés favoritos</div>
            <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-snug text-gris">
              Guardá una combinación en Armar y tocá la estrella: tus looks preferidos quedan acá, a mano.
            </p>
            <Boton className="mt-5 w-full" onClick={() => ir('armar')}>
              Armar un look
            </Boton>
          </Tarjeta>
        </div>
      ) : (
        <div className="space-y-4">
          {ocasionesConFavs.length > 1 && (
            <div className="carrusel flex gap-2 overflow-x-auto px-4">
              {(['Todas', ...ocasionesConFavs] as Filtro[]).map((o) => (
                <Chip key={o} activo={filtro === o} onClick={() => setFiltro(o)}>
                  {o}
                </Chip>
              ))}
            </div>
          )}
          <div className="space-y-3 px-4">
            {visibles.map((l) => (
              <FavoritoCard key={l.id} look={l} prendas={prendas} veces={usos.filter((u) => u.lookId === l.id).length} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FavoritoCard({ look, prendas, veces }: { look: Look; prendas: Prenda[]; veces: number }) {
  const { abrir, aviso } = useNav()
  const todas = look.prendaIds.map((id) => prendas.find((p) => p.id === id)).filter((p): p is Prenda => !!p)
  const base = todas.filter(esBase)
  const extras = todas.filter((p) => !esBase(p))

  return (
    <div className="relative border border-linea bg-papel">
      <Esquinas />
      <div className="flex items-center justify-between border-b border-linea pl-3">
        <span className="rotulo">
          {look.ocasion} · {veces ? `usado ${veces} ${veces === 1 ? 'vez' : 'veces'}` : 'sin usar'}
        </span>
        <button
          aria-label="Quitar de favoritos"
          onClick={async () => (await toggleFavorito(look), aviso('Quitado de favoritos'))}
          className="flex h-11 w-11 items-center justify-center border-l border-linea text-acento"
        >
          <IconoEstrella llena className="h-5 w-5" />
        </button>
      </div>

      <button onClick={() => abrir({ tipo: 'look', id: look.id })} className="block w-full p-3 text-left active:bg-crema">
        <div className={`grid gap-2 ${base.length > 1 ? 'grid-cols-2' : 'mx-auto w-1/2 grid-cols-1'}`}>
          {base.map((p) => (
            <div key={p.id} className="border border-linea">
              <div className="aspect-square p-2">
                <Foto blob={p.foto} alt={p.nombre} className="h-full w-full" />
              </div>
              <div className="truncate border-t border-linea px-2 py-1.5 text-[13px] font-medium">{p.nombre}</div>
            </div>
          ))}
        </div>
        {extras.length > 0 && (
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {extras.map((p) => (
              <div key={p.id} className="aspect-square border border-linea p-1">
                <Foto blob={p.foto} alt={p.nombre} className="h-full w-full" />
              </div>
            ))}
          </div>
        )}
        {look.nota && <p className="mt-2 border-l-2 border-tinta pl-2 text-[14px]">{look.nota}</p>}
      </button>

      <div className="px-3 pb-3">
        <Boton
          chico
          className="w-full"
          onClick={async () => {
            await usarLook(base.map((p) => p.id), extras.map((p) => p.id), look.ocasion)
            aviso('Listo, look registrado para hoy')
          }}
        >
          Usarlo hoy
        </Boton>
      </div>
    </div>
  )
}
