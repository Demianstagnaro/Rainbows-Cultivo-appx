// Conversiones y recetas compartidas por la ventana de aplicación y sus pruebas.
export function supplyUnit(value){
  const unit=String(value||'').trim().toLowerCase().replace(/\./g,'');
  if(['g','gr','grs','gramo','gramos'].includes(unit))return {kind:'mass',factor:1};
  if(['kg','kgs','kilo','kilos','kilogramo','kilogramos'].includes(unit))return {kind:'mass',factor:1000};
  if(['ml','cc','mililitro','mililitros'].includes(unit))return {kind:'volume',factor:1};
  if(['l','lt','lts','litro','litros'].includes(unit))return {kind:'volume',factor:1000};
  return null;
}
export function supplyNumber(value){
  const text=String(value??'').trim();
  return /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)?Number(text.replace(',','.')):NaN;
}
export function convertSupply(quantity,from,to){
  const a=supplyUnit(from),b=supplyUnit(to);
  if(!a||!b||a.kind!==b.kind)return null;
  return quantity*a.factor/b.factor;
}
export function supplyName(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\([^)]*\)/g,'').replace(/^harina de /,'').replace(/\s+/g,' ').trim();
}
export function recipeMaterials(section,column,knf=false,liters=0){
  if(!section||column<1||column>=section.headers.length)throw new Error('Elegí la etapa de la enmienda.');
  return section.rows.flatMap(row=>{
    const value=String(row[column]||'').trim();
    const dose=value.match(/^([\d.,]+)\s*(ml|g|L)\s*(x\s*L)?$/i);
    if(!dose||Boolean(dose[3])!==knf)return [];
    return [{name:row[0],quantity:supplyNumber(dose[1])*(knf?liters:1),unit:dose[2],dose:value}];
  });
}
export function consumptionPayload(rows,supplies){
  const total=new Map();
  for(const row of rows){
    const amount=supplyNumber(row.quantity);
    if(!Number.isFinite(amount)||amount<0)throw new Error(`Cantidad inválida: ${row.name}. Usá coma o punto decimal, sin separador de miles.`);
    if(amount===0)continue;
    const supply=supplies.find(x=>x.id===row.id&&x.categoria==='Cultivo');
    if(!supply)throw new Error(`Vinculá ${row.name} con un insumo del stock o poné cero si no se usó.`);
    const converted=convertSupply(amount,row.unit,supply.unidad);
    if(converted===null)throw new Error(`Las unidades de ${row.name} y ${supply.nombre} no son compatibles.`);
    total.set(supply.id,(total.get(supply.id)||0)+converted);
  }
  return [...total].map(([insumo_id,amount])=>{
    const cantidad=Math.round((amount+Number.EPSILON)*1000)/1000;
    const supply=supplies.find(x=>x.id===insumo_id);
    if(cantidad<=0)throw new Error(`El consumo de ${supply.nombre} es menor a la precisión del stock (0,001 ${supply.unidad}).`);
    if(cantidad>Number(supply.stock))throw new Error(`Stock insuficiente de ${supply.nombre}: se necesitan ${cantidad} ${supply.unidad} y hay ${supply.stock}.`);
    return {insumo_id,cantidad,unidad:supply.unidad};
  });
}
