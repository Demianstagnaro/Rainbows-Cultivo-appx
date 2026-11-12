// Caja de Palestina: importes en centavos para sumar sin error de coma flotante.
export function palestinaCashSummary(rows,initial,categories=[]){
 const cents=value=>Math.round(Number(value||0)*100);
 const result={initial:cents(initial),cashIncome:0,transferIncome:0,cashExpense:0,transferExpense:0,expenses:0,final:0,categories:categories.filter(c=>c.tipo==='egreso').map(c=>({...c,amount:0}))};
 for(const row of rows){
  if(row.anulado_at)continue;
  const amount=cents(row.monto);
  if(row.tipo==='ingreso')result[row.medio==='efectivo'?'cashIncome':'transferIncome']+=amount;
  else{
   result[row.medio==='efectivo'?'cashExpense':'transferExpense']+=amount;result.expenses+=amount;
   const category=result.categories.find(c=>c.id===row.categoria_id);if(category)category.amount+=amount;
  }
 }
 result.final=result.initial+result.cashIncome-result.cashExpense;
 for(const key of ['initial','cashIncome','transferIncome','cashExpense','transferExpense','expenses','final'])result[key]/=100;
 result.categories=result.categories.map(c=>({...c,amount:c.amount/100}));return result;
}
export function palestinaCashMonthShift(month,offset){const [year,m]=month.split('-').map(Number),d=new Date(Date.UTC(year,m-1+offset,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`}
export function palestinaCashToday(){return new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'})}
export function palestinaCashMoneyInput(value){
 const raw=String(value??''),negative=raw.trim().startsWith('-'),clean=raw.replace(/[^\d,]/g,'');
 if(!clean)return negative?'-':'';
 const [integer,...decimals]=clean.split(','),digits=(integer||'0').replace(/^0+(?=\d)/,'');
 return `${negative?'-':''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.')}${clean.includes(',')?','+decimals.join('').slice(0,2):''}`;
}
export function palestinaCashArticleKey(value){return String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
export function palestinaCashFindArticle(articles,name){return articles.find(a=>palestinaCashArticleKey(a.nombre)===palestinaCashArticleKey(name))}
export function createPalestinaCashController(ctx){
 const {db,app,escapeHtml:esc,formatMoney:money}=ctx;let serial=0,data=null;
 const dateText=value=>value?new Date(value+'T12:00:00').toLocaleDateString('es-AR'):'—';
 const labels={ingreso:'Ingreso',egreso:'Egreso',efectivo:'Efectivo',transferencia:'Transferencia'};
 const errorText=e=>['PGRST202','PGRST205','42P01','42883'].includes(e?.code)?'Verificá que estén instalados los SQL de Caja V3.26.73 y V3.26.74 en Supabase.':e?.message||'No se pudo completar la operación.';
 function editor(title,fields,onSave,buttonText='Guardar',afterSave=render){
  const dlg=document.createElement('dialog');dlg.className='dialog pc-dialog';dlg.innerHTML=`<form><h3>${esc(title)}</h3>${fields}<p class="pc-form-error" role="status" aria-live="polite"></p><menu><button type="button" class="secondary" data-cancel>Cancelar</button><button type="submit" class="primary">${esc(buttonText)}</button></menu></form>`;
  document.body.append(dlg);const form=dlg.querySelector('form'),save=dlg.querySelector('[type=submit]'),cancel=dlg.querySelector('[data-cancel]');let busy=false;
  cancel.onclick=()=>{if(!busy)dlg.close()};dlg.oncancel=e=>{if(busy)e.preventDefault()};dlg.onclose=()=>dlg.remove();
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;save.disabled=true;cancel.disabled=true;
   try{await onSave(new FormData(form));dlg.close();await afterSave()}catch(err){if(dlg.isConnected)dlg.querySelector('[role=status]').textContent=errorText(err)}
   finally{busy=false;save.disabled=false;cancel.disabled=false}
  };dlg.showModal();return {dlg,form};
 }
 function bindMoneyField(input){
  input.oninput=()=>{
   const before=input.value,pos=input.selectionStart??before.length,meaningful=before.slice(0,pos).replace(/[^\d,-]/g,'').length;
   input.value=palestinaCashMoneyInput(before);
   let count=0,caret=0;while(caret<input.value.length&&count<meaningful){if(/[\d,-]/.test(input.value[caret]))count++;caret++}
   input.setSelectionRange(caret,caret);
  };
  input.onblur=()=>{const n=ctx.moneyParse(input.value);if(Number.isFinite(n))input.value=n.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})};
 }
 function articleEditor(onCreated=null){
  let created=null;
  editor('Nuevo artículo',`<p class="muted">Revisá cómo está escrito antes de agregarlo al catálogo. Crear un artículo no registra un gasto.</p><label class="field-label">Nombre del artículo<input class="text-input" name="nombre" maxlength="180" required autocomplete="off"></label><label class="pc-check"><input type="checkbox" name="confirmado" required> Revisé el nombre y confirmo que es un artículo nuevo.</label>`,async f=>{
   const name=String(f.get('nombre')).trim().replace(/\s+/g,' ');
   if(!name)throw new Error('Ingresá el nombre del artículo.');
   if(!f.get('confirmado'))throw new Error('Revisá el nombre y confirmá la creación del artículo.');
   const existing=palestinaCashFindArticle(data.articulos,name);
   if(existing)throw new Error(`Ya existe «${existing.nombre}». Elegilo en el campo Artículo.`);
   const q=await db.rpc('crear_articulo_caja_palestina',{p_nombre:name});if(q.error)throw q.error;created=q.data;
   data.articulos.push(created);data.articulos.sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  },'Crear artículo',async()=>{if(onCreated)onCreated(created);else await render()});
 }
 function openingEditor(){
  const initial=data.apertura;
  const {form}=editor(initial?'Corregir efectivo al comenzar':'Registrar saldo inicial de efectivo',`<p class="muted">Ingresá el efectivo disponible al comenzar a usar esta caja. El saldo de cada mes se calcula a partir de este importe y de los movimientos posteriores.</p><label class="field-label">Fecha de inicio<input class="text-input" name="fecha" type="date" max="${palestinaCashToday()}" value="${esc(initial?.fecha||palestinaCashToday())}" required></label><label class="field-label">Efectivo inicial ($)<input class="text-input" name="monto" type="text" inputmode="decimal" value="${esc(Number(initial?.monto||0).toLocaleString('es-AR',{maximumFractionDigits:2}))}" required></label>${initial?'<label class="field-label">Motivo de la corrección<textarea class="text-input" name="motivo" minlength="3" maxlength="1000" required></textarea></label>':''}`,async f=>{
   const amount=ctx.moneyParse(f.get('monto'));if(!Number.isFinite(amount)||amount<0)throw new Error('Ingresá un saldo inicial válido, que puede ser cero.');
   const q=await db.rpc('guardar_apertura_caja_palestina',{p_fecha:f.get('fecha'),p_monto:amount,p_version:initial?.version||0,p_motivo:f.get('motivo')||''});if(q.error)throw q.error;
  });
  bindMoneyField(form.elements.monto);
 }
 function movementEditor(row=null){
  if(!data.apertura)return openingEditor();
  const request=crypto.randomUUID(),month=ctx.getMonth(),day=palestinaCashToday();
  const defaultDate=month===day.slice(0,7)?day:`${month}-01`;
  const {form}=editor(row?'Editar movimiento':'Nuevo movimiento',`<div class="pc-form-grid"><label class="field-label">Movimiento<select class="text-input" name="tipo"><option value="egreso" ${!row||row.tipo==='egreso'?'selected':''}>Egreso</option><option value="ingreso" ${row?.tipo==='ingreso'?'selected':''}>Ingreso</option></select></label><label class="field-label">Fecha<input class="text-input" type="date" name="fecha" min="${esc(data.apertura.fecha)}" max="${day}" value="${esc(row?.fecha||(defaultDate>day?day:defaultDate<data.apertura.fecha?data.apertura.fecha:defaultDate))}" required></label><label class="field-label">Forma de pago<select class="text-input" name="medio"><option value="efectivo">Efectivo</option><option value="transferencia" ${row?.medio==='transferencia'?'selected':''}>Transferencia</option></select></label><label class="field-label">Categoría / tipo de gasto<select class="text-input" name="categoria" required></select></label></div><label class="field-label">Artículo<input class="text-input" name="articulo" list="pc-articles" maxlength="180" autocomplete="off" value="${esc(row?.articulo||'')}" required><datalist id="pc-articles">${data.articulos.map(a=>`<option value="${esc(a.nombre)}"></option>`).join('')}</datalist><small>Buscá y elegí un artículo existente. Para incorporarlo al catálogo, usá el botón Nuevo artículo.</small></label><button class="secondary" type="button" data-create-article>+ Nuevo artículo</button><div class="pc-form-grid"><label class="field-label">Cantidad<input class="text-input" name="cantidad" type="text" inputmode="decimal" value="${esc(row?.cantidad??1)}" required></label><label class="field-label">Costo total ($)<input class="text-input" name="monto" type="text" inputmode="decimal" value="${row?esc(Number(row.monto).toLocaleString('es-AR',{maximumFractionDigits:2})):''}" placeholder="Ej.: 10.000,50" required></label></div><p class="muted">Ingresá el importe total, sin signo: la cantidad no lo multiplica. Ingreso suma y Egreso resta.</p><label class="field-label">Notas<textarea class="text-input" name="notas" maxlength="1000">${esc(row?.notas||'')}</textarea></label>${row?'<label class="field-label">Motivo de la corrección<textarea class="text-input" name="motivo" minlength="3" maxlength="1000" required></textarea></label>':''}`,async f=>{
   const quantity=Number(String(f.get('cantidad')).trim().replace(',','.')),amount=ctx.moneyParse(f.get('monto'));
   if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Ingresá una cantidad mayor que cero, con coma o punto decimal.');
   if(!Number.isFinite(amount)||amount<=0)throw new Error('Ingresá un costo total mayor que cero.');
   const article=palestinaCashFindArticle(data.articulos,f.get('articulo'));
   if(!article)throw new Error('Elegí un artículo existente de la lista. Si falta, agregalo con + Nuevo artículo y revisá su nombre.');
   const q=await db.rpc('guardar_movimiento_caja_palestina',{p_id:row?.id||null,p_version:row?.version||0,p_solicitud:request,p_fecha:f.get('fecha'),p_tipo:f.get('tipo'),p_medio:f.get('medio'),p_articulo:article.nombre,p_cantidad:quantity,p_monto:amount,p_categoria_id:f.get('categoria'),p_notas:String(f.get('notas')).trim(),p_motivo:f.get('motivo')||''});if(q.error)throw q.error;
  });
  bindMoneyField(form.elements.monto);
  form.querySelector('[data-create-article]').onclick=()=>articleEditor(article=>{
   if(!form.isConnected)return;
   form.querySelector('datalist').innerHTML=data.articulos.map(a=>`<option value="${esc(a.nombre)}"></option>`).join('');
   form.elements.articulo.value=article.nombre;form.elements.articulo.focus();
  });
  const categoryOptions=()=>{
   const selected=form.elements.categoria.value||row?.categoria_id;
   const list=data.categorias.filter(c=>c.tipo===form.elements.tipo.value&&(c.tipo!=='ingreso'||c.nombre===(form.elements.medio.value==='efectivo'?'Ingreso de efectivo':'Ingreso por transferencia')));
   form.elements.categoria.innerHTML=list.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.nombre)}</option>`).join('');
   if(!row&&list.some(c=>c.nombre==='Producción')&&!selected)form.elements.categoria.value=list.find(c=>c.nombre==='Producción').id;
  };
  form.elements.tipo.onchange=categoryOptions;form.elements.medio.onchange=categoryOptions;categoryOptions();
 }
 function cancelMovement(row){
  editor('Anular movimiento',`<p><strong>${esc(row.articulo)}</strong> · ${dateText(row.fecha)} · ${money(row.monto)}</p><p class="muted">Se quitará del cálculo de saldos y seguirá disponible en el historial como anulado.</p><label class="field-label">Motivo<textarea class="text-input" name="motivo" minlength="3" maxlength="1000" required></textarea></label>`,async f=>{const q=await db.rpc('anular_movimiento_caja_palestina',{p_id:row.id,p_version:row.version,p_motivo:f.get('motivo')});if(q.error)throw q.error},'Anular movimiento');
 }
 async function history(id){
  const dlg=document.createElement('dialog');dlg.className='dialog pc-dialog';dlg.innerHTML='<h3>Historial de cambios</h3><div data-history>Cargando…</div><menu><button type="button" class="secondary">Cerrar</button></menu>';document.body.append(dlg);dlg.onclose=()=>dlg.remove();dlg.querySelector('button').onclick=()=>dlg.close();dlg.showModal();
  try{
   const q=await db.from('palestina_caja_auditoria').select('*').eq('entidad_id',id).order('fecha',{ascending:false});if(q.error)throw q.error;if(!dlg.isConnected)return;
   dlg.querySelector('[data-history]').innerHTML=q.data.map(a=>{
    const describe=v=>v?`${v.fecha||''} · ${v.articulo||'Efectivo al comenzar'} · ${money(v.monto)}${v.tipo?' · '+labels[v.tipo]:''}${v.medio?' · '+labels[v.medio]:''}${v.cantidad?' · Cantidad '+v.cantidad:''}${v.categoria_id?' · '+(data.categorias.find(c=>c.id===v.categoria_id)?.nombre||'Categoría anterior'):''}${v.notas?' · '+v.notas:''}`:'—';
    return `<article class="pc-audit"><strong>${esc({alta:'Alta',correccion:'Corrección',anulacion:'Anulación'}[a.accion]||a.accion)}</strong><span>${esc(new Date(a.fecha).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}))} · ${esc(a.usuario_nombre||'Usuario')}</span>${a.antes?`<span>Antes: ${esc(describe(a.antes))}</span>`:''}<span>Después: ${esc(describe(a.despues))}</span>${a.motivo?`<p>Motivo: ${esc(a.motivo)}</p>`:''}</article>`;
   }).join('')||'<p>Sin cambios registrados.</p>';
  }catch(e){if(dlg.isConnected)dlg.querySelector('[data-history]').textContent=errorText(e)}
 }
 function draw(host){
  const month=ctx.getMonth(),summary=palestinaCashSummary(data.movimientos,data.saldo_inicial,data.categorias);
  const kpi=(label,value,cls='')=>`<div class="panel pc-kpi"><span>${esc(label)}</span><strong class="${cls}">${money(value)}</strong></div>`;
  host.innerHTML=`<section class="panel pc-header"><div><h2>Caja de Palestina</h2><p class="muted">Movimientos mensuales · efectivo acumulado</p></div><div class="pc-actions"><button class="secondary" type="button" data-opening>${data.apertura?'Efectivo al comenzar':'Registrar saldo inicial'}</button>${data.apertura?'<button class="secondary" type="button" data-opening-history>Historial de apertura</button>':''}<button class="secondary" type="button" data-new-article>+ Nuevo artículo</button><button class="primary" type="button" data-new ${data.apertura?'':'disabled'}>+ Movimiento</button></div></section><section class="panel pc-month"><button class="secondary" type="button" data-prev aria-label="Mes anterior">‹</button><label class="field-label">Mes<input class="text-input" type="month" value="${esc(month)}" min="1900-01" max="2200-12" data-month></label><button class="secondary" type="button" data-next aria-label="Mes siguiente">›</button></section>${!data.apertura?'<section class="panel"><strong>Registrá el saldo inicial de efectivo para comenzar, aunque sea cero.</strong></section>':`<p class="muted">Efectivo al comenzar: ${money(data.apertura.monto)} al ${dateText(data.apertura.fecha)}. El saldo inicial del mes incluye los movimientos de efectivo anteriores.</p>`}<div class="pc-kpis">${kpi('Saldo inicial de efectivo',summary.initial)}${kpi('Ingresos en efectivo',summary.cashIncome,'cash-positive')}${kpi('Gastos en efectivo',summary.cashExpense,'cash-negative')}${kpi('Gastos por transferencia',summary.transferExpense,'cash-negative')}${kpi('Saldo final de efectivo',summary.final,summary.final<0?'cash-negative':'cash-positive')}${kpi('Total de gastos',summary.expenses,'cash-negative')}${summary.transferIncome?kpi('Ingresos por transferencia',summary.transferIncome,'cash-positive'):''}</div><section class="panel"><h3>Gastos por categoría</h3><div class="pc-categories">${summary.categories.map(c=>`<div><span>${esc(c.nombre)}</span><strong>${money(c.amount)}</strong></div>`).join('')}</div></section><section class="panel"><h3>Movimientos del mes</h3><p class="muted">El resumen superior corresponde al mes completo. Los filtros siguientes afectan sólo la lista de movimientos.</p><div class="pc-filters"><label class="field-label">Buscar<input class="text-input" type="search" data-search placeholder="Artículo, notas o responsable"></label><label class="field-label">Movimiento<select class="text-input" data-type><option value="">Todos</option><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></label><label class="field-label">Forma de pago<select class="text-input" data-medium><option value="">Todas</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></label><label class="field-label">Categoría<select class="text-input" data-category><option value="">Todas</option>${data.categorias.map(c=>`<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('')}</select></label></div><label class="pc-check"><input type="checkbox" data-cancelled> Mostrar anulados</label><p class="muted" data-count></p><div class="stock-table-wrap"><table class="stock-table pc-table"><thead><tr><th>Movimiento</th><th>Fecha</th><th>Forma de pago</th><th>Artículo</th><th>Cantidad</th><th>Costo total</th><th>Tipo de gasto</th><th>Notas</th><th>Registrado por</th><th>Acciones</th></tr></thead><tbody></tbody></table></div></section>`;
  host.querySelector('[data-opening]').onclick=openingEditor;host.querySelector('[data-new-article]').onclick=()=>articleEditor();host.querySelector('[data-new]').onclick=()=>movementEditor();const openingHistory=host.querySelector('[data-opening-history]');if(openingHistory)openingHistory.onclick=()=>history(data.apertura.id);
  host.querySelector('[data-prev]').onclick=()=>{ctx.setMonth(palestinaCashMonthShift(month,-1));render()};host.querySelector('[data-next]').onclick=()=>{ctx.setMonth(palestinaCashMonthShift(month,1));render()};
  host.querySelector('[data-month]').onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){ctx.setMonth(e.target.value);render()}};
  const applyFilters=()=>{
   const query=host.querySelector('[data-search]').value.toLocaleLowerCase('es'),type=host.querySelector('[data-type]').value,medium=host.querySelector('[data-medium]').value,category=host.querySelector('[data-category]').value,includeCancelled=host.querySelector('[data-cancelled]').checked;
   const rows=data.movimientos.filter(r=>(includeCancelled||!r.anulado_at)&&(!type||r.tipo===type)&&(!medium||r.medio===medium)&&(!category||r.categoria_id===category)&&`${r.articulo} ${r.notas} ${r.creado_nombre}`.toLocaleLowerCase('es').includes(query));
   host.querySelector('[data-count]').textContent=`${rows.length} movimiento${rows.length===1?'':'s'} visibles`;
   host.querySelector('tbody').innerHTML=rows.map(r=>`<tr class="${r.anulado_at?'pc-cancelled':''}"><td>${labels[r.tipo]}${r.anulado_at?'<small>Anulado</small>':''}</td><td>${dateText(r.fecha)}</td><td>${labels[r.medio]}</td><td><strong>${esc(r.articulo)}</strong></td><td>${Number(r.cantidad).toLocaleString('es-AR',{maximumFractionDigits:3})}</td><td class="${r.tipo==='ingreso'?'cash-positive':'cash-negative'}">${r.tipo==='ingreso'?'+':'−'} ${money(r.monto)}</td><td>${esc(data.categorias.find(c=>c.id===r.categoria_id)?.nombre||'—')}</td><td>${esc(r.notas||'—')}${r.anulado_at?`<small>Anulación: ${esc(r.motivo_anulacion)}</small>`:''}</td><td>${esc(r.creado_nombre||'Usuario')}</td><td><div class="pc-actions">${r.anulado_at?'':`<button class="secondary compact-button" type="button" data-edit="${esc(r.id)}">Editar</button><button class="secondary compact-button" type="button" data-cancel="${esc(r.id)}">Anular</button>`}<button class="secondary compact-button" type="button" data-audit="${esc(r.id)}">Historial</button></div></td></tr>`).join('')||'<tr><td colspan="10" class="muted">No hay movimientos para estos filtros.</td></tr>';
   host.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>movementEditor(data.movimientos.find(r=>r.id===b.dataset.edit)));
   host.querySelectorAll('tbody [data-cancel]').forEach(b=>b.onclick=()=>cancelMovement(data.movimientos.find(r=>r.id===b.dataset.cancel)));
   host.querySelectorAll('[data-audit]').forEach(b=>b.onclick=()=>history(b.dataset.audit));
  };
  host.querySelectorAll('[data-search],[data-type],[data-medium],[data-category],[data-cancelled]').forEach(el=>{el.oninput=applyFilters;el.onchange=applyFilters});applyFilters();
 }
 async function render(){
  const run=++serial;if(!ctx.canManage()||!ctx.isActive())return;
  ctx.setTitle('Caja · Palestina');app.innerHTML='<button class="secondary cultivo-info-back" type="button" data-pc-back>← Administración</button><div data-pc-root><section class="panel">Cargando Caja…</section></div>';app.querySelector('[data-pc-back]').onclick=ctx.back;const host=app.querySelector('[data-pc-root]');
  try{
   const q=await db.rpc('consultar_caja_palestina',{p_mes:ctx.getMonth()+'-01'});if(q.error)throw q.error;if(run!==serial||!host.isConnected||!ctx.canManage())return;data=q.data;draw(host);
  }catch(e){if(run===serial&&host.isConnected){host.innerHTML=`<section class="panel error-panel"><p>${esc(errorText(e))}</p><button type="button" class="secondary" data-retry>Reintentar</button></section>`;host.querySelector('[data-retry]').onclick=render}}
 }
 return {render};
}
