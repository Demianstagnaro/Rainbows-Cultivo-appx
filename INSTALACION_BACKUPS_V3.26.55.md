# Rainbows V3.26.55 — Instalación de backups cifrados

Esta versión termina el sistema de copias de seguridad que aparece en `Config`.

La copia se genera todos los días a las **03:30 de Argentina**, se cifra antes de almacenarse y se conserva durante 30 días. También se puede solicitar y descargar manualmente desde la app.

## Importante

- No hay que ejecutar ningún SQL.
- No pegues contraseñas, URLs privadas ni tokens dentro de GitHub como archivos.
- No compartas por chat la clave de cifrado ni las conexiones de las bases.
- Guardá una copia externa de `BACKUP_ENCRYPTION_KEY`: si se pierde, los backups anteriores no pueden descifrarse.
- La restauración automática sólo admite un proyecto de Supabase nuevo y vacío. Nunca restaura directamente sobre Producción.

---

## Parte 1 — Subir la aplicación

1. En la raíz de GitHub subí todos los archivos de `RAIZ_V32655.zip`.
2. Entrá a `tests` y subí todos los archivos de `TESTS_V32655.zip`.
3. Esperá que `Calidad` y `pages build and deployment` terminen correctamente.

## Parte 2 — Instalar los workflows de GitHub

1. En GitHub abrí `.github/workflows`.
2. Subí allí los dos archivos de `WORKFLOWS_BACKUP_V32655.zip`:
   - `backup-database.yml`
   - `restore-backup.yml`
3. Confirmá el cambio.

Después deberían aparecer en la pestaña `Actions`:

- `Backup diario de Rainbows`
- `Restaurar backup de Rainbows`

## Parte 3 — Crear los secretos de GitHub

Entrá al repositorio → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.

Creá inicialmente estos dos secretos:

### `SUPABASE_DB_URL`

1. En el proyecto productivo de Supabase tocá `Connect`.
2. Copiá la conexión `Session pooler`.
3. Reemplazá `[YOUR-PASSWORD]` por la contraseña de la base.
4. Si la contraseña tiene símbolos, debe estar codificada para una URL. Supabase muestra la advertencia en la misma ventana.

Ejemplo de formato, no copiar literalmente:

`postgresql://postgres.REFERENCIA:CONTRASEÑA@aws-0-REGION.pooler.supabase.com:5432/postgres`

### `BACKUP_ENCRYPTION_KEY`

Usá una contraseña aleatoria de al menos 32 caracteres; recomiendo 50–64 caracteres. Guardala también en un administrador de contraseñas fuera de GitHub.

GitHub oculta ambos valores y los workflows nunca los imprimen.

## Parte 4 — Crear el acceso de la app a GitHub Actions

En GitHub:

1. Abrí tu foto de perfil → `Settings`.
2. Entrá a `Developer settings` → `Personal access tokens` → `Fine-grained tokens`.
3. Creá un token nuevo, limitado únicamente al repositorio `Demianstagnaro/Rainbows-Cultivo-appx`.
4. En permisos del repositorio seleccioná:
   - `Actions`: **Read and write**.
   - `Contents`: **Read-only**.
   - `Metadata`: queda habilitado automáticamente.
5. Elegí una fecha de vencimiento y anotá cuándo renovarlo.
6. Copiá el token una sola vez.

En Supabase, dentro del proyecto productivo:

1. Abrí la configuración de `Edge Functions` → `Secrets`.
2. Creá estos secretos:
   - `BACKUP_GITHUB_TOKEN`: el token recién creado.
   - `BACKUP_GITHUB_REPO`: `Demianstagnaro/Rainbows-Cultivo-appx`.
   - `BACKUP_GITHUB_BRANCH`: `main`.

## Parte 5 — Desplegar la función de Supabase

1. En Supabase abrí `Edge Functions`.
2. Elegí `Deploy a new function` → editor.
3. El nombre debe ser exactamente `rainbows-backups`.
4. Abrí `EDGE_FUNCTION_BACKUP_V32655.zip` y copiá **solamente** el contenido de `index.ts` dentro del editor.
5. Desplegá la función.

La función vuelve a comprobar la sesión y que el usuario sea un administrador activo. El token de GitHub nunca llega al navegador.

## Parte 6 — Probar el primer backup

1. En GitHub abrí `Actions` → `Backup diario de Rainbows`.
2. Tocá `Run workflow` → `Run workflow`.
3. Esperá que termine en verde.
4. Entrá a la app → `Config` → `Copias de seguridad` → `Actualizar`.
5. Debe aparecer la fecha, tamaño y vencimiento de la copia.
6. Probá `Descargar backup`: se descargará un ZIP que contiene una copia cifrada `.gpg`.

Si esta prueba funciona, las copias diarias ya quedan activas aunque todavía no configures una restauración.

---

## Parte 7 — Preparar la restauración segura

La restauración automática necesita otro proyecto de Supabase completamente separado y vacío.

1. Creá un proyecto nuevo de Supabase destinado exclusivamente a recuperación.
2. Copiá su referencia de proyecto y su conexión `Session pooler`.
3. En los secretos de GitHub agregá:
   - `PRODUCTION_PROJECT_REF`: `fplbxirsbwruazvygciu`.
   - `RECOVERY_PROJECT_REF`: referencia del proyecto nuevo.
   - `RECOVERY_DB_URL`: conexión completa del proyecto nuevo con su contraseña.

El workflow verifica tres veces que la URL de recuperación no corresponda a Producción y además se detiene si el proyecto ya contiene una instalación de Rainbows.

## Probar una restauración

1. Desde la app, seleccioná un backup.
2. Tocá `Restaurar backup`.
3. Escribí `RESTAURAR` y aceptá la segunda confirmación.
4. En GitHub → `Actions` verificá el proceso `Restaurar backup de Rainbows`.
5. La restauración termina mostrando cuántos perfiles se recuperaron.

Después de una restauración exitosa, ese proyecto deja de estar vacío. Para probar otra copia deberá utilizarse un proyecto de recuperación nuevo; esta restricción es deliberada para impedir sobrescrituras accidentales.

## Alcance de la copia

Incluye la base de datos: roles, esquema, datos, funciones, triggers, políticas y registros necesarios de autenticación según la exportación oficial de Supabase. No copia archivos subidos a Supabase Storage ni la configuración externa de proveedores de autenticación. Rainbows actualmente conserva sus imágenes y código dentro de GitHub, no en Storage.
