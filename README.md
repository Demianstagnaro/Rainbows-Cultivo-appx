# rainbows V3.0

Primera versión compartida con Supabase.

- Login por correo y contraseña.
- Tareas, realizaciones y responsables compartidos.
- Tareas extraordinarias, reprogramaciones y cancelaciones compartidas.
- Empleados y genéticas compartidos.
- Croquis, camas y plantas compartidos.
- Actualización con Supabase Realtime.

La primera cuenta puede crearse desde la app. Si la confirmación de correo está activa en Supabase, hay que confirmar el correo antes de ingresar.


## V3.0.1
- Corregido el bloqueo al iniciar sesión.
- Las consultas a Supabase ya no se ejecutan directamente dentro de onAuthStateChange.
- Se muestran estados de ingreso, carga y errores.
- Se agregó un botón Reintentar si falla la carga de datos.
- El registro indica explícitamente la URL de retorno de GitHub Pages.


## V3.1.1
- Corregido el error de JavaScript que impedía usar el botón Ingresar.
- La pantalla de acceso desaparece al iniciar sesión.
- Administración de usuarios y roles desde Config.
- Registro visible del usuario que cargó cada tarea realizada.


## V3.1.2
- Corregido el contador de Esquejes: Día 1 es siempre el día anterior al inicio de Flora S1 de la sala correspondiente.
- Los contadores “Tareas X/Y” se vuelven verdes cuando todas las tareas están completas.
- El estado verde aparece en Hoy, salas, calendario y detalle diario.
- Las tareas se ordenan por prioridad: críticas, importantes y de rutina.
- No se modificaron las fechas ni las reglas operativas del calendario.


## V3.2.0
- Navegación por días dentro del detalle de cada sala.
- Config junto a Salir y visible solo para administradores.
- Barra principal: Hoy, Calendario y Salas.
- Encabezado Cultivo rainbows.
- Flora 1, Flora 2 y Flora 3 en Ciclo 9, con avance automático cada 77 días.


## V3.2.1
- Navegador diario de salas rediseñado como “◀ Jue 16/07/2026 ▶”.
- Botón “Hoy” o “Volver a hoy” ubicado encima de la fecha.
- Config muestra los permisos de cada rol.
- El resumen de cuenta muestra los permisos del usuario conectado.
- Los administradores pueden eliminar otras cuentas.
- Por seguridad, un administrador no puede eliminar su propia cuenta desde la app.


## V3.3.1
- Reconstruida directamente sobre la V3.2.1 estable.
- No se modificó la lógica de autenticación, navegación ni Supabase.
- Se aplicó únicamente el nuevo diseño y el logo aprobado.
- Recursos visuales con versión propia para evitar caché anterior.

## V3.3.2
- Corregido el error de sintaxis de Chrome en `renderSettings`.
- Los separadores de empleados y genéticas ahora usan `\n` escapado correctamente.
- Se renovó el caché para evitar que siga cargándose `app.js?v=3.3.1`.

## V3.4.0
- Restaurada la capa de interacción que faltaba en versiones anteriores.
- La lista de empleados vuelve a mostrarse uno por línea.
- Al marcar una tarea se abre nuevamente el selector de empleados.
- Permite seleccionar varias personas y exige al menos una.
- Restaurados los controles de nueva tarea, edición, camas y plantas.
- Se mantuvo el diseño aprobado y se renovó el caché.

## V3.4.1
- Flora 1, Flora 2 y Flora 3 quedan correctamente identificadas como Ciclo 9.
- El cambio a Ciclo 10 se calcula cada 77 días desde la referencia correcta de cada sala.
- Corregido Esquejes: ya no permanece mostrando Día 64; toma la cosecha válida del ciclo correspondiente.
- En la pantalla Hoy, cada sala de flora muestra también el número de ciclo.

## V3.4.2
- El calendario muestra el ciclo y la etapa de cada sala:
  F1: C9 · Flora S3
  F2: C9 · Vege S2
  F3: C9 · Flora S3
- Se redujo aproximadamente un 12% el tamaño visual del logo Rainbows.
- El cálculo de ciclo sigue usando la misma función en Hoy, Calendario y Salas.

## V3.4.3
- Se agregó el botón «Volver a hoy» arriba del selector de mes del calendario.
- Al pulsarlo, el calendario vuelve al mes actual.
- El botón queda deshabilitado cuando ya se está viendo el mes actual.
- Se mantuvieron las abreviaciones completas de los días: Lun, Mar, Mié, Jue, Vie, Sáb y Dom.

## V3.4.4
- Todas las tareas con fecha anterior al día actual aparecen como completadas.
- Las tareas históricas no inventan empleado, horario ni usuario responsable.
- Las tareas de hoy y las futuras continúan requiriendo selección manual de empleados.
- Las tareas históricas quedan bloqueadas para evitar que se desmarquen accidentalmente.

## V3.4.5
- El rol Empleado puede ver Hoy, Salas, Calendario e Historial.
- Se agregó una pestaña Historial con acceso a los últimos 60 días.
- Desde Historial se puede abrir cada fecha y consultar tareas, responsables y estados.
- El rol Lectura también puede consultar las cuatro pantallas, sin modificar datos.
- Incluye `Rainbows_V3.4.5_permisos_empleados.sql` para actualizar las políticas de Supabase.

## V3.5.0
- En el menú de tres puntos de cada sala se puede agregar una tarea para esa sala y fecha.
- Crear y editar tareas queda limitado a Administrador y Encargado.
- Se agregó en Hoy una lista lateral de tareas generales del edificio, sin sala ni fecha.
- Todos los usuarios pueden ver las tareas generales.
- Administradores y encargados pueden crearlas, editarlas y eliminarlas.
- Administradores, encargados y empleados pueden marcarlas como realizadas indicando responsables.
- Las tareas realmente realizadas pueden desmarcarse, incluso si son de una fecha pasada.
- Se agregó “Corregir responsables” al menú de una tarea realizada.
- Las tareas históricas automáticas que nunca tuvieron una realización real siguen cerradas para evitar reabrir todo el historial.
- Requiere ejecutar `Rainbows_V3.5.0_tareas_generales_y_permisos.sql`.

## V3.5.1
- Corrige la detección del rol actual aunque tenga mayúsculas, espacios o la consulta individual del perfil falle.
- Recupera Editar tarea para administradores y encargados.
- Recupera Agregar tarea desde los tres puntos de cada sala.
- Recupera Agregar y Editar en Tareas generales.
- Elimina el subtítulo “Pendientes extraordinarios de todo el edificio”.
- Refuerza los enlaces de los botones después de cada renderizado.
- Incluye SQL de corrección de roles y políticas.

## V3.6.0
- Incluye un único SQL consolidado para permisos, tareas fechadas y tareas generales.
- No requiere borrar queries anteriores del SQL Editor.
- El script elimina políticas antiguas conocidas y crea una configuración limpia.
- Esta versión no cambia la interfaz respecto de V3.5.1.
- Ejecutar solamente `Rainbows_V3.6.0_SQL_UNIFICADO.sql`.

## V3.6.1
- El detalle de la Enmienda de Flora Semana 4 ahora muestra solamente “Semana 4”.
- Editar una tarea sin cambiar su fecha modifica la tarea existente y no crea una copia.
- Una tarea rutinaria editada en el mismo día conserva el tipo “rutina” y no aparece como “Reprogramada”.
- Si una tarea rutinaria se mueve a otra fecha, la original se cancela y se crea una sola tarea “Reprogramada” en la nueva fecha.
- Se corrigió el filtro que podía mostrar dos veces una tarea rutinaria editada.
- No requiere ejecutar un SQL nuevo.

## V3.6.2
- Se eliminaron los detalles automáticos de todas las tareas programadas.
- Fumigación de lunes y viernes: “ABA + OIL”.
- Fumigación de miércoles: “ABA + OIL + Nissorun”.
- No requiere ejecutar SQL.

## V3.6.3 — Pendientes reales y corrección de tareas completadas
- El cierre histórico automático queda congelado hasta el 21/07/2026 inclusive.
- Desde el 22/07/2026, las tareas vencidas continúan pendientes si nadie las realizó.
- El estado histórico se muestra como “Completada”.
- Las tareas realmente realizadas pueden desmarcarse desde el checkbox.
- Se agregó “Desmarcar como realizada” al menú de la tarea.
- Al desmarcar, se elimina la realización y la tarea vuelve a estado pendiente.
- No requiere ejecutar SQL.

## V3.6.4 — Tareas continuadas y días pendientes
- Se continúan automáticamente hasta el día actual las tareas pendientes de:
  - Trasplante Veges → Flora.
  - Trasplante Esquejes → Veges.
  - Esquejes.
  - Poda de bajos.
  - Schwazzing.
- Cada aparición posterior muestra “Día 2”, “Día 3”, etc.
- Al completar cualquier día de la cadena, todos los días vinculados aparecen completados con la misma realización y responsables.
- Al desmarcarla, se reabre la cadena completa.
- Los días pasados que conservan alguna tarea pendiente se muestran en rojo en el calendario.
- Hoy y los días futuros conservan el color azul habitual.
- El cierre histórico fijo hasta el 21/07/2026 se mantiene.
- No requiere ejecutar SQL.

## V3.6.4.1 — Solo “Tareas” en rojo
- En días pasados con tareas pendientes ya no se pinta todo el recuadro.
- El cuadro mantiene su apariencia normal.
- Solamente el cartel “Tareas” se muestra en rojo.
- No requiere ejecutar SQL.

## V3.6.4.2 — Cartel de tareas rojo y eliminación
- En días pasados con pendientes, únicamente el cartel “Tareas X/Y” se muestra en rojo.
- Los nombres y estados de las salas mantienen su color blanco habitual.
- Se agregó “Eliminar tarea” al menú de opciones.
- Las tareas manuales se eliminan definitivamente.
- Las tareas automáticas se cancelan solamente para la fecha seleccionada.
- Una continuación se cancela únicamente en ese día, sin eliminar toda la cadena.
- Si la tarea estaba completada, se advierte que también se eliminarán la realización y los responsables.
- No requiere ejecutar SQL.
