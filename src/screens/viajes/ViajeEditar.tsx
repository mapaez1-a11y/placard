import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Boton, Encabezado, IconoCerrar, Rotulo, Segmentado } from '../../components/ui'
import { db } from '../../lib/db'
import type { CiudadPref } from '../../lib/prefs'
import { actualizarViaje, crearViaje } from '../../lib/repo'
import { OCASIONES, type Ocasion } from '../../lib/types'
import { buscarCiudad, desdeIso, isoDia } from '../../lib/weather'
import { useNav } from '../../nav'

const campo = 'min-h-12 w-full rounded-none border border-linea bg-papel px-3 outline-none focus:border-tinta'
const enDias = (n: number) => isoDia(new Date(Date.now() + n * 86_400_000))

export default function ViajeEditar({ id }: { id?: string }) {
  const { cerrar, reemplazar, aviso } = useNav()
  const existente = useLiveQuery(() => (id ? db.viajes.get(id) : undefined), [id])

  const [destino, setDestino] = useState<CiudadPref | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<CiudadPref[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [desde, setDesde] = useState(enDias(1))
  const [hasta, setHasta] = useState(enDias(4))
  const [nombre, setNombre] = useState('')
  const [ocasion, setOcasion] = useState<Ocasion>('Finde')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!existente) return
    setDestino({ modo: 'manual', nombre: existente.destino, lat: existente.lat, lon: existente.lon })
    setDesde(existente.desde)
    setHasta(existente.hasta)
    setNombre(existente.nombre)
    setOcasion(existente.ocasion)
  }, [existente])

  const buscar = async (e: FormEvent) => {
    e.preventDefault()
    if (!busqueda.trim()) return
    setBuscando(true)
    try {
      setResultados(await buscarCiudad(busqueda.trim()))
    } catch {
      aviso('Necesitás conexión para buscar el destino')
    } finally {
      setBuscando(false)
    }
  }

  const guardar = async () => {
    if (!destino) return setError('Elegí el destino.')
    if (hasta < desde) return setError('La vuelta tiene que ser después de la ida.')
    const dias = Math.round((desdeIso(hasta).getTime() - desdeIso(desde).getTime()) / 86_400_000) + 1
    if (dias > 30) return setError('Por ahora los viajes pueden durar hasta 30 días.')
    const datos = { nombre: nombre.trim(), destino: destino.nombre, lat: destino.lat, lon: destino.lon, desde, hasta }
    if (id && existente) {
      const cambioLugarOFechas = existente.desde !== desde || existente.hasta !== hasta || existente.lat !== destino.lat
      await actualizarViaje(id, { ...datos, ocasion, ...(cambioLugarOFechas ? { pronostico: [], pronosticoAt: null } : {}) })
      aviso('Viaje actualizado')
      cerrar()
    } else {
      const nuevo = await crearViaje(datos, ocasion)
      reemplazar({ tipo: 'viaje', id: nuevo })
    }
  }

  return (
    <div>
      <Encabezado
        sub={id ? 'Editar viaje' : 'Nuevo viaje'}
        titulo={id ? 'Editar' : '¿A dónde vas?'}
        derecha={
          <button aria-label="Cerrar" onClick={cerrar} className="flex h-11 w-11 shrink-0 items-center justify-center border border-linea">
            <IconoCerrar />
          </button>
        }
      />
      <div className="space-y-6 px-4">
        <section className="space-y-2">
          <Rotulo>Destino</Rotulo>
          {destino && !resultados && (
            <div className="flex items-center justify-between gap-3 border border-tinta bg-papel px-3 py-2">
              <span className="text-[15px] font-medium">{destino.nombre}</span>
              <button className="min-h-11 shrink-0 text-[14px] underline underline-offset-4" onClick={() => setDestino(null)}>
                Cambiar
              </button>
            </div>
          )}
          {!destino && (
            <form onSubmit={buscar} className="flex gap-2">
              <input autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ciudad: Mendoza, Madrid…" className={campo} />
              <Boton type="submit" variante="secundario" className="shrink-0" disabled={buscando}>
                Buscar
              </Boton>
            </form>
          )}
          {resultados && (
            <ul className="border border-linea bg-papel">
              {resultados.length === 0 && <li className="p-3 text-[14px] text-gris">No encontré esa ciudad. Probá escribirla de otra forma.</li>}
              {resultados.map((c, i) => (
                <li key={i} className={i ? 'border-t border-linea' : ''}>
                  <button onClick={() => (setDestino(c), setResultados(null), setError(null))} className="min-h-11 w-full px-3 py-2 text-left text-[15px] active:bg-crema">
                    {c.nombre}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <Rotulo>Fechas</Rotulo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Ida">
              <input type="date" value={desde} onChange={(e) => (setDesde(e.target.value), e.target.value > hasta && setHasta(e.target.value))} className={campo} />
            </Campo>
            <Campo etiqueta="Vuelta">
              <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={campo} />
            </Campo>
          </div>
          <p className="text-[12px] leading-snug text-gris">Hasta 16 días adelante uso el pronóstico. Más lejos, lo estimo con el clima de esas fechas el año pasado.</p>
        </section>

        <section className="space-y-2">
          <Rotulo>Plan principal</Rotulo>
          <Segmentado etiqueta="Ocasión del viaje" opciones={OCASIONES} valor={ocasion} onChange={setOcasion} />
        </section>

        <Campo etiqueta="Nombre (opcional)">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Casamiento de Sofi" className={campo} />
        </Campo>

        {error && <p className="border-l-2 border-acento pl-3 text-[14px] text-acento">{error}</p>}
        <Boton className="w-full" onClick={guardar}>
          {id ? 'Guardar cambios' : 'Crear viaje'}
        </Boton>
      </div>
    </div>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="rotulo !text-[11px]">{etiqueta}</span>
      {children}
    </label>
  )
}
