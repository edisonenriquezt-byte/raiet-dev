/* RAIET ESABAS: edición segura y trazabilidad de cobros/pagos */
(function () {
  "use strict";
  const ADMIN = "4c2b8c98-200f-4307-8d7c-6d8742feb17a";
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const valor = n => "$" + Number(n || 0).toFixed(2);
  const areaNombre = tipo => tipo === "cobro" ? "abono recibido" : "pago realizado";
  const fechaHora = v => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v || "") :
      d.toLocaleString("es-EC", {timeZone:"America/Guayaquil", year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  };
  function encontrar(tipo, id) {
    const cuentas = tipo === "cobro" ? window.cacheCobros : window.cachePagos;
    const lista = tipo === "cobro" ? "cobros_abonos" : "pagos_abonos";
    const cargos = tipo === "cobro" ? "cobros_cargos" : "pagos_cargos";
    if (!Array.isArray(cuentas)) return null;
    for (const cuenta of cuentas) {
      const movimiento = (cuenta[lista] || []).find(x => String(x.id) === String(id));
      if (movimiento) {
        const cargo = (cuenta[cargos] || []).find(x => String(x.id) === String(movimiento.cargo_id));
        return {movimiento, cuenta, cargo};
      }
    }
    return null;
  }
  function dialogo() {
    let root = $("esabas-finanzas-dialogo");
    if (root) return root;
    root = document.createElement("div");
    root.id = "esabas-finanzas-dialogo";
    root.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.83);z-index:10000;overflow:auto;padding:14px;box-sizing:border-box;align-items:center;justify-content:center";
    root.innerHTML = '<div role="dialog" aria-modal="true" aria-label="Editar movimiento financiero" style="background:#111827;color:#f8fafc;border:1px solid #334155;border-radius:15px;padding:18px;width:min(100%,500px);max-height:93vh;overflow:auto;box-sizing:border-box" id="esabas-finanzas-dialogo-caja"></div>';
    document.body.appendChild(root);
    root.addEventListener("click", ev => {if (ev.target === root) cerrar();});
    return root;
  }
  function cerrar() {
    const root = $("esabas-finanzas-dialogo");
    if (root) root.style.display = "none";
  }
  function mostrar(html) {
    const root = dialogo();
    $("esabas-finanzas-dialogo-caja").innerHTML = html;
    root.style.display = "flex";
  }
  function campo(name, texto, dato, tipo = "text", extra = "") {
    return '<label style="display:block;margin:11px 0;color:#cbd5e1;font-size:13px;font-weight:600">' + esc(texto) +
      '<input name="' + esc(name) + '" type="' + tipo + '" value="' + esc(dato) +
      '" ' + extra + ' style="box-sizing:border-box;display:block;width:100%;font:inherit;font-weight:400;margin-top:5px;padding:10px;border-radius:8px;border:1px solid #475569;background:#090e1b;color:white"></label>';
  }
  function verificarSesion() {
    if (!navigator.onLine) throw new Error("Necesitas conexión a internet para editar. No se modificó ningún registro.");
    if (!window.db) throw new Error("Supabase no está disponible.");
  }
  function abrirEditar(area, id) {
    const ctx = encontrar(area, id);
    if (!ctx) return alert("No se encontró el movimiento. Actualiza el módulo.");
    if (String(id).startsWith("loc_")) return alert("Este movimiento todavía figura como local. Actualiza el módulo para confirmar que se guardó en Supabase.");
    const m = ctx.movimiento;
    mostrar('<h3 style="margin:0 0 10px">✏️ Editar ' + esc(areaNombre(area)) + '</h3>' +
      '<div style="font-size:13px;color:#94a3b8;margin-bottom:8px">' + esc(ctx.cuenta.nombre) +
      ' · ' + esc(ctx.cargo ? ctx.cargo.concepto : "Sin obligación asociada") + '</div>' +
      '<div style="font-size:12px;color:#fbbf24;border:1px solid #b45309;padding:10px;border-radius:8px;margin-bottom:12px">' +
        '⚠️ Atención: modificar este movimiento recalcula saldos, estado de la obligación y cuotas vinculadas. Se conservará un historial permanente con el motivo y los valores anteriores. La imputación a otra obligación no se cambia desde este formulario.' +
      '</div>' +
      '<form id="esabas-finanzas-form">' +
      campo("monto", "Monto (USD) *", Number(m.monto).toFixed(2), "number", 'required min="0.01" max="999999999" step="0.01"') +
      campo("fecha", "Fecha del movimiento *", m.fecha || "", "date", "required") +
      campo("tipo", "Forma de pago *", m.tipo || (area === "cobro" ? "Abono" : "Pago"), "text", 'required maxlength="100"') +
      '<label style="display:block;color:#cbd5e1;font-size:13px;font-weight:600">Observación<textarea name="nota" maxlength="2000" style="box-sizing:border-box;display:block;width:100%;min-height:66px;background:#090e1b;border:1px solid #475569;border-radius:8px;padding:10px;margin-top:5px;color:white">' + esc(m.nota || "") + '</textarea></label>' +
      '<label style="display:block;color:#fbbf24;font-size:13px;font-weight:600;margin-top:12px">Motivo de la modificación *<textarea name="motivo" required minlength="4" maxlength="300" placeholder="Ej.: importe mal ingresado; corrección por comprobante bancario" style="box-sizing:border-box;display:block;width:100%;min-height:64px;background:#090e1b;border:1px solid #d97706;border-radius:8px;padding:10px;margin-top:5px;color:white"></textarea></label>' +
      '<div id="esabas-finanzas-respuesta" role="status" style="color:#fca5a5;font-size:12px;margin:9px 0"></div>' +
      '<div style="display:flex;gap:8px;margin-top:15px"><button type="submit" class="btn btn-primary" style="flex:1">Guardar modificación</button>' +
      '<button type="button" class="btn btn-secondary" data-fin-cerrar="1">Cancelar</button></div></form>');
    const form = $("esabas-finanzas-form");
    form.addEventListener("submit", e => guardarEdicion(e, area, id, {
      monto: Number(m.monto), fecha: m.fecha
    }));
  }
  async function guardarEdicion(evento, area, id, antes) {
    evento.preventDefault();
    const form = evento.currentTarget, datos = new FormData(form), button = form.querySelector('[type="submit"]'), respuesta = $("esabas-finanzas-respuesta");
    const monto = Number(datos.get("monto"));
    const fecha = String(datos.get("fecha") || "");
    const tipo = String(datos.get("tipo") || "").trim();
    const nota = String(datos.get("nota") || "").trim();
    const motivo = String(datos.get("motivo") || "").trim();
    if (!Number.isFinite(monto) || monto <= 0 || monto > 999999999 || Math.round(monto*100)/100 !== monto) {
      respuesta.textContent = "El monto debe ser positivo y tener máximo dos decimales."; return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !tipo || motivo.length < 4) {
      respuesta.textContent = "Completa correctamente la fecha, forma de pago y motivo."; return;
    }
    const aviso = '¿Confirmas que deseas modificar este ' + areaNombre(area) + '?\n\n' +
      'Monto anterior: ' + valor(antes.monto) + '\nMonto nuevo: ' + valor(monto) +
      '\n\nSe actualizarán los saldos y las cuotas vinculadas y quedará constancia del motivo en el historial.';
    if (!confirm(aviso)) return;
    button.disabled = true;
    respuesta.textContent = "Validando y guardando en Supabase…";
    try {
      verificarSesion();
      const auth = await window.db.auth.getUser();
      if (auth.error || !auth.data?.user || auth.data.user.id !== ADMIN) throw new Error("Sesión no autorizada.");
      const r = await window.db.rpc("esabas_editar_movimiento", {
        p_area: area,
        p_movimiento_id: id,
        p_monto: monto,
        p_fecha: fecha,
        p_forma: tipo,
        p_nota: nota,
        p_motivo: motivo,
        p_monto_original: antes.monto,
        p_fecha_original: antes.fecha
      });
      if (r.error) throw new Error(r.error.message);
      if (!r.data || r.data.ok !== true || r.data.id !== id) throw new Error("Supabase no confirmó el guardado. Revisa la conexión.");
      cerrar();
      let refreshError = null;
      try {
        if (area === "cobro" && typeof window.cargarCobros === "function") await window.cargarCobros();
        if (area === "pago" && typeof window.cargarPagos === "function") await window.cargarPagos();
        if (typeof window.esabasCargarExpedientes === "function") await window.esabasCargarExpedientes();
      } catch (e) {refreshError = e;}
      let msg = "Movimiento corregido y registrado en el historial. Saldo de la obligación recalculado.";
      if (Number(r.data.saldo_a_favor) > 0.005) msg += "\nAtención: " + valor(r.data.saldo_a_favor) + " quedó como saldo a favor sin imputar a otra obligación.";
      if (refreshError) msg += "\nLa operación se guardó, pero la vista no se actualizó. Recarga la página.";
      alert(msg);
    } catch (error) {
      respuesta.textContent = "No se guardaron los cambios: " + error.message;
    } finally {
      button.disabled = false;
    }
  }
  async function mostrarHistorial(area, id) {
    const ctx = encontrar(area, id);
    if (!ctx) return alert("No se encontró el movimiento. Recarga el módulo.");
    if (String(id).startsWith("loc_")) return alert("Este movimiento todavía no se ha sincronizado con Supabase.");
    mostrar('<h3 style="margin:0 0 9px">📋 Historial de cambios</h3>' +
      '<p style="color:#94a3b8;font-size:13px;margin-bottom:12px">' +
      esc(ctx.cuenta.nombre) + ' · ' + esc(areaNombre(area)) + ' · ' + valor(ctx.movimiento.monto) + '</p>' +
      '<div id="esabas-finanzas-historial" style="font-size:13px;color:#cbd5e1">Consultando historial en Supabase…</div>' +
      '<button type="button" class="btn btn-secondary" style="width:100%;margin-top:14px" data-fin-cerrar="1">Cerrar</button>');
    try {
      verificarSesion();
      const r = await window.db.from("movimientos_financieros_cambios")
        .select("modificado_el,motivo,datos_anteriores,datos_nuevos")
        .eq("tipo",area).eq("movimiento_id",id)
        .order("modificado_el",{ascending:false}).limit(100);
      if (r.error) throw r.error;
      const out = $("esabas-finanzas-historial");
      if (!out) return;
      if (!r.data || !r.data.length) {
        out.textContent = "Este movimiento no tiene modificaciones registradas todavía."; return;
      }
      const labels = {monto:"Importe",fecha:"Fecha",tipo:"Forma de pago",nota:"Observación",desglose_imputacion:"Imputación contable"};
      out.innerHTML = r.data.map(row => {
        const old = row.datos_anteriores || {}, nuevo = row.datos_nuevos || {};
        const cambios = Object.keys(labels).filter(k => JSON.stringify(old[k] ?? null) !== JSON.stringify(nuevo[k] ?? null));
        const antesTxt = (k,v) => k==="monto" ? valor(v) : k==="desglose_imputacion" ? "Registro anterior" : (v == null || v === "" ? "—" : String(v));
        const despuesTxt = (k,v) => k==="monto" ? valor(v) : k==="desglose_imputacion" ? "Imputación actualizada" : (v == null || v === "" ? "—" : String(v));
        return '<div style="border:1px solid #334155;background:#090f1d;padding:11px;border-radius:9px;margin-bottom:9px">' +
          '<b>' + esc(fechaHora(row.modificado_el)) + '</b>' +
          '<div style="color:#fbbf24;margin:5px 0">Motivo: ' + esc(row.motivo) + '</div>' +
          (cambios.length ? cambios.map(k =>
            '<div style="margin:7px 0"><b>' + esc(labels[k]) + '</b>' +
            '<div style="color:#fca5a5">Antes: ' + esc(antesTxt(k,old[k])) + '</div>' +
            '<div style="color:#86efac">Después: ' + esc(despuesTxt(k,nuevo[k])) + '</div></div>').join("") :
           '<div>Sin diferencias en los campos visibles.</div>') +
          '</div>';
      }).join("");
    } catch (e) {
      const out = $("esabas-finanzas-historial");
      if (out) out.textContent = "No fue posible cargar el historial: " + e.message;
    }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("button[data-fin-edit],button[data-fin-history],button[data-fin-cerrar]");
    if (!b) return;
    if (b.dataset.finCerrar) return cerrar();
    const area = b.dataset.finEdit || b.dataset.finHistory;
    const id = b.dataset.finId;
    if (!["cobro","pago"].includes(area) || !id) return;
    if (b.dataset.finEdit) abrirEditar(area,id);
    else mostrarHistorial(area,id);
  });
  window.esabasFinanzas = { abrirEditar, mostrarHistorial };
})();