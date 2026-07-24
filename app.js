// ---------- Estado y persistencia (localStorage) ----------
const STORE_KEY = 'migym_data_v1';

function loadData(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return { rutinas: [], sesiones: [] };
}
function saveData(){
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}
let data = loadData();

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function todayISO(){
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset()*60000;
  return new Date(d.getTime()-tzOffsetMs).toISOString().slice(0,10);
}
function fmtDate(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString('es', {day:'2-digit', month:'short', year:'numeric'});
}

// ---------- Navegación ----------
let currentView = 'hoy';
function switchView(v){
  currentView = v;
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  document.getElementById('fab').style.display = (v==='rutinas') ? 'flex' : 'none';
  render();
}

function onFab(){
  if(currentView==='rutinas') openRutinaForm();
}

// ---------- Toast ----------
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 1800);
}

// ---------- Modal helper ----------
function openModal(html){
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalBg').classList.add('active');
}
function closeModal(){
  document.getElementById('modalBg').classList.remove('active');
}
document.getElementById('modalBg').addEventListener('click', e=>{
  if(e.target.id==='modalBg') closeModal();
});

// ---------- RUTINAS: CRUD ----------
function openRutinaForm(rutinaId){
  const r = rutinaId ? data.rutinas.find(x=>x.id===rutinaId) : null;
  openModal(`
    <button class="close-x" onclick="closeModal()">✕</button>
    <h3>${r? 'Editar rutina' : 'Nueva rutina'}</h3>
    <div class="field">
      <label>Nombre (ej. Push, Pierna, Full Body)</label>
      <input id="rNombre" value="${r? escapeHtml(r.nombre):''}" placeholder="Push Day">
    </div>
    <div id="exFields">
      ${(r? r.ejercicios : [{nombre:''}]).map((ex,i)=>exFieldRow(ex,i)).join('')}
    </div>
    <button class="btn secondary block" onclick="addExField()" style="margin-bottom:10px">+ Agregar ejercicio</button>
    <button class="btn block" onclick="saveRutina('${r? r.id : ''}')">${r? 'Guardar cambios':'Crear rutina'}</button>
    ${r? `<button class="btn danger block" style="margin-top:8px" onclick="deleteRutina('${r.id}')">Eliminar rutina</button>` : ''}
  `);
}
function exFieldRow(ex, i){
  return `<div class="field row" data-exrow="${i}">
    <input placeholder="Ejercicio (ej. Press banca)" value="${escapeHtml(ex.nombre||'')}" style="flex:1">
    <button class="iconbtn" onclick="this.closest('[data-exrow]').remove()">✕</button>
  </div>`;
}
function addExField(){
  const wrap = document.getElementById('exFields');
  const i = wrap.children.length;
  wrap.insertAdjacentHTML('beforeend', exFieldRow({nombre:''}, i));
}
function saveRutina(id){
  const nombre = document.getElementById('rNombre').value.trim();
  if(!nombre){ toast('Ponle un nombre a la rutina'); return; }
  const ejercicios = [...document.querySelectorAll('#exFields [data-exrow] input')]
    .map(inp=>inp.value.trim()).filter(Boolean)
    .map(nombreEx=>({ id: uid(), nombre: nombreEx }));
  if(ejercicios.length===0){ toast('Agrega al menos un ejercicio'); return; }

  if(id){
    const r = data.rutinas.find(x=>x.id===id);
    r.nombre = nombre;
    // conservar ids de ejercicios existentes por nombre para no perder historial
    const oldByName = {};
    r.ejercicios.forEach(e=>oldByName[e.nombre]=e.id);
    r.ejercicios = ejercicios.map(e=> oldByName[e.nombre] ? {id:oldByName[e.nombre], nombre:e.nombre} : e);
  }else{
    data.rutinas.push({ id: uid(), nombre, ejercicios });
  }
  saveData();
  closeModal();
  toast('Rutina guardada');
  render();
}
function deleteRutina(id){
  if(!confirm('¿Eliminar esta rutina? El historial de sesiones no se borra.')) return;
  data.rutinas = data.rutinas.filter(x=>x.id!==id);
  saveData();
  closeModal();
  render();
}

// ---------- HOY: sesión activa ----------
function getActiveSession(){
  return data.sesiones.find(s=>s.estado==='activa');
}
function startSession(rutinaId){
  const r = data.rutinas.find(x=>x.id===rutinaId);
  if(!r) return;
  const sesion = {
    id: uid(),
    rutinaId: r.id,
    rutinaNombre: r.nombre,
    fecha: todayISO(),
    estado: 'activa',
    ejercicios: r.ejercicios.map(ex=>({
      exId: ex.id, nombre: ex.nombre, series: []
    }))
  };
  data.sesiones.unshift(sesion);
  saveData();
  render();
}
function addSet(sesionId, exId){
  const s = data.sesiones.find(x=>x.id===sesionId);
  const ex = s.ejercicios.find(e=>e.exId===exId);
  const last = ex.series[ex.series.length-1];
  ex.series.push({ peso: last?last.peso:'', reps: last?last.reps:'', rir:'' });
  saveData();
  render();
}
function updateSet(sesionId, exId, idx, field, value){
  const s = data.sesiones.find(x=>x.id===sesionId);
  const ex = s.ejercicios.find(e=>e.exId===exId);
  ex.series[idx][field] = value;
  saveData();
}
function removeSet(sesionId, exId, idx){
  const s = data.sesiones.find(x=>x.id===sesionId);
  const ex = s.ejercicios.find(e=>e.exId===exId);
  ex.series.splice(idx,1);
  saveData();
  render();
}
function finishSession(sesionId){
  const s = data.sesiones.find(x=>x.id===sesionId);
  s.estado = 'completada';
  saveData();
  toast('Sesión guardada 💪');
  render();
}
function discardSession(sesionId){
  if(!confirm('¿Descartar esta sesión?')) return;
  data.sesiones = data.sesiones.filter(x=>x.id!==sesionId);
  saveData();
  render();
}

// ---------- Render: Vista HOY ----------
function renderHoy(){
  const card = document.getElementById('hoyRutinaCard');
  const active = getActiveSession();
  const sesionDiv = document.getElementById('hoySesion');

  if(active){
    card.innerHTML = `<h3>${escapeHtml(active.rutinaNombre)} <span class="pill">${fmtDate(active.fecha)}</span></h3>
      <div style="color:var(--muted);font-size:13px">Sesión en curso</div>`;
    sesionDiv.innerHTML = active.ejercicios.map(ex=>`
      <div class="card">
        <h3>${escapeHtml(ex.nombre)}</h3>
        ${ex.series.length===0? '<div style="color:var(--muted);font-size:13px;margin-bottom:8px">Sin series aún</div>':''}
        <div class="set-row" style="font-size:11px;color:var(--muted)">
          <div></div><div>Kg</div><div>Reps</div><div>RIR</div><div></div>
        </div>
        ${ex.series.map((set,idx)=>`
          <div class="set-row">
            <div class="idx">${idx+1}</div>
            <input type="number" inputmode="decimal" value="${set.peso}" placeholder="0"
              onchange="updateSet('${active.id}','${ex.exId}',${idx},'peso',this.value)">
            <input type="number" inputmode="numeric" value="${set.reps}" placeholder="0"
              onchange="updateSet('${active.id}','${ex.exId}',${idx},'reps',this.value)">
            <input type="number" inputmode="numeric" value="${set.rir}" placeholder="-"
              onchange="updateSet('${active.id}','${ex.exId}',${idx},'rir',this.value)">
            <button class="iconbtn" onclick="removeSet('${active.id}','${ex.exId}',${idx})">✕</button>
          </div>
        `).join('')}
        <button class="btn secondary block" style="margin-top:6px" onclick="addSet('${active.id}','${ex.exId}')">+ Serie</button>
      </div>
    `).join('') + `
      <button class="btn block" onclick="finishSession('${active.id}')">✅ Terminar sesión</button>
      <button class="btn danger block" style="margin-top:8px" onclick="discardSession('${active.id}')">Descartar sesión</button>
      <div style="height:10px"></div>
    `;
  }else{
    if(data.rutinas.length===0){
      card.innerHTML = `<h3>Bienvenido 👋</h3>
        <div style="color:var(--muted);font-size:13px;margin-bottom:10px">
          Aún no tienes rutinas creadas. Ve a la pestaña "Rutinas" y crea la primera.
        </div>
        <button class="btn block" onclick="switchView('rutinas')">Crear mi primera rutina</button>`;
    }else{
      card.innerHTML = `<h3>¿Qué entrenas hoy?</h3>
        ${data.rutinas.map(r=>`
          <div class="list-item" style="cursor:pointer" onclick="startSession('${r.id}')">
            <div>
              <div class="name">${escapeHtml(r.nombre)}</div>
              <div class="meta">${r.ejercicios.length} ejercicios</div>
            </div>
            <div class="pill">Iniciar ▶</div>
          </div>
        `).join('')}`;
    }
    sesionDiv.innerHTML = '';
  }
}

// ---------- Render: Vista RUTINAS ----------
function renderRutinas(){
  const list = document.getElementById('rutinasList');
  const empty = document.getElementById('rutinasEmpty');
  if(data.rutinas.length===0){
    list.innerHTML=''; empty.style.display='block'; return;
  }
  empty.style.display='none';
  list.innerHTML = data.rutinas.map(r=>`
    <div class="card">
      <h3>${escapeHtml(r.nombre)}
        <button class="btn ghost" onclick="openRutinaForm('${r.id}')">✏️ Editar</button>
      </h3>
      ${r.ejercicios.map(e=>`<div class="ex-item">${escapeHtml(e.nombre)}</div>`).join('')}
    </div>
  `).join('');
}

// ---------- Render: Vista HISTORIAL / PROGRESO ----------
function allExercisesFlat(){
  const map = {};
  data.rutinas.forEach(r=>r.ejercicios.forEach(e=>{ map[e.id]=e.nombre; }));
  // incluir también ejercicios de sesiones (por si la rutina fue borrada)
  data.sesiones.forEach(s=>s.ejercicios.forEach(e=>{ if(!map[e.exId]) map[e.exId]=e.nombre; }));
  return map;
}
function renderHistorial(){
  const sel = document.getElementById('progressExSelect');
  const map = allExercisesFlat();
  const ids = Object.keys(map);
  const prevVal = sel.value;
  sel.innerHTML = '<option value="">Selecciona un ejercicio</option>' +
    ids.map(id=>`<option value="${id}">${escapeHtml(map[id])}</option>`).join('');
  if(prevVal && ids.includes(prevVal)) sel.value = prevVal;

  sel.onchange = renderProgressChart;
  renderProgressChart();

  const sesionesList = document.getElementById('sesionesList');
  const completadas = data.sesiones.filter(s=>s.estado==='completada');
  if(completadas.length===0){
    sesionesList.innerHTML = '<div class="empty">Aún no hay sesiones completadas.</div>';
  }else{
    sesionesList.innerHTML = completadas.map(s=>{
      const totalSeries = s.ejercicios.reduce((a,e)=>a+e.series.length,0);
      return `<div class="list-item">
        <div>
          <div class="name">${escapeHtml(s.rutinaNombre)}</div>
          <div class="meta">${fmtDate(s.fecha)} · ${totalSeries} series</div>
        </div>
        <button class="iconbtn" onclick="deleteSesion('${s.id}')">🗑️</button>
      </div>`;
    }).join('');
  }
}
function deleteSesion(id){
  if(!confirm('¿Eliminar esta sesión del historial?')) return;
  data.sesiones = data.sesiones.filter(s=>s.id!==id);
  saveData();
  render();
}

function renderProgressChart(){
  const sel = document.getElementById('progressExSelect');
  const exId = sel.value;
  const card = document.getElementById('progressCard');
  if(!exId){ card.style.display='none'; return; }

  const points = [];
  data.sesiones
    .filter(s=>s.estado==='completada')
    .slice()
    .reverse()
    .forEach(s=>{
      const ex = s.ejercicios.find(e=>e.exId===exId);
      if(ex && ex.series.length){
        const pesos = ex.series.map(x=>parseFloat(x.peso)||0);
        const max = Math.max(...pesos);
        if(max>0) points.push({ fecha:s.fecha, max });
      }
    });

  if(points.length===0){
    card.style.display='none';
    return;
  }
  card.style.display='block';
  drawChart(points);
}

function drawChart(points){
  const canvas = document.getElementById('progressChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320;
  const cssH = 180;
  canvas.width = cssW*dpr; canvas.height = cssH*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cssW,cssH);

  const padL=36, padR=10, padT=14, padB=24;
  const w = cssW-padL-padR, h = cssH-padT-padB;
  const values = points.map(p=>p.max);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max-min)||1;
  const yFor = v => padT + h - ((v-min)/range)*h;
  const xFor = i => padL + (points.length===1? w/2 : (i/(points.length-1))*w);

  // eje
  ctx.strokeStyle = '#2a2f3a';
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+h); ctx.lineTo(padL+w,padT+h); ctx.stroke();

  // labels y
  ctx.fillStyle = '#8b93a3';
  ctx.font = '10px sans-serif';
  ctx.textAlign='right';
  ctx.fillText(max+'kg', padL-4, yFor(max)+3);
  ctx.fillText(min+'kg', padL-4, yFor(min)+3);

  // linea
  ctx.strokeStyle = '#5b8cff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((p,i)=>{
    const x=xFor(i), y=yFor(p.max);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  // puntos
  points.forEach((p,i)=>{
    const x=xFor(i), y=yFor(p.max);
    ctx.fillStyle = '#5b8cff';
    ctx.beginPath(); ctx.arc(x,y,4,0,7); ctx.fill();
  });

  // fechas primer/ultimo
  ctx.fillStyle='#8b93a3';
  ctx.textAlign='left';
  ctx.fillText(fmtDate(points[0].fecha).replace(/ de \d+$/,''), padL, cssH-6);
  ctx.textAlign='right';
  ctx.fillText(fmtDate(points[points.length-1].fecha).replace(/ de \d+$/,''), padL+w, cssH-6);
}

// ---------- Backup ----------
function exportBackup(){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `migym_backup_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Backup exportado');
}
document.getElementById('importFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const parsed = JSON.parse(text);
    if(!parsed.rutinas || !parsed.sesiones) throw new Error('formato inválido');
    if(!confirm('Esto reemplazará tus datos actuales con el backup. ¿Continuar?')) return;
    data = parsed;
    saveData();
    toast('Backup restaurado');
    render();
  }catch(err){
    toast('Archivo inválido');
  }
  e.target.value = '';
});
function resetAll(){
  if(!confirm('Esto borrará TODAS tus rutinas e historial permanentemente. ¿Seguro?')) return;
  if(!confirm('Última confirmación: ¿de verdad quieres borrar todo?')) return;
  data = { rutinas:[], sesiones:[] };
  saveData();
  toast('Datos borrados');
  render();
}

// ---------- Util ----------
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Render maestro ----------
function render(){
  if(currentView==='hoy') renderHoy();
  if(currentView==='rutinas') renderRutinas();
  if(currentView==='historial') renderHistorial();
  document.getElementById('fab').style.display = (currentView==='rutinas') ? 'flex' : 'none';
}

// ---------- Service worker (offline) ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

render();
