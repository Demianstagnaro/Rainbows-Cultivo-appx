# Rainbows 3.26.69 — Madres y ocupación de salas

Ejecutar completo **Palestina_V32669_croquis_salas.sql** en el editor SQL de Supabase. El SQL conserva los croquis y plantas existentes; se puede volver a ejecutar sin duplicar períodos.

## Madres

Info cultivo → Croquis → Madres abre una lista de genéticas. Usar **Agregar genética** para seleccionar una de las variedades del listado central. Cada genética aparece una sola vez. **Quitar** retira la variedad de esta sala. La lista no representa posiciones ni cantidades de plantas.

## Vaciar sala e historial

Cada croquis de Flora, Vege y Esquejes, y la lista de Madres, tiene **Vaciar sala**, **Historial** y, mientras está ocupado, **Fecha de ingreso**.

Al registrar el primer ingreso se abre un período con la fecha del día. Si corresponde otra fecha, usar **Fecha de ingreso**. Las salas que ya estaban cargadas al instalar la actualización comienzan con fecha **Sin registrar**: completar su fecha real antes de vaciarlas si se conoce.

**Vaciar sala** muestra el contenido actual y pide fecha de vaciado, motivo (Cosecha, Traslado u Otro) y observaciones. Confirmar archiva el contenido y cierra el período. Se conservan camas, capacidad y posiciones para la próxima carga. En Madres se vacía la lista; en Vege y Esquejes se retiran sus registros de bandejas o almácigos.

Si otra persona modifica el contenido mientras la confirmación está abierta, la app pide revisar de nuevo antes de vaciar. Repetir la confirmación de un período ya cerrado no vuelve a vaciar una sala recargada.

**Historial** muestra los últimos 100 períodos de la sala, con fechas de ingreso y vaciado, genéticas y cantidades registradas, motivo, observaciones y usuario que registró el vaciado. Las cargas posteriores abren períodos nuevos. Si se retiran individualmente todos los registros también se cierra el período.

Cosechas y traslados de stock se registran desde sus secciones habituales.

## Completar pileta

Al editar una maceta de Flora, elegir **Ocupada** y su genética. Activar **Completar las macetas vacías de esta pileta con esta genética** y guardar. Se completan las posiciones habilitadas según la capacidad de la pileta (5 o 9); las otras plantas ya ocupadas conservan su genética. Las observaciones se aplican a la maceta elegida.

## Instalación del código

El código de esta versión y sus pruebas se publican en GitHub. Sólo hace falta ejecutar el SQL anterior y recargar la app para usar las funciones nuevas.
