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
