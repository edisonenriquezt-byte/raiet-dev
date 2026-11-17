/* RAIET · Inventario PEPS y CPP ponderado sobre existencias. */
(function(){
"use strict";
const ADMIN="4c2b8c98-200f-4307-8d7c-6d8742feb17a";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const precio=v=>"$"+Number(v||0).toFixed(2);
let ocupada=false;
function mensaje(s,mal){const e=$("inv-raiet-mensaje");if(e){e.textContent=s;e.style.color=mal?"#fca5a5":"#86efac";}}
async function seguridad(){
 if(document.documentElement.classList.contains("raiet-bloqueado"))throw Error("Debes iniciar sesión.");
 if(!navigator.onLine)throw Error("Sin conexión: no se registró ninguna operación.");
 if(!window.db)throw Error("Supabase no está disponible.");
 const a=await window.db.auth.getUser();
 if(a.error||a.data?.user?.id!==ADMIN)throw Error("Usuario no autorizado.");
}

/* Vista operativa: una compra o venta se registra primero; el Kardex y stock reflejan el resultado. */
let vistaInventario="compras";
const detallesMovimientos=new Set();
function navegacionOperativa(){
 const area=$("tab-inventario"),controles=$("inv-raiet-contenedor");
 if(!area||!controles||$("inv-operativo-nav"))return;
 const crear=(tag,id,content)=>{const e=document.createElement(tag);e.id=id;if(content)e.innerHTML=content;return e;};
 const nav=crear("div","inv-operativo-nav",
  '<div style="font-size:12px;font-weight:800;color:#94a3b8;margin:4px 0 10px">OPERACIONES DE INVENTARIO</div>'+
  '<div class="inv-operativo-menu">'+
  '<button type="button" class="btn btn-secondary" data-inv-r="vista" data-vista="compras">🟢 Compras</button>'+
  '<button type="button" class="btn btn-secondary" data-inv-r="vista" data-vista="ventas">🔴 Ventas</button>'+
  '<button type="button" class="btn btn-secondary" data-inv-r="vista" data-vista="inventario">📦 Inventario</button>'+
  '<button type="button" class="btn btn-secondary" data-inv-r="vista" data-vista="transacciones">📒 Transacciones</button></div>');
 const compra=crear("div","inv-vista-compras",'<div class="card"><h3>🟢 Registrar compra de mercadería</h3>'+
  '<p class="inv-raiet-help">Selecciona un producto existente. Al confirmar, aumentará su stock y se recalcularán el costo y los precios.</p>'+
  '<div class="form-group"><label>Producto<select id="inv-operativo-producto-compra"></select></label></div>'+
  '<button class="btn btn-primary" type="button" data-inv-r="abrir-compra">＋ Nueva compra</button></div>');
 const venta=crear("div","inv-vista-ventas",'<div class="card"><h3>🔴 Registrar venta de mercadería</h3>'+
  '<p class="inv-raiet-help">Selecciona un producto con existencias. La venta descuenta stock por PEPS y mantiene el precio de la transacción.</p>'+
  '<div class="form-group"><label>Producto<select id="inv-operativo-producto-venta"></select></label></div>'+
  '<button class="btn btn-primary" type="button" data-inv-r="abrir-venta">− Nueva venta</button></div>');
 const inventario=crear("div","inv-vista-inventario");
 const transacciones=crear("div","inv-vista-transacciones",'<div id="inv-operativo-transacciones"></div>');
 const nota=controles.querySelector(".card:not([id])");
 const estado=$("inv-raiet-mensaje");
 const formularioVista=$("inv-raiet-formulario");
 const etiquetaArchivados=controles.querySelector("label");
 const creacion=area.querySelector(":scope > .card");
 const buscador=area.querySelector(":scope > .search-filter-box");
 const listado=$("lista-inventario");
 if(!creacion||!buscador||!listado||!formularioVista||!nota||!estado)throw Error("Estructura original de Inventario incompleta.");
 area.insertBefore(nav,area.firstChild);
 nav.after(nota);
 nota.after(estado);
 for(const item of [compra,venta,inventario,transacciones])area.appendChild(item);
 const detalle=crear("details","inv-operativo-nuevo-producto",'<summary style="cursor:pointer;font-weight:700;padding:12px 0">＋ Registrar producto nuevo / stock inicial</summary>');
 detalle.appendChild(creacion);inventario.appendChild(detalle);
 inventario.appendChild(buscador);
 if(etiquetaArchivados)inventario.appendChild(etiquetaArchivados);
 inventario.appendChild(listado);
 compra.appendChild(formularioVista);
 controles.remove();
 const estilos=document.createElement("style");
 estilos.textContent="#inv-operativo-nav{margin:12px 0} #inv-operativo-nav .inv-operativo-menu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px} #inv-operativo-nav button{white-space:nowrap;min-width:0;font-size:12px;padding:12px 7px} #inv-operativo-nav button.inv-activo{background:#2563eb;color:white;border-color:#2563eb} #inv-vista-compras[hidden],#inv-vista-ventas[hidden],#inv-vista-inventario[hidden],#inv-vista-transacciones[hidden]{display:none!important} #inv-operativo-nuevo-producto{margin-bottom:10px} #inv-operativo-transacciones .card{margin-bottom:8px} #inv-vista-compras .form-group,#inv-vista-ventas .form-group{margin:12px 0} #inv-vista-compras select,#inv-vista-ventas select{display:block;width:100%;padding:11px;margin-top:6px;border:1px solid #334155;background:#101827;color:#f8fafc;border-radius:8px}";
 document.head.appendChild(estilos);
 mostrarVistaInventario(vistaInventario);
}
function mostrarVistaInventario(vista){
 if(!["compras","ventas","inventario","transacciones"].includes(vista))return;
 vistaInventario=vista;
 for(const v of ["compras","ventas","inventario","transacciones"]){
  const panel=$("inv-vista-"+v);if(panel)panel.hidden=v!==vista;
 }
 for(const boton of document.querySelectorAll("#inv-operativo-nav [data-inv-r='vista']")){
  const marcado=boton.dataset.vista===vista;
  boton.classList.toggle("inv-activo",marcado);
  boton.setAttribute("aria-pressed",String(marcado));
 }
 panelCerrar();
 if(vista==="transacciones")renderTransaccionesInventario();
}
function actualizarOpcionesInventario(){
 for(const tipo of ["compra","venta"]){
  const el=$("inv-operativo-producto-"+tipo);if(!el)continue;
  const anterior=el.value;
  const productos=(window.cacheInv||[]).filter(p=>p.activo!==false);
  el.innerHTML='<option value="">— Selecciona un producto —</option>'+
   productos.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.codigo)+' · '+esc(p.nombre)+
   ' (stock '+esc(p.stock)+')</option>').join("");
  if(productos.some(p=>String(p.id)===String(anterior)))el.value=anterior;
 }
}
function renderTransaccionesInventario(){
 const cont=$("inv-operativo-transacciones");if(!cont)return;
 const items=[];
 for(const p of window.cacheInv||[]){
  for(const m of p.inventario_movimientos||[])items.push({p,m});
 }
 items.sort((a,b)=>Number(b.m.orden_fifo||0)-Number(a.m.orden_fifo||0));
 if(!items.length){cont.innerHTML='<div class="card"><p>Sin transacciones registradas. Crea una compra para comenzar.</p></div>';return;}
 const activos=items.filter(x=>!x.m.anulado);
 const entradas=activos.filter(x=>x.m.tipo==="compra").length;
 const salidas=activos.filter(x=>x.m.tipo==="venta").length;
 cont.innerHTML='<div class="card"><h3>Historial de entradas y salidas</h3>'+
  '<p class="inv-raiet-help">'+entradas+' compras · '+salidas+' ventas · '+(items.length-activos.length)+' anulaciones. Pulsa una operación para consultar sus detalles; la X la anula sin eliminarla del historial.</p></div>'+
  items.map(({p,m})=>{
   const entrada=m.tipo==="compra",anulada=!!m.anulado,abierto=detallesMovimientos.has(String(m.id));
   const tipo=entrada?"Compra / entrada":"Venta / salida";
   return '<div class="card'+(anulada?" inv-raiet-void":"")+'">'+
    '<div class="inv-raiet-trans-header">'+
    '<button type="button" class="inv-raiet-detalle" data-inv-r="detalle" data-mov="'+esc(m.id)+'" aria-expanded="'+(abierto?"true":"false")+'" title="Consultar datos de esta transacción">'+
    '<strong>'+(entrada?"🟢 ":"🔴 ")+tipo+' · '+esc(p.codigo)+' · '+esc(p.nombre)+'</strong>'+
    (anulada?' <b>(ANULADA)</b>':"")+' <span aria-hidden="true">'+(abierto?"▲":"▼")+'</span></button>'+
    (anulada?"":'<button type="button" class="inv-raiet-x" data-inv-r="anular" data-mov="'+esc(m.id)+'" title="Anular esta '+(entrada?"compra":"venta")+'" aria-label="Anular '+(entrada?"compra":"venta")+' de '+esc(m.cantidad)+' unidades de '+esc(p.nombre)+'">×</button>')+
    '</div>'+
    '<p class="inv-raiet-help">'+esc(m.fecha||"")+' · '+
    'Movimiento: <b>'+(entrada?"+":"−")+esc(m.cantidad)+' unidades</b> · '+
    (entrada?"Costo de compra":"Precio de venta")+": "+precio(m.precio_unitario)+
    ' · Total: '+precio(m.total)+'</p>'+
    '<p class="inv-raiet-help">Inventario actual de este producto: <b>'+esc(p.stock)+
    ' unidades</b> · CPP restante: '+precio(p.costo_promedio)+
    ' · PVP mayor: '+precio(p.precio_mayor)+' · PVP unidad: '+precio(p.precio_unidad)+'</p>'+
    (abierto?'<div class="inv-raiet-trans-detalle"><p><b>Operación:</b> '+tipo+' · <b>Estado:</b> '+(anulada?"ANULADA":"Vigente")+'</p>'+
      '<p><b>Producto:</b> '+esc(p.codigo)+' · '+esc(p.nombre)+'</p>'+
      '<p><b>Fecha:</b> '+esc(m.fecha||"No indicada")+' · <b>Cantidad:</b> '+esc(m.cantidad)+' unidades</p>'+
      '<p><b>'+(entrada?"Costo unitario":"Precio de venta unitario")+
      ':</b> '+precio(m.precio_unitario)+' · <b>Total:</b> '+precio(m.total)+'</p>'+
      (entrada?"":'<p><b>Modalidad:</b> '+esc(m.tipo_precio==="mayor"?"Mayorista":"Por unidad")+' · <b>Costo de salida PEPS:</b> '+precio(m.costo_salida)+'</p>')+
      '<p><b>Observación:</b> '+esc(m.detalle||"Sin observaciones")+'</p>'+
      (m.foto_url?'<button type="button" class="thumb-btn" data-inv-r="foto" data-mov="'+esc(m.id)+'">🧾 Ver comprobante</button>':"")+
      '<p class="inv-raiet-help">Referencia del movimiento: '+esc(m.id)+'</p></div>':"")+
    '</div>';
  }).join("");
}
function montaje(){
 const seccion=$("tab-inventario");
 if(!seccion||$("inv-raiet-contenedor"))return;
 const div=document.createElement("div");
 div.id="inv-raiet-contenedor";
 div.innerHTML='<div class="card" style="margin:10px 0;padding:13px 16px"><strong>Precios configurados para demostración</strong>'+
 '<p style="margin:6px 0 0;line-height:1.55;font-size:13px;color:#cbd5e1"><b>Mayorista: costo +15 %</b> · <b>Unidad: costo +35 %</b>. Son porcentajes ilustrativos, ajustables según las necesidades y políticas comerciales de cada cliente.</p></div>'+
 '<div id="inv-raiet-mensaje" role="status" style="font-size:12px;margin:10px 0;white-space:pre-wrap"></div>'+
 '<div class="card" id="inv-raiet-formulario" hidden></div>'+
 '<label style="display:flex;gap:8px;align-items:center;font-size:12px;color:#94a3b8;margin:12px 0"><input type="checkbox" id="inv-raiet-archivados"> Mostrar archivados</label>';
 const lista=$("lista-inventario");
 if(lista)lista.parentNode.insertBefore(div,lista);else seccion.appendChild(div);
 const css=document.createElement("style");
 css.textContent="#inv-raiet-formulario[hidden]{display:none!important} #inv-raiet-formulario .form-group{margin:10px 0} #inv-raiet-formulario input,#inv-raiet-formulario select,#inv-raiet-formulario textarea{display:block;width:100%;padding:10px;margin-top:5px;background:#101827;border:1px solid #334155;border-radius:7px;color:#f8fafc} #tab-inventario .inv-raiet-btns{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0} #tab-inventario .inv-raiet-help{font-size:12px;color:#a7b3c5;margin:7px 0;line-height:1.5} #tab-inventario .inv-raiet-void{opacity:.52} #inv-operativo-transacciones .inv-raiet-trans-header{display:flex;align-items:center;gap:8px} #inv-operativo-transacciones .inv-raiet-detalle{flex:1;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:0;background:transparent;color:inherit;cursor:pointer;padding:5px 0;min-width:0;font:inherit} #inv-operativo-transacciones .inv-raiet-x{width:36px;height:36px;flex-shrink:0;border-radius:8px;border:1px solid #ef4444;color:#fecaca;background:#451a1a;cursor:pointer;font-size:25px;font-weight:700;line-height:1} #inv-operativo-transacciones .inv-raiet-trans-detalle{border-top:1px solid #334155;padding:12px 0 2px;margin-top:10px;font-size:13px;overflow-wrap:anywhere} #inv-operativo-transacciones .inv-raiet-trans-detalle p{margin:5px 0;line-height:1.55}";
 document.head.appendChild(css);
 seccion.addEventListener("click",clicks);
 seccion.addEventListener("submit",submit);
 $("inv-raiet-archivados").addEventListener("change",()=>window.dibujarInventario());
 navegacionOperativa();
}
async function foto(campo){
 const file=campo?.files?.[0];
 if(!file)return null;
 if(typeof window.esabasComprimirImagen!=="function")throw Error("El compresor no cargó. La imagen no se subió.");
 const resultado=await window.esabasComprimirImagen(file,{perfil:"comprobante"});
 return new Promise((ok,fail)=>{const lector=new FileReader();
 lector.onerror=()=>fail(Error("No se pudo leer la foto."));
 lector.onload=()=>typeof lector.result==="string"&&lector.result.startsWith("data:image/")?ok(lector.result):fail(Error("Imagen no válida."));
 lector.readAsDataURL(resultado.archivo);
 });
}
async function escribir(nombre,args){
 if(ocupada)throw Error("Hay una operación en curso.");
 ocupada=true;
 try{
  await seguridad();
  const r=await window.db.rpc(nombre,args);
  if(r.error)throw Error(r.error.message);
  if(r.data==null)throw Error("El servidor no confirmó la operación. Revisa el Kardex antes de repetirla.");
  await window.cargarInventario();
  return r.data;
 }finally{ocupada=false;}
}
function tarjetaMovimientos(p){
 const movimientos=(p.inventario_movimientos||[]).slice().sort((a,b)=>Number(b.orden_fifo)-Number(a.orden_fifo));
 if(!movimientos.length)return '<p class="inv-raiet-help">Sin movimientos.</p>';
 return movimientos.map(m=>{
  const compra=m.tipo==="compra",anulado=!!m.anulado;
  return '<div class="ledger-item '+(anulado?"inv-raiet-void":"")+'"><div class="det"><b>'+
   (compra?"🟢 Entrada":"🔴 Salida")+' · '+esc(m.cantidad)+' unds · '+precio(m.precio_unitario)+' / unidad'+
   (anulado?" · ANULADO":"")+'</b>'+
   '<span class="inv-raiet-help">'+esc(m.fecha||"")+' · Total '+precio(m.total)+
   (compra?" de compra":" de venta")+'</span>'+
   (compra?"":'<span class="inv-raiet-help">Costo PEPS de salida: '+precio(m.costo_salida)+'</span>')+
   (m.detalle?'<span class="inv-raiet-help">'+esc(m.detalle)+'</span>':"")+
   (m.foto_url?'<button type="button" class="thumb-btn" data-inv-r="foto" data-mov="'+esc(m.id)+'">🧾 Comprobante</button>':"")+
   '</div><div class="actions">'+(anulado?"":'<button type="button" class="btn btn-secondary" data-inv-r="anular" data-mov="'+esc(m.id)+'">Anular</button>')+'</div></div>';
 }).join("");
}
window.dibujarInventario=function(){
 montaje();
 const cont=$("lista-inventario");if(!cont)return;
 const q=($("buscar-inv")?.value||"").toLowerCase().trim();
 const archivados=!!$("inv-raiet-archivados")?.checked;
 const prods=(window.cacheInv||[]).filter(p=>(archivados||p.activo!==false)&&
  (!q||String(p.codigo).toLowerCase().includes(q)||String(p.nombre).toLowerCase().includes(q)));
 if(!prods.length){cont.innerHTML='<div class="card">No hay productos para mostrar.</div>';return;}
 cont.innerHTML=prods.map(p=>{
  const open=(window.invAbiertos||[]).includes(String(p.id)),sinStock=Number(p.stock)<=0,arch=p.activo===false;
  return '<div class="acc-card card-inv"><div class="acc-header" data-inv-r="toggle" data-id="'+esc(p.id)+'">'+
   '<div><div class="acc-title">'+esc(p.codigo)+' · '+esc(p.nombre)+(arch?" (archivado)":"")+'</div>'+
   '<div class="acc-sub">Stock: <b>'+esc(p.stock)+'</b> unds · CPP restante: <b>'+precio(p.costo_promedio)+'</b></div></div>'+
   '<span class="badge '+(sinStock?"badge-mora":"badge-done")+'">'+(arch?"Archivado":sinStock?"Agotado":"En stock")+'</span>'+
   '<span>'+ (open?"▲":"▼")+'</span></div>'+
   '<div class="acc-body '+(open?"open":"")+'"><div class="saldo-box">'+
   '<div><span>Costo ponderado de existencias</span><strong>'+precio(p.costo_promedio)+'</strong></div>'+
   '<div><span>Mayor (+15 %)</span><strong>'+precio(p.precio_mayor)+'</strong></div>'+
   '<div><span>Unidad (+35 %)</span><strong>'+precio(p.precio_unidad)+'</strong></div></div>'+
   '<p class="inv-raiet-help">PEPS: salen primero las unidades antiguas. Los precios se calculan según el promedio ponderado del stock que queda. <b>Los recargos +15 % y +35 % son demostrativos:</b> se pueden personalizar para cada cliente.</p>'+
   (p.foto_url?'<div class="inv-raiet-btns"><button type="button" class="thumb-btn" data-inv-r="foto-producto" data-id="'+esc(p.id)+'">📷 Foto</button></div>':"")+
   '<div class="inv-raiet-btns">'+(arch?'<button type="button" class="btn btn-secondary" data-inv-r="reactivar" data-id="'+esc(p.id)+'">Reactivar</button>':
    '<button type="button" class="btn btn-primary" data-inv-r="compra" data-id="'+esc(p.id)+'">＋ Compra</button>'+
    '<button type="button" class="btn btn-secondary" data-inv-r="venta" data-id="'+esc(p.id)+'">− Venta</button>'+
    '<button type="button" class="btn btn-secondary" data-inv-r="archivar" data-id="'+esc(p.id)+'">Archivar</button>')+
   '</div><div class="ledger-section"><div class="ledger-title">📒 Kardex · '+(p.inventario_movimientos||[]).length+' registros</div>'+
    tarjetaMovimientos(p)+'</div></div></div>';
 }).join("");
 actualizarOpcionesInventario();
 if(vistaInventario==="transacciones")renderTransaccionesInventario();
};
window.renderInventario=window.dibujarInventario;
window.cargarInventario=async function(){
 montaje();
 if(!navigator.onLine){mensaje("Sin conexión: solo lectura de datos del dispositivo; no se pueden registrar movimientos.",true);window.dibujarInventario();return;}
 if(!window.db||document.documentElement.classList.contains("raiet-bloqueado"))return;
 try{
  const r=await window.db.from("inventario_productos").select("*, inventario_movimientos(*)").order("creado_el",{ascending:false});
  if(r.error)throw r.error;
  window.cacheInv=r.data||[];
  if(typeof window.guardarMemoriaLocal==="function")window.guardarMemoriaLocal();
  window.dibujarInventario();
  mensaje("✓ Datos de Inventario sincronizados.");
 }catch(e){mensaje("No se pudo sincronizar Inventario: "+(e?.message||"error"),true);}
};
window.guardarProductoInventario=async function(){
 if(ocupada)return;
 const codigo=$("inv-codigo")?.value?.trim(),nombre=$("inv-nombre")?.value?.trim();
 const cantidad=Number($("inv-stock")?.value),costo=Number($("inv-costo")?.value);
 if(!codigo||!nombre||!Number.isFinite(cantidad)||cantidad<0||!Number.isFinite(costo)||costo<=0){
  alert("Código, nombre, cantidad inicial (0 o más) y costo mayor que cero son obligatorios.");return;
 }
 try{
  await seguridad();
  const f=await foto($("inv-foto"));
  await escribir("raiet_inventario_crear_producto",{p_codigo:codigo,p_nombre:nombre,p_cantidad:cantidad,p_costo:costo,p_foto:f});
  ["inv-codigo","inv-nombre","inv-stock","inv-costo","inv-foto"].forEach(id=>{if($(id))$(id).value="";});
  mensaje("✓ Producto creado y stock inicial registrado en Kardex.");
 }catch(e){mensaje("No se guardó el producto: "+(e?.message||"error"),true);alert("No se guardó el producto: "+(e?.message||"error"));}
};
function formulario(id,tipo){
 const p=(window.cacheInv||[]).find(x=>String(x.id)===String(id));
 if(!p||p.activo===false)return mensaje("Producto no disponible.",true);
 const panel=$("inv-raiet-formulario");
 const destino=$("inv-vista-"+(tipo==="compra"?"compras":"ventas"));
 if(destino&&panel.parentNode!==destino)destino.appendChild(panel);
 panel.hidden=false;
 panel.innerHTML='<form id="inv-raiet-operacion" data-id="'+esc(id)+'" data-tipo="'+tipo+'">'+
 '<h3>'+(tipo==="compra"?"🟢 Registrar compra":"🔴 Registrar venta")+' · '+esc(p.nombre)+'</h3>'+
 '<p class="inv-raiet-help">Stock: '+esc(p.stock)+' · CPP: '+precio(p.costo_promedio)+'</p>'+
 '<div class="form-group"><label>Cantidad<input name="cantidad" type="number" step="any" min="0.0001" required></label></div>'+
 (tipo==="compra"?'<div class="form-group"><label>Costo unitario de compra<input name="costo" type="number" step="0.0001" min="0.0001" required></label></div>':
 '<div class="form-group"><label>Precio de venta<select name="tipo_precio"><option value="unidad">Unidad: '+precio(p.precio_unidad)+' (+35 %)</option><option value="mayor">Mayor: '+precio(p.precio_mayor)+' (+15 %)</option></select></label></div>')+
 '<div class="form-group"><label>Detalle / factura / observación<textarea name="detalle" maxlength="1200"></textarea></label></div>'+
 '<div class="form-group"><label>Comprobante (opcional)<input name="foto" type="file" accept="image/*"></label></div>'+
 '<div class="inv-raiet-btns"><button class="btn btn-primary" type="submit">Guardar en Kardex</button>'+
 '<button type="button" class="btn btn-secondary" data-inv-r="cancelar">Cancelar</button></div></form>';
 panel.scrollIntoView({block:"start",behavior:"smooth"});
}
async function submit(e){
 if(e.target?.id!=="inv-raiet-operacion")return;
 e.preventDefault();e.stopPropagation();
 if(ocupada)return;
 const form=e.target,b=form.querySelector('[type="submit"]'),datos=new FormData(form);
 const qty=Number(datos.get("cantidad")),tipo=form.dataset.tipo,costo=Number(datos.get("costo"));
 if(!Number.isFinite(qty)||qty<=0||(tipo==="compra"&&(!Number.isFinite(costo)||costo<=0))){
  mensaje("Cantidad o costo no válido.",true);return;
 }
 b.disabled=true;
 try{
  await seguridad();
  const f=await foto(form.querySelector('input[name="foto"]'));
  const result=await escribir("raiet_inventario_registrar_movimiento",{
   p_producto:form.dataset.id,p_tipo:tipo,p_cantidad:qty,
   p_costo:tipo==="compra"?costo:null,p_tipo_precio:String(datos.get("tipo_precio")||"unidad"),
   p_detalle:String(datos.get("detalle")||""),p_foto:f
  });
  panelCerrar();
  mensaje("✓ "+(tipo==="compra"?"Compra":"Venta")+" confirmada. Stock: "+result.stock+
   " unds · CPP restante: "+precio(result.costo_promedio)+
   " · PVP unidad: "+precio(result.precio_unidad)+".");
 }catch(err){mensaje("No se confirmó el movimiento: "+(err?.message||"error"),true);}
 finally{b.disabled=false;}
}
function panelCerrar(){const p=$("inv-raiet-formulario");if(p){p.innerHTML="";p.hidden=true;}}
async function anular(id){
 const encontrado=(window.cacheInv||[]).flatMap(p=>(p.inventario_movimientos||[]).map(m=>({p,m}))).find(x=>String(x.m.id)===String(id));
 if(!encontrado){mensaje("No se encontró el movimiento. Actualiza el inventario.",true);return;}
 if(encontrado.m.anulado){mensaje("Este movimiento ya está anulado.",true);return;}
 const {p,m}=encontrado;
 const descripcion=(m.tipo==="compra"?"COMPRA":"VENTA")+" de "+m.cantidad+" unidades de "+p.nombre+" por "+precio(m.total);
 if(!confirm("¿Anular la "+descripcion+"?\n\nSe recalcularán las existencias, el CPP y los precios. El movimiento permanecerá visible como ANULADO. Si una compra respalda ventas posteriores, RAIET rechazará la anulación."))return;
 try{await escribir("raiet_inventario_anular_movimiento",{p_movimiento:id});mensaje("✓ Movimiento anulado, con historial conservado.");}
 catch(e){mensaje("No se pudo anular: "+(e?.message||"error"),true);}
}
async function archivar(id,arch){
 if(arch&&!confirm("¿Archivar producto? Se conservarán el stock y todos los movimientos."))return;
 try{await escribir("raiet_inventario_archivar",{p_producto:id,p_archivar:arch});mensaje(arch?"✓ Producto archivado.":"✓ Producto reactivado.");}
 catch(e){mensaje("No se pudo cambiar el estado: "+(e?.message||"error"),true);}
}
window.borrarProducto=function(id){void archivar(id,true);};
window.borrarMovimientoInventario=function(id,mov){void anular(mov);};
function clicks(e){
 const b=e.target?.closest?.("[data-inv-r]");if(!b)return;
 e.preventDefault();e.stopPropagation();
 const a=b.dataset.invR,id=b.dataset.id;
 if(a==="vista"){
  mostrarVistaInventario(b.dataset.vista);
 }else if(a==="abrir-compra"||a==="abrir-venta"){
  const tipo=a==="abrir-compra"?"compra":"venta";
  const selector=$("inv-operativo-producto-"+tipo);
  if(!selector||!selector.value){mensaje("Selecciona un producto. Si es nuevo, créalo primero desde Inventario.",true);return;}
  formulario(selector.value,tipo);
 }else if(a==="detalle"){
  const mid=String(b.dataset.mov||"");
  if(detallesMovimientos.has(mid))detallesMovimientos.delete(mid);else detallesMovimientos.add(mid);
  renderTransaccionesInventario();
 }else if(a==="toggle"){
  const v=window.invAbiertos||[],i=v.indexOf(String(id));if(i>=0)v.splice(i,1);else v.push(String(id));
  window.invAbiertos=v;window.dibujarInventario();
 }else if(a==="compra"||a==="venta")formulario(id,a);
 else if(a==="cancelar")panelCerrar();
 else if(a==="anular")void anular(b.dataset.mov);
 else if(a==="archivar"||a==="reactivar")void archivar(id,a==="archivar");
 else if(a==="foto-producto"){
  const p=(window.cacheInv||[]).find(x=>String(x.id)===String(id));
  if(p?.foto_url&&window.abrirVisor)window.abrirVisor(p.foto_url);
 }else if(a==="foto"){
  const m=(window.cacheInv||[]).flatMap(x=>x.inventario_movimientos||[]).find(x=>String(x.id)===String(b.dataset.mov));
  if(m?.foto_url&&window.abrirVisor)window.abrirVisor(m.foto_url);
 }
}
function iniciar(){montaje();window.dibujarInventario();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();
})();