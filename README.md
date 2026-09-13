# Daggerheight — extensión para Owlbear Rodeo

Marcador de rango de altura para el sistema **Daggerheart**. Agrega un ítem al menú
contextual de cualquier token que permite elegir uno de los 8 rangos:

| Rango       | Triángulos | Color   |
| ----------- | ---------- | ------- |
| Muy cerca   | 1          | Azul    |
| Cerca       | 2          | Verde   |
| Lejos       | 3          | Amarillo|
| Muy lejos   | 4          | Naranja |

Cada rango se puede aplicar hacia **Arriba** (triángulos apuntando hacia arriba) o
**Abajo** (apuntando hacia abajo). Cada token solo puede tener un marcador activo a
la vez; los triángulos se apilan verticalmente pegados al borde izquierdo del token,
centrados en su altura, y se mueven/escalan junto con él.

## Desarrollo

```
npm install
npm run dev
```

Esto levanta un servidor local (por defecto en `http://localhost:5173`). Owlbear
Rodeo permite cargar extensiones de desarrollo desde `localhost` sin HTTPS.

Para instalarla en una sala:

1. Abrí la sala en Owlbear Rodeo.
2. Andá a la pestaña de extensiones (ícono de enchufe) → **Add Custom Extension** (o
   el equivalente en español, "Añadir extensión personalizada").
3. Pegá la URL del manifiesto: `http://localhost:5173/manifest.json`.

Con el servidor de desarrollo corriendo, cualquier cambio en el código se recarga
automáticamente.

## Build de producción

```
npm run build
```

Genera la carpeta `dist/` lista para publicarse en cualquier hosting estático
(GitHub Pages, Netlify, Vercel, etc.). El `manifest.json` que hay que compartir para
instalar la extensión ya publicada es `https://<tu-dominio>/manifest.json`.

## Estructura

- `public/manifest.json` — metadatos de la extensión.
- `background.html` / `src/background.ts` — se ejecuta al cargar la extensión y
  registra el ítem del menú contextual.
- `index.html` / `src/main.ts` — interfaz del selector de rango (el popover que se
  abre al hacer clic en el ítem del menú contextual).
- `src/altitude.ts` — definición de los 8 rangos (colores, cantidad de triángulos)
  y la geometría de los triángulos.
- `src/markers.ts` — lógica para crear/leer/borrar el marcador (un ítem `PATH`
  adjunto al token) en la escena.
