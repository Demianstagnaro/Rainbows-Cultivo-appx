# Rainbows 3.26.86 — Resumen automático de pagos

## Instalación desde 3.26.85
1. En Supabase → SQL Editor, ejecutar Palestina_V32686_resumen_pagos.sql. Puede volver a ejecutarse sin duplicar datos. Mantener las migraciones anteriores.
2. Extraer RAIZ_V32686.zip y subir TODO su contenido a la raíz del repositorio, reemplazando los archivos existentes y conservando el resto. Incluye el workflow de verificaciones.
3. Extraer TESTS_CAMBIADOS_V32686.zip dentro de tests, conservando las demás pruebas.
4. Recargar y comprobar 3.26.86 en Config → Versión.

## Funcionamiento
- Debajo de la planilla aparece Resumen de pagos: nombre completo, DNI, teléfono, alias / medio de pago, generado en el mes, pagado en el mes y falta pagar, con total general.
- Los importes se completan con las jornadas, trabajos por producción, sueldo mensual de Norma, ajustes y pagos registrados. El pendiente incluye el saldo anterior; un saldo negativo se muestra como anticipo, sin reducir la deuda de otros empleados.
- Datos permite completar o corregir la información personal. Para Norma se puede escribir Efectivo en alias / medio de pago. No se inventan datos faltantes.
- El SQL toma los datos personales del Excel 30_10 únicamente cuando encuentra un empleado con nombre coincidente y sin ambigüedad. No crea empleados ni sobrescribe datos de pago existentes. No importa los importes de sueldo del Excel.
- Norma sigue al final; Fran, Demi, Chomi, Cone y Lua siguen fuera de la planilla por jornada.
- El historial de planillas se consulta con las flechas o el selector de mes de arriba. Ya no hay historial de movimientos debajo.
- Para corregir/anular registros o cargar ajustes está el botón Corregir registros, que abre una ventana aparte. No se elimina ningún registro anterior.
- Registrar un pago no genera automáticamente un egreso en Caja, como ya ocurría.
- Los datos de pago se guardan separados de la lista general de empleados y solo están disponibles para administradores y encargados de Palestina. La edición detecta cambios simultáneos.

## Validación
312 pruebas JavaScript aprobadas. Prueba de interfaz DOM: resumen, edición de datos, pago parcial, navegación mensual, correcciones, exclusiones y orden de Norma. Pruebas PostgreSQL (PGlite): migración repetible, vinculación del Excel, validación, permisos y control de cambios simultáneos. No se modificaron datos de la app en producción.
