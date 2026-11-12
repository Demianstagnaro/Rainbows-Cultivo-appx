# Rainbows 3.26.73 — Administración y Caja de Palestina

## Instalación desde 3.26.72

1. Ejecutar completo **Palestina_V32673_instalar_caja.sql** en el editor SQL de Supabase. Está junto a estas instrucciones, fuera del ZIP de raíz. Crea las tablas y funciones, categorías y las 320 sugerencias de artículos de la planilla. Puede volver a ejecutarse sin duplicarlas ni borrar movimientos.
2. Extraer **RAIZ_V32673.zip** y subir su contenido a la raíz de GitHub, reemplazando los archivos existentes. Conservar la ruta `.github/workflows/quality.yml`. Incluir el archivo nuevo `palestina-cash.js` y `styles.css`.
3. Extraer **TESTS_CAMBIADOS_V32673.zip** dentro de la carpeta `tests` del repositorio, conservando la subcarpeta `sql`. Son cuatro archivos; conservar las demás pruebas existentes.
4. Cuando termine la actualización, recargar la app y comprobar la versión **3.26.73**.
5. Entrar en **Palestina → Administración → Caja** con usuario Administrador o Encargado de Palestina. Tocar **Registrar saldo inicial**, indicar fecha de inicio y efectivo disponible (puede ser cero). Luego cargar los movimientos desde esa fecha.

La actualización presupone las migraciones anteriores instaladas, especialmente los roles de V3.26.57. Si aparece un error de función inexistente al ejecutar el SQL, verificar primero esa migración.

El archivo `Palestina_V32673_administracion_caja.sql`, dentro de RAIZ, contiene el esquema y las categorías para que las pruebas de GitHub puedan ejecutarse. El archivo que se debe ejecutar en Supabase es **Palestina_V32673_instalar_caja.sql**, que además contiene las sugerencias de artículos. Mantener este instalador fuera del repositorio público porque incluye nombres de artículos de tu planilla.

## Uso

La nueva sección Administración pertenece a Palestina y contiene la opción Caja. Su registro es independiente del de Medrano.

La tabla conserva las columnas de referencia: Movimiento, Fecha, Forma de pago, Artículo, Cantidad, Costo total, Tipo de gasto y Notas. Agrega responsable y acciones. Se puede elegir un artículo sugerido o escribir uno nuevo; los nuevos quedan disponibles para las próximas cargas.

Ingresar siempre un importe positivo y elegir **Ingreso** o **Egreso**. **Costo total** es el importe de toda la compra: la cantidad no lo multiplica. Para importes usar el formato argentino, por ejemplo `10.000,50`; la cantidad acepta coma o punto decimal y hasta tres decimales.

El selector permite navegar por meses. Los resúmenes muestran saldo inicial de efectivo, ingresos de efectivo, gastos de efectivo, gastos por transferencia, saldo final de efectivo y total de gastos. Si hubo ingresos por transferencia, se muestran aparte. Las transferencias no modifican el efectivo.

El efectivo final se calcula como saldo inicial + ingresos de efectivo − gastos de efectivo, y se arrastra a los meses posteriores. El total de gastos suma efectivo y transferencias. Todas las categorías tienen su propio subtotal, incluido **Sueldo Cosecha**. Los filtros afectan sólo la tabla: los resúmenes siempre corresponden al mes completo.

**Editar** requiere un motivo y conserva los valores anteriores en Historial. **Anular** también requiere un motivo: excluye el movimiento de los cálculos y lo conserva para consultar con Mostrar anulados. Cada cambio registra responsable y fecha. Las correcciones de movimientos anteriores recalculan los saldos posteriores.

**Saldo de partida** permite corregir el importe o la fecha inicial indicando un motivo. La fecha no puede quedar después de un movimiento ya registrado. El Historial de apertura conserva las correcciones.

## Datos y validación

La caja comienza sin movimientos: no se importan los importes históricos del Excel ni su saldo. Se incorporan su estructura, categorías y sugerencias de artículos.

Acceso limitado a Administrador y Encargado de Palestina. Los otros roles no pueden consultar ni modificar esta caja. Se impiden escrituras directas desde el cliente, cargas duplicadas por reintento y ediciones sobre versiones desactualizadas.

Validación realizada: 299 pruebas JavaScript aprobadas; instalación SQL repetida, permisos, saldos entre meses, categorías, correcciones y anulaciones sobre PostgreSQL; prueba de interfaz con la misma base de datos para apertura, carga, decimales, edición, filtros, historial y navegación mensual.
