const RAINBOWS_OVERRIDES_VERSION='3.18.5';

const harvestStarts={F1:'2026-05-20',F2:'2026-07-01',F3:'2026-05-20'};
function utcDay(value){const [y,m,d]=String(value).split('-').map(Number);return Date.UTC(y,m-1,d)/86400000}
function roomHarvest(room,date){const days=utcDay(date)-utcDay(harvestStarts[room]);return days>=56&&(days-56)%77===0}
function escapeHtml(value){return String(value??'').replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]))}
function markCalendarHarvests(){
  const cells=document.querySelectorAll('.day-cell[data-date]');
  if(!cells.length)return;
  cells.forEach(cell=>{
    const stateEl=cell.querySelector('.day-state');
    if(!stateEl||stateEl.dataset.harvestDecorated==='1')return;
    const date=cell.dataset.date;
    const lines=(stateEl.innerText||stateEl.textContent||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)return;
    stateEl.dataset.harvestDecorated='1';
    stateEl.innerHTML=lines.map(line=>{
      const clean=line.replace(/\s*COSECHA\s*$/,'').trim();
      const m=clean.match(/^F([123]):/);
      const room=m?'F'+m[1]:null;
      const badge=room&&roomHarvest(room,date)?'<span class="calendar-room-harvest-badge">COSECHA</span>':'';
      return '<span class="calendar-room-state"><span>'+escapeHtml(clean)+'</span>'+badge+'</span>';
    }).join('');
    cell.querySelectorAll('.calendar-harvest-badge').forEach(el=>el.remove());
  });
}

const amendmentHeaders=['Producto','Transplante / V1','Vege 2','Vege 3','Semana 1','Semana 2','Semana 3','Semana 4','Semana 5','Semana 6','Semana 7','Semana 8'];
const amendments={
  'Flora 1 y 2':[
    ['Compost','105L','-','-','50L','-','-','20L','-','-','-','-'],['Turba','105L','-','-','50L','-','-','20L','-','-','-','-'],['Harina de hueso','13000g','-','-','-','-','-','-','-','-','-','-'],['Harina de pescado','4500g','-','-','5000g','-','-','11000g','-','-','-','-'],['Basalto','15000g','-','-','-','-','-','-','-','-','-','-'],['Bokashi','1000g','-','-','400g','-','-','400g','-','-','-','-'],['Harina de dolomita','2250g','-','-','-','-','-','-','-','-','-','-'],['Azufre agrícola','3000g','-','-','-','-','-','-','-','-','-','-'],['Tierra de diatomeas','2500g','-','-','-','-','-','-','-','-','-','-'],['Harina de alfalfa (top dress)','-','-','-','4 L','-','4 L','-','-','-','-','-'],['FPJ','5ml x L','2,5ml x L','2,5ml x L','5ml x L','-','-','-','-','-','-','-'],['FFJ','-','-','-','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','-','-','-'],['FRJ','-','-','-','-','-','-','2,5ml x L','5ml x L','-','-','-'],['LAB','5ml x L','2,5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','1ml x L','-','-'],['OHN (Ajo, jengibre, canela)','5ml x L','2,5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','-','-','-']
  ],
  'Flora 3':[
    ['Compost','55L','-','-','25L','-','-','10L','-','-','-','-'],['Turba','55L','-','-','25L','-','-','10L','-','-','-','-'],['Harina de hueso','6500g','-','-','-','-','-','-','-','-','-','-'],['Harina de pescado','2250g','-','-','2500g','-','-','5500g','-','-','-','-'],['Basalto','7500g','-','-','-','-','-','-','-','-','-','-'],['Bokashi','500g','-','-','200g','-','-','200g','-','-','-','-'],['Harina de dolomita','1150g','-','-','-','-','-','-','-','-','-','-'],['Azufre agrícola','1500g','-','-','-','-','-','-','-','-','-','-'],['Tierra de diatomeas','1250g','-','-','-','-','-','-','-','-','-','-'],['Harina de alfalfa (top dress)','-','-','-','2 L','-','2 L','-','-','-','-','-'],['FPJ','5ml x L','2,5ml x L','2,5ml x L','5ml x L','-','-','-','-','-','-','-'],['FFJ','-','-','-','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','-','-','-'],['FRJ','-','-','-','-','-','-','2,5ml x L','5ml x L','-','-','-'],['LAB','5ml x L','2,5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','1ml x L','-','-'],['OHN (Ajo, jengibre, canela)','5ml x L','2,5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','2,5ml x L','5ml x L','-','-','-']
  ]
};

function amendmentTable(title,rows){return '<section class="panel amendment-panel"><div class="amendment-title-row"><h2>'+escapeHtml(title)+'</h2></div><div class="amendment-table-scroll"><table class="amendment-table"><thead><tr>'+amendmentHeaders.map(h=>'<th>'+escapeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>'<td class="'+(i===0?'amendment-product ':'')+(v==='-'?'amendment-empty':'')+'">'+escapeHtml(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>'}
function renderAmendments(){const app=document.getElementById('app'),title=document.getElementById('screen-title');if(!app||!title)return;title.textContent='Enmiendas';app.innerHTML='<button id="back-cultivo-info" class="secondary cultivo-info-back" type="button">← Info cultivo</button><section class="panel amendment-intro"><h2>Enmienda completa</h2><p class="muted">Composición y dosis por etapa del ciclo.</p></section>'+Object.entries(amendments).map(([name,rows])=>amendmentTable(name,rows)).join('')}
window.renderAmendments=renderAmendments;
function isPalestina(){return document.getElementById('site-palestina')?.classList.contains('active')!==false}
function installStyles(){if(document.getElementById('rainbows-overrides-style'))return;const style=document.createElement('style');style.id='rainbows-overrides-style';style.textContent=`.calendar-harvest-badge{display:none!important}.day-cell.harvest-day:not(.today){box-shadow:0 10px 30px rgba(0,0,0,.18)}.calendar-room-state{display:flex;align-items:center;justify-content:space-between;gap:3px;min-width:0;white-space:nowrap}.calendar-room-state>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis}.calendar-room-harvest-badge{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;margin-left:3px;padding:1px 4px;border-radius:999px;background:rgba(196,35,35,.10);border:1px solid rgba(196,35,35,.34);color:#ef4444;font-size:.50rem;font-weight:850;line-height:1.15;letter-spacing:.015em}.amendment-intro{margin-bottom:14px}.amendment-intro h2{margin:0 0 4px}.amendment-panel{margin-bottom:14px;overflow:hidden}.amendment-title-row{margin-bottom:12px}.amendment-title-row h2{margin:0;font-size:20px}.amendment-table-scroll{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:14px}.amendment-table{width:100%;min-width:1080px;border-collapse:collapse;background:rgba(11,16,32,.35);font-size:12px}.amendment-table th,.amendment-table td{padding:9px 10px;border-right:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);text-align:center;white-space:nowrap}.amendment-table th{position:sticky;top:0;background:#172033;color:#f8fafc;font-weight:850;z-index:1}.amendment-table th:first-child,.amendment-table td:first-child{position:sticky;left:0;text-align:left;z-index:2}.amendment-table th:first-child{background:#172033;z-index:3}.amendment-table td:first-child{background:#111827}.amendment-product{font-weight:800}.amendment-empty{color:#64748b}.amendment-table tr:last-child td{border-bottom:0}.amendment-table th:last-child,.amendment-table td:last-child{border-right:0}@media(max-width:700px){.calendar-room-harvest-badge{font-size:.44rem;padding:1px 3px;margin-left:2px}.calendar-room-state{gap:2px}.amendment-panel{padding:12px}.amendment-table{font-size:11px;min-width:1000px}.amendment-table th,.amendment-table td{padding:8px}.amendment-title-row h2{font-size:18px}}`;document.head.appendChild(style)}
function refreshEnhancements(){installStyles();markCalendarHarvests()}

document.addEventListener('click',e=>{
  const target=e.target.closest('#site-palestina,#site-medrano,.top-nav button,#prev,#next,#back-today,[data-date],#back-cal');
  if(target)setTimeout(refreshEnhancements,0);
},true);
installStyles();setTimeout(markCalendarHarvests,0);
