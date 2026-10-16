import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Boton, Encabezado, Esquinas, Foto, IconoCerrar, Rotulo, Segmentado } from '../../components/ui'
import { db } from '../../lib/db'
import { usePrendas } from '../../lib/hooks'
import { actualizarViaje, borrarViaje, guardarPronostico } from '../../lib/repo'
import { extrasDe, faltantesValija, planViaje, sugerirValija } from '../../lib/suggest'
import { esBase, OCASIONES, PARTES, type DiaClima, type Prenda } from '../../lib/types'
import { climaPorTemp, descripcionCodigo, diasEntre, esLluvia, pronosticoViaje } from '../../lib/weather'
import { useNav } from '../../nav'
import { diaCorto, diaSemana, estadoViaje, pronosticoViejo, rangoFechas } from './util'

export default function ViajeDetalle({ id }: { id: string }) {
  const { abrir, cerrar, aviso } = useNav()
  const viaje = useLiveQuery(() => db.viajes.get(id), [id])
  const prendas = usePrendas()
  const [cargando, setCargando] = useState(false)
  const [errorClima, setErrorClima] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  const dias = viaje ? diasEntre(viaje.desde, viaje.hasta) : []

  // Trae el pronóstico al abrir (y lo guarda para verlo sin señal)
  useEffect(() => {
    if (!viaje || !navigator.onLine || !pronosticoViejo(viaje, dias.length)) return
    let vivo = true
    setCargando(true)
    setErrorClima(null)
    pronosticoViaje(viaje.lat, viaje.lon, viaje.desde, viaje.hasta)
      .then((p) => {
        if (vivo) return guardarPronostico(viaje.id, p)
      })
      .catch((e) => {
        if (vivo) setErrorClima(e instanceof Error ? e.message : 'No pude traer el clima')
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viaje?.id, viaje?.desde, viaje?.hasta, viaje?.lat, viaje?.pronosticoAt])

  const valija = useMemo(
    () => (viaje && prendas ? prendas.filter((p) => viaje.prendaIds.includes(p.id)).sort((a, b) => PARTES.indexOf(a.parte) - PARTES.indexOf(b.parte)) : []),
    [viaje, prendas],
  )
  const plan = useMemo(() => (viaje ? planViaje(valija, viaje.pronostico, viaje.ocasion) : []), [valija, viaje])
  const avisos = useMemo(() => (viaje ? faltantesValija(valija, viaje.pronostico) : []), [valija, viaje])

  if (viaje === undefined || !prendas) return null
  if (!viaje || viaje.deleted)
    return (
      <div className="p-6">
        <p>Este viaje ya no existe.</p>
        <Boton className="mt-4" onClick={cerrar}>Volver</Boton>
      </div>
    )

  const p = viaje.pronostico
  const estado = estadoViaje(viaje)
  const hayEstimados = p.some((d) => d.estimado)

  const autoValija = async () => {
    if (!p.length) return aviso('Esperá a que cargue el clima del destino')
    const ids = sugerirValija(prendas, p, viaje.ocasion)
    if (!ids.length) return aviso('Primero cargá prendas en tu placard')
    await actualizarViaje(viaje.id, { prendaIds: ids })
    aviso(`Te sugerí ${ids.length} prendas. Podés ajustarlas.`)
  }

  return (
    <div>
      <Encabezado
        sub={`${rangoFechas(viaje)} · ${estado.texto}`}
        titulo={viaje.nombre || viaje.destino.split(',')[0]}
        derecha={
          <button aria-label="Cerrar" onClick={cerrar} className="flex h-11 w-11 shrink-0 items-center justify-center border border-linea">
            <IconoCerrar />
          </button>
        }
      />

      <div className="space-y-7">
        {/* CLIMA */}
        <section className="space-y-3">
          <div className="px-4">
            <Rotulo>Clima en {viaje.destino.split(',')[0]}</Rotulo>
          </div>
          {p.length === 0 ? (
            <div className="mx-4 border border-linea bg-papel px-4 py-5 text-[14px] text-gris">
              {cargando ? 'Buscando el pronóstico…' : errorClima ? `${errorClima}. Revisá la conexión y volvé a abrir el viaje.` : 'Sin datos del clima todavía.'}
            </div>
          ) : (
            <>
              <div className="carrusel flex gap-2 overflow-x-auto px-4">
                {p.map((d) => (
                  <DiaCelda key={d.fecha} d={d} />
                ))}
              </div>
              <p className="px-4 text-[14px] leading-snug">
                {resumenClima(p)}
                {hayEstimados && <span className="text-gris"> Los días con * están estimados con el clima del año pasado.</span>}
              </p>
            </>
          )}
        </section>

        {/* VALIJA */}
        <section className="space-y-3 px-4">
          <Rotulo>
            Valija · {valija.length} {valija.length === 1 ? 'prenda' : 'prendas'}
          </Rotulo>
          {valija.length === 0 ? (
            <div className="relative border border-dashed border-tinta/50 bg-papel px-4 py-5">
              <Esquinas />
              <p className="text-[14px] leading-snug text-gris">Elegí qué te llevás, o dejá que te proponga una valija según el clima y el plan.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Boton chico onClick={autoValija} disabled={!p.length}>
                  Sugerir valija
                </Boton>
                <Boton chico variante="secundario" onClick={() => abrir({ tipo: 'valija', id: viaje.id })}>
                  Elegir prendas
                </Boton>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {valija.map((pr) => (
                  <Mini key={pr.id} prenda={pr} />
                ))}
              </div>
              <Boton variante="secundario" className="w-full" onClick={() => abrir({ tipo: 'valija', id: viaje.id })}>
                Editar valija
              </Boton>
            </>
          )}
          {avisos.length > 0 && valija.length > 0 && (
            <ul className="space-y-1.5">
              {avisos.map((a) => (
                <li key={a} className="flex items-start gap-2 text-[14px] leading-snug text-acento">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-acento" />
                  {a}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* PLAN */}
        {valija.length > 0 && p.length > 0 && (
          <section className="space-y-3 px-4">
            <Rotulo>Un look por día</Rotulo>
            <Segmentado etiqueta="Ocasión" opciones={OCASIONES} valor={viaje.ocasion} onChange={(o) => actualizarViaje(viaje.id, { ocasion: o })} />
            <div className="space-y-2">
              {plan.map(({ dia, sugerencia, faltan }) => (
                <div key={dia.fecha} className="relative border border-linea bg-papel">
                  <Esquinas />
                  <div className="flex items-center justify-between border-b border-linea px-3 py-2">
                    <span className="titulo text-[16px]">
                      {diaSemana(dia.fecha)} {diaCorto(dia.fecha)}
                    </span>
                    <span className="text-[13px] text-gris">
                      {dia.min}° / {dia.max}° · {climaPorTemp(dia.max)}
                      {dia.estimado && ' *'}
                    </span>
                  </div>
                  {sugerencia ? (
                    <div className="space-y-2 p-2">
                      <div className="flex gap-2">
                        {sugerencia.prendas.map((pr) => (
                          <div key={pr.id} className="w-[104px] shrink-0">
                            <Mini prenda={pr} />
                          </div>
                        ))}
                        <div className="grid min-w-0 flex-1 grid-cols-2 content-start gap-1.5">
                          {extrasDe(sugerencia).map((pr) => (
                            <Mini key={pr.id} prenda={pr} chico />
                          ))}
                        </div>
                      </div>
                      {sugerencia.avisoFrio && <p className="px-1 text-[13px] text-acento">{sugerencia.avisoFrio}</p>}
                      {esLluvia(dia.codigo) && <p className="px-1 text-[13px] text-gris">{descripcionCodigo(dia.codigo)}: calzado cerrado.</p>}
                    </div>
                  ) : (
                    <p className="p-3 text-[14px] text-gris">{faltan}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ACCIONES */}
        <section className="px-4">
          {confirmar ? (
            <div className="space-y-3 border border-acento p-4">
              <p className="text-[15px]">¿Borrar este viaje? Tus prendas no se borran.</p>
              <div className="grid grid-cols-2 gap-2">
                <Boton variante="secundario" onClick={() => setConfirmar(false)}>Cancelar</Boton>
                <Boton className="!border-acento !bg-acento" onClick={async () => (await borrarViaje(viaje.id), aviso('Viaje borrado'), cerrar())}>
                  Borrar
                </Boton>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" onClick={() => abrir({ tipo: 'viaje-editar', id: viaje.id })}>Editar viaje</Boton>
              <Boton variante="secundario" className="!border-acento !text-acento" onClick={() => setConfirmar(true)}>Borrar</Boton>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function DiaCelda({ d }: { d: DiaClima }) {
  const lluvia = esLluvia(d.codigo)
  return (
    <div className="relative w-[76px] shrink-0 border border-linea bg-papel px-2 py-2 text-center">
      <div className="rotulo !text-[11px]">{diaSemana(d.fecha)}</div>
      <div className="text-[12px] text-gris">{diaCorto(d.fecha)}</div>
      <div className="titulo mt-1.5 text-[24px]">
        {d.max}°{d.estimado && <span className="text-[14px] text-gris">*</span>}
      </div>
      <div className="text-[13px] text-gris">{d.min}°</div>
      <div className={`mt-1 truncate text-[11px] ${lluvia ? 'font-semibold text-acento' : 'text-gris'}`}>{descripcionCodigo(d.codigo)}</div>
    </div>
  )
}

function Mini({ prenda, chico }: { prenda: Prenda; chico?: boolean }) {
  const { abrir } = useNav()
  return (
    <button
      onClick={() => abrir({ tipo: 'prenda', id: prenda.id })}
      className={`w-full border bg-papel ${esBase(prenda) ? 'border-linea' : 'border-linea'}`}
      aria-label={prenda.nombre}
    >
      <div className={`${chico ? 'aspect-square p-1' : 'aspect-[4/5] p-1.5'}`}>
        <Foto blob={prenda.foto} alt={prenda.nombre} className="h-full w-full" />
      </div>
      {!chico && <div className="truncate border-t border-linea px-1.5 py-1 text-left text-[11px] font-medium">{prenda.nombre}</div>}
    </button>
  )
}

function resumenClima(p: DiaClima[]) {
  const min = Math.min(...p.map((d) => d.min))
  const max = Math.max(...p.map((d) => d.max))
  const lluvia = p.filter((d) => esLluvia(d.codigo)).length
  const climas = [...new Set(p.map((d) => climaPorTemp(d.max)))]
  const partes = [`Entre ${min}° y ${max}°`, climas.length === 1 ? `todos los días con ${climas[0] === 'Calor' ? 'calor' : climas[0] === 'Frío' ? 'frío' : 'clima templado'}` : `días de ${climas.map((c) => c.toLowerCase()).join(' y ')}`]
  if (lluvia) partes.push(`${lluvia} con lluvia`)
  if (p.some((d) => d.min < 16)) partes.push('mañanas frescas')
  return partes.join(', ') + '.'
}
