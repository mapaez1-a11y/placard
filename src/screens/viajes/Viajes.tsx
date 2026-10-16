import { Boton, Encabezado, Esquinas, IconoValija, Rotulo, Tarjeta } from '../../components/ui'
import { usePrendas, useViajes } from '../../lib/hooks'
import type { Viaje } from '../../lib/types'
import { useNav } from '../../nav'
import { estadoViaje, rangoFechas } from './util'

export default function Viajes() {
  const { abrir } = useNav()
  const viajes = useViajes()
  const prendas = usePrendas()
  if (!viajes || !prendas) return null

  const proximos = viajes.filter((v) => estadoViaje(v).tipo !== 'pasado')
  const pasados = viajes.filter((v) => estadoViaje(v).tipo === 'pasado').reverse()

  return (
    <div className="aparecer">
      <Encabezado sub="Armá la valija" titulo="Viajes" />
      <div className="space-y-5 px-4">
        <Boton className="w-full" onClick={() => abrir({ tipo: 'viaje-editar' })}>
          Nuevo viaje
        </Boton>

        {viajes.length === 0 ? (
          <Tarjeta className="px-5 py-8 text-center">
            <IconoValija className="mx-auto h-10 w-10" />
            <div className="titulo mt-3 text-[22px]">¿Te vas de viaje?</div>
            <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-snug text-gris">
              Elegí el destino y las fechas: te muestro el clima de cada día, qué conviene llevar y un look para cada jornada.
            </p>
          </Tarjeta>
        ) : (
          <>
            {proximos.length > 0 && (
              <section className="space-y-2">
                <Rotulo>Próximos</Rotulo>
                {proximos.map((v) => (
                  <FilaViaje key={v.id} viaje={v} />
                ))}
              </section>
            )}
            {pasados.length > 0 && (
              <section className="space-y-2">
                <Rotulo>Anteriores</Rotulo>
                {pasados.map((v) => (
                  <FilaViaje key={v.id} viaje={v} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FilaViaje({ viaje }: { viaje: Viaje }) {
  const { abrir } = useNav()
  const estado = estadoViaje(viaje)
  const temps = viaje.pronostico.length
    ? `${Math.min(...viaje.pronostico.map((d) => d.min))}° a ${Math.max(...viaje.pronostico.map((d) => d.max))}°`
    : null
  return (
    <button
      onClick={() => abrir({ tipo: 'viaje', id: viaje.id })}
      className={`relative flex w-full items-stretch border bg-papel text-left active:bg-crema ${estado.tipo === 'ahora' ? 'border-acento' : 'border-linea'} ${estado.tipo === 'pasado' ? 'opacity-60' : ''}`}
    >
      <Esquinas />
      <div className="min-w-0 flex-1 px-4 py-3">
        <div className={`rotulo !text-[11px] ${estado.tipo === 'ahora' ? '!text-acento' : ''}`}>{estado.texto}</div>
        <div className="titulo mt-1 truncate text-[22px]">{viaje.nombre || viaje.destino.split(',')[0]}</div>
        <div className="mt-1 text-[14px] text-gris">
          {rangoFechas(viaje)} · {viaje.prendaIds.length} {viaje.prendaIds.length === 1 ? 'prenda' : 'prendas'}
        </div>
      </div>
      {temps && (
        <div className="flex w-[84px] shrink-0 flex-col items-center justify-center border-l border-linea">
          <span className="titulo text-[18px]">{temps}</span>
        </div>
      )}
    </button>
  )
}
