import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { LookCard } from '../components/LookCard'
import { Boton, Encabezado, Foto, IconoCerrar, Rotulo, Tarjeta } from '../components/ui'
import { db } from '../lib/db'
import { haceCuanto, textoUso, useLooks, usePrendas } from '../lib/hooks'
import { borrarPrenda } from '../lib/repo'
import { useNav } from '../nav'

export default function PrendaDetalle({ id }: { id: string }) {
  const { abrir, cerrar, aviso } = useNav()
  const prenda = useLiveQuery(() => db.prendas.get(id), [id])
  const prendas = usePrendas()
  const looks = useLooks()
  const [confirmar, setConfirmar] = useState(false)

  if (prenda === undefined || !prendas || !looks) return null
  if (!prenda || prenda.deleted)
    return (
      <div className="p-6">
        <p>Esta prenda ya no existe.</p>
        <Boton className="mt-4" onClick={cerrar}>Volver</Boton>
      </div>
    )

  const susLooks = looks.filter((l) => l.prendaIds.includes(prenda.id))
  const filas: [string, string][] = [
    ['Tipo', prenda.tipo],
    ['Parte', prenda.parte],
    ...((prenda.parte === 'Accesorio'
      ? [['Tono', prenda.color === 'Dorado' || prenda.color === 'Plateado' ? prenda.color : `Color${prenda.color ? ` (${prenda.color.toLowerCase()})` : ''}`]]
      : [['Color', prenda.color || '—'], ['Tela', prenda.tela || '—']]) as [string, string][]),
    ['Clima', prenda.clima.join(' · ') || '—'],
    ['Ocasión', prenda.ocasiones.join(' · ') || '—'],
    ['Uso', textoUso(prenda.vecesUsada)],
    ['Último uso', haceCuanto(prenda.ultimoUso)],
  ]

  const borrar = async () => {
    await borrarPrenda(prenda.id)
    aviso('Prenda borrada')
    cerrar()
  }

  return (
    <div>
      <Encabezado
        sub={prenda.parte}
        titulo={prenda.nombre}
        derecha={
          <button aria-label="Cerrar" onClick={cerrar} className="flex h-11 w-11 shrink-0 items-center justify-center border border-linea">
            <IconoCerrar />
          </button>
        }
      />
      <div className="space-y-5 px-4">
        <Tarjeta>
          <div className="aspect-square p-5">
            <Foto blob={prenda.foto} alt={prenda.nombre} className="h-full w-full" />
          </div>
        </Tarjeta>

        <dl className="border-t border-linea">
          {filas.map(([k, v]) => (
            <div key={k} className="flex min-h-11 items-center justify-between gap-4 border-b border-linea">
              <dt className="rotulo">{k}</dt>
              <dd className="text-right text-[15px] first-letter:uppercase">{v}</dd>
            </div>
          ))}
        </dl>

        {confirmar ? (
          <div className="space-y-3 border border-acento p-4">
            <p className="text-[15px] leading-snug">
              ¿Borrar <b>{prenda.nombre}</b>?{susLooks.length > 0 && ` También se borran ${susLooks.length === 1 ? 'el look' : `los ${susLooks.length} looks`} donde aparece.`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" onClick={() => setConfirmar(false)}>Cancelar</Boton>
              <Boton className="!border-acento !bg-acento" onClick={borrar}>Borrar</Boton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => abrir({ tipo: 'editar', id: prenda.id })}>Editar</Boton>
            <Boton variante="secundario" className="!border-acento !text-acento" onClick={() => setConfirmar(true)}>Borrar</Boton>
          </div>
        )}

        <section className="space-y-3 pt-2">
          <Rotulo>Aparece en {susLooks.length} {susLooks.length === 1 ? 'look' : 'looks'}</Rotulo>
          {susLooks.length === 0 ? (
            <p className="text-[14px] text-gris">Todavía no la usaste en ningún look.</p>
          ) : (
            <div className="space-y-2">
              {susLooks.map((l) => (
                <LookCard key={l.id} look={l} prendas={prendas} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
