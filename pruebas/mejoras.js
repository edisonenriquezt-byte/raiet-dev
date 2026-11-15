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

function formatoAlarma(iso){
 if(!iso)return "";
 const d=new Date(iso);
 return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("es-EC",{
  timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hour12:false
 }).format(d);
}
function alarmaLocalInput(iso){
 if(!iso)return "";
 const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";
 const p=new Intl.DateTimeFormat("en-GB",{
  timeZone:"America/Guayaquil",year:"numeric",month:"2-digit",day:"2-digit",
  hour:"2-digit",minute:"2-digit",hourCycle:"h23"
 }).formatToParts(d);
 let partes={};p.forEach(function(z){partes[z.type]=z.value;});
 return partes.year+"-"+partes.month+"-"+partes.day+"T"+partes.hour+":"+partes.minute;
}
function alarmaAUTC(valor,proxima){
 if(!valor)return null;
 if(!proxima)throw new Error("Para programar una alarma debes indicar la próxima actuación o vencimiento.");
 if(valor.slice(0,10)>proxima)throw new Error("La alarma no puede ser posterior a la fecha de la próxima actuación o vencimiento.");
 const d=new Date(valor+":00-05:00");
 if(!Number.isFinite(d.getTime()))throw new Error("Fecha u hora de alarma inválida.");
 return d.toISOString();
}
window.esabasFormatoAlarma=formatoAlarma;
window.esabasAlarmFromUTC=alarmaLocalInput;
window.esabasAlarmToUTC=alarmaAUTC;

function diasHasta(x){
 return Math.round((Date.parse(String(x).slice(0,10)+"T12:00:00Z")-Date.parse(fechaEC()+"T12:00:00Z"))/86400000);
}
function alertasLegales(){
 var s=window.esabasState;
 if(!s||!Array.isArray(s.actuaciones)||document.documentElement.classList.contains("raiet-bloqueado"))return [];
 var alertasGenerales=s.actuaciones.filter(function(a){return a.proxima_fecha && a.estado_vencimiento!=="cumplido";}).map(function(a){
  var dias=diasHasta(a.proxima_fecha);if(!Number.isFinite(dias)||dias>7)return null;
  var asunto=s.asuntos.find(function(x){return String(x.id)===String(a.asunto_id);});
  var cliente=asunto?s.clientes.find(function(x){return String(x.id)===String(asunto.cliente_id);}):null;
  var prefijo=dias<0?"🚨 PLAZO VENCIDO hace "+Math.abs(dias)+" día(s)":dias===0?"🚨 VENCE HOY":dias===1?"⚠️ VENCE MAÑANA":dias<=3?"⏳ Vence en "+dias+" días":"📅 Aviso preventivo: faltan "+dias+" días";
  return {color:dias<=1?"#ef4444":dias<=3?"#f59e0b":"#38bdf8",texto:prefijo+": <b>"+safe(cliente&&cliente.nombre||"Cliente")+"</b> · "+safe(asunto&&asunto.titulo||"Asunto")+" · "+safe(a.tipo||"Actuación")+" ("+safe(a.proxima_fecha)+")"};
 }).filter(Boolean);
 var proximasAlarmas=s.actuaciones.filter(function(a){
  if(!a.fecha_alarma || a.estado_vencimiento==="cumplido")return false;
  var ms=new Date(a.fecha_alarma).getTime()-Date.now();
  return Number.isFinite(ms) && ms<=86400000 && ms>=-86400000;
 }).map(function(a){
  var asunto=s.asuntos.find(function(x){return String(x.id)===String(a.asunto_id);});
  var cliente=asunto?s.clientes.find(function(x){return String(x.id)===String(asunto.cliente_id);}):null;
  var ms=new Date(a.fecha_alarma).getTime()-Date.now();
  return {color:ms<=0?"#ef4444":"#f59e0b",texto:"🔔 "+
   (ms<=0?"Recordatorio activado":"Alarma programada")+
   ": <b>"+safe(cliente&&cliente.nombre||"Cliente")+"</b> · "+
   safe(asunto&&asunto.titulo||"Asunto")+" · "+safe(a.tipo)+
   " · "+safe(formatoAlarma(a.fecha_alarma))};
 });
 return alertasGenerales.concat(proximasAlarmas);
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
  if(a.fecha_alarma){var aviso=document.createElement("div");aviso.className="esabas-mini";aviso.style.color="#facc15";aviso.textContent="🔔 Recordatorio: "+formatoAlarma(a.fecha_alarma);card.insertBefore(aviso,estado.nextSibling);}
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
  formOptional("fecha_alarma","🔔 Recordatorio / alarma (fecha y hora, opcional)",alarmaLocalInput(a.fecha_alarma),"datetime-local")+
  '<p class="esabas-mini">Si la programas, RAIET enviará el recordatorio por el sistema de alarmas de la Agenda (Telegram), incluso con esta página cerrada.</p>'+
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
  var nombres={fecha_actuacion:"Fecha",tipo:"Tipo",descripcion:"Detalle",proxima_fecha:"Próxima actuación o vencimiento",estado_vencimiento:"Estado",fecha_alarma:"🔔 Recordatorio"};
  panel.innerHTML='<b>Registro de modificaciones ('+r.data.length+')</b>'+r.data.map(function(item){
   var old=item.datos_anteriores||{},nuevo=item.datos_nuevos||{};
   var dif=Object.keys(nombres).filter(function(k){return String(old[k]||"")!==String(nuevo[k]||"");}).map(function(k){
    return '<div style="margin:4px 0">'+safe(nombres[k])+': <span style="color:#fca5a5">'+safe(k==="fecha_alarma" ? formatoAlarma(old[k])||"—" : old[k]||"—")+
    '</span> → <span style="color:#86efac">'+safe(k==="fecha_alarma" ? formatoAlarma(nuevo[k])||"—" : nuevo[k]||"—")+'</span></div>';
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
 var alarmaTexto=String(datos.get("fecha_alarma")||"");
 var alarmaIso;
 try{
  alarmaIso=alarmaAUTC(alarmaTexto,prox);
  if(alarmaIso && Date.parse(alarmaIso)<=Date.now() && alarmaTexto!==alarmaLocalInput(previo.fecha_alarma))
   throw new Error("La alarma debe programarse para una fecha y hora futuras.");
 }catch(error){alert(error.message);return;}
 if(estado==="cumplido")alarmaIso=null;
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
   fecha_actuacion:fecha,tipo:tipo,descripcion:desc,proxima_fecha:prox||null,estado_vencimiento:estado,
   fecha_alarma:alarmaIso
  }).eq("id",aid).eq("asunto_id",previo.asunto_id).select().single();
  if(resp.error)throw resp.error;
  var adjunto=typeof window.esabasArchivoSeleccionado==="function" ? window.esabasArchivoSeleccionado(f) : datos.get("archivo");
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

async function comprimirImagen(file, opciones) {
  if (!file) throw new Error("No se seleccionó ningún archivo.");
  var salida = { archivo: file, nombreOriginal: file.name, bytesOriginales: file.size };
  var tipo = (file.type || "").toLowerCase();
  var extensionImagen = /\.(jpe?g|png|webp|heic|heif|avif|bmp|gif|tif|tiff|svg)$/i.test(file.name || "");
  var esImagen = tipo.startsWith("image/") || extensionImagen;
  if (!esImagen) return salida; // PDF, Word y otros documentos no se alteran.
  if (tipo === "image/svg+xml" || /\.svg$/i.test(file.name || "")) {
    throw new Error("Las imágenes SVG no se admiten como evidencia; utiliza JPG, PNG o WEBP.");
  }

  var url = null;
  try {
    url = URL.createObjectURL(file);
    var img = new Image();
    await new Promise(function(resolve, reject) {
      img.onload = resolve;
      img.onerror = function() { reject(new Error("No se puede abrir la fotografía. Conviértela a JPG o PNG antes de subirla.")); };
      img.src = url;
    });
    var ancho = img.naturalWidth, alto = img.naturalHeight;
    if (!ancho || !alto || ancho * alto > 75000000) {
      throw new Error("La fotografía tiene dimensiones inválidas o demasiado grandes.");
    }

    // Comprobantes: menor peso. Expedientes: más resolución para preservar texto.
    var comprobante = !!(opciones && opciones.perfil === "comprobante");
    var maxLado = comprobante ? 1450 : 1900;
    var objetivoBytes = comprobante ? 260000 : 500000;
    var escalas = [1, 0.87];
    var formatos = [
      { tipo: "image/webp", calidades: [0.76, 0.66, 0.60] },
      { tipo: "image/jpeg", calidades: [0.73, 0.64, 0.58] }
    ];
    var mejor = null;
    var archivoOriginalApto = /^(image\/jpeg|image\/png|image\/webp)$/i.test(tipo);
    if (archivoOriginalApto) {
      mejor = { archivo: file, bytes: file.size, original: true };
    }

    var tamañoBase = Math.min(1, maxLado / Math.max(ancho, alto));
    for (var i = 0; i < escalas.length; i++) {
      var factor = tamañoBase * escalas[i];
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(ancho * factor));
      canvas.height = Math.max(1, Math.round(alto * factor));
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("El dispositivo no permite comprimir imágenes.");
      ctx.fillStyle = "#ffffff"; // Fondo blanco para legibilidad y transparencia.
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (var f = 0; f < formatos.length; f++) {
        for (var k = 0; k < formatos[f].calidades.length; k++) {
          var mime = formatos[f].tipo;
          var quality = formatos[f].calidades[k];
          var blob = await new Promise(function(resolve) {
            canvas.toBlob(resolve, mime, quality);
          });
          if (!blob || blob.type !== mime) continue; // Codificador no compatible.
          if (!mejor || blob.size < mejor.bytes) {
            mejor = { archivo: blob, bytes: blob.size, original: false, mime: mime };
          }
        }
      }
      canvas.width = 0;
      canvas.height = 0;
      // Si alcanzamos un tamaño económico sin sacrificar más resolución, basta.
      if (mejor && mejor.bytes <= objetivoBytes) break;
    }

    if (!mejor || !mejor.archivo) {
      throw new Error("No fue posible optimizar esta imagen en tu dispositivo.");
    }
    if (mejor.original) return salida; // Ya ocupa menos que cualquier versión recomprimida.
    var nombre = (file.name || "imagen").replace(/\.[^.]*$/, "");
    var ext = mejor.mime === "image/webp" ? ".webp" : ".jpg";
    salida.archivo = new File([mejor.archivo], nombre + ext, {
      type: mejor.mime, lastModified: Date.now()
    });
    salida.bytesGuardados = salida.archivo.size;
    return salida;
  } catch (err) {
    // Sin guardar imágenes gigantes silenciosamente cuando falle la conversión.
    throw new Error(err && err.message ? err.message : "Error al comprimir la imagen.");
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
window.esabasComprimirImagen=comprimirImagen;
// Mantener las alertas al día mientras la aplicación está abierta.
if(typeof window.setInterval==="function"){
 window.setInterval(function(){
  if(!document.documentElement.classList.contains("raiet-bloqueado") && typeof window.actualizarPanelAlertas==="function")window.actualizarPanelAlertas();
 },120000);
}
document.addEventListener("visibilitychange",function(){
 if(!document.hidden && !document.documentElement.classList.contains("raiet-bloqueado") && typeof window.actualizarPanelAlertas==="function")window.actualizarPanelAlertas();
});
})();