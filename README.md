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


## V3.1
- Login oculto después de ingresar.
- Administración de usuarios y roles.
- Registro del usuario que hizo cada modificación.
