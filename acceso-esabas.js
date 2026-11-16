
/*
  RAIET ESABAS
  Acceso privado de administrador
  Primera versión: contraseña y bloqueo automático
*/

(function () {
  "use strict";

  const ADMIN_UID = "4c2b8c98-200f-4307-8d7c-6d8742feb17a";
  const MINUTOS_INACTIVIDAD = 10;
  const TIEMPO_BLOQUEO = MINUTOS_INACTIVIDAD * 60 * 1000;

  let temporizador = null;
  let inicioRealizado = false;
  let ultimaActividad = Date.now();
  let bloqueoEnCurso = false;
  const SERVIDOR_HUELLA = "raiet-esabas-supabase-fwkdtcecdwxezzkphxiv";
  const URL_VERSIONES = "https://api.github.com/repos/edisonenriquezt-byte/raiet-dev/releases/latest";
  const ID_FINAL = "com.esabas.raiet";
  let actualizacionConsultada = false;
  let autenticacionEnCurso = false;
  const CLAVE_ACTIVIDAD_WEB = "raiet_web_ultima_actividad";
  const VERSION_WEB = "1.0.23";
  function leerActividadWeb() {
    try { return Number(sessionStorage.getItem(CLAVE_ACTIVIDAD_WEB)) || 0; }
    catch (_) { return 0; }
  }
  function guardarActividadWeb() {
    if (puente()) return;
    try { sessionStorage.setItem(CLAVE_ACTIVIDAD_WEB, String(ultimaActividad)); }
    catch (_) {}
  }
  function borrarActividadWeb() {
    try { sessionStorage.removeItem(CLAVE_ACTIVIDAD_WEB); } catch (_) {}
  }

  // El navegador web no expone la huella de Android.
  const puente = () => window.RAIET_NATIVE && window.RAIET_NATIVE.enabled ? window.RAIET_NATIVE : null;
  const lectorHuella = () => puente() && puente().biometric;


  const raiz = document.documentElement;
  raiz.classList.add("raiet-bloqueado");

  const estilos = document.createElement("style");

  estilos.textContent = `
    html.raiet-bloqueado body > :not(#raiet-acceso) {
      visibility: hidden !important;
    }

    #raiet-acceso {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: #080a10;
      color: #f8fafc;
      font-family: Arial, sans-serif;
    }

    html:not(.raiet-bloqueado) #raiet-acceso {
      display: none;
    }

    #raiet-acceso .acceso-tarjeta {
      width: 100%;
      max-width: 390px;
      padding: 28px;
      border-radius: 18px;
      background: #111520;
      border: 1px solid #263247;
      box-sizing: border-box;
    }

    #raiet-acceso h1 {
      color: #ffffff;
      font-size: 25px;
      margin: 0 0 8px;
    }

    #raiet-acceso p {
      color: #a7b3c5;
      font-size: 14px;
      line-height: 1.5;
    }

    #raiet-acceso label {
      display: block;
      margin: 16px 0 6px;
      font-size: 13px;
      font-weight: bold;
    }

    #raiet-acceso input {
      width: 100%;
      box-sizing: border-box;
      padding: 13px;
      border-radius: 9px;
      border: 1px solid #37465d;
      background: #080a10;
      color: white;
      font-size: 16px;
    }

    #raiet-acceso button {
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 14px;
      border: 0;
      border-radius: 9px;
      color: white;
      background: #2563eb;
      font-weight: bold;
      cursor: pointer;
    }

    #raiet-acceso button:disabled {
      opacity: 0.6;
    }

    #raiet-acceso .mensaje {
      min-height: 20px;
      margin-top: 14px;
      color: #fca5a5;
      font-size: 13px;
    }

    #raiet-acceso [hidden] { display: none !important; }

    #raiet-huella {
      background: #0f766e !important;
      margin-top: 12px !important;
    }

    #raiet-olvidar-huella {
      background: transparent !important;
      color: #a7b3c5 !important;
      border: 1px solid #37465d !important;
      font-size: 12px !important;
      margin-top: 10px !important;
    }

    #raiet-revisar-version {
      position: fixed;
      top: 49px;
      right: 12px;
      z-index: 99998;
      background: #1e40af;
      border: 0;
      border-radius: 8px;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 8px 10px;
      cursor: pointer;
    }

    #raiet-aviso-actualizacion {
      position: fixed;
      left: 14px;
      right: 14px;
      bottom: 90px;
      z-index: 99995;
      padding: 14px;
      background: #102a43;
      border: 1px solid #38bdf8;
      border-radius: 12px;
      color: white;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font: 13px Arial, sans-serif;
    }
    #raiet-aviso-actualizacion button {
      border: 0;
      background: #2563eb;
      border-radius: 6px;
      color: white;
      padding: 8px 10px;
      cursor: pointer;
    }
    html.raiet-bloqueado #raiet-revisar-version,
    html.raiet-bloqueado #raiet-aviso-actualizacion { display: none !important; }

    #raiet-version-web { position: fixed; top: 12px; left: 12px; z-index: 99997; pointer-events:none; color:#94a3b8; background:#101827; padding:5px 8px; border:1px solid #334155; border-radius:6px; font:11px Arial,sans-serif; }
    html.raiet-bloqueado #raiet-version-web { display:none; }
    #raiet-cerrar-sesion {
      position: fixed;
      right: 12px;
      top: 12px;
      z-index: 99999;
      padding: 8px 12px;
      background: #991b1b;
      color: white;
      border: 0;
      border-radius: 8px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
    }

    html.raiet-bloqueado #raiet-cerrar-sesion {
      display: none;
    }
  `;

  document.head.appendChild(estilos);

  document.addEventListener("DOMContentLoaded", async function () {
    const cliente = window.db;

    const acceso = document.createElement("div");
    acceso.id = "raiet-acceso";

    acceso.innerHTML = `
      <div class="acceso-tarjeta">
        <h1>RAIET ESABAS</h1>
        <p>Sistema privado de gestión profesional</p>

        <form id="raiet-formulario-acceso">
          <label for="raiet-email">Correo electrónico</label>
          <input
            type="email"
            id="raiet-email"
            autocomplete="username"
            required
          >

          <label for="raiet-clave">Contraseña</label>
          <input
            type="password"
            id="raiet-clave"
            autocomplete="current-password"
            required
          >

          <button type="submit" id="raiet-entrar">
            Iniciar sesión
          </button>
        </form>

        <button type="button" id="raiet-huella" hidden>
          🔐 Entrar con huella
        </button>
        <button type="button" id="raiet-olvidar-huella" hidden>
          Olvidar huella de este dispositivo
        </button>

        <p class="mensaje" id="raiet-mensaje" role="status"></p>
      </div>
    `;

    document.body.appendChild(acceso);

    const salir = document.createElement("button");
    salir.id = "raiet-cerrar-sesion";
    salir.type = "button";
    salir.textContent = "Cerrar sesión";

    document.body.appendChild(salir);
    if (!puente()) {
      const etiquetaVersion=document.createElement("span");
      etiquetaVersion.id="raiet-version-web";
      etiquetaVersion.textContent="WEB · v"+VERSION_WEB;
      etiquetaVersion.title="Versión web de RAIET ESABAS";
      document.body.appendChild(etiquetaVersion);
    }

    const revisarBoton = document.createElement("button");
    revisarBoton.id = "raiet-revisar-version";
    revisarBoton.type = "button";
    revisarBoton.textContent = "↻ Comprobar actualización";
    revisarBoton.hidden = !puente();
    document.body.appendChild(revisarBoton);

    const formulario = document.getElementById(
      "raiet-formulario-acceso"
    );

    const mensaje = document.getElementById("raiet-mensaje");
    const botonEntrar = document.getElementById("raiet-entrar");
    const botonHuella = document.getElementById("raiet-huella");
    const botonOlvidarHuella = document.getElementById("raiet-olvidar-huella");

    async function comprobarHuellaGuardada() {
      const lector = lectorHuella();
      botonHuella.hidden = true;
      botonOlvidarHuella.hidden = true;
      if (!lector) return;
      try {
        const [estado, guardada] = await Promise.all([
          lector.isAvailable({ useFallback: false }),
          lector.isCredentialsSaved({ server: SERVIDOR_HUELLA })
        ]);
        const disponible = !!(estado.isAvailable && estado.strongBiometryIsAvailable);
        botonHuella.hidden = !(disponible && guardada.isSaved);
        botonOlvidarHuella.hidden = !guardada.isSaved;
      } catch (_) {
        // Si falla el sensor, nunca bloqueamos el acceso con contraseña.
      }
    }

    async function ofrecerHuella(email, password) {
      const lector = lectorHuella();
      if (!lector) return;
      try {
        const estado = await lector.isAvailable({ useFallback: false });
        if (!estado.isAvailable || !estado.strongBiometryIsAvailable) return;
        const guardada = await lector.isCredentialsSaved({ server: SERVIDOR_HUELLA });
        if (!guardada.isSaved &&
            window.confirm("¿Activar el acceso con huella para no volver a escribir correo y contraseña en este teléfono? Android protegerá tus credenciales en su almacén seguro.")) {
          await lector.setCredentials({
            server: SERVIDOR_HUELLA,
            username: email,
            password: password,
            accessControl: 1,  // BIOMETRY_CURRENT_SET: exige huella y se invalida al modificar huellas
            authValidityDuration: 0,
            title: "Activar huella RAIET ESABAS",
            negativeButtonText: "Cancelar"
          });
        }
      } catch (error) {
        // El usuario puede cancelar la activación sin perder el acceso normal.
      }
      await comprobarHuellaGuardada();
    }

    async function autenticarYVerificar(email, password) {
      const resultado = await cliente.auth.signInWithPassword({ email, password });
      if (resultado.error) {
        throw new Error("Credenciales incorrectas.");
      }
      if (!resultado.data.user || resultado.data.user.id !== ADMIN_UID) {
        await cliente.auth.signOut({ scope: "local" });
        throw new Error("Usuario no autorizado.");
      }
    }

    async function abrirEnNavegador(url) {
      const nativo = puente();
      if (nativo && nativo.browser) {
        await nativo.browser.open({ url });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }

    async function revisarActualizaciones(manual) {
      const nativo = puente();
      if (!nativo || !nativo.app || (!manual && actualizacionConsultada)) return;
      actualizacionConsultada = true;
      try {
        const info = await nativo.app.getInfo();
        // Nunca confundimos los builds de prueba con la APK oficial.
        if (info.id !== ID_FINAL) {
          if (manual) window.alert("Edición de prueba: la actualización automática se habilitará en la APK firmada definitiva.");
          return;
        }
        const res = await fetch(URL_VERSIONES, { cache: "no-store" });
        if (!res.ok) throw new Error("No se pudo consultar GitHub.");
        const datos = await res.json();
        const etiqueta = /^raiet-esabas-android-(\d+)$/.exec(String(datos.tag_name || ""));
        const remoto = etiqueta ? Number(etiqueta[1]) : 0;
        const instalado = Number(info.build);
        const archivo = Array.isArray(datos.assets)
          ? datos.assets.find(a => a.name === "RAIET-ESABAS.apk")
          : null;
        const url = archivo && String(archivo.browser_download_url || "");
        const autorizada = /^https:\/\/github\.com\/edisonenriquezt-byte\/raiet-dev\/releases\/download\/[^/]+\/RAIET-ESABAS\.apk$/.test(url);
        if (!remoto || !Number.isFinite(instalado) || !autorizada) {
          if (manual) window.alert("No se encontró una versión instalable válida.");
          return;
        }
        if (remoto <= instalado) {
          if (manual) window.alert("RAIET ESABAS está actualizado (versión " + info.version + ").");
          return;
        }

        let aviso = document.getElementById("raiet-aviso-actualizacion");
        if (!aviso) {
          aviso = document.createElement("div");
          aviso.id = "raiet-aviso-actualizacion";
          const mensaje = document.createElement("span");
          mensaje.textContent = "Hay una actualización nueva de RAIET ESABAS.";
          const descargar = document.createElement("button");
          descargar.type = "button";
          descargar.textContent = "Descargar actualización";
          descargar.addEventListener("click", () => {
            abrirEnNavegador(url).catch(() => window.alert("No se pudo abrir la descarga."));
          });
          const cerrar = document.createElement("button");
          cerrar.type = "button";
          cerrar.textContent = "Ahora no";
          cerrar.addEventListener("click", () => aviso.remove());
          aviso.append(mensaje, descargar, cerrar);
          document.body.appendChild(aviso);
        }
      } catch (_) {
        if (manual) window.alert("No se pudo consultar las versiones. Revisa tu conexión a internet.");
      }
    }

    function mostrarMensaje(texto) {
      mensaje.textContent = texto;
    }

    function controlarInactividad() {
      clearTimeout(temporizador);

      temporizador = setTimeout(function () {
        if (Date.now() - ultimaActividad >= TIEMPO_BLOQUEO) {
          bloquearAplicacion();
        }
      }, TIEMPO_BLOQUEO);
    }

    function registrarActividad() {
      if (raiz.classList.contains("raiet-bloqueado")) {
        return;
      }

      ultimaActividad = Date.now();
      guardarActividadWeb();
      controlarInactividad();
    }

    async function bloquearAplicacion() {
      if (bloqueoEnCurso) return;

      bloqueoEnCurso = true;

      raiz.classList.add("raiet-bloqueado");
      clearTimeout(temporizador);
      borrarActividadWeb();

      document.getElementById("raiet-clave").value = "";

      if (cliente) {
        try {
          await cliente.auth.signOut({ scope: "local" });
        } catch (error) {
          console.error("Error al cerrar sesión:", error);
        }
      }

      mostrarMensaje("Identifícate con huella o con tus credenciales para continuar.");
      await comprobarHuellaGuardada();
      bloqueoEnCurso = false;
    }

    function abrirAplicacion() {
      raiz.classList.remove("raiet-bloqueado");

      mostrarMensaje("");
      document.getElementById("raiet-clave").value = "";

      if (!inicioRealizado) {
        inicioRealizado = true;

        if (typeof window.raietArrancar === "function") {
          window.raietArrancar();
        }
      } else if (typeof window.raietArrancar === "function") {
        window.raietArrancar();
      }

      ultimaActividad = Date.now();
      guardarActividadWeb();
      controlarInactividad();
      void revisarActualizaciones(false);
    }

    botonHuella.addEventListener("click", async function () {
      if (autenticacionEnCurso || !cliente || !lectorHuella()) return;
      autenticacionEnCurso = true;
      botonHuella.disabled = true;
      mostrarMensaje("Verificando huella...");
      try {
        // Android Keystore solo libera el secreto tras la autenticación biométrica.
        const credenciales = await lectorHuella().getSecureCredentials({
          server: SERVIDOR_HUELLA,
          title: "Entrar a RAIET ESABAS",
          subtitle: "Confirma tu huella",
          negativeButtonText: "Usar contraseña"
        });
        await autenticarYVerificar(credenciales.username, credenciales.password);
        abrirAplicacion();
      } catch (error) {
        mostrarMensaje(error && error.message === "Usuario no autorizado"
          ? "Usuario no autorizado."
          : "No se pudo usar la huella. Puedes ingresar con tu contraseña.");
      } finally {
        botonHuella.disabled = false;
        autenticacionEnCurso = false;
      }
    });

    botonOlvidarHuella.addEventListener("click", async function () {
      if (!lectorHuella()) return;
      if (!window.confirm("¿Quitar el acceso con huella guardado en este teléfono?")) return;
      try {
        await lectorHuella().deleteCredentials({ server: SERVIDOR_HUELLA });
        mostrarMensaje("Acceso con huella eliminado de este dispositivo.");
      } catch (_) {
        mostrarMensaje("No se pudo quitar la huella.");
      }
      await comprobarHuellaGuardada();
    });

    revisarBoton.addEventListener("click", function () {
      void revisarActualizaciones(true);
    });

    formulario.addEventListener("submit", async function (evento) {
      evento.preventDefault();

      if (!cliente) {
        mostrarMensaje("No se pudo conectar con Supabase.");
        return;
      }

      const email = document.getElementById("raiet-email")
        .value.trim();

      const password = document.getElementById("raiet-clave").value;

      if (autenticacionEnCurso) return;
      autenticacionEnCurso = true;
      botonEntrar.disabled = true;
      mostrarMensaje("Verificando acceso...");

      try {
        await autenticarYVerificar(email, password);
        await ofrecerHuella(email, password);
        abrirAplicacion();
      } catch (error) {
        mostrarMensaje(error && error.message === "Usuario no autorizado."
          ? "Usuario no autorizado."
          : "No se pudo iniciar sesión. Revisa las credenciales y la conexión.");
      } finally {
        autenticacionEnCurso = false;
        botonEntrar.disabled = false;
      }
    });

    salir.addEventListener("click", bloquearAplicacion);

    ["click", "keydown", "touchstart", "pointerdown"].forEach(
      function (evento) {
        document.addEventListener(evento, registrarActividad, {
          passive: true
        });
      }
    );

    document.addEventListener("visibilitychange", function () {
      if (document.hidden && puente() && !raiz.classList.contains("raiet-bloqueado")) {
        // En Android, bloquea al abandonar la app para proteger expedientes.
        void bloquearAplicacion();
      } else if (!document.hidden && !raiz.classList.contains("raiet-bloqueado")) {
        if (Date.now() - ultimaActividad >= TIEMPO_BLOQUEO) {
          void bloquearAplicacion();
        }
      }
    });

    if (!cliente) {
      mostrarMensaje("No se encontró la conexión con Supabase.");
      return;
    }

    // La web conserva su sesión al refrescar sólo si hubo actividad reciente.
    // Android mantiene su acceso biométrico al abrir y su bloqueo al abandonar.
    const ultimaWeb = !puente() ? leerActividadWeb() : 0;
    const transcurrido = Date.now() - ultimaWeb;
    if (!puente() && ultimaWeb > 0 && transcurrido >= 0 && transcurrido < TIEMPO_BLOQUEO) {
      try {
        const identidad = await cliente.auth.getUser();
        if (!identidad.error && identidad.data?.user?.id === ADMIN_UID) {
          abrirAplicacion();
          return;
        }
        if (identidad.error) {
          mostrarMensaje("No fue posible comprobar la sesión. Revisa tu conexión y actualiza.");
          await comprobarHuellaGuardada();
          return;
        }
      } catch (error) {
        mostrarMensaje("Sin conexión para comprobar la sesión. Revisa internet y vuelve a cargar.");
        await comprobarHuellaGuardada();
        return;
      }
    }

    borrarActividadWeb();
    try {
      await cliente.auth.signOut({ scope: "local" });
    } catch (error) {
      console.warn("No se pudo cerrar una sesión local anterior.");
    }
    mostrarMensaje("");
    await comprobarHuellaGuardada();
  });
})();
