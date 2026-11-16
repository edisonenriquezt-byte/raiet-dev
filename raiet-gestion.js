/* RAIET ESABAS · Gestión personal, comercial y profesional (sin duplicar otros módulos). */
(function () {
"use strict";
var ID="4c2b8c98-200f-4307-8d7c-6d8742feb17a";
var T={tarea:"Tarea",oportunidad:"Oportunidad",nota:"Nota",recordatorio:"Recordatorio",compra:"Compra"};
var A={personal:"Personal",profesional:"Profesional"};
var E={pendiente:"Pendiente",en_gestion:"En gestión",completado:"Completada",descartado:"Descartada"};
var F={ninguna:"No repetir",diaria:"Diaria",semanal:"Semanal",mensual:"Mensual"};
var lista=[],historial=[],editando=null,cargando=false;
function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function sel(obj,v){return Object.keys(obj).map(function(k){return '<option value="'+k+'" '+(k===v?"selected":"")+'>'+esc(obj[k])+'</option>';}).join("");}
function fechaInput(d){if(!d)return"";var x=new Date(d),f=function(v){return String(v).padStart(2,"0");};return isNaN(+x)?"":x.getFullYear()+"-"+f(x.getMonth()+1)+"-"+f(x.getDate())+"T"+f(x.getHours())+":"+f(x.getMinutes());}
function fechaTxt(d){return d?new Date(d).toLocaleString("es-EC",{timeZone:"America/Guayaquil",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Sin fecha";}
function nota(t,err){var x=$("gestion-msg");if(x){x.textContent=t;x.style.color=err?"#fca5a5":"#86efac";}}
function boton(label,accion,id,p){return '<button type="button" class="'+(p?"btn btn-primary":"btn btn-secondary")+'" data-gm="'+accion+'" '+(id?'data-id="'+esc(id)+'"':"")+'>'+esc(label)+'</button>';}
function bloqueado(){return document.documentElement.classList.contains("raiet-bloqueado");}
async function auth(){
 if(bloqueado())throw Error("Inicia sesión en RAIET.");
 if(!navigator.onLine)throw Error("Sin conexión: no se han guardado cambios.");
 if(!window.db)throw Error("Supabase no está conectado.");
 var a=await window.db.auth.getUser();
 if(a.error||a.data?.user?.id!==ID)throw Error("Usuario no autorizado.");
 return a.data.user;
}
function vista(){
 if($("tab-gestion"))return;
 var agenda=$("tab-agenda"),nav=document.querySelector(".bottom-nav");
 if(!agenda||!nav)return;
 var css=document.createElement("style");
 css.textContent=[
 "#tab-gestion .gm-input{width:100%;background:#080e1b;color:#f8fafc;border:1px solid #334155;border-radius:7px;padding:10px;font:13px system-ui}",
 "#tab-gestion textarea.gm-input{min-height:75px;resize:vertical}",
 "#tab-gestion .gm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:9px 0}",
 "#tab-gestion label{font-size:12px;color:#cbd5e1;display:block;margin-top:8px}",
 "#tab-gestion label .gm-input{margin-top:5px}",
 "#tab-gestion .gm-card{border:1px solid #273950;border-left:3px solid #38bdf8;background:#101827;padding:12px;margin:10px 0;border-radius:9px;overflow-wrap:anywhere}",
 "#tab-gestion .gm-card.personal{border-left-color:#a78bfa}",
 "#tab-gestion .gm-meta{font-size:12px;color:#a7b3c5;white-space:pre-wrap;margin:6px 0;line-height:1.5}",
 "#tab-gestion .gm-tools{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0}",
 "#tab-gestion [hidden]{display:none!important}"
 ].join("\n");
 document.head.appendChild(css);
 var s=document.createElement("section");s.className="tab-content";s.id="tab-gestion";
 s.innerHTML=[
 '<div class="card"><h2 style="font-size:19px">🧭 Gestión</h2>',
 '<p class="gm-meta">Personal, tareas, compras, notas, seguimientos y oportunidades. Sin crear clientes ni duplicar pagos.</p>',
 '<div class="gm-tools">',boton("+ Registrar","nuevo",null,true),boton("↻ Actualizar","actualizar"),boton("📅 Agenda","agenda"),'</div>',
 '<div class="gm-grid">',
 '<label>Ámbito<select id="gm-ambito" class="gm-input"><option value="">Todos</option>',sel(A),'</select></label>',
 '<label>Tipo<select id="gm-tipo" class="gm-input"><option value="">Todos</option>',sel(T),'</select></label>',
 '<label>Estado<select id="gm-estado" class="gm-input"><option value="activos">Pendientes y en gestión</option><option value="">Todos</option>',sel(E),'</select></label>',
 '</div><input type="search" id="gm-buscar" class="gm-input" placeholder="Buscar anotaciones, oportunidades, compras…">',
 '<div id="gm-form" hidden></div><div id="gestion-msg" role="status" class="gm-meta"></div>',
 '<div id="gm-resumen" class="gm-meta"></div><div id="gm-lista"></div></div>'
 ].join("");
 agenda.parentNode.insertBefore(s,agenda);
 var b=document.createElement("button");b.id="nav-gestion";b.className="nav-btn";b.textContent="🧭 Gestión";b.type="button";
 nav.insertBefore(b,nav.children[1]||null);b.addEventListener("click",function(){abrir();});
 s.addEventListener("click",manejar);s.addEventListener("submit",guardarForm);
 ["gm-ambito","gm-tipo","gm-estado","gm-buscar"].forEach(function(id){$(id).addEventListener(id==="gm-buscar"?"input":"change",dibujar);});
}
function formulario(item){
 editando=item?.id||null;
 var d=$("gm-form");d.hidden=false;
 d.innerHTML=[
 '<form id="gm-edicion" class="gm-card"><h3>',item?"Editar anotación":"Registrar anotación",'</h3>',
 '<div class="gm-grid"><label>Ámbito<select class="gm-input" name="ambito">',sel(A,item?.ambito||"personal"),'</select></label>',
 '<label>Tipo<select class="gm-input" name="tipo">',sel(T,item?.tipo||"tarea"),'</select></label></div>',
 '<label>Título / actividad *<input required maxlength="220" name="titulo" class="gm-input" value="',esc(item?.titulo||""),'" placeholder="Ej.: Comprar frutas, llamar, enviar propuesta"></label>',
 '<div class="gm-grid"><label>Estado<select name="estado" class="gm-input">',sel(E,item?.estado||"pendiente"),'</select></label>',
 '<label>Prioridad<select name="prioridad" class="gm-input">',sel({baja:"Baja",normal:"Normal",alta:"Alta"},item?.prioridad||"normal"),'</select></label></div>',
 '<label>Notas / motivo / datos importantes<textarea name="detalle" class="gm-input">',esc(item?.detalle||""),'</textarea></label>',
 '<div class="gm-grid"><label>Contacto (opcional)<input class="gm-input" name="contacto" value="',esc(item?.contacto||""),'"></label>',
 '<label>Próxima acción<input class="gm-input" name="proxima_accion" value="',esc(item?.proxima_accion||""),'"></label></div>',
 '<div class="gm-grid"><label>Fecha (opcional)<input class="gm-input" name="fecha" type="datetime-local" value="',fechaInput(item?.fecha),'"></label>',
 '<label>Alarma (opcional)<input class="gm-input" name="fecha_alarma" type="datetime-local" value="',fechaInput(item?.fecha_alarma),'"></label>',
 '<label>Repetir<select class="gm-input" name="frecuencia">',sel(F,item?.frecuencia||"ninguna"),'</select></label></div>',
 '<p class="gm-meta">Si tiene fecha, aparece automáticamente en Agenda. Los eventos personales se muestran sin detalles sensibles.</p>',
 '<div class="gm-tools"><button type="submit" class="btn btn-primary">💾 Guardar</button>',boton("Cancelar","cancelar"),'</div></form>'
 ].join("");
 d.scrollIntoView({block:"nearest",behavior:"smooth"});
}
async function cargar(){
 if(cargando)return;
 cargando=true;
 try{
  await auth();nota("Cargando Gestión…");
  var res=await Promise.all([
   window.db.from("gestion_items").select("*").order("actualizado_el",{ascending:false}).limit(1000),
   window.db.from("gestion_historial").select("*").order("creado_el",{ascending:false}).limit(2000)
  ]);
  if(res[0].error)throw res[0].error;
  if(res[1].error)throw res[1].error;
  lista=res[0].data||[];historial=res[1].data||[];
  dibujar();nota("✓ "+lista.length+" anotaciones sincronizadas.");
 }catch(e){nota("No se pudo consultar Gestión: "+(e?.message||"error"),true);}
 finally{cargando=false;}
}
function dibujar(){
 var destino=$("gm-lista");if(!destino)return;
 var amb=$("gm-ambito").value,tipo=$("gm-tipo").value,est=$("gm-estado").value,bus=$("gm-buscar").value.toLowerCase().trim();
 var visibles=lista.filter(function(x){return (!amb||x.ambito===amb)&&(!tipo||x.tipo===tipo)&&(!est||(est==="activos"?["pendiente","en_gestion"].includes(x.estado):x.estado===est))&&(!bus||[x.titulo,x.detalle,x.contacto,x.proxima_accion].join(" ").toLowerCase().includes(bus));});
 $("gm-resumen").textContent=visibles.length+" visibles · "+lista.filter(x=>["pendiente","en_gestion"].includes(x.estado)).length+" pendientes/en gestión · "+lista.filter(x=>x.tipo==="oportunidad"&&x.estado!=="descartado").length+" oportunidades";
 destino.innerHTML=visibles.length?visibles.map(function(x){
  var hist=historial.filter(z=>z.gestion_id===x.id),vigente=["pendiente","en_gestion"].includes(x.estado);
  return [
   '<article class="gm-card ',esc(x.ambito),'"><b>',esc(x.titulo),'</b> <span class="gm-meta">',esc(E[x.estado]||x.estado),'</span>',
   '<p class="gm-meta">',esc(A[x.ambito]),' · ',esc(T[x.tipo]),' · ',esc(fechaTxt(x.fecha)),x.frecuencia!=="ninguna"?" · 🔁 "+esc(F[x.frecuencia]):"",' · ',esc(x.prioridad),'</p>',
   x.detalle?'<p class="gm-meta">📝 '+esc(x.detalle)+'</p>':"",
   x.contacto?'<p class="gm-meta">👤 '+esc(x.contacto)+'</p>':"",
   x.proxima_accion?'<p class="gm-meta">➜ '+esc(x.proxima_accion)+'</p>':"",
   '<div class="gm-tools">',boton("Editar","editar",x.id),
   vigente?boton("✓ Realizada","hecho",x.id):"",
   boton("+ Gestión realizada","anotar",x.id),boton("Historial ("+hist.length+")","historial",x.id),
   boton("Eliminar","eliminar",x.id),'</div>',
   '<div id="gm-h-',esc(x.id),'" class="gm-meta" hidden>',
   hist.slice(0,25).map(z=>'<div style="border-top:1px solid #334155;padding:7px 0">'+esc(new Date(z.creado_el).toLocaleString("es-EC",{timeZone:"America/Guayaquil"}))+" · "+esc(z.accion)+" · "+esc(z.detalle)+'</div>').join("")||"Sin historial",
   '</div><div id="gm-n-',esc(x.id),'" hidden></div></article>'
  ].join("");
 }).join(""):'<p class="gm-meta">No hay registros para este filtro. Pulsa + Registrar para crear uno.</p>';
}
async function guardarForm(e){
 if(e.target?.id==="gm-edicion"){
  e.preventDefault();e.stopPropagation();
  var b=e.target.querySelector('[type="submit"]');b.disabled=true;
  try{
   var user=await auth(),f=new FormData(e.target);
   if(f.get("fecha_alarma")&&!f.get("fecha"))throw Error("Una alarma necesita fecha de actividad.");
   var iso=v=>v?new Date(v).toISOString():null;
   var payload={propietario:user.id,ambito:f.get("ambito"),tipo:f.get("tipo"),titulo:String(f.get("titulo")||"").trim(),
     detalle:String(f.get("detalle")||"").trim(),contacto:String(f.get("contacto")||"").trim(),
     proxima_accion:String(f.get("proxima_accion")||"").trim(),estado:f.get("estado"),prioridad:f.get("prioridad"),
     frecuencia:f.get("frecuencia"),fecha:iso(f.get("fecha")),fecha_alarma:iso(f.get("fecha_alarma"))};
   if(!payload.titulo)throw Error("Escribe un título.");
   var q=editando?window.db.from("gestion_items").update(payload).eq("id",editando).eq("propietario",user.id):window.db.from("gestion_items").insert(payload);
   var result=await q.select("id").single();
   if(result.error)throw result.error;
   editando=null;$("gm-form").hidden=true;await cargar();
   if(typeof window.cargarAgenda==="function")window.cargarAgenda();
   nota("✓ Registro guardado. Agenda sincronizada si tiene fecha.");
  }catch(err){nota("No se confirmó el guardado: "+(err?.message||"error"),true);}
  finally{b.disabled=false;}
 }else if(e.target?.hasAttribute("data-gm-nota")){
  e.preventDefault();e.stopPropagation();
  var id=e.target.getAttribute("data-gm-nota"),bt=e.target.querySelector('[type="submit"]');
  var txt=String(new FormData(e.target).get("nota")||"").trim();
  if(!txt)return nota("Escribe la gestión realizada.",true);
  bt.disabled=true;
  try{
   var user2=await auth();
   var res=await window.db.from("gestion_historial").insert({gestion_id:id,propietario:user2.id,accion:"Gestión",detalle:txt}).select("id").single();
   if(res.error)throw res.error;
   await cargar();nota("✓ Gestión incorporada al historial.");
  }catch(er){nota("No se guardó la gestión: "+(er?.message||"error"),true);}
  finally{bt.disabled=false;}
 }
}
async function cambiar(id,accion){
 var x=lista.find(v=>v.id===id);if(!x)return;
 var confirmacion=accion==="hecho"?"¿Registrar esta actividad como realizada?"+(x.frecuencia!=="ninguna"?" Se programará su próxima repetición.":""):"¿Eliminar definitivamente este registro y su historial?";
 if(!confirm(confirmacion))return;
 try{
  var u=await auth(),q=accion==="hecho"
   ?window.db.from("gestion_items").update({estado:"completado"}).eq("id",id).eq("propietario",u.id)
   :window.db.from("gestion_items").delete().eq("id",id).eq("propietario",u.id);
  var r=await q.select("id").single();if(r.error)throw r.error;
  await cargar();if(typeof window.cargarAgenda==="function")window.cargarAgenda();
  nota("✓ Cambio confirmado.");
 }catch(e){nota("Operación no confirmada: "+(e?.message||"error"),true);}
}
function abrir(id){
 var btn=$("nav-gestion");
 if(typeof window.cambiarPestana==="function")window.cambiarPestana("gestion",btn);
 if($("view-desc"))$("view-desc").textContent="Gestión personal y profesional";
 if(id){
  $("gm-buscar").value="";$("gm-ambito").value="";$("gm-tipo").value="";$("gm-estado").value="";
  dibujar();
  var elegido=lista.find(x=>x.id===id);
  if(elegido){formulario(elegido);return;}
 }
 void cargar();
}
function manejar(e){
 var b=e.target.closest("[data-gm]");if(!b)return;
 e.preventDefault();
 var t=b.dataset.gm,id=b.dataset.id;
 if(t==="nuevo")formulario();
 else if(t==="cancelar"){$("gm-form").hidden=true;editando=null;}
 else if(t==="actualizar")void cargar();
 else if(t==="editar")formulario(lista.find(x=>x.id===id));
 else if(t==="hecho"||t==="eliminar")void cambiar(id,t);
 else if(t==="historial"){$("gm-h-"+id).hidden=!$("gm-h-"+id).hidden;}
 else if(t==="anotar"){
  var box=$("gm-n-"+id);box.hidden=false;
  box.innerHTML=['<form class="gm-card" data-gm-nota="',esc(id),'"><label>Seguimiento o gestión realizada<textarea class="gm-input" name="nota" required></textarea></label>',
  '<div class="gm-tools"><button class="btn btn-primary" type="submit">Guardar gestión</button>',boton("Cancelar","cancelarnota",id),'</div></form>'].join("");
 }else if(t==="cancelarnota")$("gm-n-"+id).hidden=true;
 else if(t==="agenda"){
  var ag=Array.from(document.querySelectorAll(".nav-btn")).find(x=>(x.getAttribute("onclick")||"").includes("'agenda'"));
  if(typeof window.cambiarPestana==="function")window.cambiarPestana("agenda",ag);
 }
}
function iniciar(){
 vista();
 var old=window.raietArrancar;
 if(typeof old==="function")window.raietArrancar=function(){old();void cargar();};
 new MutationObserver(function(){
  if(bloqueado()){
   lista=[];historial=[];editando=null;
   if($("gm-lista"))$("gm-lista").innerHTML="";
   if($("gm-form")){$("gm-form").innerHTML="";$("gm-form").hidden=true;}
  }
 }).observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
}
window.raietAbrirGestion=abrir;
window.raietGestionesCargar=cargar;
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
})();