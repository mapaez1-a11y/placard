const MAX_LADO = 1200
const CALIDAD = 0.8

/** Achica la foto a 1200px de lado como máximo y la pasa a WebP (o JPEG si el navegador no soporta WebP). */
export async function comprimirFoto(file: Blob): Promise<Blob> {
  const bitmap = await cargarBitmap(file)
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // Fondo blanco: si la foto tiene transparencia (fondo quitado), se funde con multiply.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  if ('close' in bitmap) (bitmap as ImageBitmap).close()

  const webp = await aBlob(canvas, 'image/webp')
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await aBlob(canvas, 'image/jpeg')
  if (!jpeg) throw new Error('No se pudo procesar la foto')
  return jpeg
}

function aBlob(canvas: HTMLCanvasElement, tipo: string) {
  return new Promise<Blob | null>((res) => canvas.toBlob(res, tipo, CALIDAD))
}

async function cargarBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** Quita el fondo en el navegador. La primera vez descarga el modelo (~40 MB). */
export async function quitarFondo(file: Blob, onProgreso?: (p: number) => void): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal')
  const sinFondo = await removeBackground(file, {
    progress: (_key: string, actual: number, total: number) => {
      if (total) onProgreso?.(actual / total)
    },
  })
  return comprimirFoto(sinFondo)
}

export function blobADataURL(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

export async function dataURLABlob(dataUrl: string): Promise<Blob> {
  const [meta, b64] = dataUrl.split(',')
  const tipo = /data:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}
