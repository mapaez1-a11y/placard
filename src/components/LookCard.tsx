import { toggleFavorito } from '../lib/repo'
import { esBase, type Look, type Prenda } from '../lib/types'
import { useNav } from '../nav'
import { Esquinas, Foto, IconoEstrella } from './ui'

export function LookCard({ look, prendas }: { look: Look; prendas: Prenda[] }) {
  const { abrir } = useNav()
  const todas = look.prendaIds.map((id) => prendas.find((p) => p.id === id)).filter((p): p is Prenda => !!p)
  const ps = [...todas.filter(esBase), ...todas.filter((p) => !esBase(p))]
  return (
    <div className="relative flex border border-linea bg-papel">
      <Esquinas />
      <button onClick={() => abrir({ tipo: 'look', id: look.id })} className="flex min-w-0 flex-1 items-center text-left active:bg-crema">
        <div className="flex shrink-0">
          {ps.slice(0, 3).map((p) => (
            <div key={p.id} className="h-[84px] w-[64px] border-r border-linea p-1.5">
              <Foto blob={p.foto} alt={p.nombre} className="h-full w-full" />
            </div>
          ))}
        </div>
        <div className="min-w-0 px-3 py-2">
          <div className="rotulo !text-[11px]">{look.ocasion}</div>
          <div className="truncate text-[14px] font-medium">{ps.filter(esBase).map((p) => p.nombre).join(' + ')}{ps.length > ps.filter(esBase).length && ` +${ps.length - ps.filter(esBase).length}`}</div>
          {look.nota && <div className="truncate text-[13px] text-gris">{look.nota}</div>}
        </div>
      </button>
      <button
        aria-label={look.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
        aria-pressed={look.favorito}
        onClick={() => toggleFavorito(look)}
        className={`flex w-12 shrink-0 items-center justify-center border-l border-linea ${look.favorito ? 'text-acento' : 'text-gris'}`}
      >
        <IconoEstrella llena={look.favorito} className="h-5 w-5" />
      </button>
    </div>
  )
}
