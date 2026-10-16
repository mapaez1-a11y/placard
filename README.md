# Placard

Usá la ropa que ya tenés: sacale foto a tus prendas y la app te arma looks según el clima y la ocasión.
Funciona sin internet, se instala en la pantalla de inicio y, si querés, sincroniza entre dispositivos con Supabase.

## Correrla en tu computadora

Necesitás Node.js 20 o más nuevo (https://nodejs.org).

```bash
npm install
npm run dev
```

Abrí la dirección que aparece (`http://localhost:5173`). Para probarla en el celular, conectalo a la misma red wifi y abrí la dirección "Network" que muestra la terminal (ej. `http://192.168.0.10:5173`).
La cámara, la ubicación y la instalación solo andan con HTTPS, así que para usarla de verdad en el celular publicala (abajo).

## Publicarla gratis

### GitHub Pages (automático)
El repo ya trae `.github/workflows/deploy.yml`. Cada vez que se sube un cambio a `main`, GitHub compila la app y la publica en `https://<tu-usuario>.github.io/<nombre-del-repo>/`.
Una sola vez: en el repo, **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### Vercel
1. Subí esta carpeta a un repositorio de GitHub.
2. Entrá a https://vercel.com → Add New → Project → elegí el repo.
3. Vercel detecta Vite solo (build: `npm run build`, carpeta: `dist`). Tocá Deploy.

### Netlify
1. https://app.netlify.com → Add new site → Import an existing project → elegí el repo.
2. Build command: `npm run build` · Publish directory: `dist`. Deploy.
   (Sin GitHub: corré `npm run build` y arrastrá la carpeta `dist` a https://app.netlify.com/drop)

### Instalarla en el celular
- **iPhone (Safari):** abrí el link → botón Compartir → "Agregar a pantalla de inicio".
- **Android (Chrome):** abrí el link → menú ⋮ → "Instalar app" o "Agregar a pantalla de inicio".

## Login y sincronización con Supabase (opcional)

Sin configurar nada, todo queda guardado en el celular. Para tener el mismo placard en varios dispositivos:

1. Creá un proyecto gratis en https://supabase.com.
2. En **SQL Editor → New query**, pegá el contenido de `supabase/schema.sql` y tocá **Run**. Crea las tablas `prendas`, `looks` y `usos`, el bucket privado `fotos` y las reglas para que cada cuenta vea solo lo suyo.
3. En **Project Settings → API** copiá la *Project URL* y la clave *anon public*.
4. Copiá `.env.example` como `.env` y pegá esos dos valores. En Vercel/Netlify, cargalos como variables de entorno (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) y volvé a publicar.
5. En **Authentication → URL Configuration**, poné la dirección publicada de tu app como *Site URL* (para el link del mail de confirmación).

Después, en la app: **Hoy → ícono de ajustes → Crear cuenta**. Entrá con la misma cuenta en el otro dispositivo y listo.

### Cómo funciona la sincronización
- La app es *local first*: todo se guarda primero en el celular (IndexedDB), así anda sin señal.
- Con sesión iniciada, sube los cambios y baja los de tus otros dispositivos al abrirla, al volver internet y unos segundos después de cada cambio. También hay un botón "Sincronizar ahora".
- Las fotos van al bucket `fotos` de Supabase Storage, en una carpeta por usuaria.
- Si editaste lo mismo en dos dispositivos, gana el cambio más reciente.
- Si cerrás sesión, tus prendas siguen en el celular.

## Tus datos
- Prendas, fotos (comprimidas a 1200 px, WebP/JPEG 0.8), looks e historial: IndexedDB con Dexie.
- Ciudad y última ocasión: localStorage.
- La app pide almacenamiento persistente para que el navegador no borre los datos.
- **Ajustes → Exportar backup** descarga un `.json` con todo (fotos en base64). **Importar backup** lo vuelve a cargar.

## Novedades

- **Clima de donde estés:** cada vez que abrís la app (o volvés a ella) usa la ubicación actual del celular. Si viajaste, el clima ya es el del destino. La ciudad de Ajustes queda solo como respaldo si no das permiso de ubicación.
- **Viajes:** creá un viaje con destino y fechas. Ves el clima de cada día (pronóstico real hasta 16 días; más lejos, estimado con el clima de esas fechas del año pasado), armás la valija o dejás que la app te la sugiera, te avisa lo que falta (abrigo, calzado para lluvia, ropa para cierto clima) y te propone un look distinto por día solo con lo que llevás. Mientras el viaje está en curso, la pestaña Hoy sugiere con la valija.
- **Favoritos:** pestaña propia con los looks que marcaste con estrella, filtrables por ocasión y con un botón para usarlos hoy.
- **Carteras, accesorios (aros y collares) y cinturones:** tienen su propia sección en el Placard, se suman a los looks sugeridos y los podés agregar a mano en Armar.

> Si ya tenías Supabase configurado, volvé a correr `supabase/schema.sql` para crear la tabla de viajes.

## Cómo elige los looks
- Clima según la máxima del día: 20° o más = Calor, 14 a 19° = Templado, menos de 14° = Frío.
- Filtra por clima y ocasión; si no alcanza, relaja el filtro y te avisa.
- Prioriza prendas sin estrenar o que no usás hace tiempo, y no repite looks usados en los últimos 3 días.
- Si la mínima baja de 16°, suma un abrigo.
- Suma calzado, cartera, aros, collar y cinturón (el cinturón solo con pantalón, pollera o vestido), rotando los que menos usás.
- "Quitar fondo" (opcional) usa @imgly/background-removal en el navegador; la primera vez descarga el modelo (~40 MB).

## Stack
React + Vite + TypeScript, Tailwind, Dexie, vite-plugin-pwa, Supabase (opcional). Clima: Open-Meteo (sin clave).
