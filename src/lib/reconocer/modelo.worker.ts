/// <reference lib="webworker" />
// Corre el modelo de visión (CLIP) en un hilo aparte para no trabar la pantalla.
import { env, pipeline, RawImage } from '@huggingface/transformers'

env.allowLocalModels = false // el modelo se baja una vez y queda guardado en el navegador

type Clasificador = (img: RawImage, etiquetas: string[], opciones: { hypothesis_template: string }) => Promise<{ label: string; score: number }[]>

let cargando: Promise<Clasificador> | null = null

function cargar(alProgresar: (p: number) => void) {
  cargando ??= pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
    dtype: 'q8',
    progress_callback: (info: { status: string; loaded?: number; total?: number }) => {
      if (info.status === 'progress_total' && info.total) alProgresar(info.loaded! / info.total)
    },
  }) as unknown as Promise<Clasificador>
  cargando.catch(() => (cargando = null))
  return cargando
}

export interface Pedido {
  id: number
  foto: Blob
  preguntas: { etiquetas: string[]; plantilla: string }[]
}

self.onmessage = async (e: MessageEvent<Pedido>) => {
  const { id, foto, preguntas } = e.data
  try {
    const clasificar = await cargar((p) => self.postMessage({ id, tipo: 'progreso', p }))
    self.postMessage({ id, tipo: 'analizando' })
    const img = await RawImage.fromBlob(foto)
    const respuestas = []
    for (const q of preguntas) respuestas.push(await clasificar(img, q.etiquetas, { hypothesis_template: q.plantilla }))
    self.postMessage({ id, tipo: 'ok', respuestas })
  } catch (err) {
    self.postMessage({ id, tipo: 'error', mensaje: err instanceof Error ? err.message : String(err) })
  }
}
