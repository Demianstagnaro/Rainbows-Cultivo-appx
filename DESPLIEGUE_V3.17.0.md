# Despliegue seguro de Rainbows V3.17.0

Esta versión cambia frontend y permisos de Supabase. Para evitar una ventana de incompatibilidad, se aplica primero la migración y después se publica el código.

## 1. Preparación

1. Confirmar que existe un backup reciente y descargable de Supabase.
2. Confirmar que al menos un perfil activo tiene rol `administrador`.
3. Verificar que las comprobaciones de la rama y del pull request estén en verde.

La migración usa una transacción. Si alguna validación falla antes de `commit`, Supabase revierte todos sus cambios automáticamente.

## 2. Aplicar Supabase

1. Abrir Supabase Dashboard > SQL Editor con una cuenta propietaria del proyecto.
2. Ejecutar completo `Rainbows_V3.17.0_seguridad_integral.sql`, una sola vez.
3. Confirmar que finaliza sin errores.
4. Ir a Authentication > Settings y desactivar **Allow new users to sign up**.

No editar ni ejecutar fragmentos aislados del archivo: la transacción y las validaciones finales forman parte de la corrección.

## 3. Verificación posterior de la base

Estas consultas son de solo lectura:

```sql
select rol, activo, count(*)
from public.perfiles
group by rol, activo
order by rol, activo;

select nombre, tipo, activa
from public.salas
where nombre = 'Sala de trabajo';

select count(*) as politicas_rainbows
from pg_policies
where schemaname = 'public'
  and tablename = any(array[
    'auditoria', 'camas', 'ciclos', 'configuracion', 'cosecha_geneticas',
    'cosechas', 'empleados', 'equipos', 'eventos_planta', 'geneticas',
    'mantenimientos', 'medrano_comandas', 'medrano_dispensario_lotes',
    'medrano_pacientes', 'perfiles', 'plantas', 'produccion',
    'realizacion_empleados', 'realizaciones_tarea', 'salas', 'stock_ciclos',
    'stock_existencias', 'stock_movimientos', 'stock_transferencia_items',
    'stock_transferencias', 'tarea_general_empleados', 'tareas', 'tareas_generales'
  ]);
```

El resultado esperado es una sola `Sala de trabajo` activa y `47` políticas.

## 4. Publicar frontend

1. Aprobar y fusionar el pull request de V3.17.0.
2. Esperar que GitHub Pages termine la publicación.
3. Abrir la app y hacer una recarga completa una vez para renovar el service worker.
4. Confirmar que la app y el manifiesto informan V3.17.0.

## 5. Prueba funcional por rol

| Control | Administrador | Cultivo | Medrano |
|---|---:|---:|---:|
| Palestina: Hoy, Calendario, Salas y Genéticas | Edita | Opera tareas | Solo lectura |
| Cosechas | Sí | No | No |
| Stock Palestina | Gestiona | No | Consulta |
| Configuración y usuarios | Sí | No | No |
| Sede Medrano | Gestiona | No | Gestiona |

Además:

- Crear y completar una tarea de prueba en Palestina con un usuario Cultivo.
- Confirmar que Medrano no puede modificar esa tarea.
- Crear una transferencia de prueba como Administrador y confirmar su recepción como Medrano.
- Confirmar que un usuario inactivo vuelve a la pantalla de acceso.
- Verificar que una cuenta nueva no puede ingresar hasta ser habilitada por un Administrador.

## Recuperación

Si la migración falla, no publicar el frontend: la transacción habrá dejado la base anterior intacta. Si aparece un problema después del `commit`, detener la publicación y restaurar el backup verificado antes de modificar datos manualmente.
