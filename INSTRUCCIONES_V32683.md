# Rainbows 3.26.83 — Completar bandejas de Veges

## Instalación desde 3.26.81 o 3.26.82

1. Ejecutar completo **Palestina_V32683_completar_bandejas.sql** en Supabase. Este SQL también incluye la ampliación de Vege 1 a 12 bandejas; no hace falta ejecutar antes el SQL V3.26.82. Requiere el sistema de Croquis V3.26.69 ya instalado.
2. Extraer **RAIZ_V32683.zip** y subir todo su contenido a la raíz de GitHub, reemplazando los archivos existentes. Conservar la ruta `.github/workflows/quality.yml`. Incluir ambos SQL en el repositorio porque las pruebas también verifican la ampliación de bandejas. El archivo V3.26.82 se incluye para esas verificaciones; el que se ejecuta en Supabase para esta entrega es el V3.26.83.
3. Extraer **TESTS_CAMBIADOS_V32683.zip** dentro de `tests`, conservando la subcarpeta `sql`. Son cuatro archivos: `pwa.test.mjs`, `sql/tray-fill-assertions.sql`, `sql/vege-trays-fixture.sql` y `sql/vege-trays-assertions.sql`. Conservar las demás pruebas.
4. Recargar y comprobar **3.26.83 en Config → Versión**.

## Uso

En **Info cultivo → Croquis → Vege 1 o Vege 2**:

1. Tocar una maceta de la bandeja.
2. Elegir la genética.
3. Marcar **Completar las macetas vacías de esta bandeja con la misma genética**.
4. Guardar.

Se guarda la genética elegida en la maceta seleccionada y se completan las demás posiciones vacías de esa bandeja, hasta 9 macetas. Las otras macetas ya ocupadas conservan su genética y sus datos. Si se edita una maceta ocupada, sólo esa maceta seleccionada cambia a la genética elegida; las demás ocupadas se respetan.

Sin marcar la opción, se guarda únicamente la maceta seleccionada como antes. No se puede completar una bandeja sin elegir una genética activa.

El llenado completo se guarda en una sola operación: si algo falla, no se aplican cambios parciales. Conserva los permisos operativos existentes y el historial de ocupación de salas.

Vege 1 mantiene **12 bandejas de 9 (108 posiciones)**. Vege 2 conserva **11 bandejas de 9**. Esquejes continúa con su carga por almácigo y no muestra esta opción.

Validación: 309 pruebas JavaScript aprobadas. Pruebas PostgreSQL de llenado completo, conservación de ocupadas, otras bandejas intactas, límites, genética activa, permisos e instalación repetida. Prueba de interfaz con la misma base de datos para el llenado de bandeja 12, validación sin genética, guardado individual y Esquejes sin cambios.
