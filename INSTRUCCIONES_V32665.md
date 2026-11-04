# V3.26.65 — Mediciones y ajustes móviles

1. Subir el contenido de RAIZ_V32665.zip a la raíz de GitHub.
2. Subir el contenido de TESTS_V32665.zip dentro de tests.
3. Esperar los checks del último commit y actualizar la app.

No ejecutar SQL ni cambiar Edge Functions. Requiere las migraciones ya aplicadas hasta V3.26.64.

## Cambios

- Mediciones: admite coma o punto decimal y valida límites antes de enviar a Supabase.
- Temperatura: controles propios de menos/más, de 0,1 °C por toque.
- Navegación móvil: botones ajustados al ancho y encabezado sin superposición.
- Formularios: campos de 16 px, límites al ancho y altura disponible, desplazamiento vertical en diálogos largos.
- Tablas: desplazamiento local dentro de su sección. Se conservan las columnas para no ocultar información.
- Controles principales con mayor área táctil y margen inferior para no taparlos con el micrófono.

## Comprobación en teléfono

1. Registrar temperatura 24,5; humedad 55,5; pH 6,2 y EC 1,5. Revisar los valores guardados.
2. Probar menos/más en temperatura.
3. Abrir Calendario, Info cultivo, Insumos y croquis.
4. En Medrano abrir una comanda, producción, paciente y arqueo: verificar que se llega a Guardar y Cancelar.
5. Revisar en orientación vertical y horizontal.

La revisión fue de código y pruebas locales. No sustituye una prueba visual en tu teléfono con su teclado y navegador; no se ejecutaron operaciones reales en la base de producción.
