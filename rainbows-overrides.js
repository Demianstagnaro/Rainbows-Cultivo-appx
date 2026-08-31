const __rainbowsHarvestStarts={F1:'2026-05-20',F2:'2026-07-01',F3:'2026-05-20'};
function __rainbowsUtcDay(value){const [y,m,d]=String(value).split('-').map(Number);return Date.UTC(y,m-1,d)/86400000}
function __rainbowsRoomHarvest(room,date){const days=__rainbowsUtcDay(date)-__rainbowsUtcDay(__rainbowsHarvestStarts[room]);return days>=56&&(days-56)%77===0}
function __rainbowsMarkCalendarHarvests(){
  document.querySelectorAll('.day-cell[data-date]').forEach(cell=>{
    if(cell.dataset.harvestRoomLabels==='1')return;
    const stateEl=cell.querySelector('.day-state');
    if(!stateEl)return;
    cell.dataset.harvestRoomLabels='1';
    cell.querySelectorAll('.calendar-harvest-badge').forEach(el=>el.remove());
    const date=cell.dataset.date;
    const lines=(stateEl.innerText||stateEl.textContent||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    stateEl.innerHTML=lines.map(line=>{
      const match=line.match(/^F([123]):/);
      const room=match?'F'+match[1]:null;
      const badge=room&&__rainbowsRoomHarvest(room,date)?'<span class="calendar-room-harvest-badge">COSECHA</span>':'';
      return '<span class="calendar-room-state"><span>'+line+'</span>'+badge+'</span>';
    }).join('');
  });
}
setTimeout(__rainbowsMarkCalendarHarvests,0);
const __rainbowsCalendarObserver=new MutationObserver(()=>__rainbowsMarkCalendarHarvests());
const __rainbowsCalendarRoot=document.getElementById('app');
if(__rainbowsCalendarRoot)__rainbowsCalendarObserver.observe(__rainbowsCalendarRoot,{childList:true,subtree:true});

const __rainbowsAmendmentHeaders=['Producto','Transplante / V1','Vege 2','Vege 3','Semana 1','Semana 2','Semana 3','Semana 4','Semana 5','Semana 6','Semana 7','Semana 8'];
const __rainbowsAmendments={
  'Flora 1 y 2':[
    ['Compost','105L','-','-','50L','-','-','20L','-','-','-','-'],['Turba','105L','-','-','50L','-','-','20L','-','-','-','-'],['Harina de hueso','13000g','-','-','-','-','-','-','-','-','-','-'],['Harina de pescado','4500g','-','-','5000g','-','-','11000g','-','-','-','-'],['Basalto','15000g','-','-','-','-','-','-','-','-','-','-'],['Bokashi','1000g','-','-','400g','-','-','400g','-','-','-','-'],['Harina de dolomita','2250g','-','-','-','-','-','-','-','-','-','-'],['Azufre agrícola','3000g','-','-','-','-','-','-','-','-','-','-'],['Tierra de diatomeas','2500g','-','-','-','-','-','-','-','-','-','-'],['Harina de alfalfa (top dress)','-','-','-','4 L','-','4 L','-','-','-','-','-'],['FPJ','5ml x L','2,5ml x L','2,5ml x L','5ml x L','-','-','-','-','-','-','-'],['FFJ','-','-','-','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','-','-','-'],['FRJ','-','-','-','-','-','-','2,5ml x L','5ml x L','-','-','-'],['LAB','5ml x L','2,5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','1ml x L','-','-'],['OHN (Ajo, jengibre, canela)','5ml x L','2,5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','-','-','-']
  ],
  'Flora 3':[
    ['Compost','55L','-','-','25L','-','-','10L','-','-','-','-'],['Turba','55L','-','-','25L','-','-','10L','-','-','-','-'],['Harina de hueso','6500g','-','-','-','-','-','-','-','-','-','-'],['Harina de pescado','2250g','-','-','2500g','-','-','5500g','-','-','-','-'],['Basalto','7500g','-','-','-','-','-','-','-','-','-','-'],['Bokashi','500g','-','-','200g','-','-','200g','-','-','-','-'],['Harina de dolomita','1150g','-','-','-','-','-','-','-','-','-','-'],['Azufre agrícola','1500g','-','-','-','-','-','-','-','-','-','-'],['Tierra de diatomeas','1250g','-','-','-','-','-','-','-','-','-','-'],['Harina de alfalfa (top dress)','-','-','-','2 L','-','2 L','-','-','-','-','-'],['FPJ','5ml x L','2,5ml x L','2,5ml x L','5ml x L','-','-','-','-','-','-','-'],['FFJ','-','-','-','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','-','-','-'],['FRJ','-','-','-','-','-','-','2,5ml x L','5ml x L','-','-','-'],['LAB','5ml x L','2,5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','1ml x L','-','-'],['OHN (Ajo, jengibre, canela)','5ml x L','2,5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','-','-','-']
  ]
};
function __rainbowsEscape(value){return String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))}
function __rainbowsAmendmentTable(title,rows){return '<section class="panel amendment-panel"><div class="amendment-title-row"><div><h2>'+__rainbowsEscape(title)+'</h2><span class="amendment-flora-start">INICIA FLORA · Semana 1</span></div></div><div class="amendment-table-scroll"><table class="amendment-table"><thead><tr>'+__rainbowsAmendmentHeaders.map(h=>'<th>'+__rainbowsEscape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>'<td class="'+(i===0?'amendment-product ':'')+(v==='-'?'amendment-empty':'')+'">'+__rainbowsEscape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>'}
function renderAmendments(){$('screen-title').textContent='Enmiendas';state.day=null;app.innerHTML='<section class="panel amendment-intro"><h2>Enmienda completa</h2><p class="muted">Composición y dosis por etapa del ciclo.</p></section>'+Object.entries(__rainbowsAmendments).map(([title,rows])=>__rainbowsAmendmentTable(title,rows)).join('');document.querySelectorAll('.top-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view==='amendments'))}
function __rainbowsEnsureAmendmentsNav(){const nav=document.querySelector('.top-nav');if(!nav)return;let btn=nav.querySelector('[data-view="amendments"]');if(!btn){btn=document.createElement('button');btn.type='button';btn.dataset.view='amendments';btn.textContent='Enmiendas';const stock=nav.querySelector('[data-view="stock"]');if(stock)nav.insertBefore(btn,stock);else nav.appendChild(btn);btn.addEventListener('click',()=>{if(state.site!=='palestina')return;state.view='amendments';renderAmendments()})}btn.hidden=state.site!=='palestina'}
const __rainbowsOriginalRender=render;
render=function(){__rainbowsEnsureAmendmentsNav();if(state.site==='palestina'&&state.view==='amendments'){renderAmendments();return}const result=__rainbowsOriginalRender();setTimeout(__rainbowsEnsureAmendmentsNav,0);return result};
__rainbowsEnsureAmendmentsNav();setTimeout(__rainbowsEnsureAmendmentsNav,0);
