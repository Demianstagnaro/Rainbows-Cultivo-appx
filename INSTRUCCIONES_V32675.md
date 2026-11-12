# Rainbows 3.26.75 — Botones de Caja Palestina

## Instalación desde 3.26.74

1. Extraer **RAIZ_V32675.zip** y subir su contenido a la raíz de GitHub, reemplazando los archivos existentes.
2. Extraer **TESTS_CAMBIADOS_V32675.zip** dentro de `tests`, reemplazando únicamente `pwa.test.mjs`. Conservar las demás pruebas.
3. Recargar la app y comprobar la versión **3.26.75**.

**No requiere ejecutar SQL.** Se mantienen las migraciones V3.26.73 y V3.26.74 ya instaladas y todos los registros existentes.

## Cambios

Los botones **+ Movimiento** y **+ Nuevo artículo** ahora están dentro del recuadro **Movimientos del mes**, junto al título, en la parte inferior de la pantalla principal de Caja. En celulares se acomodan dentro del mismo recuadro.

El saldo inicial de cada mes es el **saldo final de efectivo del mes anterior**. Esta regla ya estaba implementada: se comprobó y se aclaró en la pantalla. Si hay meses sin movimientos, se conserva el mismo saldo. Las transferencias no afectan el efectivo. Corregir o anular movimientos anteriores recalcula los saldos posteriores.

El importe **Efectivo al comenzar** sólo establece el punto de inicio cuando se empieza a usar la caja. No se vuelve a cargar al cambiar de mes.

Validación: 301 pruebas JavaScript aprobadas; comprobación de la ubicación y funcionamiento de los botones en la interfaz; verificación PostgreSQL de continuidad del saldo entre meses.
