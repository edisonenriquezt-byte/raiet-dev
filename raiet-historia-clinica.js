/* RAIET ESABAS — Historia Clínica 1.0.28
   Datos sensibles: se consultan bajo Supabase Auth/RLS, no se guardan en localStorage.
   Los documentos se almacenan en un bucket privado y solo se abren mediante URLs temporales.
*/
(function () {
 "use strict";
 const ADMIN="4c2b8c98-200f-4307-8d7c-6d8742feb17a";
 const BUCKET="raiet-clinica";
 const MAX=10*1024*1024;
 const TIPOS=["application/pdf","image/jpeg","image/png","image/webp"];
 const nombres={evoluciones:"Consultas y evolución",recetas:"Recetas",examenes:"Exámenes",documentos:"Documentos",citas:"Citas",historial:"Auditoría"};
 const tablas={evoluciones:"pacientes_evoluciones",recetas:"pacientes_recetas",examenes:"pacientes_examenes",documentos:"pacientes_documentos",citas:"pacientes_citas",historial:"pacientes_historial"};
 const st={pacientes:[],paciente:null,registros:{},abierto:null,tab:"evoluciones",archivo:false,editar:null,cargando:false,ocupado:false,localesPendientes:false,ready:false};
 const $=id=>document.getElementById(id);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const txt=v=>esc(v||"—");
 const hoy=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
 const fecha=v=>{if(!v)return "—";if(String(v).length===10){const p=String(v).split("-");return p[2]+"/"+p[1]+"/"+p[0];}const d=new Date(v);return isNaN(d.getTime())?esc(v):d.toLocaleString("es-EC",{dateStyle:"short",timeStyle:"short"});};
 const mensaje=(v,error=false)=>{const x=$("hc-estado");if(x){x.textContent=v||"";x.style.color=error?"#fca5a5":"#93c5fd";}};
 const db=()=>window.db;
 async function autorizado(){
   if(!navigator.onLine)throw Error("Historia Clínica requiere conexión segura. Los datos médicos no se guardan fuera de línea.");
   if(!db())throw Error("Inicia sesión en RAIET para acceder a Historia Clínica.");
   const r=await db().auth.getUser();
   if(r.error||r.data?.user?.id!==ADMIN)throw Error("No tienes acceso autorizado a las historias clínicas.");
 }
 function input(n,l,v="",type="text",extra=""){
   return '<label class="hc-campo"><span>'+esc(l)+'</span><input name="'+esc(n)+'" type="'+type+'" value="'+esc(v)+'" '+extra+'></label>';
 }
 function area(n,l,v="",extra=""){
   return '<label class="hc-campo hc-ancho"><span>'+esc(l)+'</span><textarea name="'+esc(n)+'" rows="2" '+extra+'>'+esc(v)+'</textarea></label>';
 }
 function boton(s){return '<button type="submit" class="btn btn-primary">'+esc(s)+'</button>';}
 function formPaciente(p){
   const edit=!!p;
   return '<form id="hc-form-paciente" class="card" '+(edit?"":"hidden")+'>'
    +'<h3 id="hc-titulo-form">'+(edit?"Editar ficha del paciente":"Nueva ficha clínica")+'</h3>'
    +'<div class="hc-grid">'
    +input("nombre","Nombre completo",p?.nombre||"","text","required maxlength=180")
    +input("documento","Documento / identificación",p?.documento||"","text","maxlength=40")
    +input("fecha_nacimiento","Fecha de nacimiento",p?.fecha_nacimiento||"","date")
    +input("telefono","Teléfono",p?.telefono||"","tel","maxlength=30")
    +input("email","Correo electrónico",p?.email||"","email","maxlength=180")
    +input("contacto_emergencia","Contacto de emergencia",p?.contacto_emergencia||"","text","maxlength=180")
    +area("direccion","Dirección",p?.direccion||"")
    +area("antecedentes","Antecedentes personales / familiares",p?.antecedentes||"")
    +area("alergias","Alergias",p?.alergias||"")
    +area("enfermedades","Enfermedades y condiciones relevantes",p?.enfermedades||"")
    +area("medicacion_actual","Medicación actual",p?.medicacion_actual||"")
    +'</div><div class="hc-acciones">'+boton(edit?"Guardar modificaciones":"Crear historia clínica")
    +'<button type="button" class="btn btn-secondary" data-hc="cancelar">Cancelar</button></div></form>';
 }
 function iniciar(){
   const tab=$("tab-pacientes");if(!tab||st.ready)return;
   st.ready=true;
   let pendientes=[];
   try{pendientes=JSON.parse(localStorage.getItem("raiet_dev_pac")||"[]").filter(x=>String(x.id||"").startsWith("loc_"));}catch(_){}
   st.localesPendientes=pendientes.length>0;
   tab.innerHTML='<div class="card hc-encabezado"><div class="hc-acciones"><div><h2>🩺 Historia Clínica</h2>'
      +'<p class="hc-muted">Fichas de pacientes, consultas, recetas, exámenes, documentos y controles médicos.</p></div>'
      +'<button type="button" class="btn btn-primary" data-hc="nuevo">+ Nuevo paciente</button></div>'
      +'<p class="hc-muted">Acceso restringido. Los registros se consultan en línea, sin copia local automática.</p>'
      +(st.localesPendientes?'<p class="hc-aviso">⚠ Hay fichas antiguas que existen solo en este dispositivo. Se conservarán en el navegador hasta migrarlas; no se pueden usar aquí mientras no se sincronicen.</p>':"")+'</div>'
      +'<div id="hc-estado" role="status" class="hc-mensaje"></div>'
      +'<div id="hc-form-wrap">'+formPaciente(null)+'</div>'
      +'<div class="hc-filtros"><input id="hc-buscar" type="search" placeholder="Buscar por nombre, documento o teléfono">'
      +'<label><input id="hc-archivados" type="checkbox"> Mostrar archivados</label></div>'
      +'<div id="hc-lista"></div>';
   const css=document.createElement("style");
   css.textContent="#tab-pacientes .hc-acciones{display:flex;gap:9px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:10px 0}"
    +"#tab-pacientes .hc-encabezado h2{margin:0 0 7px}#tab-pacientes .hc-muted{font-size:12px;line-height:1.5;color:#a7b3c5}"
    +"#tab-pacientes .hc-aviso{padding:10px;border:1px solid #b45309;border-radius:8px;color:#fcd34d;font-size:13px}"
    +"#tab-pacientes .hc-mensaje{min-height:20px;font-size:13px;margin:10px 0;white-space:pre-wrap}"
    +"#tab-pacientes .hc-filtros{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}"
    +"#tab-pacientes .hc-filtros input[type=search]{flex:1;min-width:180px;background:#101827;color:white;padding:11px;border:1px solid #334155;border-radius:8px}"
    +"#tab-pacientes .hc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}"
    +"#tab-pacientes .hc-campo{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#cbd5e1}"
    +"#tab-pacientes .hc-ancho{grid-column:1/-1}"
    +"#tab-pacientes .hc-campo input,#tab-pacientes .hc-campo textarea,#tab-pacientes .hc-campo select{background:#101827;border:1px solid #334155;border-radius:7px;padding:10px;color:#fff;width:100%;box-sizing:border-box}"
    +"#tab-pacientes .hc-ficha{margin-bottom:12px}#tab-pacientes .hc-ficha h3{margin:0}"
    +"#tab-pacientes .hc-nav{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}"
    +"#tab-pacientes .hc-nav button{font-size:12px;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#111827;color:#cbd5e1}"
    +"#tab-pacientes .hc-nav button.activo{background:#1d4ed8;color:#fff;border-color:#1d4ed8}"
    +"#tab-pacientes .hc-registro{border:1px solid #334155;border-radius:8px;padding:11px;margin:8px 0;font-size:13px;overflow-wrap:anywhere}"
    +"#tab-pacientes .hc-registro p{margin:6px 0;white-space:pre-wrap}#tab-pacientes .hc-inactivo{opacity:.68}"
    +"#tab-pacientes .hc-cabeza{display:flex;justify-content:space-between;align-items:center;gap:8px}"
    +"#tab-pacientes .hc-cabeza button{color:#fff;text-align:left;background:transparent;border:0;padding:7px;flex:1;cursor:pointer}"
    +"#tab-pacientes button{cursor:pointer}#tab-pacientes form[hidden]{display:none!important}"
    +"#tab-pacientes .hc-detalles{background:#0f172a;padding:10px;border-radius:8px;margin:10px 0;font-size:13px}"
    +"#tab-pacientes .hc-detalles p{margin:7px 0;white-space:pre-wrap}";
   document.head.appendChild(css);
   tab.addEventListener("click",click);
   tab.addEventListener("submit",submit);
   $("hc-buscar").addEventListener("input",dibujar);
   $("hc-archivados").addEventListener("change",dibujar);
   mensaje("Inicia sesión y abre Historia Clínica para consultar los registros.");
 }
 function dibujar(){
   if(!st.ready)return;
   const cont=$("hc-lista"),q=($("hc-buscar")?.value||"").trim().toLowerCase();
   const show=!!$("hc-archivados")?.checked;
   const lista=st.pacientes.filter(p=>(show||!p.archivado)&&(!q||[p.nombre,p.documento,p.telefono].some(x=>String(x||"").toLowerCase().includes(q))));
   if(!lista.length){cont.innerHTML='<div class="card"><p class="hc-muted">No hay historias clínicas que coincidan con la búsqueda.</p></div>';return;}
   cont.innerHTML=lista.map(p=>{
     const open=st.abierto===String(p.id),arch=!!p.archivado;
     return '<div class="card hc-ficha'+(arch?" hc-inactivo":"")+'"><div class="hc-cabeza">'
       +'<button type="button" data-hc="abrir" data-id="'+esc(p.id)+'"><h3>'+esc(p.nombre)+(arch?" · ARCHIVADO":"")+'</h3>'
       +'<span class="hc-muted">'+(p.documento?'Documento: '+esc(p.documento)+' · ':'')+(p.telefono?'Tel: '+esc(p.telefono):'Sin teléfono')+' · '+(open?"▲":"▼")+'</span></button>'
       +'<button type="button" class="btn btn-secondary" data-hc="editar" data-id="'+esc(p.id)+'">Editar</button></div>'
       +(open?detallePaciente(p):"")+'</div>';
   }).join("");
 }
 function detallePaciente(p){
   const cols=[["Fecha de nacimiento",fecha(p.fecha_nacimiento)],["Email",txt(p.email)],["Dirección",txt(p.direccion)],
    ["Contacto de emergencia",txt(p.contacto_emergencia)],["Antecedentes",txt(p.antecedentes)],
    ["Alergias",txt(p.alergias)],["Condiciones",txt(p.enfermedades)],["Medicación actual",txt(p.medicacion_actual)]];
   return '<div class="hc-detalles">'+cols.map(c=>'<p><b>'+c[0]+':</b> '+c[1]+'</p>').join("")+'</div>'
     +'<div class="hc-acciones"><button type="button" class="btn btn-secondary" data-hc="archivar" data-id="'+esc(p.id)+'">'
     +(p.archivado?"Reactivar ficha":"Archivar ficha")+'</button></div>'
     +'<div class="hc-nav">'+Object.keys(nombres).map(k=>'<button type="button" class="'+(st.tab===k?"activo":"")+'" data-hc="tab" data-tipo="'+k+'">'+nombres[k]+'</button>').join("")+'</div>'
     +'<div id="hc-subvista">'+contenidoTab(p)+'</div>';
 }
 function resumen(k,r){
   if(k==="historial"){
     const antes=r.antes||{},despues=r.despues||{};
     const campos=Object.keys(despues).filter(x=>JSON.stringify(antes[x])!==JSON.stringify(despues[x])&&x!=="modificado_el");
     return '<b>'+esc(r.tipo||"Modificación")+'</b> · '+fecha(r.creado_el)+'<p>Campos: '+txt(campos.join(", "))+'</p>';
   }
   if(k==="evoluciones")return '<b>'+fecha(r.fecha)+' · Consulta</b><p><b>Motivo:</b> '+txt(r.motivo)+'</p><p><b>Exploración:</b> '+txt(r.exploracion)+'</p><p><b>Diagnóstico:</b> '+txt(r.diagnostico)+'</p><p><b>Tratamiento:</b> '+txt(r.plan_tratamiento)+'</p>'
     +'<p><b>Signos:</b> Peso '+txt(r.peso)+' kg · Estatura '+txt(r.estatura)+' cm · PA '+txt(r.presion_arterial)+' · T '+txt(r.temperatura)+' °C · FC '+txt(r.frecuencia_cardiaca)+' · SpO₂ '+txt(r.saturacion)+' %</p>'
     +'<p><b>Profesional:</b> '+txt(r.profesional)+' · <b>Control:</b> '+fecha(r.proxima_cita)+'</p>';
   if(k==="recetas")return '<b>'+fecha(r.fecha)+' · Receta</b><p><b>Medicamentos:</b> '+txt(r.medicamentos)+'</p><p><b>Indicaciones:</b> '+txt(r.indicaciones)+'</p><p><b>Profesional:</b> '+txt(r.profesional)+'</p>';
   if(k==="examenes")return '<b>'+fecha(r.fecha)+' · '+txt(r.tipo_estudio)+'</b><p><b>Resultado / conclusión:</b> '+txt(r.conclusion)+'</p>'
     +(r.archivo_ruta?'<button class="btn btn-secondary" type="button" data-hc="archivo" data-ruta="'+esc(r.archivo_ruta)+'">Abrir archivo privado</button>':"");
   if(k==="documentos")return '<b>'+fecha(r.fecha)+' · '+txt(r.tipo)+'</b><p>'+txt(r.nombre_archivo)+' · '+txt(r.observacion)+'</p>'
     +'<button class="btn btn-secondary" type="button" data-hc="archivo" data-ruta="'+esc(r.archivo_ruta)+'">Abrir archivo privado</button>';
   if(k==="citas")return '<b>'+fecha(r.fecha_hora)+' · '+txt(r.motivo)+'</b><p>'+txt(r.observaciones)+'</p>'
     +'<p>'+(r.realizado?"✓ Atención realizada":'Pendiente · <button type="button" class="btn btn-secondary" data-hc="realizar" data-id="'+esc(r.id)+'">Marcar realizada</button>')+'</p>';
   return "";
 }
 function contenidoTab(p){
   if(st.cargando)return '<p class="hc-muted">Consultando registros protegidos...</p>';
   const r=(st.registros[st.tab]||[]).filter(x=>String(x.paciente_id||"")===String(p.id));
   const esArchivo=st.tab==="historial";
   const form=esArchivo?"":formRegistro(st.tab,p);
   return '<h3>'+nombres[st.tab]+'</h3>'+form
    +(r.length?r.map(x=>'<div class="hc-registro">'+resumen(st.tab,x)+'</div>').join(""):'<p class="hc-muted">Aún no hay registros en esta sección.</p>');
 }
 function formRegistro(tipo,p){
   const common='<input type="hidden" name="paciente_id" value="'+esc(p.id)+'">';
   let contenido="";
   if(tipo==="evoluciones")contenido=input("fecha","Fecha",hoy(),"date","required")
    +input("profesional","Profesional responsable","","text","required")
    +area("motivo","Motivo de consulta","","required")
    +area("exploracion","Evaluación / exploración")
    +area("diagnostico","Diagnóstico","","required")
    +area("plan_tratamiento","Plan de tratamiento")
    +input("peso","Peso (kg)","","number",'step="0.01" min="0"')
    +input("estatura","Estatura (cm)","","number",'step="0.1" min="0"')
    +input("presion_arterial","Presión arterial")
    +input("temperatura","Temperatura (°C)","","number",'step="0.1"')
    +input("frecuencia_cardiaca","Frecuencia cardíaca","","number",'min="0"')
    +input("saturacion","Saturación O₂ (%)","","number",'min="0" max="100"')
    +input("proxima_cita","Próximo control","","date");
   if(tipo==="recetas")contenido=input("fecha","Fecha",hoy(),"date","required")
     +input("profesional","Profesional responsable","","text","required")
     +area("medicamentos","Medicamentos / dosis / frecuencia","","required")
     +area("indicaciones","Indicaciones y duración del tratamiento");
   if(tipo==="examenes")contenido=input("fecha","Fecha",hoy(),"date","required")
     +input("tipo_estudio","Examen o estudio","","text","required")
     +area("conclusion","Resultado / conclusión")
     +'<label class="hc-campo hc-ancho"><span>Archivo de examen (PDF o imagen; opcional)</span><input type="file" name="archivo" accept=".pdf,image/jpeg,image/png,image/webp"></label>';
   if(tipo==="documentos")contenido=input("fecha","Fecha",hoy(),"date","required")
     +'<label class="hc-campo"><span>Tipo de documento</span><select name="tipo"><option>Consentimiento</option><option>Informe</option><option>Resultado</option><option>Otro</option></select></label>'
     +area("observacion","Observación")
     +'<label class="hc-campo hc-ancho"><span>Archivo PDF o imagen (máximo 10 MB)</span><input type="file" name="archivo" accept=".pdf,image/jpeg,image/png,image/webp" required></label>';
   if(tipo==="citas")contenido=input("fecha_hora","Fecha y hora de la cita","","datetime-local","required")
     +input("motivo","Motivo del control","","text","required")
     +area("observaciones","Observaciones");
   return '<form data-hc-form="'+tipo+'" class="hc-registro">'+common+'<div class="hc-grid">'+contenido+'</div>'
      +'<div class="hc-acciones">'+boton(tipo==="citas"?"Agendar cita":"Registrar "+(tipo==="evoluciones"?"consulta":tipo==="recetas"?"receta":tipo==="examenes"?"examen":"documento"))+'</div></form>';
 }
 async function cargarPacientes(){
   iniciar();if(st.ocupado)return;
   mensaje("Consultando historias clínicas...");
   try{
    await autorizado();
    const res=await db().from("pacientes").select("*").order("creado_el",{ascending:false});
    if(res.error)throw res.error;
    st.pacientes=res.data||[];
    if(!st.localesPendientes){try{localStorage.removeItem("raiet_dev_pac");}catch(_){}}
    dibujar();mensaje(st.pacientes.length+" fichas disponibles. Registros médicos protegidos por usuario.");
    if(st.abierto&&st.pacientes.some(x=>String(x.id)===st.abierto))await cargarDetalle(st.abierto);
   }catch(e){st.pacientes=[];dibujar();mensaje(e.message||"No se pudieron consultar las fichas.",true);}
 }
 async function cargarDetalle(id){
   st.cargando=true;dibujar();
   const entradas=Object.entries(tablas);
   try{
     await autorizado();
     const datos=await Promise.all(entradas.map(async ([k,t])=>{
       const orden=k==="historial"?"creado_el":k==="citas"?"fecha_hora":"fecha";
       const q=db().from(t).select("*").eq("paciente_id",id).order(orden,{ascending:false}).limit(150);
       const res=await q;if(res.error)throw Error(nombres[k]+": "+res.error.message);
       return [k,res.data||[]];
     }));
     if(st.abierto!==id)return;
     st.registros=Object.fromEntries(datos);
     mensaje("Historia clínica consultada correctamente.");
   }catch(e){mensaje("No se pudo leer el historial: "+(e.message||"error"),true);}
   finally{st.cargando=false;dibujar();}
 }
 async function guardarFicha(form){
   await autorizado();
   const f=new FormData(form);
   const campos=["nombre","documento","fecha_nacimiento","telefono","email","direccion","contacto_emergencia","antecedentes","alergias","enfermedades","medicacion_actual"];
   const datos={};
   campos.forEach(k=>datos[k]=String(f.get(k)||"").trim()||null);
   if(!datos.nombre)throw Error("El nombre es obligatorio.");
   if(st.editar){
     datos.modificado_el=new Date().toISOString();
     const r=await db().from("pacientes").update(datos).eq("id",st.editar).select("id").single();
     if(r.error)throw r.error;
     mensaje("✓ Ficha actualizada; cambio registrado en auditoría.");
   }else{
     const r=await db().from("pacientes").insert(datos).select("id").single();
     if(r.error)throw r.error;
     st.abierto=String(r.data.id);
     mensaje("✓ Historia clínica creada.");
   }
   st.editar=null;$("hc-form-wrap").innerHTML=formPaciente(null);
   await cargarPacientes();
 }
 async function subirArchivo(file,paciente){
   if(!file)return null;
   if(!TIPOS.includes(file.type))throw Error("Solo se admiten documentos PDF e imágenes JPG, PNG o WebP.");
   if(file.size>MAX)throw Error("El archivo supera los 10 MB.");
   let final=file;
   if(file.type.startsWith("image/")){
     if(typeof window.esabasComprimirImagen!=="function")throw Error("No está disponible el compresor de imágenes.");
     const r=await window.esabasComprimirImagen(file,{perfil:"comprobante"});
     if(!r?.archivo)throw Error("No se pudo optimizar la imagen.");
     final=r.archivo;
   }
   if(!TIPOS.includes(final.type)||final.size>MAX)throw Error("El archivo optimizado es inválido o supera los 10 MB.");
   const ext=final.type==="application/pdf"?"pdf":final.type==="image/png"?"png":final.type==="image/webp"?"webp":"jpg";
   if(!/^[a-f0-9-]{36}$/i.test(paciente))throw Error("Identificador del paciente no válido.");
   if(!crypto?.randomUUID)throw Error("La conexión debe ser segura para generar la referencia del archivo.");
   const ruta=paciente+"/"+crypto.randomUUID()+"."+ext;
   const u=await db().storage.from(BUCKET).upload(ruta,final,{contentType:final.type,cacheControl:"0",upsert:false});
   if(u.error)throw u.error;
   return {ruta,nombre:file.name,mime:final.type,bytes:final.size};
 }
 async function guardarRegistro(form,tipo){
   await autorizado();
   const f=new FormData(form),id=String(f.get("paciente_id")||"");
   if(!st.pacientes.some(x=>String(x.id)===id))throw Error("Paciente no identificado.");
   const payload={paciente_id:id};
   const campos={evoluciones:["fecha","motivo","exploracion","diagnostico","plan_tratamiento","peso","estatura","presion_arterial","temperatura","frecuencia_cardiaca","saturacion","proxima_cita","profesional"],
     recetas:["fecha","medicamentos","indicaciones","profesional"],
     examenes:["fecha","tipo_estudio","conclusion"],
     documentos:["fecha","tipo","observacion"],
     citas:["fecha_hora","motivo","observaciones"]};
   for(const campo of campos[tipo]){
     const v=String(f.get(campo)||"").trim();
     payload[campo]=v||null;
   }
   if(tipo==="evoluciones"&&(!payload.motivo||!payload.diagnostico||!payload.profesional))throw Error("Indica motivo, diagnóstico y profesional.");
   if(tipo==="recetas"&&(!payload.medicamentos||!payload.profesional))throw Error("Completa medicamentos y profesional.");
   if(tipo==="examenes"&&!payload.tipo_estudio)throw Error("Indica el estudio.");
   if(tipo==="citas"){
     if(!payload.fecha_hora||!payload.motivo)throw Error("Completa fecha, hora y motivo.");
     const d=new Date(payload.fecha_hora);
     if(isNaN(d.getTime()))throw Error("Fecha de cita inválida.");
     payload.fecha_hora=d.toISOString();
   }
   if(tipo==="evoluciones"){
     for(const k of ["peso","estatura","temperatura","frecuencia_cardiaca","saturacion"])if(payload[k]!==null){
       const n=Number(payload[k]);if(!Number.isFinite(n))throw Error("Valor inválido: "+k);
       payload[k]=n;
     }
   }
   const file=f.get("archivo"),hayFile=file instanceof File&&file.size>0;
   if(tipo==="documentos"&&!hayFile)throw Error("Selecciona un documento.");
   if(hayFile){
     const subido=await subirArchivo(file,id);
     if(tipo==="documentos")Object.assign(payload,{nombre_archivo:subido.nombre,archivo_ruta:subido.ruta,mime:subido.mime,bytes:subido.bytes});
     if(tipo==="examenes")Object.assign(payload,{nombre_archivo:subido.nombre,archivo_ruta:subido.ruta});
   }
   const r=await db().from(tablas[tipo]).insert(payload).select("id").single();
   if(r.error)throw Error(r.error.message+(hayFile?" (El archivo se subió, pero no pudo registrarse; requiere revisión administrativa).":""));
   mensaje("✓ "+(tipo==="citas"?"Cita agendada":nombres[tipo]+" registrado")+" correctamente.");
   await cargarDetalle(id);
 }
 async function cambiarArchivo(id){
   await autorizado();
   const p=st.pacientes.find(x=>String(x.id)===id);if(!p)return;
   const archive=!p.archivado;
   if(!confirm(archive?"¿Archivar esta ficha? El historial no se eliminará.":"¿Reactivar esta ficha clínica?"))return;
   const r=await db().from("pacientes").update({archivado:archive,modificado_el:new Date().toISOString()}).eq("id",id).select("id").single();
   if(r.error)throw r.error;
   await cargarPacientes();
   mensaje(archive?"✓ Ficha archivada sin borrar registros.":"✓ Ficha reactivada.");
 }
 async function abrirArchivo(path){
   await autorizado();
   const archivo=[...(st.registros.documentos||[]),...(st.registros.examenes||[])].find(x=>x.archivo_ruta===path&&String(x.paciente_id)===st.abierto);
   if(!archivo||!path.startsWith(st.abierto+"/"))throw Error("Archivo no registrado para este paciente.");
   const r=await db().storage.from(BUCKET).createSignedUrl(path,60);
   if(r.error||!r.data?.signedUrl)throw Error(r.error?.message||"No se pudo emitir acceso temporal.");
   if(window.RAIET_NATIVE?.openBrowser){await window.RAIET_NATIVE.openBrowser(r.data.signedUrl);return;}
   const win=window.open(r.data.signedUrl,"_blank","noopener,noreferrer");
   if(!win)mensaje("El navegador bloqueó la pestaña. Permite abrir ventanas emergentes para consultar el documento.",true);
 }
 async function realizarCita(id){
   await autorizado();
   const cita=(st.registros.citas||[]).find(x=>String(x.id)===id&&String(x.paciente_id)===st.abierto);
   if(!cita)throw Error("No se identificó la cita.");
   if(!confirm("¿Marcar la cita como realizada?"))return;
   const r=await db().from("pacientes_citas").update({realizado:true}).eq("id",id).select("id").single();
   if(r.error)throw r.error;
   await cargarDetalle(st.abierto);
 }
 async function click(ev){
   const b=ev.target.closest("[data-hc]");if(!b||st.ocupado)return;
   const act=b.dataset.hc,id=b.dataset.id;
   try{
     if(act==="nuevo"){st.editar=null;$("hc-form-wrap").innerHTML=formPaciente({nombre:""}).replace("Editar ficha del paciente","Nueva ficha clínica").replace("Guardar modificaciones","Crear historia clínica");$("hc-form-paciente").hidden=false;return;}
     if(act==="cancelar"){st.editar=null;$("hc-form-wrap").innerHTML=formPaciente(null);return;}
     if(act==="editar"){const p=st.pacientes.find(x=>String(x.id)===id);if(!p)return;st.editar=id;$("hc-form-wrap").innerHTML=formPaciente(p);$("hc-form-paciente").hidden=false;$("hc-form-paciente").scrollIntoView({behavior:"smooth",block:"start"});return;}
     if(act==="abrir"){
       st.abierto=st.abierto===id?null:id;st.tab="evoluciones";st.registros={};dibujar();
       if(st.abierto)await cargarDetalle(st.abierto);return;
     }
     if(act==="tab"){st.tab=b.dataset.tipo;dibujar();return;}
     st.ocupado=true;b.disabled=true;
     if(act==="archivar")await cambiarArchivo(id);
     if(act==="archivo")await abrirArchivo(b.dataset.ruta);
     if(act==="realizar")await realizarCita(id);
   }catch(e){mensaje(e.message||"No pudo completarse la acción.",true);}
   finally{st.ocupado=false;b.disabled=false;}
 }
 async function submit(ev){
   if(ev.target.id!=="hc-form-paciente"&&!ev.target.matches("form[data-hc-form]"))return;
   ev.preventDefault();
   if(st.ocupado)return;
   st.ocupado=true;
   const b=ev.target.querySelector('button[type="submit"]');if(b)b.disabled=true;
   try{
     if(ev.target.id==="hc-form-paciente")await guardarFicha(ev.target);
     else await guardarRegistro(ev.target,ev.target.dataset.hcForm);
   }catch(e){mensaje("No se guardó: "+(e.message||"error"),true);}
   finally{st.ocupado=false;if(b)b.disabled=false;}
 }
 window.cargarPacientes=cargarPacientes;
 window.renderPacientes=dibujar;
 window.dibujarPacientes=dibujar;
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
 else iniciar();
})();
