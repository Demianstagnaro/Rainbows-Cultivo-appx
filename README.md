# Rainbows OS V2.3

App web/PWA simple para GitHub Pages.

## Correcciones V2.3
- Incluye todos los archivos requeridos: `index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`.
- Fechas fijadas según lo confirmado:
  - 01/07/2026: Flora 1 = Inicio Flora S7.
  - 01/07/2026: Flora 3 = Inicio Flora S7.
  - 01/07/2026: Flora 2 = Inicio Flora S1.
- Tareas agrupadas por sala.
- Barras de progreso naranjas.
- Flora 1 no tiene riego manual diario.
- Flora 1 tiene tarea “Calibrar riego” en:
  - trasplante / nuevo ciclo,
  - inicio Flora S1,
  - inicio Flora S7.
- Checkboxes con responsable guardado localmente.

## Publicación
Subir/reemplazar en la raíz del repositorio:
- index.html
- styles.css
- app.js
- manifest.json
- sw.js
- README.md

Luego abrir:
`https://demianstagnaro.github.io/Rainbows-Cultivo-appx/?v=2.4`


## V2.3
- Mantiene la disposición visual de V2.3.
- Flora 3 sincronizada con Flora 1.
- Agrega sala Esquejes.
- Quita cambios de layout de V2.2.
- En tarjetas de Hoy muestra Semana N en lugar de repetir sala/etapa larga.


## Cambios V2.4
- Empleados: Cone, Chomi, Pata, Lua, Mar, Eric y Tortu.
- Esquejes muestra el número de día desde el ingreso.
- Esquejes solo tiene la tarea diaria Mantenimiento mientras está ocupada.
- Esquejes queda vacía dos días después de la cosecha, al pasar a Veges.
- Se quitó el indicador visible de versión de la pantalla Hoy.


## V2.5
- Permite seleccionar desde una persona hasta todos los empleados al completar una tarea.
- Mantiene compatibilidad con tareas ya guardadas con un solo responsable.


## V2.6
- Esquejes ingresa el día anterior al inicio de Flora S1 del grupo de destino.
- Los lotes se identifican como destinados a Flora 1 y Flora 3, o a Flora 2.
- Mientras la sala está ocupada muestra Día 1, Día 2, etc. y la tarea Mantenimiento.
- El lote pasa a Veges dos días después de la siguiente cosecha del grupo opuesto.
- El día del traslado a Veges, Esquejes vuelve a figurar como vacía.


## V2.7
- En la pestaña Hoy, cada sala reúne en una sola tarjeta su estado, progreso y tareas.
- Se eliminaron las secciones separadas de Estado de salas y Tareas de hoy.
- No se modificaron las reglas, fechas ni demás pantallas.


## V2.8
- Se puede tocar cualquier día del calendario para abrir su detalle.
- El detalle muestra estado, progreso y tareas de cada sala para esa fecha.
- Las tareas realizadas muestran responsables y hora.
- También se pueden marcar o desmarcar tareas de días anteriores o futuros.
- No se modificaron reglas, fechas ni la pantalla Hoy.


## V2.9
- Las tareas generadas por el calendario se identifican como Rutina.
- Se pueden crear tareas extraordinarias desde Hoy o desde cualquier día del calendario.
- Se pueden editar, mover o eliminar tareas desde la app.
- Al mover una tarea queda identificada como Reprogramada.
- Las excepciones no modifican las reglas futuras del calendario.
- La navegación pasó a la parte superior.
- El resumen de Hoy incluye una barra de progreso general.
- El nombre visible de la app pasó de Rainbows OS a RAINBOWS.
- Los cambios siguen guardándose localmente en cada dispositivo.


## V2.10
- La marca del encabezado ahora aparece como "rainbows" en minúsculas.
- Se aplicó una tipografía redondeada aproximada y un degradado iridiscente inspirado en la referencia visual proporcionada.
- Las tareas normales ya no muestran la etiqueta Rutina.
- Solo se muestran etiquetas para tareas Extraordinarias o Reprogramadas.
- El botón Cancelar del formulario de tareas funciona aunque los campos estén vacíos.
- No se modificaron reglas, fechas ni lógica del cultivo.


## V2.11
- Se agregó un croquis editable en Flora 1, Flora 2 y Flora 3.
- Flora 1 y 2 tienen 15 camas en 3 columnas × 5 filas, sin pasillos entre camas y con circulación lateral.
- Flora 3 se muestra provisionalmente en 2 columnas × 4 filas hasta cargar su disposición real.
- Cada cama permite elegir capacidad de 5 o 9 plantas, cantidad actual, genética y observaciones.
- Se muestran totales de plantas, capacidad y distribución por genética.
- En el calendario siempre se muestran tareas hechas y pendientes, incluso cuando todavía no se realizó ninguna.
