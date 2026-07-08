# Rainbows OS V1

App web/PWA simple para GitHub Pages.

## Qué incluye esta V1

- Pantalla Hoy.
- Calendario mensual.
- Pantalla de salas.
- Configuración básica de empleados.
- Tareas con checkbox.
- Al marcar una tarea, pregunta quién la realizó.
- Guarda los tildes localmente en el navegador con `localStorage`.
- No conecta Google Sheets todavía.
- La función `saveTaskCompletion` está separada en `app.js` para conectar Google Sheets más adelante.

## Archivos

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `sw.js`
- `README.md`

## Cómo actualizar GitHub Pages

1. Descomprimir este ZIP.
2. Entrar a la carpeta descomprimida.
3. Subir/reemplazar estos archivos en el repositorio de GitHub Pages.
4. Confirmar con **Commit changes**.
5. GitHub Pages se actualiza solo.

## Importante

Los tildes de tareas quedan guardados solo en el navegador/dispositivo donde se usan. En la próxima etapa se puede reemplazar esa persistencia por Google Sheets.
