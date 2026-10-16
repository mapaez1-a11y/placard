import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { PrendaCard } from '../components/PrendaCard'
import { Boton, Encabezado, IconoCerrar, IconoEstrella } from '../components/ui'
import { db } from '../lib/db'
import { usePrendas, useUsos } from '../lib/hooks'
import { borrarLook, guardarLook, toggleFavorito, usarLook } from '../lib/repo'
import { esBase, type Prenda } from '../lib/types'
import { useNav } from '../nav'

export default function LookDetalle({ id }: { id: string }) {
  const { cerrar, aviso } = useNav()
  const look = useLiveQuery(() => db.looks.get(id), [id])
  const prendas = usePrendas()
  const usos = useUsos()
  const [confirmar, setConfirmar] = useState(false)

  if (look === undefined || !prendas || !usos) return null
  if (!look || look.deleted)
    return (
      <div className="p-6">
        <p>Este look ya no existe.</p>
        <Boton className="mt-4" onClick={cerrar}>Volver</Boton>
      </div>
    )

  const ps = look.prendaIds.map((pid) => prendas.find((p) => p.id === pid)).filter((p): p is Prenda => !!p)
  const vecesUsado = usos.filter((u) => u.lookId === look.id).length
  const principales = ps.filter(esBase)
  const extras = ps.filter((p) => !principales.includes(p))

  return (
    <div>
      <Encabezado
        sub={`${look.ocasion} · ${vecesUsado ? `usado ${vecesUsado} ${vecesUsado === 1 ? 'vez' : 'veces'}` : 'sin usar'}`}
        titulo="Look"
        derecha={
          <div className="flex gap-2">
            <button
              aria-label={look.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
              aria-pressed={look.favorito}
              onClick={() => toggleFavorito(look)}
              className={`flex h-11 w-11 items-center justify-center border border-linea ${look.favorito ? 'text-acento' : ''}`}
            >
              <IconoEstrella llena={look.favorito} />
            </button>
            <button aria-label="Cerrar" onClick={cerrar} className="flex h-11 w-11 items-center justify-center border border-linea">
              <IconoCerrar />
            </button>
          </div>
        }
      />
      <div className="space-y-4 px-4">
        <div className="grid grid-cols-2 gap-3">
          {[...principales, ...extras].map((p) => (
            <PrendaCard key={p.id} prenda={p} detalle="parte" />
          ))}
        </div>
        {look.nota && <p className="border-l-2 border-tinta pl-3 text-[15px]">{look.nota}</p>}

        <div className="grid grid-cols-2 gap-2 pt-1">
          {!look.guardado ? (
            <Boton variante="secundario" onClick={async () => (await guardarLook(look.prendaIds, look.ocasion, look.nota), aviso('Look guardado'))}>
              Guardar
            </Boton>
          ) : confirmar ? (
            <Boton variante="secundario" className="!border-acento !bg-acento !text-papel" onClick={async () => (await borrarLook(look.id), aviso('Look borrado'), cerrar())}>
              Sí, borrar
            </Boton>
          ) : (
            <Boton variante="secundario" className="!border-acento !text-acento" onClick={() => setConfirmar(true)}>
              Borrar look
            </Boton>
          )}
          <Boton
            onClick={async () => {
              await usarLook(principales.map((p) => p.id), extras.map((p) => p.id), look.ocasion)
              aviso('Listo, look registrado para hoy')
              cerrar()
            }}
          >
            Usarlo hoy
          </Boton>
        </div>
      </div>
    </div>
  )
}
