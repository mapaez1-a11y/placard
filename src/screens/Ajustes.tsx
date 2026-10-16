import type { Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Boton, Encabezado, IconoCerrar, Rotulo } from '../components/ui'
import { exportarBackup, importarBackup } from '../lib/backup'
import { pedirPersistencia } from '../lib/db'
import { haceCuanto, usePrendas } from '../lib/hooks'
import { prefs, type CiudadPref } from '../lib/prefs'
import { borrarTodo } from '../lib/repo'
import { supabase } from '../lib/supabase'
import { alCerrarSesion, sincronizar, useEstadoSync } from '../lib/sync'
import { buscarCiudad } from '../lib/weather'
import { useNav } from '../nav'

export default function Ajustes() {
  const { cerrar } = useNav()
  return (
    <div>
      <Encabezado
        sub="Placard"
        titulo="Ajustes"
        derecha={
          <button aria-label="Cerrar" onClick={cerrar} className="flex h-11 w-11 items-center justify-center border border-linea">
            <IconoCerrar />
          </button>
        }
      />
      <div className="space-y-8 px-4">
        <Cuenta />
        <Ciudad />
        <Datos />
        <p className="rotulo pb-4 text-center !text-[11px]">Placard v1.0 · tus datos quedan en este dispositivo</p>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <Rotulo>{titulo}</Rotulo>
      {children}
    </section>
  )
}

const campo = 'min-h-12 w-full rounded-none border border-linea bg-papel px-3 outline-none focus:border-tinta'

// ---------- Cuenta ----------

function useSesion() {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    if (!supabase) return setSesion(null)
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return sesion
}

function Cuenta() {
  const sesion = useSesion()
  const estado = useEstadoSync()
  const { aviso } = useNav()

  if (!supabase)
    return (
      <Seccion titulo="Cuenta y sincronización">
        <p className="text-[14px] leading-snug text-gris">
          La sincronización entre dispositivos no está configurada. Todo se guarda en este celular. Para activarla, seguí los pasos de Supabase del README.
        </p>
      </Seccion>
    )

  if (sesion === undefined) return null
  if (!sesion) return <Login />

  const textoEstado = {
    'sin-config': '',
    'sin-sesion': '',
    sincronizando: 'Sincronizando…',
    offline: 'Sin conexión: se sincroniza cuando vuelva internet',
    listo: estado.tipo === 'listo' && estado.ultimo ? `Sincronizado · ${haceCuantoCorto(estado.ultimo)}` : 'Listo',
    error: estado.tipo === 'error' ? `Error al sincronizar: ${estado.mensaje}` : '',
  }[estado.tipo]

  return (
    <Seccion titulo="Cuenta y sincronización">
      <div className="space-y-1">
        <div className="text-[15px] font-medium">{sesion.user.email}</div>
        <div className={`text-[14px] ${estado.tipo === 'error' ? 'text-acento' : 'text-gris'}`}>{textoEstado}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" chico onClick={() => sincronizar()} disabled={estado.tipo === 'sincronizando'}>
          Sincronizar ahora
        </Boton>
        <Boton
          variante="secundario"
          chico
          onClick={async () => {
            await supabase!.auth.signOut()
            await alCerrarSesion()
            aviso('Sesión cerrada. Tus prendas siguen en el celular.')
          }}
        >
          Cerrar sesión
        </Boton>
      </div>
    </Seccion>
  )
}

function haceCuantoCorto(ts: number) {
  const min = Math.floor((Date.now() - ts) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  return haceCuanto(ts).toLowerCase()
}

function Login() {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setMsg(null)
    const sb = supabase!
    const { data, error } =
      modo === 'entrar'
        ? await sb.auth.signInWithPassword({ email, password: clave })
        : await sb.auth.signUp({ email, password: clave, options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href } })
    setEnviando(false)
    if (error) return setMsg({ tipo: 'error', texto: traducirError(error.message) })
    if (modo === 'crear' && !data.session) setMsg({ tipo: 'ok', texto: 'Te mandamos un mail para confirmar la cuenta. Después volvé y entrá.' })
  }

  return (
    <Seccion titulo="Cuenta y sincronización">
      <p className="text-[14px] leading-snug text-gris">
        Entrá con tu cuenta para tener el placard en todos tus dispositivos. Sin cuenta, la app funciona igual en este celular.
      </p>
      <form onSubmit={enviar} className="space-y-2">
        <input type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          placeholder="Contraseña (mínimo 6 caracteres)"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className={campo}
        />
        {msg && <p className={`text-[14px] ${msg.tipo === 'error' ? 'text-acento' : ''}`}>{msg.texto}</p>}
        <Boton type="submit" className="w-full" disabled={enviando}>
          {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </Boton>
      </form>
      <button onClick={() => (setModo(modo === 'entrar' ? 'crear' : 'entrar'), setMsg(null))} className="min-h-11 w-full text-[14px] underline underline-offset-4">
        {modo === 'entrar' ? '¿No tenés cuenta? Creala' : 'Ya tengo cuenta'}
      </button>
    </Seccion>
  )
}

function traducirError(m: string) {
  if (/invalid login/i.test(m)) return 'Email o contraseña incorrectos.'
  if (/not confirmed/i.test(m)) return 'Todavía no confirmaste tu email. Revisá tu casilla.'
  if (/already registered/i.test(m)) return 'Ese email ya tiene cuenta. Probá entrar.'
  if (/network|fetch/i.test(m)) return 'Sin conexión. Probá de nuevo cuando tengas internet.'
  return m
}

// ---------- Ciudad ----------

function Ciudad() {
  const [actual, setActual] = useState<CiudadPref | null>(prefs.getCiudad())
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<CiudadPref[] | null>(null)
  const { aviso } = useNav()

  const buscar = async (e: FormEvent) => {
    e.preventDefault()
    if (!busqueda.trim()) return
    try {
      setResultados(await buscarCiudad(busqueda.trim()))
    } catch {
      aviso('Sin conexión para buscar ciudades')
    }
  }
  const elegir = (c: CiudadPref | null) => {
    prefs.setCiudad(c)
    prefs.setClimaCache(null)
    setActual(c)
    setResultados(null)
    setBusqueda('')
    aviso(c ? `Respaldo: ${c.nombre.split(',')[0]}` : 'Respaldo: Buenos Aires')
  }

  return (
    <Seccion titulo="Ubicación para el clima">
      <p className="text-[14px] leading-snug text-gris">
        Cada vez que abrís Placard uso tu ubicación actual, así si viajás el clima se actualiza solo. Esta ciudad se usa solo si no das permiso de ubicación.
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px]">
          <span className="rotulo mr-2 !text-[11px]">Respaldo</span>
          {actual ? actual.nombre : 'Buenos Aires'}
        </div>
        {actual && (
          <button onClick={() => elegir(null)} className="min-h-11 shrink-0 text-[14px] underline underline-offset-4">
            Quitar
          </button>
        )}
      </div>
      <form onSubmit={buscar} className="flex gap-2">
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar ciudad de respaldo" className={campo} />
        <Boton type="submit" variante="secundario" className="shrink-0">Buscar</Boton>
      </form>
      {resultados && (
        <ul className="border border-linea bg-papel">
          {resultados.length === 0 && <li className="p-3 text-[14px] text-gris">No encontré esa ciudad.</li>}
          {resultados.map((c, i) => (
            <li key={i} className={i ? 'border-t border-linea' : ''}>
              <button onClick={() => elegir(c)} className="min-h-11 w-full px-3 py-2 text-left text-[15px] active:bg-crema">
                {c.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  )
}

// ---------- Datos ----------

function Datos() {
  const { aviso } = useNav()
  const prendas = usePrendas()
  const archivo = useRef<HTMLInputElement>(null)
  const [persistente, setPersistente] = useState<boolean | null>(null)
  const [uso, setUso] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistente).catch(() => setPersistente(null))
    navigator.storage?.estimate?.().then((e) => e.usage != null && setUso(`${(e.usage / 1024 / 1024).toFixed(1)} MB`))
  }, [prendas?.length])

  const exportar = async () => {
    setOcupado(true)
    try {
      const n = await exportarBackup()
      aviso(`Backup listo: ${n} prendas`)
    } catch {
      aviso('No se pudo exportar')
    } finally {
      setOcupado(false)
    }
  }

  const importar = async (f: File | undefined) => {
    if (!f) return
    setOcupado(true)
    try {
      const r = await importarBackup(f)
      aviso(`Importé ${r.prendas} prendas y ${r.looks} looks`)
    } catch (e) {
      aviso(e instanceof Error ? e.message : 'Archivo inválido')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Seccion titulo="Tus datos">
      <dl className="border-t border-linea text-[15px]">
        <Fila k="Prendas" v={String(prendas?.length ?? '—')} />
        <Fila k="Espacio usado" v={uso ?? '—'} />
        <Fila
          k="Protección"
          v={
            persistente ? (
              'Datos protegidos'
            ) : (
              <button className="underline underline-offset-4" onClick={async () => setPersistente(await pedirPersistencia())}>
                Pedir protección
              </button>
            )
          }
        />
      </dl>
      {persistente === false && (
        <p className="text-[13px] leading-snug text-gris">
          El navegador puede borrar datos si se queda sin espacio. Instalá la app en la pantalla de inicio y hacé backups de vez en cuando.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" chico onClick={exportar} disabled={ocupado}>Exportar backup</Boton>
        <Boton variante="secundario" chico onClick={() => archivo.current?.click()} disabled={ocupado}>Importar backup</Boton>
      </div>
      <input ref={archivo} type="file" accept="application/json,.json" className="hidden" onChange={(e) => (importar(e.target.files?.[0]), (e.target.value = ''))} />

      {confirmar ? (
        <div className="space-y-3 border border-acento p-4">
          <p className="text-[14px] leading-snug">
            ¿Borrar todas las prendas, looks e historial? {supabase ? 'Si tenés sesión iniciada, también se borran de tus otros dispositivos. ' : ''}No se puede deshacer.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" chico onClick={() => setConfirmar(false)}>Cancelar</Boton>
            <Boton chico className="!border-acento !bg-acento" onClick={async () => (await borrarTodo(), setConfirmar(false), aviso('Listo, placard vacío'))}>
              Borrar todo
            </Boton>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmar(true)} className="min-h-11 w-full text-[14px] text-acento underline underline-offset-4">
          Borrar todos los datos
        </button>
      )}
    </Seccion>
  )
}

function Fila({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-linea">
      <dt className="rotulo">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
