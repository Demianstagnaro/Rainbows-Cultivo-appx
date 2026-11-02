# Rainbows V3.26.58 — Parámetros del cultivo

## Instalación

Hacelo en este orden:

1. Si todavía no ejecutaste la corrección del rol Encargado P, corré primero `CORRECCION_V32657_PERFIL_ENCARGADO_P.sql` en Supabase → SQL Editor. Es seguro volver a ejecutarla si ya la habías aplicado.
2. En Supabase → SQL Editor → New query, pegá solamente el contenido completo de `Rainbows_V3.26.58_parametros_cultivo.sql` y tocá **Run**.
3. En GitHub, subí juntos a la raíz todos los archivos de `RAIZ_V32658.zip` y confirmá el cambio.
4. En GitHub, entrá a la carpeta `tests`, subí juntos los archivos de `TESTS_V32658.zip` y confirmá el cambio.
5. Esperá que terminen en verde `Calidad` y `pages build and deployment`.

No subas los ZIP directamente: abrilos y subí los archivos que contienen en la ubicación indicada.

Esta versión no requiere modificar ninguna Edge Function.

## Uso

1. Entrá a Palestina → Info cultivo → Parámetros.
2. Administrador o Encargado P puede editar los objetivos de Vege y Flora S1 a S8.
3. Tocá `Registrar medición` y elegí fecha, sala y, si corresponde, una cama.
4. La etapa se completa automáticamente según sala y fecha, pero se puede corregir antes de guardar.
5. Completá solamente los valores que efectivamente mediste.
6. El historial puede consultarse por mes y filtrarse por sala.

Los valores objetivo empiezan vacíos para que Rainbows cargue sus rangos reales de trabajo sin imponer valores genéricos.
