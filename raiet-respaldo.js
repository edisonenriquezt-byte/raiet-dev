/* RAIET ESABAS — Copia cifrada local y comprobación de lectura.
   Los datos nunca se almacenan en GitHub ni se transmiten a un tercero. */
(function() {
"use strict";
const TABLAS = [
 "acreedores","actuaciones","actuaciones_adjuntos","actuaciones_cambios",
 "agenda","asuntos","clientes","cobros_abonos","cobros_cargos","compromisos_pago",
 "inventario_movimientos","inventario_productos","movimientos_financieros_cambios",
 "pacientes","pacientes_evoluciones","pacientes_examenes","pacientes_recetas",
 "pagos_abonos","pagos_cargos"
];
const UID_ADMIN="4c2b8c98-200f-4307-8d7c-6d8742feb17a";
const PROYECTO="fwkdtcecdwxezzkphxiv";
const BUCKET="esabas-actuaciones";
const FORMATO="RAIET-ESABAS-RESPALDO-CIFRADO-1";
const VUELTAS=310000;
const bytesA64=bytes=>{
 let resultado="";
 for(let i=0;i<bytes.length;i+=16384)
   resultado+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return btoa(resultado);
};
function a64Bytes(base64){
 const bin=atob(base64);
 const b=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);
 return b;
}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");}
async function sha256(bytes){
 return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)));
}
async function verificarAcceso() {
 if(!navigator.onLine)throw new Error("Para generar el respaldo necesitas conexión a Supabase.");
 if(document.documentElement.classList.contains("raiet-bloqueado"))
   throw new Error("Primero debes acceder a RAIET.");
 if(!window.crypto?.subtle || !window.crypto?.getRandomValues)
   throw new Error("Este navegador no ofrece cifrado seguro WebCrypto.");
 const cliente=window.db;
 if(!cliente)throw new Error("Supabase no está disponible.");
 const r=await cliente.auth.getUser();
 if(r.error || r.data?.user?.id!==UID_ADMIN)
   throw new Error("No hay una sesión autorizada para respaldar expedientes.");
 return cliente;
}
async function obtenerDatos(client,status){
 const tablas={};
 let totalFilas=0;
 for(let i=0;i<TABLAS.length;i++){
   const tabla=TABLAS[i], filas=[];
   status("Leyendo tablas "+(i+1)+"/"+TABLAS.length+": "+tabla);
   for(let desde=0;desde<100000;desde+=500) {
     const resp=await client.from(tabla).select("*").order("id",{ascending:true}).range(desde,desde+499);
     if(resp.error)throw new Error("No se pudo respaldar "+tabla+": "+resp.error.message);
     const chunk=resp.data||[];
     filas.push(...chunk);
     if(chunk.length<500)break;
     if(desde>=99500)throw new Error("Demasiados registros en "+tabla+". No se generó un respaldo parcial.");
   }
   tablas[tabla]=filas;totalFilas+=filas.length;
 }
 const referencias=tablas.actuaciones_adjuntos||[];
 const archivos=[];
 for(let i=0;i<referencias.length;i++){
   const ref=referencias[i];
   status("Copiando documentos privados "+(i+1)+"/"+referencias.length);
   if(!ref.ruta_storage)throw new Error("Adjunto sin ruta en Supabase.");
   const r=await client.storage.from(BUCKET).download(ref.ruta_storage);
   if(r.error || !r.data)throw new Error("No se pudo respaldar «"+(ref.nombre_archivo||"adjunto")+"»: "+(r.error?.message||"sin contenido"));
   const bytes=new Uint8Array(await r.data.arrayBuffer());
   if(!bytes.length)throw new Error("Documento vacío en Storage: "+(ref.nombre_archivo||"adjunto"));
   archivos.push({
     ruta:ref.ruta_storage,
     mime:ref.tipo_archivo||"application/octet-stream",
     tamano:bytes.length,
     sha256:await sha256(bytes),
     contenido:bytesA64(bytes)
   });
 }
 return {
   formato:"RAIET-ESABAS-DATOS-1",proyecto:PROYECTO,creado:new Date().toISOString(),
   totalFilas,tablas,archivos,
   nota:"Copia lógica de datos de usuario y adjuntos privados. No incluye cuentas de Auth ni configuración interna de Supabase."
 };
}
async function comprimir(bytes) {
 if(typeof CompressionStream!=="function")return {bytes,metodo:"sin-compresion"};
 const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
 return {bytes:new Uint8Array(await new Response(stream).arrayBuffer()),metodo:"gzip"};
}
async function descomprimir(bytes,metodo){
 if(metodo==="sin-compresion")return bytes;
 if(metodo!=="gzip"||typeof DecompressionStream!=="function")
   throw new Error("Este navegador no puede descomprimir este respaldo GZIP.");
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function derivar(clave,sal){
 const material=await crypto.subtle.importKey(
   "raw",new TextEncoder().encode(clave),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey(
   {name:"PBKDF2",salt:sal,iterations:VUELTAS,hash:"SHA-256"},material,
   {name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function cifrar(payload,clave,status){
 const json=new TextEncoder().encode(JSON.stringify(payload));
 status("Comprimiendo y cifrando la copia de seguridad…");
 const comprimido=await comprimir(json);
 const sal=crypto.getRandomValues(new Uint8Array(16));
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const llave=await derivar(clave,sal);
 const datos=new Uint8Array(await crypto.subtle.encrypt(
   {name:"AES-GCM",iv},llave,comprimido.bytes));
 return {
  formato:FORMATO,cifrado:"AES-256-GCM",derivacion:"PBKDF2-SHA256",iteraciones:VUELTAS,
  compresion:comprimido.metodo,sal:bytesA64(sal),iv:bytesA64(iv),datos:bytesA64(datos)
 };
}
async function descifrar(contenido,clave){
 let env;
 try{env=JSON.parse(contenido);}catch(_){throw new Error("El archivo no contiene un respaldo RAIET válido.");}
 if(env.formato!==FORMATO || env.cifrado!=="AES-256-GCM" || env.iteraciones!==VUELTAS)
   throw new Error("Formato o parámetros del respaldo no reconocidos.");
 let bytes;
 try{
   const key=await derivar(clave,a64Bytes(env.sal));
   bytes=new Uint8Array(await crypto.subtle.decrypt(
     {name:"AES-GCM",iv:a64Bytes(env.iv)},key,a64Bytes(env.datos)));
 }catch(_){throw new Error("Contraseña incorrecta o respaldo dañado (falló la autenticación del cifrado).");}
 let payload;
 try{payload=JSON.parse(new TextDecoder().decode(await descomprimir(bytes,env.compresion)));}
 catch(_){throw new Error("El respaldo se descifró pero su contenido está dañado.");}
 if(payload.formato!=="RAIET-ESABAS-DATOS-1" || payload.proyecto!==PROYECTO)
   throw new Error("Este archivo no contiene los datos del proyecto RAIET.");
 if(!payload.tablas || TABLAS.some(t=>!Array.isArray(payload.tablas[t])))
   throw new Error("El respaldo no contiene las 19 tablas esperadas.");
 let filas=0;
 for(const t of TABLAS)filas+=payload.tablas[t].length;
 if(filas!==payload.totalFilas)throw new Error("No coincide el conteo de registros.");
 if(!Array.isArray(payload.archivos) || payload.archivos.length!==payload.tablas.actuaciones_adjuntos.length)
   throw new Error("Faltan documentos privados en el respaldo.");
 for(const f of payload.archivos){
   const blob=a64Bytes(f.contenido);
   if(blob.byteLength!==f.tamano || await sha256(blob)!==f.sha256)
     throw new Error("Error de integridad en un adjunto del respaldo.");
 }
 return {filas,archivos:payload.archivos.length,fecha:payload.creado};
}
function descargarArchivo(env){
 const blob=new Blob([JSON.stringify(env)],{type:"application/octet-stream"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");
 link.href=url;
 link.download="RAIET-ESABAS-RESPALDO-"+new Date().toISOString().slice(0,10)+".raietbak";
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function iniciar(){
 if(window.RAIET_NATIVE?.enabled)return; // Respaldo externo desde navegador/PC.
 const marca=document.querySelector("header.brand-header");
 if(!marca)return;
 const boton=document.createElement("button");
 boton.type="button";boton.id="raiet-respaldo";
 boton.textContent="🔐 Respaldo";
 boton.title="Crear o verificar una copia cifrada de datos y adjuntos";
 boton.style.cssText="display:block;margin:4px 12px 14px auto;padding:9px 14px;color:#fff;background:#1e3a5f;border:1px solid #60a5fa;border-radius:8px;cursor:pointer;font:12px Arial";
 marca.insertAdjacentElement("afterend",boton);
 const css=document.createElement("style");
 css.textContent="html.raiet-bloqueado #raiet-respaldo{display:none!important}";
 document.head.appendChild(css);
 boton.addEventListener("click",abrirDialogo);
}
function abrirDialogo(){
 document.getElementById("raiet-respaldo-dialogo")?.remove();
 const cubre=document.createElement("div");
 cubre.id="raiet-respaldo-dialogo";
 cubre.setAttribute("role","dialog");cubre.setAttribute("aria-modal","true");
 cubre.style.cssText="position:fixed;inset:0;z-index:2147483500;background:#000d;padding:20px;display:flex;align-items:center;justify-content:center;overflow:auto";
 const panel=document.createElement("div");
 panel.style.cssText="width:100%;max-width:520px;padding:18px;background:#101827;border:1px solid #64748b;border-radius:12px;color:#fff;line-height:1.5;font:14px Arial";
 const titulo=document.createElement("h3");titulo.textContent="Respaldo cifrado de RAIET";
 const ayuda=document.createElement("p");
 ayuda.textContent="Copia las 19 tablas y los documentos jurídicos privados. Guárdala FUERA de Supabase. La contraseña no se almacena; perderla impide recuperar la copia.";
 ayuda.style.cssText="margin:12px 0;color:#cbd5e1";
 const clave=document.createElement("input");
 clave.type="password";clave.placeholder="Contraseña para el respaldo (mínimo 12 caracteres)";clave.autocomplete="new-password";clave.style.cssText="width:100%;padding:12px;margin:8px 0;background:#111e32;color:white;border:1px solid #64748b;border-radius:8px";
 const repetir=document.createElement("input");
 repetir.type="password";repetir.placeholder="Repite la contraseña (para crear copia)";repetir.autocomplete="new-password";repetir.style.cssText=clave.style.cssText;
 const estado=document.createElement("p");
 estado.setAttribute("role","status");
 estado.style.cssText="white-space:pre-wrap;color:#93c5fd;overflow-wrap:anywhere;margin:10px 0";
 const archivo=document.createElement("input");
 archivo.type="file";archivo.accept=".raietbak";archivo.style.cssText="display:block;width:100%;margin:10px 0";
 const acciones=document.createElement("div");
 acciones.style.cssText="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px";
 const botonAccion=(texto)=>{
  const b=document.createElement("button");
  b.type="button";b.textContent=texto;
  b.style.cssText="padding:11px;background:#1d4ed8;color:white;border:0;border-radius:8px;cursor:pointer";
  acciones.appendChild(b);return b;
 };
 const generar=botonAccion("Crear y descargar copia");
 const verificar=botonAccion("Verificar archivo cifrado");
 const cerrar=botonAccion("Cerrar");
 cerrar.style.background="#334155";
 const decir=txt=>estado.textContent=txt;
 let ocupado=false;
 async function ejecutar(fn){
  if(ocupado)return;
  ocupado=true;generar.disabled=true;verificar.disabled=true;
  try{await fn();}
  catch(error){decir("Error: "+(error?.message||"No fue posible completar la operación."));}
  finally{clave.value="";repetir.value="";ocupado=false;generar.disabled=false;verificar.disabled=false;}
 }
 generar.addEventListener("click",()=>ejecutar(async()=>{
  if(clave.value.length<12)throw new Error("Usa al menos 12 caracteres.");
  if(clave.value!==repetir.value)throw new Error("Las contraseñas no coinciden.");
  const pass=clave.value;
  const cliente=await verificarAcceso();
  const datos=await obtenerDatos(cliente,decir);
  const cifrado=await cifrar(datos,pass,decir);
  // Validación inmediata del cifrado antes de ofrecer la descarga.
  const prueba=await descifrar(JSON.stringify(cifrado),pass);
  descargarArchivo(cifrado);
  decir("✓ Copia cifrada generada y comprobada: "+prueba.filas+" registros, "+prueba.archivos+" adjuntos. Verifica que el archivo se descargó y guárdalo fuera de Supabase.");
 }));
 verificar.addEventListener("click",()=>ejecutar(async()=>{
  if(!archivo.files?.[0])throw new Error("Selecciona primero tu archivo .raietbak.");
  if(!clave.value)throw new Error("Introduce la contraseña del respaldo.");
  if(!window.crypto?.subtle)throw new Error("Este navegador no permite descifrar archivos.");
  decir("Comprobando el archivo, contraseña e integridad de documentos…");
  const res=await descifrar(await archivo.files[0].text(),clave.value);
  decir("✓ RESPALDO VÁLIDO: "+res.filas+" registros, "+res.archivos+" adjuntos. Fecha: "+res.fecha+". No se modificó la base de datos.");
 }));
 cerrar.addEventListener("click",()=>{if(!ocupado)cubre.remove();});
 cubre.addEventListener("click",e=>{if(e.target===cubre&&!ocupado)cubre.remove();});
 panel.append(titulo,ayuda,clave,repetir,archivo,acciones,estado);
 cubre.appendChild(panel);document.body.appendChild(cubre);
 clave.focus();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
})();
