import { textoUso } from '../lib/hooks'
import type { Prenda } from '../lib/types'
import { useNav } from '../nav'
import { Foto, Tarjeta } from './ui'

export function PrendaCard({ prenda, detalle = 'uso', className = '' }: { prenda: Prenda; detalle?: 'uso' | 'parte'; className?: string }) {
  const { abrir } = useNav()
  return (
    <Tarjeta onClick={() => abrir({ tipo: 'prenda', id: prenda.id })} className={`flex flex-col ${className}`}>
      <div className="aspect-[4/5] w-full p-3">
        <Foto blob={prenda.foto} alt={prenda.nombre} className="h-full w-full" />
      </div>
      <div className="border-t border-linea px-3 py-2.5">
        <div className="truncate text-[14px] font-medium">{prenda.nombre}</div>
        <div className="rotulo mt-0.5 !text-[11px]">{detalle === 'uso' ? textoUso(prenda.vecesUsada) : prenda.parte}</div>
      </div>
    </Tarjeta>
  )
}

/** Versión horizontal y chica, para abrigo y calzado */
export function PrendaFila({ prenda, etiqueta }: { prenda: Prenda; etiqueta: string }) {
  const { abrir } = useNav()
  return (
    <Tarjeta onClick={() => abrir({ tipo: 'prenda', id: prenda.id })} className="flex min-h-[72px] items-center gap-3 pr-3">
      <div className="h-[72px] w-[64px] shrink-0 border-r border-linea p-1.5">
        <Foto blob={prenda.foto} alt={prenda.nombre} className="h-full w-full" />
      </div>
      <div className="min-w-0">
        <div className="rotulo !text-[11px]">{etiqueta}</div>
        <div className="truncate text-[14px] font-medium">{prenda.nombre}</div>
      </div>
    </Tarjeta>
  )
}
