import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Boton, Chip, Encabezado, Esquinas, Foto, IconoCamara, IconoCerrar, IconoGaleria, Rotulo } from '../components/ui'
import { db } from '../lib/db'
import { comprimirFoto, quitarFondo } from '../lib/image'
import { crearPrenda, editarPrenda } from '../lib/repo'
import { CLIMAS, OCASIONES, PARTE_POR_TIPO, PARTES, PARTES_COMPLEMENTO, TIPOS, type Clima, type Ocasion, type Parte, type Tipo } from '../lib/types'
import { useNav } from '../nav'

const COLORES = ['Blanco', 'Negro', 'Gris', 'Beige', 'Crema', 'Camel', 'Marrón', 'Azul marino', 'Celeste', 'Jean', 'Verde', 'Oliva', 'Rojo', 'Bordó', 'Rosa', 'Amarillo', 'Naranja', 'Violeta', 'Estampado', 'Rayado', 'Dorado', 'Plateado', 'Perlado']
const TELAS = ['Algodón', 'Lino', 'Seda', 'Satén', 'Jean', 'Lana', 'Hilo', 'Morley', 'Gabardina', 'Cuero', 'Ecocuero', 'Poliéster', 'Viscosa', 'Paño', 'Plush', 'Corderoy', 'Gasa', 'Tejido', 'Metal', 'Oro', 'Plata', 'Acero', 'Perlas', 'Rafia', 'Gamuza']
const esComplemento = (t: Tipo) => PARTES_COMPLEMENTO.includes(PARTE_POR_TIPO[t])
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export default function Agregar({ idEditar, tipoInicial }: { idEditar?: string; tipoInicial?: Tipo }) {
  const { ir, cerrar, aviso } = useNav()
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  const [foto, setFoto] = useState<Blob | null>(null)
  const [original, setOriginal] = useState<Blob | null>(null)
  const [fotoCambio, setFotoCambio] = useState(false)
  const [procesando, setProcesando] = useState<string | null>(null)

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<Tipo>(tipoInicial ?? 'remera')
  const [parte, setParte] = useState<Parte>(PARTE_POR_TIPO[tipoInicial ?? 'remera'])
  const [color, setColor] = useState('')
  const [tela, setTela] = useState('')
  const [clima, setClima] = useState<Clima[]>(tipoInicial && esComplemento(tipoInicial) ? [...CLIMAS] : [])
  const [ocasiones, setOcasiones] = useState<Ocasion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!idEditar) return
    db.prendas.get(idEditar).then((p) => {
      if (!p) return
      setFoto(p.foto)
      setOriginal(p.foto)
      setNombre(p.nombre)
      setTipo(p.tipo)
      setParte(p.parte)
      setColor(p.color)
      setTela(p.tela)
      setClima(p.clima)
      setOcasiones(p.ocasiones)
    })
  }, [idEditar])

  const elegirFoto = async (file: File | undefined) => {
    if (!file) return
    setProcesando('Procesando foto…')
    try {
      setOriginal(file)
      setFoto(await comprimirFoto(file))
      setFotoCambio(true)
      setError(null)
    } catch {
      aviso('No pude leer esa foto. Probá con otra.')
    } finally {
      setProcesando(null)
    }
  }

  const sacarFondo = async () => {
    if (!original) return
    setProcesando('Preparando…')
    try {
      const sinFondo = await quitarFondo(original, (p) => setProcesando(p < 1 ? `Descargando modelo ${Math.round(p * 100)}%` : 'Quitando el fondo…'))
      setFoto(sinFondo)
      setFotoCambio(true)
    } catch (e) {
      console.error(e)
      aviso('No se pudo quitar el fondo (necesita conexión la primera vez)')
    } finally {
      setProcesando(null)
    }
  }

  const cambiarTipo = (t: Tipo) => {
    setTipo(t)
    setParte(PARTE_POR_TIPO[t])
    // Carteras, aros, collares y cinturones sirven con cualquier clima
    if (esComplemento(t) && !clima.length) setClima([...CLIMAS])
  }

  const toggle = <T,>(lista: T[], set: (l: T[]) => void, v: T) => set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])

  const guardar = async () => {
    if (!foto) return setError('Falta la foto de la prenda.')
    if (!clima.length) return setError('Elegí al menos un clima.')
    if (!ocasiones.length) return setError('Elegí al menos una ocasión.')
    setGuardando(true)
    const datos = {
      nombre: nombre.trim() || [cap(tipo), color.trim().toLowerCase()].filter(Boolean).join(' '),
      tipo,
      parte,
      color: color.trim(),
      tela: tela.trim(),
      clima: CLIMAS.filter((c) => clima.includes(c)),
      ocasiones: OCASIONES.filter((o) => ocasiones.includes(o)),
    }
    try {
      if (idEditar) {
        await editarPrenda(idEditar, datos, fotoCambio ? foto : undefined)
        aviso('Cambios guardados')
        cerrar()
      } else {
        await crearPrenda(datos, foto)
        aviso('Guardada en el placard')
        ir('placard')
      }
    } catch (e) {
      console.error(e)
      setError('No se pudo guardar. ¿Tenés espacio libre en el celular?')
      setGuardando(false)
    }
  }

  return (
    <div className="aparecer">
      <Encabezado
        sub={idEditar ? 'Editar prenda' : 'Nueva prenda'}
        titulo={idEditar ? 'Editar' : 'Agregar'}
        derecha={
          (idEditar || tipoInicial) && (
            <button aria-label="Cerrar" onClick={cerrar} className="flex h-11 w-11 items-center justify-center border border-linea">
              <IconoCerrar />
            </button>
          )
        }
      />

      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (elegirFoto(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => (elegirFoto(e.target.files?.[0]), (e.target.value = ''))} />

      <div className="space-y-5 px-4">
        {/* Foto */}
        {foto ? (
          <div className="space-y-2">
            <div className="relative border border-linea bg-papel">
              <Esquinas />
              <div className="aspect-square p-4">
                <Foto blob={foto} alt="Vista previa" className="h-full w-full" />
              </div>
              {procesando && (
                <div className="absolute inset-0 flex items-center justify-center bg-papel/80">
                  <span className="titulo text-[16px]">{procesando}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Boton variante="secundario" chico onClick={() => camara.current?.click()} disabled={!!procesando}>
                Otra foto
              </Boton>
              <Boton variante="secundario" chico onClick={sacarFondo} disabled={!!procesando || !original}>
                Quitar fondo
              </Boton>
            </div>
            <button onClick={() => galeria.current?.click()} className="min-h-11 w-full text-[14px] text-gris underline underline-offset-4">
              Elegir otra de la galería
            </button>
          </div>
        ) : (
          <div className="relative border border-dashed border-tinta/50 bg-papel">
            <Esquinas />
            <div className="flex flex-col items-center px-5 pb-5 pt-8 text-center">
              <IconoCamara className="h-10 w-10" />
              <p className="mt-3 text-[14px] text-gris">Poné la prenda sobre un fondo liso y claro, con buena luz.</p>
              <div className="mt-5 grid w-full grid-cols-2 gap-2">
                <Boton onClick={() => camara.current?.click()} disabled={!!procesando}>
                  <IconoCamara className="h-5 w-5" /> Sacar foto
                </Boton>
                <Boton variante="secundario" onClick={() => galeria.current?.click()} disabled={!!procesando}>
                  <IconoGaleria className="h-5 w-5" /> Galería
                </Boton>
              </div>
              {procesando && <div className="rotulo mt-3">{procesando}</div>}
            </div>
          </div>
        )}

        {/* Datos */}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Tipo">
            <Selector value={tipo} onChange={(v) => cambiarTipo(v as Tipo)} opciones={TIPOS.map((t) => [t, cap(t)])} />
          </Campo>
          <Campo etiqueta="Parte">
            <Selector value={parte} onChange={(v) => setParte(v as Parte)} opciones={PARTES.map((p) => [p, p])} />
          </Campo>
          <Campo etiqueta="Color">
            <input list="colores" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Blanco" className={estiloCampo} />
          </Campo>
          <Campo etiqueta={esComplemento(tipo) ? 'Material' : 'Tela'}>
            <input list="telas" value={tela} onChange={(e) => setTela(e.target.value)} placeholder="Algodón" className={estiloCampo} />
          </Campo>
          <div className="col-span-2">
            <Campo etiqueta="Nombre (opcional)">
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={[cap(tipo), color.toLowerCase()].filter(Boolean).join(' ') || 'Blusa blanca'}
                className={estiloCampo}
              />
            </Campo>
          </div>
        </div>
        <datalist id="colores">{COLORES.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="telas">{TELAS.map((t) => <option key={t} value={t} />)}</datalist>

        <div className="space-y-2">
          <Rotulo>Clima</Rotulo>
          <div className="grid grid-cols-3 border border-tinta">
            {CLIMAS.map((c, i) => (
              <button
                key={c}
                aria-pressed={clima.includes(c)}
                onClick={() => toggle(clima, setClima, c)}
                className={`titulo min-h-11 text-[16px] ${i ? 'border-l border-tinta' : ''} ${clima.includes(c) ? 'bg-tinta text-crema' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-gris">{esComplemento(tipo) ? 'Para carteras y accesorios podés dejar los tres.' : 'Podés elegir más de uno.'}</p>
        </div>

        <div className="space-y-2">
          <Rotulo>Ocasión</Rotulo>
          <div className="flex flex-wrap gap-2">
            {OCASIONES.map((o) => (
              <Chip key={o} activo={ocasiones.includes(o)} onClick={() => toggle(ocasiones, setOcasiones, o)}>
                {o}
              </Chip>
            ))}
          </div>
        </div>

        {error && <p className="border-l-2 border-acento pl-3 text-[14px] text-acento">{error}</p>}

        <Boton className="w-full" onClick={guardar} disabled={guardando || !!procesando}>
          {idEditar ? 'Guardar cambios' : 'Guardar en el placard'}
        </Boton>
      </div>
    </div>
  )
}

const estiloCampo = 'min-h-12 w-full appearance-none rounded-none border border-linea bg-papel px-3 outline-none focus:border-tinta'

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="rotulo !text-[11px]">{etiqueta}</span>
      {children}
    </label>
  )
}

function Selector({ value, onChange, opciones }: { value: string; onChange: (v: string) => void; opciones: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${estiloCampo} pr-9`}>
        {opciones.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}
