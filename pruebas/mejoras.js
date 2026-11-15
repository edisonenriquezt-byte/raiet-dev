/* RAIET ESABAS - Mejoras de actuaciones, alertas e imágenes */
(function(){
"use strict";
var ADMIN="4c2b8c98-200f-4307-8d7c-6d8742feb17a";
var $=function(id){return document.getElementById(id);};
function safe(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function fechaEC(){
 var p=new Intl.DateTimeFormat("en-US",{timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 var m={};p.forEach(function(x){m[x.type]=x.value;});return m.year+"-"+m.month+"-"+m.day;
}
function diasHasta(x){
 return Math.round((Date.parse(String(x).slice(0,10)+"T12:00:00Z")-Date.parse(fechaEC()+"T12:00:00Z"))/86400000);
}
function alertasLegales(){
 var s=window.esabasState;
 if(!s||!Array.isArray(s.actuaciones)||document.documentElement.classList.contains("raiet-bloqueado"))return [];
 return s.actuaciones.filter(function(a){return a.proxima_fecha && a.estado_vencimiento!=="cumplido";}).map(function(a){
  var dias=diasHasta(a.proxima_fecha);if(!Number.isFinite(dias)||dias>7)return null;
  var asunto=s.asuntos.find(function(x){return String(x.id)===String(a.asunto_id);});
  var cliente=asunto?s.clientes.find(function(x){return String(x.id)===String(asunto.cliente_id);}):null;
  var prefijo=dias<0?"🚨 PLAZO VENCIDO hace "+Math.abs(dias)+" día(s)":dias===0?"🚨 VENCE HOY":dias===1?"⚠️ VENCE MAÑANA":dias<=3?"⏳ Vence en "+dias+" días":"📅 Aviso preventivo: faltan "+dias+" días";
  return {color:dias<=1?"#ef4444":dias<=3?"#f59e0b":"#38bdf8",texto:prefijo+": <b>"+safe(cliente&&cliente.nombre||"Cliente")+"</b> · "+safe(asunto&&asunto.titulo||"Asunto")+" · "+safe(a.tipo||"Actuación")+" ("+safe(a.proxima_fecha)+")"};
 }).filter(Boolean);
}
window.esabasAlertasPlazos=alertasLegales;
function formInput(name,label,value,tipo){
 return '<label>'+safe(label)+'<input name="'+safe(name)+'" type="'+(tipo||"text")+'" value="'+safe(value||"")+'" required></label>';
}
function formOptional(name,label,value,tipo){
 return '<label>'+safe(label)+'<input name="'+safe(name)+'" type="'+(tipo||"text")+'" value="'+safe(value||"")+'"></label>';
}
function estadoTexto(v){return v==="cumplido"?"Cumplido":v==="reprogramado"?"Reprogramado":"Pendiente";}
function decorar(){
 var state=window.esabasState;if(!state||!Array.isArray(state.actuaciones))return;
 document.querySelectorAll("#esabas-detalle-asunto .esabas-tramite[data-actuacion-id]").forEach(function(card){
  var aid=card.dataset.actuacionId;
  if(card.querySelector("[data-esabas-editar]"))return;
  var a=state.actuaciones.find(function(x){return String(x.id)===aid;});if(!a)return;
  var barra=document.createElement("div");barra.className="esabas-tools";
  barra.innerHTML='<button type="button" class="btn btn-primary" data-esabas-editar="'+safe(aid)+'">✏️ Editar actuación</button>'+
   '<button type="button" class="btn btn-secondary" data-esabas-historial="'+safe(aid)+'">Historial de cambios</button>';
  card.appendChild(barra);
  var estado=document.createElement("div");estado.className="esabas-mini";
  estado.style.marginTop="7px";
  estado.textContent="Estado del vencimiento: "+estadoTexto(a.estado_vencimiento);
  if(a.estado_vencimiento==="cumplido")estado.style.color="#86efac";
  else if(a.proxima_fecha && diasHasta(a.proxima_fecha)<0)estado.style.color="#fca5a5";
  card.insertBefore(estado,card.firstChild.nextSibling);
  var archivos=state.adjuntos.filter(function(z){return String(z.actuacion_id)===aid;});
  archivos.forEach(function(z){
   var b=card.querySelector('[data-legal="abrir-adjunto"][data-id="'+z.id+'"]');
   if(b && z.bytes_originales && z.bytes_guardados && z.bytes_guardados<z.bytes_originales){
    var porcentaje=Math.round((1-z.bytes_guardados/z.bytes_originales)*100);
    b.title="Fotografía optimizada. Ahorro de espacio: "+porcentaje+"%";
    var info=document.createElement("span");info.className="esabas-mini";info.style.marginLeft="6px";
    info.textContent="📦 -"+porcentaje+"%";b.after(info);
   }
  });
 });
}
window.esabasDecorate=decorar;

function abrirEditor(aid){
 var s=window.esabasState, a=s&&s.actuaciones.find(function(x){return String(x.id)===String(aid);});
 var card=document.querySelector('#esabas-detalle-asunto [data-actuacion-id="'+aid+'"]');
 if(!a||!card)return;
 document.querySelectorAll("[data-esabas-form-editar]").forEach(function(x){x.remove();});
 var f=document.createElement("form");f.className="esabas-form";f.dataset.esabasFormEditar=aid;
 f.innerHTML='<h3>Editar actuación registrada</h3>'+
  '<div class="esabas-cols">'+formInput("fecha_actuacion","Fecha de actuación",a.fecha_actuacion,"date")+
  formInput("tipo","Tipo de actuación",a.tipo,"text")+'</div>'+
  '<label>Detalle de lo realizado<textarea name="descripcion" required>'+safe(a.descripcion||"")+'</textarea></label>'+
  formOptional("proxima_fecha","Próxima actuación o vencimiento",a.proxima_fecha,"date")+
  '<label>Estado del vencimiento<select name="estado_vencimiento">'+
  ["pendiente","reprogramado","cumplido"].map(function(v){return '<option value="'+v+'"'+((a.estado_vencimiento||"pendiente")===v?" selected":"")+'>'+estadoTexto(v)+'</option>';}).join("")+
  '</select></label>'+
  '<label>Adjuntar otra fotografía o documento (opcional)<input type="file" name="archivo" accept="image/*,.pdf,.doc,.docx,.txt"></label>'+
  '<p class="esabas-advertencia">⚠️ Al guardar, se registrará el cambio en el historial y se actualizará automáticamente la Agenda y sus alertas. Los adjuntos anteriores se conservarán.</p>'+
  '<div data-esabas-estado role="status" class="esabas-mini"></div>'+
  '<div class="esabas-tools"><button class="btn btn-primary" type="submit">Confirmar cambios</button>'+
  '<button class="btn btn-secondary" type="button" data-esabas-cancelar="1">Cancelar</button></div>';
 card.appendChild(f);f.scrollIntoView({behavior:"smooth",block:"nearest"});
}
async function verHistorial(aid){
 var card=document.querySelector('#esabas-detalle-asunto [data-actuacion-id="'+aid+'"]');if(!card)return;
 var actual=card.querySelector(".esabas-historial");if(actual){actual.remove();return;}
 var panel=document.createElement("div");panel.className="esabas-historial esabas-form esabas-mini";
 panel.textContent="Consultando cambios…";card.appendChild(panel);
 try{
  var r=await window.db.from("actuaciones_cambios").select("modificado_el,datos_anteriores,datos_nuevos").eq("actuacion_id",aid).order("modificado_el",{ascending:false});
  if(r.error)throw r.error;
  if(!r.data.length){panel.textContent="No existen modificaciones anteriores.";return;}
  var nombres={fecha_actuacion:"Fecha",tipo:"Tipo",descripcion:"Detalle",proxima_fecha:"Próxima actuación o vencimiento",estado_vencimiento:"Estado"};
  panel.innerHTML='<b>Registro de modificaciones ('+r.data.length+')</b>'+r.data.map(function(item){
   var old=item.datos_anteriores||{},nuevo=item.datos_nuevos||{};
   var dif=Object.keys(nombres).filter(function(k){return String(old[k]||"")!==String(nuevo[k]||"");}).map(function(k){
    return '<div style="margin:4px 0">'+safe(nombres[k])+': <span style="color:#fca5a5">'+safe(old[k]||"—")+
    '</span> → <span style="color:#86efac">'+safe(nuevo[k]||"—")+'</span></div>';
   }).join("");
   var f=new Date(item.modificado_el);
   return '<div style="padding:9px 0;border-top:1px solid #334155"><b>'+safe(f.toLocaleString("es-EC"))+'</b>'+dif+'</div>';
  }).join("");
 }catch(e){panel.textContent="No se pudo leer el historial: "+e.message;}
}
async function guardarEdicion(e){
 var f=e.target.closest("form[data-esabas-form-editar]");if(!f)return;
 e.preventDefault();e.stopPropagation();
 var aid=f.dataset.esabasFormEditar, s=window.esabasState;
 var previo=s&&s.actuaciones.find(function(x){return String(x.id)===aid;});
 if(!previo)return;
 var datos=new FormData(f), fecha=String(datos.get("fecha_actuacion")||""), tipo=String(datos.get("tipo")||"").trim();
 var desc=String(datos.get("descripcion")||"").trim(), prox=String(datos.get("proxima_fecha")||"");
 var estado=String(datos.get("estado_vencimiento")||"pendiente");
 if(!fecha||!tipo||!desc){alert("Completa la fecha, el tipo y la descripción.");return;}
 if(prox && previo.proxima_fecha && prox!==previo.proxima_fecha && estado==="pendiente")estado="reprogramado";
 if(estado==="reprogramado" && !prox){alert("Para reprogramar debes indicar una nueva fecha.");return;}
 if(!window.confirm("¿CONFIRMAS LA MODIFICACIÓN?\n\nSe guardará el historial de cambios y se actualizarán la Agenda y las alertas de este asunto."))return;
 var btn=f.querySelector("[type=submit]"),aviso=f.querySelector("[data-esabas-estado]");btn.disabled=true;
 aviso.textContent="Guardando cambios…";
 try{
  var au=await window.db.auth.getUser();
  if(au.error || !au.data.user || au.data.user.id!==ADMIN)throw new Error("Sesión no autorizada.");
  var resp=await window.db.from("actuaciones").update({
   fecha_actuacion:fecha,tipo:tipo,descripcion:desc,proxima_fecha:prox||null,estado_vencimiento:estado
  }).eq("id",aid).eq("asunto_id",previo.asunto_id).select().single();
  if(resp.error)throw resp.error;
  var adjunto=datos.get("archivo");
  if(adjunto && adjunto.size && typeof window.esabasSubirAdjunto==="function"){
   aviso.textContent="Actuación actualizada. Comprimiendo y subiendo adjunto…";
   await window.esabasSubirAdjunto(aid,adjunto);
  }
  await window.esabasCargarExpedientes();
  if(typeof window.cargarAgenda==="function")await window.cargarAgenda();
  if($("esabas-mensaje")){$("esabas-mensaje").textContent="Actuación actualizada; Agenda y alertas sincronizadas."; $("esabas-mensaje").style.color="#86efac";}
 }catch(err){
  aviso.textContent="Error: "+err.message;
  aviso.style.color="#fca5a5";
 }finally{btn.disabled=false;}
}
document.addEventListener("submit",guardarEdicion,true);
document.addEventListener("click",function(e){
 var b=e.target.closest("[data-esabas-editar], [data-esabas-historial], [data-esabas-cancelar]");
 if(!b)return;
 if(b.dataset.esabasEditar)abrirEditor(b.dataset.esabasEditar);
 else if(b.dataset.esabasHistorial)verHistorial(b.dataset.esabasHistorial);
 else if(b.dataset.esabasCancelar){var form=b.closest("form[data-esabas-form-editar]");if(form)form.remove();}
});

async function comprimirImagen(file){
 var salida={archivo:file,nombreOriginal:file.name,bytesOriginales:file.size};
 if(!file || !file.type || !file.type.startsWith("image/") || file.type==="image/svg+xml")return salida;
 var objUrl=null;
 try{
  objUrl=URL.createObjectURL(file);
  var img=new Image();
  await new Promise(function(resolve,reject){img.onload=resolve;img.onerror=reject;img.src=objUrl;});
  var max=1600,escala=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
  var canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*escala));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*escala));
  var ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Canvas no disponible");
  ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  var blob=await new Promise(function(resolve){canvas.toBlob(resolve,"image/jpeg",0.77);});
  if(!blob)throw new Error("No se pudo comprimir");
  if(blob.size>850000){
   var segundo=await new Promise(function(resolve){canvas.toBlob(resolve,"image/jpeg",0.61);});
   if(segundo && segundo.size<blob.size)blob=segundo;
  }
  if(blob.size>=file.size)return salida;
  var name=(file.name||"foto").replace(/\.[^.]*$/,"")+".jpg";
  salida.archivo=new File([blob],name,{type:"image/jpeg",lastModified:Date.now()});
  return salida;
 }catch(err){console.warn("No se pudo optimizar esta foto; se utilizará el original.",err);return salida;}
 finally{if(objUrl)URL.revokeObjectURL(objUrl);}
}
window.esabasComprimirImagen=comprimirImagen;
})();