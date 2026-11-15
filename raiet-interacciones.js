/* RAIET ESABAS: archivos Android, navegación Atrás, actualización deslizando. */
(function(){
"use strict";
var porFormulario = new WeakMap();
var historial = [];
var originalCambiar = null;
function bridge(){var b=window.RAIET_NATIVE;return b&&b.enabled?b:null;}
function permitido(){return !document.documentElement.classList.contains("raiet-bloqueado");}
window.esabasArchivoSeleccionado=function(form){
 if(!form)return null;
 var guardado=porFormulario.get(form);
 if(guardado)return guardado;
 var entrada=form.querySelector('input[type="file"][name="archivo"]');
 return entrada&&entrada.files&&entrada.files.length?entrada.files[0]:null;
};
function prepararEntradas(){
 var n=bridge();
 if(!n||!n.camera||!n.camera.getPhoto)return;
 document.querySelectorAll('form input[type="file"][name="archivo"]').forEach(function(input){
  if(input.dataset.raietFotoPreparada==="si")return;
  var form=input.closest("form");if(!form)return;
  input.dataset.raietFotoPreparada="si";
  var grupo=document.createElement("div");
  grupo.className="esabas-tools";
  var cam=document.createElement("button");cam.type="button";cam.className="btn btn-secondary";cam.textContent="📷 Tomar foto";cam.dataset.raietFoto="camara";
  var gal=document.createElement("button");gal.type="button";gal.className="btn btn-secondary";gal.textContent="🖼 Galería / capturas";gal.dataset.raietFoto="galeria";
  var aviso=document.createElement("span");aviso.className="esabas-mini";aviso.dataset.raietFotoEstado="1";aviso.setAttribute("role","status");
  grupo.append(cam,gal,aviso);
  input.insertAdjacentElement("afterend",grupo);
  input.addEventListener("change",function(){
   porFormulario.delete(form);
   aviso.textContent=input.files&&input.files[0]?"Elegido: "+input.files[0].name:"";
  });
 });
}
async function elegir(boton){
 if(!permitido())return;
 var n=bridge(),form=boton.closest("form");
 if(!n?.camera?.getPhoto||!form){window.alert("La cámara no está disponible.");return;}
 var estado=form.querySelector("[data-raiet-foto-estado]");
 var tipo=boton.dataset.raietFoto;
 boton.disabled=true;
 if(estado)estado.textContent=tipo==="camara"?"Abriendo cámara…":"Abriendo galería…";
 try{
  var foto=await n.camera.getPhoto({
   source:tipo==="camara"?n.cameraSource.Camera:n.cameraSource.Photos,
   resultType:n.cameraResultType.Uri,
   quality:86,correctOrientation:true,saveToGallery:false
  });
  if(!foto.webPath)throw new Error("Android no entregó la imagen.");
  var respuesta=await fetch(foto.webPath);
  if(!respuesta.ok)throw new Error("No se pudo leer la imagen seleccionada.");
  var blob=await respuesta.blob();
  if(!blob.size)throw new Error("El archivo está vacío.");
  var mime=blob.type&&blob.type.startsWith("image/")?blob.type:"image/jpeg";
  var ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";
  var archivo=new File([blob],"RAIET-"+(tipo==="camara"?"foto":"captura")+"-"+Date.now()+"."+ext,{type:mime,lastModified:Date.now()});
  porFormulario.set(form,archivo);
  var input=form.querySelector('input[type="file"][name="archivo"]');
  if(input){input.required=false;input.value="";}
  if(estado)estado.textContent="✓ "+archivo.name+" lista. Pulsa Guardar / Subir.";
 }catch(err){
  var cancelado=/cancel|cancelado|cancelled/i.test(err?.message||"");
  if(estado)estado.textContent=cancelado?"Selección cancelada.":"Error: "+(err?.message||"No se pudo seleccionar la imagen.");
  if(!cancelado)window.alert("No se pudo seleccionar la imagen: "+(err?.message||"error"));
 }finally{boton.disabled=false;}
}
document.addEventListener("click",function(e){
 var boton=e.target.closest("[data-raiet-foto]");if(!boton)return;
 e.preventDefault();e.stopPropagation();void elegir(boton);
},true);
function prepararAtras(){
 var n=bridge();
 if(!n?.app?.addListener)return;
 originalCambiar=window.cambiarPestana;
 if(typeof originalCambiar==="function"){
  window.cambiarPestana=function(tab,boton){
   var previo=document.querySelector(".tab-content.active");
   if(previo&&previo.id!=="tab-"+tab){
    historial.push(previo.id.slice(4));
    if(historial.length>20)historial.shift();
   }
   return originalCambiar(tab,boton);
  };
 }
 n.app.addListener("backButton",function(){
  // Evitar que Android cierre el WebView y obligue a volver a iniciar sesión.
  var visor=document.getElementById("esabas-visor-adjunto");
  if(visor){visor.remove();return;}
  var modales=document.querySelectorAll(".modal.active");
  if(modales.length){modales[modales.length-1].classList.remove("active");return;}
  var editor=document.querySelector("form[data-esabas-form-editar]");
  if(editor){editor.remove();return;}
  if(!permitido())return;
  var pestaña=document.querySelector(".tab-content.active");
  var estado=window.esabasState;
  if(pestaña?.id==="tab-clientes" && estado && (estado.asuntoId||estado.clienteId)){
   if(estado.asuntoId)estado.asuntoId=null;
   else estado.clienteId=null;
   if(typeof window.esabasCargarExpedientes==="function")void window.esabasCargarExpedientes();
   return;
  }
  while(historial.length){
   var tab=historial.pop();
   if(!document.getElementById("tab-"+tab))continue;
   var boton=Array.from(document.querySelectorAll(".nav-btn")).find(function(x){
    return tab==="clientes"?x.dataset.legal==="navegar":(x.getAttribute("onclick")||"").includes("'"+tab+"'");
   });
   if(originalCambiar)originalCambiar(tab,boton||null);
   return;
  }
  var clientes=document.getElementById("tab-clientes");
  if(clientes&&pestaña?.id!=="tab-clientes"&&originalCambiar)
    originalCambiar("clientes",document.querySelector('[data-legal="navegar"]'));
  // Pantalla principal: Atrás no cierra sesión ni la aplicación.
 }).catch(function(e){console.error("Atrás Android:",e);});
}
function prepararDeslizar(){
 if(!bridge())return;
 var inicio=null,actualizando=false;
 var aviso=document.createElement("div");
 aviso.setAttribute("role","status");
 aviso.style.cssText="position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483000;display:none;padding:10px 15px;background:#075985;color:white;border-radius:20px;font:13px Arial;box-shadow:0 3px 14px #0008";
 document.body.appendChild(aviso);
 document.addEventListener("touchstart",function(e){
  inicio=null;
  if(!permitido()||actualizando||e.touches.length!==1)return;
  if(document.scrollingElement&&document.scrollingElement.scrollTop>8)return;
  if(document.querySelector("#esabas-visor-adjunto,.modal.active"))return;
  if(e.target.closest("input,textarea,select,[contenteditable],.esabas-form"))return;
  inicio={x:e.touches[0].clientX,y:e.touches[0].clientY};
 },{passive:true});
 document.addEventListener("touchend",function(e){
  if(!inicio||!permitido()||actualizando||!e.changedTouches.length)return;
  var dy=e.changedTouches[0].clientY-inicio.y;
  var dx=Math.abs(e.changedTouches[0].clientX-inicio.x);
  inicio=null;
  if(dy<100||dx>70)return;
  actualizando=true;aviso.style.display="block";aviso.textContent="↻ Actualizando datos…";
  void (async function(){
   try{
    if(!navigator.onLine)throw new Error("Sin conexión a internet");
    if(typeof window.raietArrancar==="function")window.raietArrancar();
    if(typeof window.esabasCargarExpedientes==="function")await window.esabasCargarExpedientes();
    aviso.textContent="✓ Datos actualizados";
   }catch(e){aviso.textContent="No se pudo actualizar: "+(e?.message||"error");}
   finally{actualizando=false;setTimeout(function(){aviso.style.display="none";},1800);}
  })();
 },{passive:true});
}
function iniciar(){
 prepararEntradas();
 new MutationObserver(prepararEntradas).observe(document.body,{childList:true,subtree:true});
 prepararAtras();
 prepararDeslizar();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});
else iniciar();
})();