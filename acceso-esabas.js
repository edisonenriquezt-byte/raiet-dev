
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

        <p class="mensaje" id="raiet-mensaje" role="status"></p>
      </div>
    `;

    document.body.appendChild(acceso);

    const salir = document.createElement("button");
    salir.id = "raiet-cerrar-sesion";
    salir.type = "button";
    salir.textContent = "Cerrar sesión";

    document.body.appendChild(salir);

    const formulario = document.getElementById(
      "raiet-formulario-acceso"
    );

    const mensaje = document.getElementById("raiet-mensaje");
    const botonEntrar = document.getElementById("raiet-entrar");

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
      controlarInactividad();
    }

    async function bloquearAplicacion() {
      if (bloqueoEnCurso) return;

      bloqueoEnCurso = true;

      raiz.classList.add("raiet-bloqueado");
      clearTimeout(temporizador);

      document.getElementById("raiet-clave").value = "";

      if (cliente) {
        try {
          await cliente.auth.signOut({ scope: "local" });
        } catch (error) {
          console.error("Error al cerrar sesión:", error);
        }
      }

      mostrarMensaje("Introduce tus credenciales para continuar.");
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
      controlarInactividad();
    }

    formulario.addEventListener("submit", async function (evento) {
      evento.preventDefault();

      if (!cliente) {
        mostrarMensaje("No se pudo conectar con Supabase.");
        return;
      }

      const email = document.getElementById("raiet-email")
        .value.trim();

      const password = document.getElementById("raiet-clave").value;

      botonEntrar.disabled = true;
      mostrarMensaje("Verificando acceso...");

      try {
        const resultado = await cliente.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (resultado.error) {
          mostrarMensaje("Correo o contraseña incorrectos.");
          return;
        }

        if (
          !resultado.data.user ||
          resultado.data.user.id !== ADMIN_UID
        ) {
          await cliente.auth.signOut({ scope: "local" });
          mostrarMensaje("Usuario no autorizado.");
          return;
        }

        abrirAplicacion();

      } catch (error) {
        mostrarMensaje("No se pudo iniciar sesión. Revisa la conexión.");
      } finally {
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
      if (!document.hidden && !raiz.classList.contains("raiet-bloqueado")) {
        if (Date.now() - ultimaActividad >= TIEMPO_BLOQUEO) {
          bloquearAplicacion();
        }
      }
    });

    if (!cliente) {
      mostrarMensaje("No se encontró la conexión con Supabase.");
      return;
    }

    // Cada apertura exige una nueva identificación.
    // No cierra las sesiones de otros dispositivos.
    try {
      await cliente.auth.signOut({ scope: "local" });
    } catch (error) {
      console.warn("No se pudo verificar el cierre anterior.");
    }

    mostrarMensaje("");
  });
})();
