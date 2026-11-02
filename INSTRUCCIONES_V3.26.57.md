# Rainbows V3.26.57 — Rol Encargado P

## Instalación

Hacelo en este orden:

1. En Supabase → SQL Editor → New query, pegá **solamente** el contenido completo de `Rainbows_V3.26.57_rol_encargado_palestina.sql` y tocá **Run**.
2. En Supabase → Edge Functions → `rainbows-create-user` → Code, reemplazá el código por el nuevo `index.ts` incluido en `SUPABASE_FUNCTION_V32657.zip` y tocá **Deploy updates**.
3. En GitHub, subí juntos a la **raíz** todos los archivos de `RAIZ_V32657.zip` y confirmá el cambio.
4. En GitHub, entrá a la carpeta `tests`, subí juntos los archivos de `TESTS_V32657.zip` y confirmá el cambio.
5. En GitHub, actualizá también `supabase/functions/rainbows-create-user/index.ts` con el archivo del ZIP de la función, para que el repositorio conserve la misma versión desplegada.
6. Esperá que terminen en verde `Calidad` y `pages build and deployment`.

No subas los ZIP directamente: abrilos y subí los archivos que contienen en la ubicación indicada.

## Asignar el rol

Entrá como Administrador a `Config` y podés:

- cambiar un usuario existente a `Encargado P`; o
- crear una cuenta nueva seleccionando `Encargado P`.

## Comprobación recomendada

Ingresá con la cuenta Encargado P y verificá:

1. Ve `Hoy`, `Calendario`, `Info cultivo`, `Cosechas` y `Stock Palestina`.
2. Puede crear una cosecha nueva.
3. Puede agregar o editar una genética.
4. Puede registrar un movimiento de Stock Palestina.
5. No aparece el botón `Config`.
6. No aparece el botón `Medrano`.

El rol `Administrador` conserva acceso total y sigue siendo el único que puede administrar usuarios, empleados, backups y configuración.
