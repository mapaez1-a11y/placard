import { useEffect, useMemo, useState } from 'react'
import { PrendaCard } from '../components/PrendaCard'
import { Boton, Encabezado, Foto, IconoAjustes, Rotulo, Segmentado, Tarjeta } from '../components/ui'
import { esHoy, fechaCorta, useLooks, usePrendas, useUsos, useViajes } from '../lib/hooks'
import { prefs } from '../lib/prefs'
import { usarLook } from '../lib/repo'
import { extrasDe, sugerir } from '../lib/suggest'
import { esBase, type Ocasion, type Prenda } from '../lib/types'
import { climaPorTemp, descripcionCodigo, isoDia, obtenerClima, type ClimaHoy } from '../lib/weather'
import { useNav } from '../nav'

const OCASIONES_HOY = ['Trabajo', 'Salida', 'Finde'] as const

export default function Hoy() {
  const { ir, abrir, aviso } = useNav()
  const prendas = usePrendas()
  const looks = useLooks()
  const usos = useUsos()
  const [clima, setClima] = useState<ClimaHoy | null>(() => prefs.getClimaCache<ClimaHoy>())
  const [cargandoClima, setCargandoClima] = useState(true)
  const [ocasion, setOcasion] = useState<Ocasion>(() => {
    const o = prefs.getOcasion()
    return (OCASIONES_HOY as readonly string[]).includes(o) ? o : 'Trabajo'
  })
  const [idx, setIdx] = useState(0)
  const [verOtras, setVerOtras] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const actualizarClima = () => {
    setCargandoClima(true)
    obtenerClima()
      .then(setClima)
      .finally(() => setCargandoClima(false))
  }
  useEffect(() => {
    actualizarClima()
    // Si la app quedó abierta y volvés a ella (por ejemplo, ya de viaje), se actualiza con tu ubicación nueva
    const alVolver = () => document.visibilityState === 'visible' && actualizarClima()
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [])

  // Si estás de viaje hoy, las sugerencias salen de la valija
  const viajes = useViajes()
  const [usarValija, setUsarValija] = useState(true)
  const viajeActivo = useMemo(() => {
    const hoy = isoDia(new Date())
    return viajes?.find((v) => v.desde <= hoy && hoy <= v.hasta && v.prendaIds.length > 0) ?? null
  }, [viajes])
  const disponibles = useMemo(() => {
    if (!prendas) return undefined
    if (!viajeActivo || !usarValija) return prendas
    return prendas.filter((p) => viajeActivo.prendaIds.includes(p.id))
  }, [prendas, viajeActivo, usarValija])

  const cambiarOcasion = (o: Ocasion) => {
    setOcasion(o)
    prefs.setOcasion(o)
    setIdx(0)
  }

  const resultado = useMemo(() => {
    if (!disponibles || !looks || !usos || !clima) return null
    return sugerir(disponibles, looks, usos, { max: clima.max, min: clima.min }, ocasion)
  }, [disponibles, looks, usos, clima, ocasion])

  // ¿Ya registraste un look hoy?
  const lookDeHoy = useMemo(() => {
    if (!usos || !looks || !prendas) return null
    const uso = usos.filter((u) => esHoy(u.fecha)).sort((a, b) => b.fecha - a.fecha)[0]
    if (!uso) return null
    const look = looks.find((l) => l.id === uso.lookId)
    if (!look) return null
    const ps = look.prendaIds.map((id) => prendas.find((p) => p.id === id)).filter((p): p is Prenda => !!p)
    return { uso, look, ps }
  }, [usos, looks, prendas])

  const opcion = resultado?.opciones.length ? resultado.opciones[idx % resultado.opciones.length] : null

  const usar = async () => {
    if (!opcion) return
    setGuardando(true)
    const extras = extrasDe(opcion).map((p) => p.id)
    await usarLook(opcion.prendas.map((p) => p.id), extras, ocasion)
    setGuardando(false)
    setVerOtras(false)
    setIdx(0)
    aviso('Listo, look registrado')
  }

  const otra = () => {
    if (!resultado || resultado.opciones.length < 2) return aviso('Por ahora es la única combinación posible')
    setIdx((i) => i + 1)
  }

  return (
    <div className="aparecer">
      <Encabezado
        sub={fechaCorta()}
        titulo="¿Qué me pongo?"
        derecha={
          <button aria-label="Ajustes" onClick={() => abrir({ tipo: 'ajustes' })} className="flex h-11 w-11 items-center justify-center border border-linea">
            <IconoAjustes />
          </button>
        }
      />

      <div className="space-y-5 px-4">
        <TarjetaClima clima={clima} cargando={cargandoClima} onRefrescar={actualizarClima} />

        {prendas && prendas.length === 0 ? (
          <Tarjeta className="px-5 py-8 text-center">
            <div className="titulo text-[24px]">Todavía no cargaste ropa</div>
            <p className="mx-auto mt-2 max-w-[260px] text-[14px] text-gris">Sacale una foto a tus prendas y te armo looks según el clima y la ocasión.</p>
            <Boton className="mt-5 w-full" onClick={() => ir('agregar')}>
              Agregar prenda
            </Boton>
          </Tarjeta>
        ) : lookDeHoy && !verOtras ? (
          <section className="space-y-4">
            <Rotulo>Tu look de hoy</Rotulo>
            <GrillaLook ps={lookDeHoy.ps.filter(esBase)} />
            <Extras ps={lookDeHoy.ps.filter((p) => !esBase(p))} />
            <p className="text-[14px] leading-snug text-gris">
              Lo registraste a las {new Date(lookDeHoy.uso.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}. Mañana te sugiero otro distinto.
            </p>
            <Boton variante="secundario" className="w-full" onClick={() => setVerOtras(true)}>
              Ver otras opciones
            </Boton>
          </section>
        ) : (
          <>
            {viajeActivo && (
              <div className="flex items-center justify-between gap-3 border border-acento px-3 py-2">
                <span className="text-[14px] leading-snug">
                  {usarValija ? <>De viaje en <b>{viajeActivo.destino.split(',')[0]}</b>: te sugiero con lo que llevaste.</> : 'Te sugiero con todo tu placard.'}
                </span>
                <button onClick={() => (setUsarValija(!usarValija), setIdx(0))} className="min-h-11 shrink-0 text-[14px] underline underline-offset-4">
                  {usarValija ? 'Ver todo' : 'Solo valija'}
                </button>
              </div>
            )}
            <Segmentado etiqueta="Ocasión" opciones={OCASIONES_HOY} valor={ocasion} onChange={cambiarOcasion} />

            {!resultado ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="aspect-[4/5] animate-pulse border border-linea bg-papel" />
                <div className="aspect-[4/5] animate-pulse border border-linea bg-papel" />
              </div>
            ) : resultado.faltan || !opcion ? (
              <Tarjeta className="px-5 py-6">
                <p className="text-[15px] leading-snug">{resultado.faltan}</p>
                <Boton variante="secundario" className="mt-4 w-full" onClick={() => ir('agregar')}>
                  Agregar prenda
                </Boton>
              </Tarjeta>
            ) : (
              <section key={`${ocasion}-${idx}`} className="aparecer space-y-4">
                <Rotulo>
                  Look sugerido · {(idx % resultado.opciones.length) + 1}/{resultado.opciones.length}
                </Rotulo>
                <GrillaLook ps={opcion.prendas} />
                <p className="text-[15px] leading-snug">{opcion.motivo}</p>

                {opcion.avisoFrio && (
                  <div className="space-y-2">
                    <p className="flex items-start gap-2 text-[14px] font-medium text-acento">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-acento" />
                      {opcion.avisoFrio}
                    </p>
                  </div>
                )}
                <Extras ps={extrasDe(opcion)} />
                {opcion.aviso && <p className="text-[13px] leading-snug text-gris">{opcion.aviso}</p>}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Boton variante="secundario" onClick={otra}>
                    Otra opción
                  </Boton>
                  <Boton onClick={usar} disabled={guardando}>
                    Usar este look
                  </Boton>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function GrillaLook({ ps }: { ps: Prenda[] }) {
  if (ps.length === 1)
    return (
      <div className="mx-auto w-2/3">
        <PrendaCard prenda={ps[0]} detalle="parte" />
      </div>
    )
  return (
    <div className="grid grid-cols-2 gap-3">
      {ps.map((p) => (
        <PrendaCard key={p.id} prenda={p} detalle="parte" />
      ))}
    </div>
  )
}

const ETIQUETA_EXTRA: Record<string, string> = {
  Abrigo: 'Sumá abrigo',
  Calzado: 'Calzado',
  Cartera: 'Cartera',
  Accesorio: 'Accesorio',
  Cinturón: 'Cinturón',
}

function Extras({ ps }: { ps: Prenda[] }) {
  const { abrir } = useNav()
  if (!ps.length) return null
  return (
    <div className="grid grid-cols-3 gap-2">
      {ps.map((p) => (
        <button
          key={p.id}
          onClick={() => abrir({ tipo: 'prenda', id: p.id })}
          className={`relative border bg-papel text-left active:bg-crema ${p.parte === 'Abrigo' ? 'border-acento' : 'border-linea'}`}
        >
          <div className="aspect-square p-2">
            <Foto blob={p.foto} alt={p.nombre} className="h-full w-full" />
          </div>
          <div className="border-t border-linea px-2 py-1.5">
            <div className={`rotulo !text-[10px] ${p.parte === 'Abrigo' ? '!text-acento' : ''}`}>{ETIQUETA_EXTRA[p.parte] ?? p.parte}</div>
            <div className="truncate text-[12px] font-medium">{p.nombre}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

function TarjetaClima({ clima, cargando, onRefrescar }: { clima: ClimaHoy | null; cargando: boolean; onRefrescar: () => void }) {
  if (!clima)
    return (
      <Tarjeta className="flex h-[112px] items-center px-5">
        <span className="rotulo">Buscando el clima…</span>
      </Tarjeta>
    )
  const categoria = climaPorTemp(clima.max)
  return (
    <Tarjeta onClick={onRefrescar} className="flex w-full items-stretch">
      <div className="flex w-[118px] shrink-0 flex-col justify-center border-r border-linea px-4 py-4">
        <div className="titulo text-[58px] leading-[0.9]">{clima.actual}°</div>
        <div className="rotulo mt-1">Ahora</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[15px] font-semibold">{clima.ciudad.split(',')[0]}</span>
          <span className="titulo shrink-0 border border-acento px-2 py-0.5 text-[13px] text-acento">{categoria}</span>
        </div>
        <div className="text-[14px] text-gris">{descripcionCodigo(clima.codigo)}</div>
        <div className="text-[14px]">
          Mín <b className="font-semibold">{clima.min}°</b> · Máx <b className="font-semibold">{clima.max}°</b>
        </div>
        <div className="rotulo !text-[11px]">
          {cargando ? 'Buscando tu ubicación…' : clima.offline ? 'Sin conexión · último dato guardado' : clima.fuente === 'gps' ? 'Tu ubicación actual' : 'Sin permiso de ubicación'}
        </div>
      </div>
    </Tarjeta>
  )
}
