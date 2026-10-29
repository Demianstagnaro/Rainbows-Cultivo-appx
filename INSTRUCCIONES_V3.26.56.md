# Rainbows V3.26.56 — Control físico de stock

## Instalación

Hacelo en este orden:

1. En Supabase → SQL Editor → New query, pegá **solamente** el contenido completo de `Rainbows_V3.26.56_control_fisico_stock.sql` y tocá **Run**.
2. En GitHub, subí juntos a la **raíz** todos los archivos de `RAIZ_V32656.zip` y confirmá el cambio.
3. En GitHub, entrá a la carpeta `tests`, subí juntos los archivos de `TESTS_V32656.zip` y confirmá el cambio.
4. Esperá que terminen en verde `Calidad` y `pages build and deployment`.

No vuelvas a subir el ZIP entero: abrilo y subí los archivos que contiene en la ubicación indicada.

## Cómo comprobarlo

1. Entrá con un usuario administrador a Medrano → Stock → Control físico.
2. La vista inicial debe mostrar `Materias primas críticas`.
3. Cargá el conteo de un solo producto con la misma cantidad registrada y confirmá. Debe quedar como `Coincide`.
4. Hacé otro control de prueba con una diferencia pequeña y escribí una observación de al menos cinco caracteres. Debe registrarse como `Ajustado` y actualizar el stock.
5. Abrí `Historial`: debe permitir elegir año, mes y día y mostrar responsable, hora, registrado, reservado, disponible, contado, diferencia y resultado.

Si un conteo es menor que una cantidad ya reservada, el sistema no modifica el stock: lo guarda como `Requiere revisión` para no afectar comandas ni producciones activas.
