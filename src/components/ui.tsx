import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useBlobUrl } from '../lib/hooks'

/** Marcas en las 4 esquinas, como en un plano */
export function Esquinas() {
  const base = 'pointer-events-none absolute h-2 w-2 border-tinta'
  return (
    <>
      <span className={`${base} -left-px -top-px border-l-[1.5px] border-t-[1.5px]`} />
      <span className={`${base} -right-px -top-px border-r-[1.5px] border-t-[1.5px]`} />
      <span className={`${base} -bottom-px -left-px border-b-[1.5px] border-l-[1.5px]`} />
      <span className={`${base} -bottom-px -right-px border-b-[1.5px] border-r-[1.5px]`} />
    </>
  )
}

export function Tarjeta({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      onClick={onClick}
      className={`relative border border-linea bg-papel text-left ${onClick ? 'active:bg-crema transition-colors' : ''} ${className}`}
    >
      <Esquinas />
      {children}
    </Comp>
  )
}

type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'texto'; chico?: boolean }

export function Boton({ variante = 'primario', chico, className = '', children, ...rest }: BotonProps) {
  const estilos = {
    primario: 'bg-tinta text-crema border border-tinta active:bg-acento active:border-acento',
    secundario: 'bg-transparent text-tinta border border-tinta active:bg-tinta/5',
    texto: 'bg-transparent text-tinta border border-transparent underline underline-offset-4',
  }[variante]
  return (
    <button
      {...rest}
      className={`titulo inline-flex items-center justify-center gap-2 ${chico ? 'min-h-11 px-3 text-[15px]' : 'min-h-12 px-4 text-[17px]'} transition-colors disabled:opacity-40 ${estilos} ${className}`}
    >
      {children}
    </button>
  )
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: readonly T[]
  valor: T
  onChange: (v: T) => void
  etiqueta: string
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="grid border border-tinta" style={{ gridTemplateColumns: `repeat(${opciones.length}, 1fr)` }}>
      {opciones.map((o, i) => (
        <button
          key={o}
          role="radio"
          aria-checked={valor === o}
          onClick={() => onChange(o)}
          className={`titulo min-h-11 text-[16px] transition-colors ${i ? 'border-l border-tinta' : ''} ${valor === o ? 'bg-tinta text-crema' : 'text-tinta'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Chip({ activo, onClick, children }: { activo?: boolean; onClick?: () => void; children: ReactNode }) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      onClick={onClick}
      aria-pressed={onClick ? !!activo : undefined}
      className={`inline-flex items-center border px-3 text-[13px] font-medium transition-colors ${onClick ? 'min-h-11' : 'min-h-7'} ${
        activo ? 'border-acento bg-acento text-papel' : 'border-linea bg-papel text-tinta'
      }`}
    >
      {children}
    </Comp>
  )
}

export function Foto({ blob, alt, className = '' }: { blob: Blob | null | undefined; alt: string; className?: string }) {
  const url = useBlobUrl(blob)
  if (!url)
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <IconoPercha className="h-10 w-10 text-linea" />
      </div>
    )
  return <img src={url} alt={alt} className={`foto ${className}`} draggable={false} />
}

export function Encabezado({ titulo, sub, derecha }: { titulo: string; sub?: ReactNode; derecha?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div>
        {sub && <div className="rotulo mb-1.5">{sub}</div>}
        <h1 className="titulo text-[34px]">{titulo}</h1>
      </div>
      {derecha}
    </header>
  )
}

export function Rotulo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rotulo flex items-center gap-2 ${className}`}>{children}<span className="h-px flex-1 bg-linea" /></div>
}

export function Toast({ texto }: { texto: string | null }) {
  if (!texto) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div role="status" className="aparecer titulo bg-tinta px-4 py-3 text-[15px] text-crema">
        {texto}
      </div>
    </div>
  )
}

// ---------- Íconos de línea ----------
type IconoProps = { className?: string }
const svg = (className: string | undefined, d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" className={className ?? 'h-6 w-6'} aria-hidden>
    {d}
  </svg>
)

export const IconoPercha = ({ className }: IconoProps) =>
  svg(className, <path d="M12 7.5a2 2 0 1 1 2-2M12 7.5v1.5L3 15.5h18L12 9" />)
export const IconoSol = ({ className }: IconoProps) =>
  svg(className, <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>)
export const IconoCapas = ({ className }: IconoProps) =>
  svg(className, <><rect x="4" y="3.5" width="16" height="7" /><rect x="4" y="13.5" width="16" height="7" /></>)
export const IconoGrilla = ({ className }: IconoProps) =>
  svg(className, <><rect x="3.5" y="3.5" width="7" height="7" /><rect x="13.5" y="3.5" width="7" height="7" /><rect x="3.5" y="13.5" width="7" height="7" /><rect x="13.5" y="13.5" width="7" height="7" /></>)
export const IconoMas = ({ className }: IconoProps) => svg(className, <path d="M12 4v16M4 12h16" />)
export const IconoFlechaIzq = ({ className }: IconoProps) => svg(className, <path d="M15 5l-7 7 7 7" />)
export const IconoFlechaDer = ({ className }: IconoProps) => svg(className, <path d="M9 5l7 7-7 7" />)
export const IconoAjustes = ({ className }: IconoProps) =>
  svg(className, <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><rect x="14" y="5" width="4" height="4" /><rect x="6" y="15" width="4" height="4" /></>)
export const IconoEstrella = ({ className, llena }: IconoProps & { llena?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={llena ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" className={className ?? 'h-6 w-6'} aria-hidden>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  </svg>
)
export const IconoCamara = ({ className }: IconoProps) =>
  svg(className, <><path d="M3.5 7.5h4l1.5-2.5h6l1.5 2.5h4v12h-17z" /><circle cx="12" cy="13" r="3.5" /></>)
export const IconoGaleria = ({ className }: IconoProps) =>
  svg(className, <><rect x="3.5" y="4.5" width="17" height="15" /><path d="M3.5 16l5-5 4 4 3-3 5 5" /></>)
export const IconoCerrar = ({ className }: IconoProps) => svg(className, <path d="M6 6l12 12M18 6L6 18" />)
export const IconoNube = ({ className }: IconoProps) =>
  svg(className, <path d="M7 18.5h10.5a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7.3 10 4.3 4.3 0 0 0 7 18.5z" />)
export const IconoValija = ({ className }: IconoProps) =>
  svg(className, <><rect x="3.5" y="7.5" width="17" height="12" /><path d="M9 7.5V4.5h6v3M9 7.5v12M15 7.5v12" /></>)
export const IconoCheck = ({ className }: IconoProps) => svg(className, <path d="M5 12.5l4.5 4.5L19 7.5" />)
