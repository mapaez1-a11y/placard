// Color principal de la prenda, mirando los píxeles (sin modelo, instantáneo).

const PALETA: [string, number, number, number][] = [
  ['Blanco', 246, 245, 240],
  ['Crema', 238, 226, 200],
  ['Beige', 214, 195, 160],
  ['Camel', 190, 148, 100],
  ['Marrón', 105, 68, 42],
  ['Negro', 28, 28, 30],
  ['Gris', 128, 128, 130],
  ['Azul marino', 32, 42, 78],
  ['Azul', 52, 92, 170],
  ['Celeste', 150, 196, 230],
  ['Verde', 52, 128, 72],
  ['Oliva', 108, 108, 54],
  ['Rojo', 198, 40, 42],
  ['Bordó', 112, 24, 42],
  ['Rosa', 236, 162, 182],
  ['Terracota', 178, 90, 60],
  ['Naranja', 236, 132, 44],
  ['Amarillo', 238, 206, 62],
  ['Violeta', 118, 72, 150],
  ['Dorado', 198, 162, 62],
]

// Distancia de color aproximada a la percepción humana ("redmean")
function distancia(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const rm = (r1 + r2) / 2
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

export async function colorPrincipal(foto: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(foto)
    const N = 72
    const canvas = document.createElement('canvas')
    canvas.width = N
    canvas.height = N
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, N, N)
    ctx.drawImage(bmp, 0, 0, N, N)
    bmp.close()
    const px = ctx.getImageData(0, 0, N, N).data

    // Fondo = promedio del borde de la foto
    let br = 0, bg = 0, bb = 0, nb = 0
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (x > 2 && x < N - 3 && y > 2 && y < N - 3) continue
        const i = (y * N + x) * 4
        br += px[i]; bg += px[i + 1]; bb += px[i + 2]; nb++
      }
    br /= nb; bg /= nb; bb /= nb

    const contar = (umbral: number, soloCentro: boolean) => {
      const votos = new Map<string, number>()
      let total = 0
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          if (soloCentro && (x < N * 0.3 || x > N * 0.7 || y < N * 0.3 || y > N * 0.7)) continue
          const i = (y * N + x) * 4
          const [r, g, b] = [px[i], px[i + 1], px[i + 2]]
          if (umbral && distancia(r, g, b, br, bg, bb) < umbral) continue
          let mejor = PALETA[0]
          let dMin = Infinity
          for (const c of PALETA) {
            const d = distancia(r, g, b, c[1], c[2], c[3])
            if (d < dMin) (dMin = d), (mejor = c)
          }
          votos.set(mejor[0], (votos.get(mejor[0]) ?? 0) + 1)
          total++
        }
      return { votos, total }
    }

    // Primero ignoramos lo que se parece al fondo; si casi no queda nada, miramos el centro
    let { votos, total } = contar(60, false)
    if (total < N * N * 0.005) ({ votos, total } = contar(0, true))
    if (!total) return null
    const orden = [...votos.entries()].sort((a, b) => b[1] - a[1])
    return orden[0][0]
  } catch {
    return null
  }
}
