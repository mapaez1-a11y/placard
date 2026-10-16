import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Boton, Encabezado, Foto, IconoCheck, Rotulo } from '../../components/ui'
import { db } from '../../lib/db'
import { usePrendas } from '../../lib/hooks'
import { actualizarViaje } from '../../lib/repo'
import { sugerirValija } from '../../lib/suggest'
import type { Parte, Prenda } from '../../lib/types'
import { climaPorTemp } from '../../lib/weather'
import { useNav } from '../../nav'

const GRUPOS: { titulo: string; partes: Parte[] }[] = [
  { titulo: 'Arriba y vestidos', partes: ['Arriba', 'Entero'] },
  { titulo: 'Abajo', partes: ['Abajo'] },
  { titulo: 'Abrigos', partes: ['Abrigo'] },
  { titulo: 'Calzado', partes: ['Calzado'] },
  { titulo: 'Carteras', partes: ['Cartera'] },
  { titulo: 'Accesorios', partes: ['Accesorio'] },
  { titulo: 'Cinturones', partes: ['Cinturón'] },
]

export default function Valija({ id }: { id: string }) {
  const { cerrar, aviso, ir } = useNav()
  const viaje = useLiveQuery(() => db.viajes.get(id), [id])
  const prendas = usePrendas()
  const [sel, setSel] = useState<string[] | null>(null)

  useEffect(() => {
    if (viaje && sel === null) setSel(viaje.prendaIds)
  }, [viaje, sel])

  if (!viaje || !prendas || sel === null) return null

  const climas = [...new Set(viaje.pronostico.map((d) => climaPorTemp(d.max)))]
  const sirve = (p: Prenda) => !climas.length || p.clima.some((c) => climas.includes(c))
  const toggle = (pid: string) => setSel(sel.includes(pid) ? sel.filter((x) => x !== pid) : [...sel, pid])

  const guardar = async () => {
    await actualizarViaje(viaje.id, { prendaIds: sel })
    aviso(`Valija lista: ${sel.length} ${sel.length === 1 ? 'prenda' : 'prendas'}`)
    cerrar()
  }

  return (
    <div>
      <Encabezado sub={`${sel.length} elegidas`} titulo="Valija" />
      <div className="space-y-6 px-4">
        {prendas.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[15px]">Tu placard está vacío.</p>
            <Boton onClick={() => ir('agregar')}>Agregar prenda</Boton>
          </div>
        ) : (
          <>
            <p className="text-[14px] leading-snug text-gris">
              Tocá lo que te llevás.{climas.length > 0 && ` Las marcadas con un punto sirven para el clima del viaje (${climas.join(', ').toLowerCase()}).`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Boton
                chico
                variante="secundario"
                disabled={!viaje.pronostico.length}
                onClick={() => (setSel(sugerirValija(prendas, viaje.pronostico, viaje.ocasion)), aviso('Te propuse una valija'))}
              >
                Sugerir
              </Boton>
              <Boton chico variante="secundario" onClick={() => setSel([])}>
                Vaciar
              </Boton>
            </div>

            {GRUPOS.map((g) => {
              const ps = prendas.filter((p) => g.partes.includes(p.parte)).sort((a, b) => Number(sirve(b)) - Number(sirve(a)))
              if (!ps.length) return null
              return (
                <section key={g.titulo} className="space-y-2">
                  <Rotulo>
                    {g.titulo} · {ps.filter((p) => sel.includes(p.id)).length}/{ps.length}
                  </Rotulo>
                  <div className="grid grid-cols-3 gap-2">
                    {ps.map((p) => {
                      const activo = sel.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          aria-pressed={activo}
                          onClick={() => toggle(p.id)}
                          className={`relative border bg-papel text-left ${activo ? 'border-acento outline outline-1 outline-acento' : 'border-linea'}`}
                        >
                          <div className={`aspect-square p-2 ${activo ? '' : 'opacity-70'}`}>
                            <Foto blob={p.foto} alt={p.nombre} className="h-full w-full" />
                          </div>
                          <div className={`flex items-center gap-1 border-t px-1.5 py-1 ${activo ? 'border-acento bg-acento text-papel' : 'border-linea'}`}>
                            {sirve(p) && !activo && <span className="h-1.5 w-1.5 shrink-0 bg-acento" />}
                            <span className="truncate text-[11px] font-medium">{p.nombre}</span>
                          </div>
                          {activo && (
                            <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-acento text-papel">
                              <IconoCheck className="h-4 w-4" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-tinta bg-crema px-4 py-3">
        <div className="mx-auto grid max-w-[448px] grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={cerrar}>Cancelar</Boton>
          <Boton onClick={guardar}>Guardar valija</Boton>
        </div>
      </div>
      <div className="h-20" />
    </div>
  )
}
