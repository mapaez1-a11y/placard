import { useCallback, useEffect, useRef, useState } from 'react'
import { IconoCapas, IconoEstrella, IconoGrilla, IconoMas, IconoSol, IconoValija, Toast } from './components/ui'
import { NavContext, type Capa, type Tab } from './nav'
import Agregar from './screens/Agregar'
import Ajustes from './screens/Ajustes'
import Armar from './screens/Armar'
import Favoritos from './screens/Favoritos'
import Hoy from './screens/Hoy'
import LookDetalle from './screens/LookDetalle'
import Placard from './screens/Placard'
import PrendaDetalle from './screens/PrendaDetalle'
import Valija from './screens/viajes/Valija'
import ViajeDetalle from './screens/viajes/ViajeDetalle'
import ViajeEditar from './screens/viajes/ViajeEditar'
import Viajes from './screens/viajes/Viajes'

const TABS: { id: Tab; nombre: string; Icono: typeof IconoSol }[] = [
  { id: 'hoy', nombre: 'Hoy', Icono: IconoSol },
  { id: 'armar', nombre: 'Armar', Icono: IconoCapas },
  { id: 'placard', nombre: 'Placard', Icono: IconoGrilla },
  { id: 'viajes', nombre: 'Viajes', Icono: IconoValija },
  { id: 'favoritos', nombre: 'Favoritos', Icono: IconoEstrella },
  { id: 'agregar', nombre: 'Agregar', Icono: IconoMas },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('hoy')
  const [capas, setCapas] = useState<Capa[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // El botón "atrás" del celular cierra la capa abierta en vez de salir de la app
  useEffect(() => {
    const onPop = () => setCapas((c) => c.slice(0, -1))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const abrir = useCallback((c: Capa) => {
    history.pushState({ capa: true }, '')
    setCapas((cs) => [...cs, c])
  }, [])
  const cerrar = useCallback(() => history.back(), [])
  const reemplazar = useCallback((c: Capa) => setCapas((cs) => [...cs.slice(0, -1), c]), [])
  const capasRef = useRef(capas)
  capasRef.current = capas
  const ir = useCallback((t: Tab) => {
    // Cerrar capas abiertas al cambiar de pestaña
    const n = capasRef.current.length
    if (n) history.go(-n)
    setCapas([])
    setTab(t)
    window.scrollTo({ top: 0 })
  }, [])
  const aviso = useCallback((texto: string) => {
    setToast(texto)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }, [])

  const capa = capas[capas.length - 1]

  return (
    <NavContext.Provider value={{ tab, ir, abrir, cerrar, reemplazar, aviso }}>
      <div className="mx-auto min-h-dvh max-w-[480px] bg-crema">
        <main className="pb-tabbar">
          {tab === 'hoy' && <Hoy />}
          {tab === 'armar' && <Armar />}
          {tab === 'placard' && <Placard />}
          {tab === 'viajes' && <Viajes />}
          {tab === 'favoritos' && <Favoritos />}
          {tab === 'agregar' && <Agregar key="nueva" />}
        </main>

        {capa && (
          <div key={`${capas.length}-${capa.tipo}-${"id" in capa ? capa.id : ""}`} className="aparecer fixed inset-0 z-30 overflow-y-auto bg-crema">
            <div className="pb-tabbar mx-auto max-w-[480px]">
              {capa.tipo === 'prenda' && <PrendaDetalle id={capa.id} />}
              {capa.tipo === 'editar' && <Agregar idEditar={capa.id} />}
              {capa.tipo === 'ajustes' && <Ajustes />}
              {capa.tipo === 'look' && <LookDetalle id={capa.id} />}
              {capa.tipo === 'nueva' && <Agregar tipoInicial={capa.tipoInicial} />}
              {capa.tipo === 'viaje' && <ViajeDetalle id={capa.id} />}
              {capa.tipo === 'viaje-editar' && <ViajeEditar id={capa.id} />}
              {capa.tipo === 'valija' && <Valija id={capa.id} />}
            </div>
          </div>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-tinta bg-crema pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto grid max-w-[480px] grid-cols-6">
            {TABS.map(({ id, nombre, Icono }) => {
              const activo = tab === id && !capa
              return (
                <button
                  key={id}
                  onClick={() => ir(id)}
                  aria-current={activo ? 'page' : undefined}
                  className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 ${activo ? 'text-tinta' : 'text-gris'}`}
                >
                  {activo && <span className="absolute inset-x-3 top-0 h-[3px] bg-acento" />}
                  <Icono className="h-6 w-6" />
                  <span className="titulo text-[11px] tracking-[0.04em]">{nombre}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <Toast texto={toast} />
      </div>
    </NavContext.Provider>
  )
}
