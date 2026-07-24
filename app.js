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

// ---------- Biblioteca de ejercicios por grupo muscular ----------
const MUSCULOS = ["Pecho","Espalda","Piernas","Hombros","Bíceps","Tríceps","Core","Cardio"];
const MUSCULO_COLOR = {Pecho:"#ff6b6b",Espalda:"#ffa94d",Piernas:"#ffd43b",Hombros:"#4dd4ff",
  "Bíceps":"#b197fc","Tríceps":"#f783ac",Core:"#39d98a",Cardio:"#ff922b"};
const LIBRERIA = {
  Pecho:["Press banca plano","Press banca inclinado","Press banca declinado","Aperturas con mancuernas","Fondos en paralelas","Press con mancuernas","Pullover","Crossover en polea"],
  Espalda:["Dominadas","Jalón al pecho","Remo con barra","Remo con mancuerna","Remo en polea baja","Face pull","Encogimientos","Peso muerto"],
  Piernas:["Sentadilla libre","Sentadilla en Smith","Prensa de piernas","Extensión de cuádriceps","Curl femoral","Peso muerto rumano","Zancadas","Hip thrust","Elevación de gemelos"],
  Hombros:["Press militar","Press Arnold","Elevaciones laterales","Elevaciones frontales","Pájaro posterior","Face pull","Remo al mentón"],
  "Bíceps":["Curl con barra","Curl con mancuernas","Curl martillo","Curl concentrado","Curl en polea","Curl predicador"],
  "Tríceps":["Press francés","Fondos en banco","Extensión overhead","Tríceps polea alta","Tríceps cuerda","Press cerrado","Dips"],
  Core:["Plancha","Crunch","Rueda abdominal","Elevación de piernas","Russian twist","Plancha lateral"],
  Cardio:["Caminadora","Bicicleta estática","Elíptica","Remo ergómetro","Saltar la cuerda","HIIT","Sprints"]
};

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
  const musculo = ex.musculo || MUSCULOS[0];
  const listId = 'exlist_'+i;
  const opciones = (LIBRERIA[musculo]||[]).map(n=>`<option value="${escapeHtml(n)}">`).join('');
  return `<div class="field" data-exrow="${i}">
    <div class="row">
      <select class="exrow-musculo" style="flex:1" onchange="onExMuscleChange(this)">
        ${MUSCULOS.map(m=>`<option value="${m}" ${m===musculo?'selected':''}>${m}</option>`).join('')}
      </select>
      <input class="exrow-nombre" list="${listId}" placeholder="Ejercicio" value="${escapeHtml(ex.nombre||'')}" style="flex:2">
      <button class="iconbtn" onclick="this.closest('[data-exrow]').remove()">✕</button>
    </div>
    <datalist id="${listId}">${opciones}</datalist>
  </div>`;
}
function onExMuscleChange(sel){
  const row = sel.closest('[data-exrow]');
  const musculo = sel.value;
  const datalist = row.querySelector('datalist');
  datalist.innerHTML = (LIBRERIA[musculo]||[]).map(n=>`<option value="${escapeHtml(n)}">`).join('');
}
function addExField(){
  const wrap = document.getElementById('exFields');
  const i = Date.now()+''+wrap.children.length;
  wrap.insertAdjacentHTML('beforeend', exFieldRow({nombre:''}, i));
}
function saveRutina(id){
  const nombre = document.getElementById('rNombre').value.trim();
  if(!nombre){ toast('Ponle un nombre a la rutina'); return; }
  const ejercicios = [...document.querySelectorAll('#exFields [data-exrow]')]
    .map(row=>({
      nombre: row.querySelector('.exrow-nombre').value.trim(),
      musculo: row.querySelector('.exrow-musculo').value
    }))
    .filter(e=>e.nombre)
    .map(e=>({ id: uid(), nombre: e.nombre, musculo: e.musculo }));
  if(ejercicios.length===0){ toast('Agrega al menos un ejercicio'); return; }

  if(id){
    const r = data.rutinas.find(x=>x.id===id);
    r.nombre = nombre;
    // conservar ids de ejercicios existentes por nombre para no perder historial
    const oldByName = {};
    r.ejercicios.forEach(e=>oldByName[e.nombre]=e.id);
    r.ejercicios = ejercicios.map(e=> oldByName[e.nombre] ? {id:oldByName[e.nombre], nombre:e.nombre, musculo:e.musculo} : e);
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
    notas: '',
    ejercicios: r.ejercicios.map(ex=>({
      exId: ex.id, nombre: ex.nombre, musculo: ex.musculo, series: []
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
function updateSessionNotes(sesionId, value){
  const s = data.sesiones.find(x=>x.id===sesionId);
  s.notas = value;
  saveData();
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

// ---------- Racha ----------
function computeStreak(){
  const fechas = new Set(data.sesiones.filter(s=>s.estado==='completada').map(s=>s.fecha));
  let streak = 0;
  const d = new Date();
  for(let i=0;i<365;i++){
    const iso = new Date(d.getTime()-i*86400000-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
    if(fechas.has(iso)) streak++;
    else if(i>0) break;
    else continue; // hoy sin sesión aún no rompe la racha de ayer hacia atrás
  }
  return streak;
}

// ---------- Render: Vista HOY ----------
function renderHoy(){
  const card = document.getElementById('hoyRutinaCard');
  const active = getActiveSession();
  const sesionDiv = document.getElementById('hoySesion');
  const streak = computeStreak();
  document.getElementById('headerSub').textContent = streak>0
    ? `🔥 ${streak} día${streak===1?'':'s'} seguido${streak===1?'':'s'}`
    : 'Seguimiento personal de rutinas';

  if(active){
    card.innerHTML = `<h3>${escapeHtml(active.rutinaNombre)} <span class="pill">${fmtDate(active.fecha)}</span></h3>
      <div style="color:var(--muted);font-size:13px">Sesión en curso</div>`;
    sesionDiv.innerHTML = active.ejercicios.map(ex=>`
      <div class="card">
        <h3>${escapeHtml(ex.nombre)}
          ${ex.musculo?`<span class="pill" style="color:${MUSCULO_COLOR[ex.musculo]||'inherit'}">${ex.musculo}</span>`:''}
        </h3>
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
      <div class="card">
        <label>Notas de la sesión</label>
        <input placeholder="Sensaciones, récord, etc." value="${escapeHtml(active.notas||'')}"
          onchange="updateSessionNotes('${active.id}', this.value)">
      </div>
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
      ${r.ejercicios.map(e=>`<div class="ex-item">${escapeHtml(e.nombre)}
        ${e.musculo?`<span class="pill" style="color:${MUSCULO_COLOR[e.musculo]||'inherit'}">${e.musculo}</span>`:''}
      </div>`).join('')}
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
function computePRs(){
  const map = allExercisesFlat();
  const prs = {}; // exId -> {peso, reps, fecha}
  data.sesiones.filter(s=>s.estado==='completada').forEach(s=>{
    s.ejercicios.forEach(ex=>{
      ex.series.forEach(set=>{
        const peso = parseFloat(set.peso)||0;
        const reps = parseFloat(set.reps)||0;
        if(peso<=0) return;
        const cur = prs[ex.exId];
        if(!cur || peso>cur.peso || (peso===cur.peso && reps>cur.reps)){
          prs[ex.exId] = { peso, reps, fecha: s.fecha, nombre: ex.nombre };
        }
      });
    });
  });
  return Object.values(prs).sort((a,b)=>b.peso-a.peso);
}
function computeVolumeSeries(){
  return data.sesiones.filter(s=>s.estado==='completada').slice().reverse().map(s=>{
    const vol = s.ejercicios.reduce((acc,ex)=>acc+ex.series.reduce((a,set)=>
      a+(parseFloat(set.peso)||0)*(parseFloat(set.reps)||0), 0), 0);
    return { fecha: s.fecha, vol: Math.round(vol) };
  }).filter(p=>p.vol>0);
}
function renderStreakCard(){
  const streak = computeStreak();
  const completadas = data.sesiones.filter(s=>s.estado==='completada').length;
  document.getElementById('streakCard').innerHTML = `
    <div class="grid2" style="margin-bottom:12px">
      <div class="card" style="text-align:center;margin-bottom:0">
        <div style="font-size:26px;font-weight:800">🔥 ${streak}</div>
        <div style="color:var(--muted);font-size:12px">día${streak===1?'':'s'} seguidos</div>
      </div>
      <div class="card" style="text-align:center;margin-bottom:0">
        <div style="font-size:26px;font-weight:800">${completadas}</div>
        <div style="color:var(--muted);font-size:12px">sesiones totales</div>
      </div>
    </div>`;
}
function renderPRs(){
  const prs = computePRs();
  const card = document.getElementById('prsCard');
  if(prs.length===0){ card.style.display='none'; return; }
  card.style.display='block';
  document.getElementById('prsList').innerHTML = prs.slice(0,10).map(p=>`
    <div class="list-item">
      <div>
        <div class="name">${escapeHtml(p.nombre)}</div>
        <div class="meta">${fmtDate(p.fecha)}</div>
      </div>
      <div class="pill" style="color:var(--accent2)">${p.peso}kg × ${p.reps}</div>
    </div>
  `).join('');
}
function renderVolumeChart(){
  const points = computeVolumeSeries();
  const card = document.getElementById('volumeCard');
  if(points.length===0){ card.style.display='none'; return; }
  card.style.display='block';
  const canvas = document.getElementById('volumeChart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 320, cssH = 180;
  canvas.width = cssW*dpr; canvas.height = cssH*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cssW,cssH);

  const padL=44, padR=10, padT=14, padB=24;
  const w = cssW-padL-padR, h = cssH-padT-padB;
  const last = points.slice(-10);
  const max = Math.max(...last.map(p=>p.vol)) || 1;
  const bw = Math.max(10, w/last.length - 8);

  ctx.strokeStyle = '#2a2f3a';
  ctx.beginPath(); ctx.moveTo(padL,padT); ctx.lineTo(padL,padT+h); ctx.lineTo(padL+w,padT+h); ctx.stroke();
  ctx.fillStyle = '#8b93a3'; ctx.font='10px sans-serif'; ctx.textAlign='right';
  ctx.fillText(Math.round(max)+'kg', padL-4, padT+8);

  last.forEach((p,i)=>{
    const bh = (p.vol/max)*h;
    const x = padL + i*(w/last.length) + 4;
    const y = padT+h-bh;
    ctx.fillStyle = '#5b8cff';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#8b93a3'; ctx.font='9px sans-serif'; ctx.textAlign='center';
    ctx.fillText(fmtDate(p.fecha).split(' ')[0], x+bw/2, cssH-6);
  });
}

function renderHistorial(){
  renderStreakCard();
  renderPRs();
  renderVolumeChart();
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
