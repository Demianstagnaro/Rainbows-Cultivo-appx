# Rainbows 3.26.80 — Norma con sueldo mensual

## Instalación desde 3.26.79

1. Ejecutar completo **Palestina_V32680_norma_mensual.sql** en Supabase. Requiere Asistencias y sueldos V3.26.77 ya instalada. Agrega o reactiva a Norma sin duplicar su nombre y habilita la modalidad mensual. No establece ningún importe de sueldo.
2. Extraer **RAIZ_V32680.zip** y subir todo su contenido a la raíz de GitHub, reemplazando los archivos existentes. Conservar la ruta `.github/workflows/quality.yml`. Incluir el nuevo SQL, que también se utiliza en las pruebas.
3. Extraer **TESTS_CAMBIADOS_V32680.zip** dentro de `tests`, conservando la subcarpeta `sql`. Son tres archivos: `pwa.test.mjs`, `payroll.test.mjs` y `sql/payroll-monthly-assertions.sql`. Conservar las demás pruebas.
4. Recargar la app y comprobar **3.26.80 en Config → Versión**.

## Uso

Norma aparece en la misma planilla junto a los empleados por jornada. Fran, Demi, Chomi, Cone y Lua continúan excluidos.

1. Tocar **Definir sueldo mensual** debajo del nombre de Norma y cargar su importe mensual actual. No hace falta definir horas ni guardias para ella.
2. En cada mes, tildar **Sueldo del mes** en la fila del **día 1**. Se suma el sueldo mensual completo una sola vez. Las otras fechas de su columna no generan cargos diarios.
3. Al pagarle, usar **+ Pago** debajo de Norma. El formulario propone **Efectivo** y permite indicar fecha e importe. Se puede registrar un pago completo o varios pagos parciales durante el mes.

Los pagos se descuentan del pendiente y aparecen agrupados por fecha. Como antes, el registro de un pago no genera automáticamente un egreso en Caja.

El sueldo mensual no se cuenta como un día trabajado. No se genera una asistencia diaria ni se multiplica el importe mensual por la cantidad de días. La fila de totales ahora dice **Total sueldos**, para incluir los jornales y el sueldo mensual.

Si cambia su sueldo, modificar el valor debajo del nombre. Afecta las cargas posteriores: el sueldo de un mes ya registrado conserva su importe. Para corregir una carga anterior, usar Correcciones e historial.

Se conservan empleados, registros, pagos, saldos e historial anteriores. Si Norma ya estaba registrada, se usa su mismo empleado. Si tenía valores por jornada configurados, hay que confirmar expresamente el nuevo sueldo mensual: no se convierten automáticamente en un sueldo mensual.

Permisos: sólo Administradores y Encargados de Palestina.

Validación: **309 pruebas JavaScript**, pruebas PostgreSQL de sueldo mensual único, rechazo de duplicados y cargos diarios, pagos parciales, saldo, conservación histórica e instalación repetida. Prueba de interfaz de alta de Norma, configuración mensual, una carga por mes y dos pagos en efectivo.
