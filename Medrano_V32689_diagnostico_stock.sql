-- Diagnóstico de solo lectura para el SQL Editor, compatible desde 3.26.88.
with inventario(sector,categoria,id,producto,lote,unidad,fisico,activo) as (
 select 'dispensario','flores',id,nombre_historico,codigo_lote,'g',gramos_actual,true from public.medrano_dispensario_lotes
 union all select 'dispensario','mostrador',id,nombre,null,'unidades',cantidad,activo from public.medrano_mostrador_productos
 union all select 'laboratorio',categoria,id,nombre,lote,unidad,cantidad,activo from public.medrano_laboratorio_stock
), saldos as (
 select i.*,public.stock_reservado_medrano(sector,categoria,id,null) as reservado from inventario i
)
select sector,categoria,producto,lote,unidad,fisico,reservado,fisico-reservado as disponible,activo,id
from saldos where fisico<0 or fisico<reservado or fisico is null or fisico::text in ('NaN','Infinity','-Infinity')
order by sector,categoria,producto,lote,id;
