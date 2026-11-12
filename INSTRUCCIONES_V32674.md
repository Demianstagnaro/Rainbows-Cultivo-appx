# Rainbows 3.26.74 — Correcciones de Caja Palestina

## Instalación desde 3.26.73

1. Ejecutar completo **Palestina_V32674_articulos_caja.sql** en el editor SQL de Supabase. Requiere la Caja V3.26.73 ya instalada. Conserva efectivo inicial, artículos, movimientos e historial. Puede repetirse sin duplicar datos.
2. Extraer **RAIZ_V32674.zip** y subir su contenido a la raíz de GitHub, reemplazando los archivos existentes. Conservar la ruta `.github/workflows/quality.yml`. Incluir `palestina-cash.js` actualizado y el nuevo SQL, que también utilizan las pruebas.
3. Extraer **TESTS_CAMBIADOS_V32674.zip** dentro de la carpeta `tests`, conservando la subcarpeta `sql`. Son tres archivos; conservar todas las demás pruebas.
4. Recargar la app y comprobar **3.26.74** antes de continuar cargando movimientos.

## Cambios

- El efectivo inicial y el costo total se separan en miles con puntos al escribir; la coma indica decimales. Al salir del campo se muestran dos decimales. Ejemplo: `1.250.000,50`.
- El botón antes llamado «Saldo de partida» ahora dice **Efectivo al comenzar**. Es el dinero disponible al empezar a usar esta caja. Se registra una vez, no cada mes. Se puede corregir con motivo e historial.
- El campo Artículo busca entre los artículos existentes. Escribir un nombre desconocido y guardar el movimiento ya no crea un artículo nuevo: se muestra un aviso para elegir uno de la lista.
- **+ Nuevo artículo** está disponible tanto en la pantalla de Caja como dentro del movimiento. Abre un formulario separado, pide revisar y confirmar el nombre, y avisa si ya existe uno con distintas mayúsculas, acentos o espacios.
- Al crear el artículo desde un movimiento, queda seleccionado y se conservan los otros campos que estabas completando. Crear el artículo no registra un gasto.

## Cómo funciona la caja

1. **Efectivo al comenzar:** importe y fecha iniciales de esta caja. A partir de ellos se calculan los saldos siguientes. Si ya se registró, la actualización lo conserva.
2. **Movimientos:** elegir Ingreso o Egreso, fecha, Efectivo o Transferencia, artículo, cantidad, costo total y categoría; notas opcionales.
3. **Costo total:** importe de toda la operación, siempre positivo. La cantidad no lo multiplica; el tipo Ingreso/Egreso determina si suma o resta.
4. **Saldo de efectivo:** efectivo inicial + ingresos en efectivo − gastos en efectivo. Las transferencias se muestran aparte y no cambian el efectivo.
5. **Meses:** el efectivo se arrastra automáticamente. Los gastos del mes se resumen por forma de pago y categoría, incluido Sueldo Cosecha. El total de gastos suma efectivo y transferencias.
6. **Control:** las búsquedas y filtros afectan la tabla, no el resumen del mes completo. Editar o anular exige motivo y conserva quién hizo el cambio, cuándo y los valores anteriores. Las correcciones recalculan los saldos posteriores.

Esta caja es independiente de Medrano. No calcula el saldo global de una cuenta bancaria ni reinicia el efectivo al cambiar el día o el mes. Acceso para Administrador y Encargado de Palestina.

Validación: 301 pruebas JavaScript aprobadas. Pruebas PostgreSQL de actualización repetida, conservación de registros, creación explícita, duplicados, rechazo de artículos desconocidos y permisos. Prueba de interfaz con PostgreSQL para importes, rechazo de errores, alta dentro del movimiento, conservación de campos, edición, anulación, historial y navegación mensual.
