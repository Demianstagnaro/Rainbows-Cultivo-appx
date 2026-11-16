# Rainbows 3.26.84 — Sueldos por producción

## Instalación desde 3.26.83

1. Ejecutar completo **Palestina_V32684_sueldos_por_produccion.sql** en Supabase. Requiere Asistencias y sueldos V3.26.77 y modalidad mensual V3.26.80 ya instaladas. Conserva los registros existentes. Se puede volver a ejecutar.
2. Extraer **RAIZ_V32684.zip** y subir todo su contenido a la raíz de GitHub, reemplazando los archivos existentes. Incluir `palestina-payroll.js`, `app.js`, `styles.css`, `index.html`, `sw.js` y el nuevo SQL. Conservar la ruta `.github/workflows/quality.yml`.
3. Extraer **TESTS_CAMBIADOS_V32684.zip** dentro de `tests`, conservando la subcarpeta `sql`. Son tres archivos: `pwa.test.mjs`, `payroll.test.mjs` y `sql/payroll-production-assertions.sql`. Conservar las demás pruebas.
4. Recargar y comprobar **3.26.84 en Config → Versión**.

## Registrar un trabajo por producción

Desde **Palestina → Administración → Asistencias y sueldos**, usar **+ Producción** o elegir **Por producción…** en el casillero de un día.

Completar:

- Empleado y fecha.
- Trabajo realizado, por ejemplo Poda de piletas.
- Unidades realizadas. Acepta coma o punto decimal y hasta tres decimales.
- Valor por unidad en pesos. El total se calcula como unidades × valor por unidad y se redondea a centavos.
- Notas opcionales.

Si el importe está acordado por un trabajo completo, se puede registrar una unidad y el valor total de ese trabajo.

El total se guarda y se suma automáticamente a **Total sueldos** y a **Falta pagar**. No se calcula por horas ni se cuenta como una jornada de asistencia. No hace falta configurar un jornal para un empleado que sólo cobra por producción.

## Reemplazar una jornada o sumar un trabajo adicional

- Si se elige **Por producción…** desde una jornada ya tildada, el formulario indica **Cambiar jornada a producción**. Al guardar, reemplaza esa jornada y su importe anterior. No se suman ambos cargos. La conversión se guarda en una única operación y conserva el historial.
- **+ Producción** registra un trabajo adicional. Puede coexistir con una jornada del mismo día si corresponde pagar ambos trabajos.
- Se pueden guardar varios trabajos de producción para la misma persona y fecha. Cada trabajo aparece separado en su casillero con unidades e importe.

Tocar un trabajo guardado permite editarlo indicando un motivo. En Correcciones e historial se puede filtrar por **Producción**, ver el detalle de unidades y valor unitario, consultar la auditoría o anular un trabajo. La anulación lo quita del cálculo y conserva el registro.

## Pagos y registros anteriores

Los pagos se cargan con **+ Pago** como antes, completos o parciales. Se descuentan del pendiente total, que ahora incluye producción. El saldo continúa arrastrándose entre meses. El pago no genera automáticamente un egreso en Caja.

Las tarifas por jornada, el sueldo mensual de Norma, asistencias, pagos y ajustes existentes se conservan. No cambian las exclusiones de empleados ni el orden de Norma al final. Los trabajadores inactivos con registros pendientes continúan disponibles para consultar y pagar su saldo.

El acceso sigue limitado a Administradores y Encargados de Palestina.

Validación: **311 pruebas JavaScript aprobadas**. Pruebas PostgreSQL de unidades, precios, varios trabajos en un día, cálculo sin tarifa horaria, pagos, arrastre, reintentos, conversión sin duplicación, edición, anulaciones, datos inválidos y permisos. Prueba de interfaz con PostgreSQL de carga, cálculo, pago y correcciones.
