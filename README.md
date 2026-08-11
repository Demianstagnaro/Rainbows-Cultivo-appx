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

## V3.6.4.3
- El texto de 'Tareas X/Y' también se muestra en rojo cuando hay pendientes.

## V3.6.4.4 — Enmienda en Madres y calendario sin recuadro
- Se agregó la tarea automática “Enmienda” en la sala Madres.
- Se repite cada dos semanas, los martes, comenzando el 28/07/2026.
- En días pasados con pendientes, el texto “Tareas X/Y” continúa en rojo.
- Se eliminó el fondo, borde y recuadro especial del cartel.
- No requiere ejecutar SQL.

## V3.6.4.5 — Corrección Enmienda en Madres
- Se corrigió el identificador interno de la sala Madres.
- La tarea “Enmienda” ahora aparece desde el martes 28/07/2026 y se repite cada 14 días.
- No requiere ejecutar SQL.

## V3.6.4.6 — Enmienda en Veges
- Se agregó una tarea automática “Enmienda” en la sala Veges.
- Aparece exactamente 14 días después de cada trasplante Esquejes → Veges.
- Se genera una sola vez por cada pase a Veges.
- La fecha queda vinculada al trasplante y se ajusta automáticamente si cambia el ciclo.
- No requiere ejecutar SQL.

## V3.6.4.7 — Cartel rojo sin recuadro del día
- El cartel “Tareas X/Y” vuelve a tener fondo rojo suave, borde rojo y texto rojo.
- Se eliminó cualquier borde, sombra, contorno o resaltado especial del día completo.
- Las salas y el resto del calendario mantienen su apariencia habitual.
- No requiere ejecutar SQL.

## V3.6.4.8 — Corrección del borde blanco
- Se corrigió el borde blanco grueso de los días pasados con tareas pendientes.
- La causa era `border-color: inherit`, que heredaba el color blanco del texto.
- Los días pendientes vuelven a usar el mismo borde gris normal que el resto.
- El cartel “Tareas X/Y” conserva fondo, borde y texto rojos.
- El día actual mantiene su contorno azul.
- No requiere ejecutar SQL.

## V3.6.4.9 — Tareas generales registradas por fecha
- Al completar una tarea general, desaparece de la lista de pendientes.
- Se eliminó la lista acumulativa de tareas generales realizadas en Hoy.
- La tarea queda asociada a la fecha y hora exactas en que se completó.
- Al abrir esa fecha desde Calendario o Historial aparece en “Tareas generales realizadas”.
- Se conservan responsables y usuario que registró la realización.
- El resumen del Historial indica cuando hubo tareas generales terminadas.
- No requiere ejecutar SQL.

## V3.6.5.0 — Sala de trabajo y Trimming
- Se agregó “Sala de trabajo” como sala operativa permanente.
- No recibe tareas automáticas de riego.
- Cada cosecha genera automáticamente Trimming el segundo lunes posterior.
- Ejemplo: cosecha miércoles 15/07 → Trimming lunes 27/07.
- La tarea se llama “Trimming - Flora X”.
- El detalle muestra fecha de cosecha, ciclo cosechado y, desde el segundo día, el número de día de continuidad.
- Si no se completa, pasa automáticamente al día siguiente.
- Al completarla, se cierra toda la continuidad y queda registrada en Historial.
- No requiere ejecutar SQL para la tarea automática.

## V3.6.5.1 — Corrección del ciclo cosechado en Trimming
- Se corrigió el número de ciclo mostrado en las tareas de Trimming.
- Flora 1 y Flora 3 están actualmente en ciclo 10.
- Por lo tanto, la cosecha que se está trimmeando corresponde correctamente al ciclo 9.
- No requiere ejecutar SQL.

## V3.6.5.2 — Ciclos corregidos y unificados
- Flora 1 y Flora 3 toman el 16/07/2026 como inicio del ciclo 10.
- Por eso, la cosecha del 15/07/2026 pertenece correctamente al ciclo 9.
- Hoy, Calendario, Salas, Historial y Trimming usan la misma función para calcular el ciclo.
- Se eliminó el ajuste independiente que tenía Trimming.
- El detalle ahora muestra “Cosecha: 15/07/2026 · Ciclo 9”.
- Flora 2 conserva su referencia de ciclo independiente.
- No requiere ejecutar SQL.

## V3.6.6.0 — Continuaciones registradas por jornada
- Trasplante, Esquejes, Poda bajos, Schwazzing y Trimming muestran “Día X”.
- Al completar una jornada se puede elegir “Finalizar tarea” o “Completar Día X y continuar mañana”.
- Cada día trabajado queda marcado como realizado con sus responsables y hora.
- Si se elige continuar, la tarea aparece al día siguiente con el número de día incrementado.
- Si se elige finalizar, deja de generarse desde el día siguiente.
- Ya no se completan juntas todas las jornadas anteriores.
- No requiere ejecutar SQL.


## V3.6.6.1 — Etiquetas exclusivas
- Las tareas creadas manualmente muestran únicamente “Extraordinaria”.
- Las tareas reprogramadas muestran únicamente “Reprogramada”.
- En esos casos ya no aparece también la etiqueta de prioridad “Rutina”.
- Las tareas automáticas conservan su etiqueta de prioridad normal.
- No requiere ejecutar SQL.


## V3.6.6.2 — Continuaciones compatibles con Supabase

- Corrige el error `tareas_estado_check` al continuar una tarea.
- Cada jornada se guarda con estado `realizada`, que ya está permitido por la base.
- La decisión de continuar se guarda internamente sin mostrar etiquetas técnicas.
- Una jornada marcada como ‘continuar mañana’ no cierra la cadena; ‘Finalizar tarea’ sí la cierra.
- No requiere ejecutar SQL.

## V3.7.0 — Backups administrados
- Agrega en Config, solo para Administradores: Crear backup manual, Descargar backup y Restaurar backup.
- Integra una Edge Function segura que valida nuevamente el rol administrador.
- Los botones controlan un repositorio privado de GitHub Actions sin exponer claves en el navegador.
- El backup diario conserva las copias durante 30 días.
- La restauración se dirige primero a un proyecto vacío de recuperación para evitar sobrescribir accidentalmente la base activa.
- Incluye `INSTALACION_BACKUPS.md` y el código de la función `supabase/functions/rainbows-backups`.


## V3.8.0 — Genéticas

- Nueva solapa principal **Genéticas**.
- Columnas: Genética, Nomenclatura, Linaje, Genotipo y Estado.
- Alta y edición disponibles para administradores.
- Las genéticas archivadas conservan el historial pero no se ofrecen para nuevas asignaciones.
- Antes de publicar, ejecutar `Rainbows_V3.8.0_geneticas_catalogo.sql` en Supabase.


## V3.8.2 — Cannabinoides

Se agregó el campo `cannabinoides` al catálogo de genéticas. Admite valores sugeridos como THC, CBD, THC + CBD y combinaciones personalizadas.


## V3.8.3 — Plantas visibles en el croquis

- Las posiciones ocupadas muestran directamente la nomenclatura de la genética.
- Si una genética no tiene nomenclatura, se muestra una abreviatura automática de su nombre.
- Cada genética recibe un color visual consistente para poder distinguirla rápidamente.
- Las plantas ocupadas sin genética asignada muestran `S/G`.
- El detalle completo continúa disponible al dejar el puntero sobre la planta o al abrirla.
- No requiere cambios en Supabase.


## V3.8.4 — Ocupación real de Veges y enmienda a 21 días
- La enmienda automática de Veges pasa de 14 a 21 días después del trasplante Esquejes → Veges.
- Veges se considera vacía desde el trasplante de sus plantas a la sala de Flora correspondiente.
- Mientras Veges está vacía no se generan tareas automáticas de Riego, Fumigación, KNF ni Enmienda.
- Las tareas vuelven a generarse desde el siguiente trasplante Esquejes → Veges.


## V3.9.0 — Cosechas
Nueva solapa Cosechas con historial 2025–2026, detalle por genética, filtros y carga editable. Los nombres históricos se conservan textualmente; las cosechas nuevas seleccionan genéticas del catálogo.


## V3.10.0
- Corregido el botón Editar cosecha en la vista por sala y año.


## V3.10.0 — Stock Palestina
- Nueva solapa Stock Palestina.
- Stock actual general por sala, ciclo y genética.
- Detalle por Flora y ciclo.
- Historial importado desde Stock Palestina.xlsx.
- Registro de entradas y salidas nuevas con actualización automática del saldo.


## V3.10.1 — Stock Palestina en cero y detalle plegable

- El stock actual se reinicia a 0 mediante el SQL complementario.
- Los movimientos históricos permanecen visibles pero dejan de afectar el saldo actual.
- El cuadro de stock actual se puede desplegar y replegar con un clic.


## V3.10.2 — Cosechas sincronizadas con Stock Palestina

- Al guardar una cosecha se ofrece crear o actualizar automáticamente su planilla de Stock Palestina.
- Cada planilla queda vinculada a la cosecha mediante `cosecha_id`, con protección contra duplicados.
- Editar una cosecha actualiza el mismo stock y registra diferencias como ajustes, sin volver a ingresar toda la cosecha.
- Los detalles de cosecha existentes conservan sus IDs al editarse para mantener el vínculo con las existencias.


## V3.10.3 — Genéticas únicas por cosecha

- Impide seleccionar la misma genética más de una vez dentro de una cosecha nueva o editada.
- Las genéticas ya utilizadas quedan deshabilitadas en los demás selectores.
- Si se intenta repetir una genética, la app indica que deben modificarse los gramos de la fila existente.
- Incluye una segunda validación al guardar para evitar duplicados incluso si se altera el formulario.


## V3.10.4 — Stock inicial por genética y textos

- La tabla de cada ciclo muestra por separado el stock inicial y el stock actual de cada genética.
- Se reemplazó “existencias” por “stock” en los textos de las salas.
- No requiere cambios adicionales en Supabase.


## V3.10.6 — Total automático de cosecha

- En cosechas nuevas, el total cosechado se calcula automáticamente sumando los gramos ingresados por genética.
- Al editar una cosecha con desglose por genética, el total también se recalcula automáticamente.
- Las cosechas históricas sin desglose conservan la posibilidad de editar manualmente el total.
- No requiere cambios en Supabase.


## V3.10.7 — Ingreso por bolsas y agrupación automática

- Permite repetir una genética en varias filas al cargar o editar una cosecha.
- Cada fila puede representar una bolsa o pesada independiente.
- Al guardar, suma automáticamente las filas repetidas y conserva una sola línea por genética.
- El detalle de la cosecha y Stock Palestina continúan mostrando y sincronizando el total agrupado por genética.
- No requiere cambios en Supabase.


## V3.10.8 — Corrección guardado por bolsas

- Corrige el error que guardaba el encabezado de una cosecha pero fallaba al insertar su desglose por genética.
- Los campos internos usados para agrupar bolsas ya no se envían a Supabase.
- Si fallara el detalle de una cosecha nueva, se elimina automáticamente el encabezado incompleto para evitar registros colgados.
- No requiere cambios en Supabase.


## V3.10.9 — Recuperación de contraseña

- Botón “¿Olvidaste tu contraseña?” en el acceso.
- Envío de enlace de recuperación mediante Supabase Auth.
- Pantalla segura para establecer y confirmar una contraseña nueva.
- Requiere autorizar la URL pública de la app en Supabase Authentication → URL Configuration → Redirect URLs.


## V3.11.0 — Navegación por días

- La solapa Hoy permite avanzar y retroceder un día con flechas.
- Muestra la fecha consultada y un botón para volver al día actual.
- El detalle diario del Calendario permite avanzar y retroceder sin volver a la grilla mensual.
- No requiere cambios en Supabase.


## V3.11.1 — Historial removido del menú

- Se eliminó la solapa Historial del menú principal.
- Las tareas pasadas siguen disponibles desde Calendario.
- No se borran tareas ni realizaciones de Supabase.
- No requiere cambios en Supabase.


## V3.11.2 — Ícono oficial de la app

- Se agregó el logo oficial para Android, iPhone/iPad y escritorio.
- Incluye íconos estándar y maskable para evitar recortes.
- Los usuarios que ya tengan el acceso directo deben eliminarlo y volver a instalar la app para ver el ícono nuevo.
- No requiere cambios en Supabase.


## V3.11.3 — Encabezado centrado

- La marca queda centrada en el encabezado.
- “Rainbows” aparece arriba y “Cultivo” debajo.
- Se conservan las tipografías y estilos actuales.
- No requiere cambios en Supabase.


## V3.11.4 — Centrado real del encabezado
- La marca Rainbows / Cultivo queda centrada respecto del ancho total de la pantalla.
- No requiere cambios en Supabase.


## V3.11.5 — Corrección del encabezado

- Se eliminó el posicionamiento absoluto que superponía Config y Salir sobre la marca.
- Rainbows / Cultivo queda en la columna central del encabezado.
- Los controles laterales conservan su espacio propio.
- No requiere cambios en Supabase.


## V3.11.6 — Ajuste fino del encabezado

- Se desplazó únicamente el logo “Rainbows” 4 px hacia la derecha.
- “Cultivo” permanece centrado en su posición.
- No requiere cambios en Supabase.


## V3.12.2 — Corrección real del desplazamiento del logo

- Se reemplazó `transform: translateX(4px)`, que interfería con el escalado previo del logo.
- El logo Rainbows ahora se desplaza 4 px a la derecha mediante `position: relative; left: 4px`.
- No se modifica “Cultivo”, los botones ni la estructura del encabezado.


## V3.12.2 — Voz, etapa 1
- Botón flotante de micrófono.
- Reconocimiento de voz configurado en español de Argentina (`es-AR`).
- Transcripción visible antes/durante la interpretación.
- Navegación por voz: Hoy, Calendario, Salas, Genéticas, Cosechas, Stock Palestina y Configuración (según permisos).
- Acceso por voz a Flora 1, Flora 2, Flora 3, Veges, Madres y Esquejes.
- Navegación diaria: día anterior, día siguiente/mañana y volver a hoy.
- Esta etapa no modifica datos ni realiza escrituras en Supabase.


## V3.12.2
- Restaurado el diseño legible del calendario móvil.
- El calendario usa desplazamiento horizontal interno en pantallas angostas, sin ensanchar toda la página.
- El botón de voz permanece fijo y visible.


## V3.12.3 — Voz, etapa 2: dictado en campos de texto

- Mantiene intacta la navegación por voz validada en V3.12.2.
- Agrega botón `🎙️ Dictar` en Detalle, Observaciones y Linaje.
- El reconocimiento usa `es-AR` y escribe el texto reconocido dentro del campo.
- Si el campo ya tenía texto, el dictado se agrega al final sin borrar lo anterior.
- El usuario debe revisar y usar el botón Guardar habitual: el dictado por sí solo no guarda ni escribe en Supabase.
- No modifica tareas, cosechas, stock, genéticas ni croquis automáticamente.
- Actualiza APP_VERSION, referencias de `app.js`/`styles.css` y caché del service worker.


## V3.12.4 — Voz: modo de escucha continua

- El micrófono flotante funciona como interruptor: un toque lo activa y otro toque lo apaga.
- Mientras está activo, la app reinicia automáticamente el reconocimiento después de cada frase para permitir varios comandos consecutivos.
- Se puede cerrar por voz con frases como `cerrar micrófono`, `apagar micrófono` o `dejar de escuchar`.
- El botón permanece animado durante toda la sesión continua, incluso entre frases.
- Los errores fatales de permiso o captura detienen el modo continuo; los silencios normales permiten continuar.
- El dictado puntual en campos de texto se conserva y no guarda automáticamente.
- No se modificó ninguna lógica de Supabase, tareas, cosechas, stock ni backups.
- Actualiza APP_VERSION, referencias de `app.js`/`styles.css` y caché del service worker.


## V3.12.5 — Micrófono continuo simplificado

- Elimina los botones separados `🎙️ Dictar` de los campos de texto.
- Mantiene el micrófono flotante en modo continuo para comandos de voz.
- Se conserva el cierre por segundo toque o por comandos como `cerrar micrófono`.
- No cambia la lógica de Supabase ni los datos.


## V3.13.1 — Voz etapa 3: consultas Tareas/Hoy
- Consultas por voz de tareas sin modificar datos.
- Permite preguntar por tareas del día visible, pendientes, realizadas, por sala y por empleado.
- El micrófono continuo permanece activo después de responder.
- Se agregó ayuda contextual con ejemplos desde el panel de voz.
- La edición/dictado de detalles no se reintrodujo en esta versión; se integrará después con el micrófono continuo, sin botón separado.


## V3.13.2 — Consultas de tareas por fecha hablada
- Las consultas de tareas resuelven la fecha mencionada en la orden, sin depender de la fecha abierta en la interfaz.
- Reconoce `hoy`, `ayer`, `anteayer`, `mañana` y `pasado mañana`.
- Reconoce días de la semana; expresiones como `lunes pasado` buscan hacia atrás y `próximo lunes` hacia adelante.
- También reconoce fechas explícitas como `12 de agosto`, `12 de agosto de 2026` y `12/8/2026`.
- Si la frase no menciona una fecha, conserva el comportamiento anterior y consulta el día actualmente visible.
- La respuesta siempre muestra la fecha exacta interpretada para que el usuario pueda verificarla.


## V3.13.3 — Consultas de Salas por voz
- Agrega consultas de estado, semana y ciclo por sala y por fecha hablada.
- Permite consultar próxima cosecha, próximo inicio de flora y próximo trasplante de Flora 1, 2 y 3.
- Agrega consultas del croquis actual por cama/genética y cantidad actual de plantas/camas.
- Las consultas de croquis describen la asignación actual; no se presenta como histórica porque no existe historial fechado de planta/cama.
- No modifica datos ni escribe en Supabase.


## V3.13.4 — Ayuda de voz realmente contextual
- Corrige la lista de `Ejemplos` para que se regenere cada vez que cambia la vista activa.
- Si la ayuda queda abierta al navegar entre Hoy, Calendario, Salas, Genéticas, Cosechas, Stock o Configuración, su contenido se actualiza automáticamente.
- También se actualiza al entrar o salir de una sala concreta, para mostrar ejemplos específicos de esa sala.
- No cambia consultas, reconocimiento de voz ni datos de Supabase.


## V3.13.5 — Consultas de voz globales

- Las consultas de Tareas/Hoy y Salas funcionan desde cualquier ventana de la app.
- La ventana activa ya no limita qué información se puede consultar.
- Si una consulta de sala omite el nombre estando dentro de una sala, la sala abierta se usa solo como contexto opcional.
- La ayuda de voz aclara qué consultas son globales y separa navegación.
- Se deja preparada la arquitectura para que futuras modificaciones sean contextuales a su sección y requieran confirmación.
- Sin cambios en Supabase ni en la lógica de datos.


## V3.13.6 — Normalización de números en voz

- Reconoce como equivalentes `Flora 3`, `Flora tres` y `Flora III` (también Flora 1/I/uno y Flora 2/II/dos).
- Normaliza números hablados del 1 al 31 para consultas de camas y fechas simples.
- No cambia la lógica de consultas ni escribe en Supabase.


## V3.13.7 — Consulta de responsables por fecha
- Agrega consultas por voz como "¿Quién hizo las tareas de hoy?".
- Admite cualquier fecha ya soportada por el parser: ayer, anteayer, días de la semana y fechas concretas.
- También admite filtro por sala, por ejemplo "¿Quién hizo las tareas ayer en Flora 2?".
- La respuesta muestra cada tarea realizada junto con la persona o personas registradas.
- Si una tarea figura realizada pero no tiene responsable asociado, lo indica explícitamente.


## V3.13.8
- Se elimina el botón Ejemplos del panel del micrófono.
- Se agrega la solapa Ayuda con instructivo de voz y comandos actualmente disponibles, organizados por navegación, tareas, fechas y salas.
- Las consultas siguen siendo globales; las modificaciones por voz continúan deshabilitadas.


## V3.13.9 — Ayuda junto a Config/Salir
- La sección Ayuda se retiró de la barra principal de navegación.
- Administradores: Ayuda queda en el encabezado junto a Config.
- Otros roles: Ayuda queda en el encabezado junto a Salir.
- Sin cambios en comandos de voz, consultas ni datos.


## V3.14.0 — Consultas de cultivo completamente globales
- Las consultas de voz ya no dependen de estar dentro de Salas ni de una Flora concreta.
- Si la pregunta nombra una sala, responde sobre esa sala desde cualquier ventana.
- Si una consulta de sala no nombra ninguna Flora, responde en conjunto por Flora 1, Flora 2 y Flora 3 cuando corresponde.
- Ejemplos globales: próxima cosecha, inicio de flora, trasplante, estado/semana/ciclo, cantidad de plantas/camas y genética por cama.
- Las tareas ya continúan funcionando globalmente por fecha, sala y responsable.
- La sección activa queda reservada como contexto para futuras MODIFICACIONES por voz, que requerirán confirmación.
- Sin cambios en Supabase ni en datos.


## V3.14.1 — Consultas globales de Stock Palestina por voz

- Se agregaron consultas de stock desde cualquier sección de la app.
- Permite consultar stock total, por sala, ciclo y genética.
- Permite consultar movimientos, salidas, entradas, ajustes y destinos como Medrano, Consumo interno y Descarte.
- Admite filtros de fechas habladas y rangos “esta semana” / “semana pasada”.
- Las respuestas reutilizan la misma lógica de saldo (`stockItemCurrent`) que la pantalla Stock Palestina.
- No se habilitaron modificaciones de stock por voz.


## V3.14.2 — Prioridad de navegación por voz
- Los comandos explícitos `ir a`, `abrir`, `abrime`, `entrar a` y `llevame a` se resuelven antes que las consultas globales.
- Corrige la colisión donde `ir a stock` devolvía el stock disponible en vez de abrir Stock Palestina.
- Las consultas como `cuánto stock hay` y `qué salidas hubo` siguen funcionando igual.


## V3.14.3 — Consultas globales de Cosechas por voz

- Agrega consultas globales de resultados de cosecha desde cualquier pantalla.
- Permite consultar total por sala/ciclo, última cosecha, producción por genética, genética de mayor producción, meta/desvío y acumulados por año.
- Mantiene “cuándo se cosecha” dentro de las consultas de calendario de Salas.
- No habilita cargas ni ediciones de cosechas por voz.
- Actualiza APP_VERSION, referencias de `app.js`/`styles.css` y caché del service worker.


## V3.14.4 — Consultas globales de Genéticas por voz

- Agrega consultas globales por nombre o nomenclatura de genética.
- Permite consultar nomenclatura, linaje, cannabinoides, genotipo y estado.
- Permite listar genéticas activas, archivadas y filtrar por THC/CBD/CBG.
- Mantiene consultas globales desde cualquier pantalla y no habilita modificaciones por voz.
- Actualiza Ayuda con ejemplos de consultas de Genéticas.


## V3.14.5 — Reconocimiento mejorado de genéticas por voz
- Las consultas por voz comparan automáticamente contra las genéticas reales cargadas en Supabase.
- Reconoce nombre, nomenclatura y nomenclaturas deletreadas (por ejemplo, MCV2 / “eme ce uve dos”).
- Tolera pequeñas diferencias de transcripción mediante coincidencia aproximada.
- Si dos genéticas resultan demasiado parecidas, no adivina: pide aclarar el nombre o la nomenclatura.
- La mejora se aplica a consultas de Genéticas, Stock Palestina y Cosechas.


## V3.14.6 — Respuestas habladas opcionales

- Agrega la opción `Leer respuestas en voz alta` al panel de voz.
- La preferencia queda guardada localmente en el dispositivo.
- Usa SpeechSynthesis con idioma `es-AR` cuando está disponible.
- Mientras Rainbows lee una respuesta, pausa el reconocimiento para evitar que el micrófono escuche la propia voz de la app.
- Al terminar de hablar, el modo de escucha continua se reanuda automáticamente.
- Si la lectura está desactivada, el comportamiento permanece igual que en V3.14.5.
- No modifica datos ni agrega escrituras por voz.


## V3.14.7 — Lectura inteligente de respuestas de voz

- Las respuestas breves y las respuestas múltiples breves se leen completas.
- Las respuestas extensas se resumen oralmente y mantienen el detalle completo en pantalla.
- Las respuestas ambiguas de genéticas leen un aviso corto y dejan las opciones completas visibles para elegir.
- El micrófono continuo sigue pausándose durante la lectura y se retoma automáticamente al finalizar.


## V3.14.8 — Prioridad de consultas de tareas
- Corrige una colisión por voz donde frases como ‘qué tareas quedaron pendientes’ podían interpretarse como consulta de Stock por contener ‘quedan/quedaron’.
- Las consultas explícitas de tareas ahora tienen prioridad sobre Stock.
- Stock ignora frases que mencionan claramente tareas, pendientes o responsables.
- No cambia ninguna lógica de datos ni permisos.


## V3.14.9 — Completar tareas por voz con confirmación
- Primer comando de voz que prepara una modificación de datos.
- Solo funciona desde Hoy o desde una fecha concreta abierta en Calendario.
- Comandos como “completar fumigación de Flora 2” identifican una tarea pendiente del día visible.
- Si se mencionan responsables por nombre, quedan preseleccionados.
- Siempre abre el diálogo existente de responsables y requiere tocar Guardar antes de escribir en Supabase.
- Si hay varias tareas posibles, no adivina: pide especificar tarea y sala.
- Si la orden menciona una fecha distinta de la que está abierta, no modifica nada y pide abrir primero ese día.
- Las consultas siguen siendo globales; las modificaciones por voz son contextuales.


## V3.15.1 — Mejor reconocimiento de empleados y detener lectura
- Reconocimiento aproximado de nombres de empleados con alias frecuentes.
- Se mantiene la confirmación manual de responsables antes de guardar.
- Botón “Detener voz” durante la lectura de respuestas para cortar el audio inmediatamente.
- Al detener la lectura, el micrófono continuo retoma la escucha automáticamente.


## V3.15.1
- Ayuda rediseñada con resumen inicial y lista completa desplegable.
- Configuración de voz disponible para todos desde Ayuda: selector de voz, velocidad, prueba y lectura activada/desactivada.
- La voz y velocidad elegidas se guardan por dispositivo.


## V3.15.2 — Mejor reconocimiento de Veges por voz
- Se agregaron alias fonéticos para la sala Veges (por ejemplo: vejes, vejez, veces y variantes similares).
- La normalización se aplica a navegación, consultas y acciones por voz.
- No se modificó la lógica de datos ni Supabase.


## V3.15.3 — Alias conservadores para Veges por voz
- Se eliminan `veces` y `vejez` como alias de Veges para evitar falsos positivos.
- Se mantienen variantes fonéticas cercanas y seguras: Veges, Vejes, Vegez, Bejes, Begez, Veyes/Beyes y variantes `veggie(s)`.
- No se modifica ninguna otra lógica de voz, datos ni Supabase.


## V3.15.4 — Vejez como alias de Veges
- Se reincorpora `vejez` como alias de voz para la sala Veges porque es una transcripción frecuente del reconocimiento en uso real.
- Se mantiene `veces` excluido para evitar falsos positivos con una palabra común.
- No se modifican otras funciones de voz ni lógica de datos.


## V3.15.5 — Crear tareas por voz
- Agrega creación de tareas por voz desde Hoy o Calendario.
- Requiere identificar sala y nombre de tarea; la fecha puede indicarse por voz o toma la fecha visible.
- Abre el formulario normal precompletado y nunca guarda automáticamente.
- Mantiene las consultas globales y las modificaciones contextuales.


## V3.15.7 — Tareas generales por voz
- Permite crear tareas generales por voz solo cuando la orden dice explícitamente `tarea general` o `general`.
- No interpreta automáticamente una tarea sin sala como general: pide aclaración para evitar errores.
- Las tareas generales se preparan únicamente desde Hoy, donde se administran actualmente.
- Abre el formulario existente con el nombre precargado y requiere Guardar manualmente.
- Mantiene tareas por sala con fecha y sala obligatorias.
- Actualiza versión y caché del service worker.


## V3.15.7 — Reprogramar y cancelar tareas por voz
- Reprogramar tareas desde Hoy/Calendario abre el formulario con la nueva fecha para revisión antes de Guardar.
- Cancelar tareas desde Hoy/Calendario reutiliza la confirmación manual existente antes de modificar datos.
- Si hay ambigüedad, falta fecha destino o la tarea está en otro día, Rainbows no adivina.


## V3.16.0 — Sensibilidad ambiente del micrófono
- Agrega Sensibilidad ambiente en Ayuda → Voz de Rainbows: Alta, Normal y Baja.
- Alta conserva el comportamiento previo.
- Normal y Baja usan Web Audio para medir el nivel ambiente y abrir SpeechRecognition solo al detectar una voz por encima del ruido sostenido brevemente.
- El umbral se adapta al ruido constante del ambiente; Baja exige una señal más clara/cercana.
- La preferencia queda guardada por dispositivo.
- No cambia la lógica de comandos, consultas ni escrituras en Supabase.


## V3.16.1 — Respuesta más rápida del filtro de voz

- Conserva el nivel de ruido ambiente aprendido entre frases en Normal/Baja.
- Evita recalibrar desde cero después de cada comando, especialmente en móvil.
- Reduce la calibración posterior a 35 ms en móvil y el traspaso al reconocimiento a 10 ms.
- Mantiene el filtro previo de ruido y el comportamiento de sensibilidad Alta.
- Corrige APP_VERSION, referencias y caché a 3.16.1.


## V3.16.2 — Escucha móvil continua sin timing

- En celular, Sensibilidad Normal/Baja deja de usar el gate previo de Web Audio que podía recortar el inicio de cada frase.
- SpeechRecognition permanece continuo cuando el navegador lo permite y se reinicia en ~60 ms si Chrome corta la sesión.
- Ruido/frases dudosas se descartan después del reconocimiento sin mostrar errores ni cerrar la escucha.
- Alta conserva el comportamiento anterior.
- En escritorio Normal/Baja conservan el filtro previo por nivel ambiente, donde funcionaba bien.
- Actualiza APP_VERSION, referencias y caché a 3.16.2.


## V3.16.3 — Baja menos sensible en móvil
- Mantiene la escucha móvil continua sin timing de V3.16.2.
- Endurece únicamente la sensibilidad Baja en celular: descarta palabras sueltas y fragmentos lejanos.
- Exige una combinación coherente de intención + vocabulario de Rainbows antes de ejecutar una frase.
- Mantiene Normal y Alta sin cambios funcionales.
- Actualiza APP_VERSION, referencias y caché a 3.16.3.


## V3.16.4 — Navegación a Hoy en sensibilidad Baja
- Corrige el filtro móvil estricto para reconocer explícitamente `Ir a hoy`, `Abrir hoy`, `Ir a inicio` y `Abrir inicio`.
- Mantiene sin cambios el filtrado de ruido y la sensibilidad Baja de V3.16.3.
- Actualiza APP_VERSION, referencias y caché a 3.16.4.

## V3.16.5 — Movimientos de stock por lote
- Permite seleccionar varias genéticas dentro de una sala/ciclo y registrar todos los movimientos en una sola operación.
- Agrega “Seleccionar todas”, “Limpiar” y “Usar todo disponible” para salidas.
- Cada genética conserva su movimiento individual en `stock_movimientos`, por lo que no cambia el modelo de datos ni se pierde detalle histórico.
- Valida el stock disponible por genética antes de registrar salidas.
- Muestra cantidad de genéticas y total de gramos cargados antes de guardar.
- Pide una confirmación final única con cantidad de movimientos, total, sala/ciclo y destino/origen.
- Actualiza APP_VERSION, referencias de `app.js`/`styles.css` y caché del service worker a 3.16.5.


## V3.16.6 — Voz móvil más estable
- Corrige el modo Normal/Baja en celular sin volver al detector previo que podía cortar el inicio de la frase.
- SpeechRecognition trabaja en sesiones cortas y se recicla casi inmediatamente, en vez de quedar en una sesión continua ocupada por ruido o conversaciones lejanas.
- En modo Baja los textos intermedios irrelevantes se ocultan para evitar que el panel parezca reaccionar constantemente al ruido.
- Android puede devolver hasta tres alternativas de reconocimiento; Rainbows elige la alternativa con más señales de ser un comando válido de la app.
- Los resultados irrelevantes o desconocidos se descartan silenciosamente y fuerzan un reinicio rápido de la escucha.
- Mantiene los comandos cortos seguros como “Ir a hoy” y “Abrir hoy”.
- No modifica el modelo de datos ni los movimientos múltiples de Stock agregados en V3.16.5.
- Actualiza APP_VERSION, referencias de app.js/styles.css y caché del service worker a 3.16.6.
