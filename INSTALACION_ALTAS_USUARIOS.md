# Alta de usuarios desde Config (V3.19.1)

La pantalla **Config → Crear cuenta** llama a la Edge Function `rainbows-create-user`. La función valida el token de sesión y comprueba en `perfiles` que quien llama sea un administrador activo. La clave de servicio nunca se incorpora al sitio web.

Para activarla en el proyecto Supabase `fplbxirsbwruazvygciu`, desplegar `supabase/functions/rainbows-create-user/index.ts` con el nombre `rainbows-create-user` y **desactivar la verificación JWT del gateway** para esta función. La función valida por su cuenta cada token con `auth.getUser` y el perfil administrativo. Con Supabase CLI:

```sh
supabase login
supabase link --project-ref fplbxirsbwruazvygciu
supabase functions deploy rainbows-create-user --no-verify-jwt
```

Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` deben estar disponibles en las funciones del proyecto (Supabase las proporciona automáticamente en proyectos con claves heredadas). La URL de la app `https://demianstagnaro.github.io/Rainbows-Cultivo-appx/` debe estar permitida como redirect en **Authentication → URL Configuration**.

Prueba: un administrador abre Config, escribe nombre, correo y rol, y pulsa **Crear y enviar invitación**. Debe aparecer un nuevo usuario activo con ese rol; el correo de invitación abre la pantalla para configurar contraseña. Un usuario con rol Cultivo o Medrano no debe ver Config y una invocación directa a la función con su token debe responder 403.
