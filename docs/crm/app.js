/* ════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN DEL CRM — rellenar los marcadores [ENTRE CORCHETES]
   Todo lo específico de la empresa vive aquí; no hay datos fijos en el resto del código.
   ════════════════════════════════════════════════════════════════════ */
const CRM_CONFIG = {
  empresa: {
    nombre: "Candy Ads",
    razonSocial: "Miguel Cabrera Rodríguez",
    cif: "29541337E",
    direccion: "",
    ciudad: "Sevilla",
    telefono: "634 237 322",
    email: "equipo@candyads.es",
    web: "candyads.es",
    responsable: "Miguel Cabrera Rodríguez",
    cargo: "Titular",
    logoUrl: "/assets/candyads-icono.png", // el logo se pinta siempre completo con logoCandy() (cubo + logotipo)
    pieLegal: "Candy Ads · Miguel Cabrera Rodríguez · NIF 29541337E · equipo@candyads.es · candyads.es",
  },
  presupuesto: {
    prefijo: "PRS", // nº de presupuesto automático: PRS-2025-0001
    ivaPorDefecto: 21, // %
    validezDias: 30,
    moneda: "€",
    condiciones: [
      "Precios por lote de sobres según la tarifa vigente de Candy Ads",
      "IVA no incluido salvo indicación expresa",
    ],
    textoIntroduccion:
      "De acuerdo con sus indicaciones, nos es grato presentarles nuestra propuesta económica:",
    textoLegal: "",
    textoAceptacion:
      "En caso de aceptación, rogamos nos devuelvan este presupuesto firmado y sellado.",
  },
  google: { clientId: "" }, // Client ID de OAuth (Google Cloud) para Calendar y Tasks
  supabase: { url: "", key: "" }, // opcional: sincronización en la nube (vacío = solo local)
  hostOrigin: "", // opcional: origen de la web que embebe este CRM en un iframe (p.ej. "https://tu-web.com")
};
const EMP = CRM_CONFIG.empresa;
const SB_URL = CRM_CONFIG.supabase.url,
  SB_KEY = CRM_CONFIG.supabase.key,
  SB_DISABLED = !(SB_URL && SB_KEY);
// Escapa texto para meterlo en HTML (contenido o atributo). Antes delegaba en DOMPurify.sanitize, que no
// escapa comillas (un dato podía salirse de un atributo) y, si la librería no cargaba, no hacía nada.
function escHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function esc(str) {
  return escHtml(str);
}
/* Logo oficial de Candy Ads (cubo + logotipo): nunca el nombre escrito en texto. URLs absolutas para que
   también salga en las ventanas de impresión (presupuestos, contratos, informes). */
function logoCandy(alto, extra) {
  var base = new URL("/assets/", location.href).href;
  return '<span style="display:inline-flex;align-items:center;gap:2px;' + (extra || "") + '">' +
    '<img src="' + base + 'candyads-icono.png" alt="Candy Ads" style="height:' + alto + 'px;width:auto;">' +
    '<img src="' + base + 'candyads-logotipo.jpg" alt="" style="height:' + Math.round(alto * 0.72) + 'px;width:auto;">' +
    "</span>";
}
function toggleAccordion(id) {
  const body = document.getElementById(id),
    btn = document.getElementById(id + "-btn"),
    open = body.classList.toggle("open");
  btn && btn.classList.toggle("open", open);
}
function toggleSidebar() {
  const sb = document.getElementById("sidebar"),
    btn = document.getElementById("sidebar-toggle"),
    ov = document.getElementById("mobile-overlay");
  if (esMobil()) {
    const open = sb.classList.toggle("mobile-open");
    ((btn.textContent = open ? "✕" : "☰"),
      ov &&
        (open ? ov.classList.add("visible") : ov.classList.remove("visible")));
  } else {
    const collapsed = sb.classList.toggle("collapsed");
    ((btn.textContent = collapsed ? "☰" : "✕"),
      collapsed
        ? ((btn.style.left = "14px"), btn.classList.remove("open"))
        : ((btn.style.left = ""), btn.classList.add("open")));
  }
}
function toggleDarkMode() {
  const isDark = void 0,
    newTheme =
      "dark" === document.documentElement.getAttribute("data-theme")
        ? "light"
        : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  try {
    CRM_STORE.setItem("ncrm_theme", newTheme);
  } catch (e) {}
  actualizarBtnDark("dark" === newTheme);
}
function actualizarBtnDark(isDark) {
  const icon = document.getElementById("dark-icon"),
    label = document.getElementById("dark-label");
  (icon && (icon.textContent = isDark ? "☀️" : "🌙"),
    label && (label.textContent = isDark ? "Modo claro" : "Modo oscuro"));
}
!(function () {
  try {
    const saved = void 0;
    "dark" === CRM_STORE.getItem("ncrm_theme") &&
      document.documentElement.setAttribute("data-theme", "dark");
  } catch (e) {}
})();
let db = [];
(!(function cargarDatos() {
  try {
    const lsRaw = CRM_STORE.getItem("ncrm_crm"),
      lsData = lsRaw ? JSON.parse(lsRaw) : null;
    if (lsData && lsData.length > 0) return void (db = lsData);
    const tag = document.getElementById("ncrm-embedded-data"),
      emb = tag ? JSON.parse(tag.textContent) : null;
    emb &&
      emb.db &&
      emb.db.length > 0 &&
      ((db = emb.db),
      CRM_STORE.setItem("ncrm_crm", JSON.stringify(db)),
      CRM_STORE.setItem("ncrm_ts", new Date().toISOString()));
  } catch (e) {
    (console.warn("Error cargando datos:", e), (db = []));
  }
})(),
  db.forEach((c) => {
    ((c.notas = c.notas || []),
      (c.llamadas = c.llamadas || []),
      (c.visitas = c.visitas || []),
      (c.pedidos = c.pedidos || []),
      (c.contacto = c.contacto || ""),
      (c.provincia = c.provincia || ""),
      (c.municipio = c.municipio || ""),
      (c.cp = c.cp || ""),
      (c.telefono = c.telefono || ""),
      (c.email = c.email || ""),
      (c.direccion = c.direccion || ""),
      (c.sector = c.sector || ""),
      (c.recordatorios = c.recordatorios || []));
  }));
let activeId = null;
try {
  activeId = parseInt(CRM_STORE.getItem("ncrm_active")) || null;
} catch (e) {}
// Sin selección guardada (el CRM ya no recuerda la última empresa entre sesiones): la primera de la lista.
(!activeId || !db.find((c) => c.id === activeId)) &&
  (activeId = db.length ? db[0].id : null);
let editMode = !1,
  chartDonut = null,
  chartBars = null,
  chartTop = null,
  filtroTemp = "todos",
  filtroRiesgo = !1;
const fmt = (n) =>
  new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
function save() {
  neutralizarTodo(db); // ningún texto guardado puede romper el HTML (ver puente.js)
  db.forEach(function (c) {
    if (c.notas)
      c.notas.forEach(function (n) {
        if (n && typeof n === "object" && n.adjunto) {
          delete n.adjunto;
          delete n.adjuntoTipo;
          delete n.adjuntoNombre;
        }
      });
  });
  const tsISO = new Date().toISOString();
  setTimeout(actualizarCuota, 50);
  _lastSave = tsISO;
  try {
    (CRM_STORE.setItem("ncrm_crm", JSON.stringify(db)),
      CRM_STORE.setItem("ncrm_active", activeId),
      CRM_STORE.setItem("ncrm_ts", tsISO));
  } catch (e) {
    console.warn("CRM_STORE no disponible");
  }
  try {
    const tag = document.getElementById("ncrm-embedded-data");
    tag &&
      (tag.textContent = JSON.stringify({
        db: db,
        activeId: activeId,
        ts: tsISO,
      }));
  } catch (e) {}
  sbSave(db, tsISO);
  _crmNotificarHost(db, tsISO);
}
function guardarArchivo() {
  // Copia de seguridad descargable (los datos ya se guardan solos en Supabase, con historial).
  const ts = Date.now(),
    datos = JSON.stringify({ db: db, ts: new Date(ts).toISOString() }, null, 1);
  const blob = new Blob([datos], { type: "application/json;charset=utf-8" }),
    a = document.createElement("a");
  ((a.href = URL.createObjectURL(blob)),
    (a.download = "crm-candyads-" + new Date(ts).toISOString().slice(0, 10) + ".json"),
    document.body.appendChild(a),
    a.click(),
    document.body.removeChild(a),
    URL.revokeObjectURL(a.href));
  const btn = document.getElementById("btn-guardar");
  btn &&
    ((btn.textContent = "✅ Guardado"),
    setTimeout(() => (btn.textContent = "💾 Guardar archivo"), 2e3));
}
function cerrarModal(id) {
  document.getElementById(id).style.display = "none";
}
function abrirModal(id) {
  document.getElementById(id).style.display = "flex";
}
function actualizarProvincias() {
  const sel = document.getElementById("filtro-provincia"),
    val = sel.value,
    provs = [
      ...new Set(db.map((c) => c.provincia).filter((p) => p && p.trim())),
    ].sort();
  ((sel.innerHTML = '<option value="">Todas las provincias</option>'),
    provs.forEach(
      (p) => (sel.innerHTML += `<option value="${p}">${p}</option>`),
    ),
    (sel.value = val));
  const dl = document.getElementById("dl-provincias");
  dl && (dl.innerHTML = provs.map((p) => `<option value="${esc(p)}">`).join(""));
}
function getAvatar(name) {
  const w = name.trim().split(/\s+/);
  return w.length >= 2
    ? (w[0][0] + w[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}
function cargarLista() {
  const txt = document.getElementById("input-buscador").value.toLowerCase(),
    _sd = txt.length > 1,
    prov = document.getElementById("filtro-provincia").value,
    ul = document.getElementById("ul-clientes");
  ul.innerHTML = "";
  const parseFechaISO = (s) => {
      const d = new Date(s);
      return isNaN(d) ? null : d;
    },
    parseFechaES = (s) => {
      const m = s ? s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null;
      return m
        ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
        : null;
    },
    ultimoPedido = (c) => {
      let u = null;
      return (
        (c.pedidos || []).forEach((p) => {
          const d = parseFechaISO(p.fecha) || parseFechaES(p.fecha);
          d && (!u || d > u) && (u = d);
        }),
        u
      );
    };
  let contadorVisible = 0;
  (db.forEach((c) => {
    if (txt) {
      const _f = void 0,
        _eC = [
          c.nombre,
          c.contacto,
          c.telefono,
          c.telefonoFijo || "",
          c.email,
          c.sector || "",
          c.cif || "",
          c.municipio || "",
          c.direccion || "",
          c.provincia || "",
        ].some((v) => v && String(v).toLowerCase().includes(txt)),
        _sd2 = txt.length > 1,
        _eP =
          _sd2 &&
          (c.pedidos || []).some((p) =>
            [p.id, p.ref, p.empresa].some(
              (v) => v && String(v).toLowerCase().includes(txt),
            ),
          ),
        _ePr =
          _sd2 &&
          (c.presupuestos || []).some((p) =>
            [p.ref, p.modelo, p.empresa].some(
              (v) => v && String(v).toLowerCase().includes(txt),
            ),
          ),
        _eN =
          _sd2 &&
          (c.notas || []).some(
            (n) =>
              n &&
              ("object" == typeof n ? n.texto || "" : String(n || ""))
                .toLowerCase()
                .includes(txt),
          );
      if (!(_eC || _eP || _ePr || _eN)) return;
    }
    if (prov && c.provincia !== prov) return;
    if ("todos" !== filtroTemp) {
      const temp = void 0;
      if (getTemperatura(c).nivel !== filtroTemp) return;
    }
    if (filtroRiesgo) {
      const up = ultimoPedido(c);
      if (!up) return;
      const diasSinPedido = void 0;
      if ((Date.now() - up.getTime()) / 864e5 <= 90) return;
    }
    contadorVisible++;
    const temp = getTemperatura(c),
      etq = getEtqInfo(c),
      li = document.createElement("div"),
      esCartera = false;
    ((li.className =
      "client-item" +
      (c.id === activeId ? " active" : "") +
      ""),
      (li.innerHTML = `<div class="client-avatar">${getAvatar(c.nombre)}</div>\n      <div style="flex:1;min-width:0;">\n        <div style="display:flex;align-items:center;gap:5px;">\n          <span class="etq-dot" title="${etq.label}">${esc(etq.dot)}</span>\n          <div class="client-item-name">${esc(c.nombre)}</div>\n        </div>\n        <div style="display:flex;align-items:center;gap:5px;margin-top:2px;">\n          <div class="client-item-prov">${esc(c.provincia) || "Sin provincia"}</div>\n          <span class="temp-badge ${temp.css}" style="font-size:9.5px;padding:1px 6px;">${temp.label}</span>\n        </div>\n      </div>`),
      (li.onclick = () => {
        ((activeId = c.id),
          save(),
          cargarLista(),
          renderPerfil(),
          esMobil() && cerrarSidebarMovil());
      }),
      ul.appendChild(li));
  }),
    0 === contadorVisible &&
      (ul.innerHTML = `<div style="padding:20px 12px;text-align:center;color:var(--text3);font-size:12.5px;">\n      ${filtroRiesgo ? "No hay clientes en riesgo en este momento 🎉" : "Sin resultados para esta búsqueda."}</div>`),
    calcularRiesgo());
}
function filtrarClientes() {
  cargarLista();
}
function getEtqInfo(c) {
  const p = c.pipeline || "";
  const PIPELINE_ETQ = {
    prospecto: { dot: "🔵", label: "🔵 Prospecto", cls: "etq-nocliente" },
    "pendiente-datos": {
      dot: "📋",
      label: "📋 Pdte. datos presup.",
      cls: "etq-nocliente",
    },
    presupuestado: {
      dot: "📄",
      label: "📄 Presupuestado",
      cls: "etq-ocasional",
    },
    negociacion: { dot: "🤝", label: "🤝 Negociación", cls: "etq-ocasional" },
    "pedido-curso": {
      dot: "📦",
      label: "📦 Pedido en curso",
      cls: "etq-recurrente",
    },
    "cliente-recurrente": {
      dot: "🟢",
      label: "⭐ Recurrente",
      cls: "etq-recurrente",
    },
    "cliente-ocasional": {
      dot: "🟡",
      label: "🔶 Ocasional",
      cls: "etq-ocasional",
    },
    "cliente-perdido": {
      dot: "🔴",
      label: "🔴 Cliente perdido",
      cls: "etq-nocliente",
    },
    "no-cliente": { dot: "⚫", label: "⚫ No cliente", cls: "etq-nocliente" },
    perdido: { dot: "❌", label: "❌ Descartado", cls: "etq-nocliente" },
  };
  if (PIPELINE_ETQ[p]) return PIPELINE_ETQ[p];
  const e = c.etiqueta || "NoCliente";
  return "Recurrente" === e
    ? { dot: "🟢", label: "⭐ Recurrente", cls: "etq-recurrente" }
    : "Ocasional" === e
      ? { dot: "🟡", label: "🔶 Ocasional", cls: "etq-ocasional" }
      : "Perdido" === e
        ? { dot: "🔴", label: "🔴 Perdido", cls: "etq-nocliente" }
        : { dot: "⚫", label: "⚫ No cliente", cls: "etq-nocliente" };
}
function getEtiqueta(c) {
  const ano = new Date().getFullYear().toString(),
    n = (c.pedidos || []).filter((p) => (p.fecha || "").startsWith(ano)).length;
  return 0 === n
    ? { color: "#ff3b30", title: "Sin pedidos este año" }
    : 1 === n
      ? { color: "#ff9500", title: "1 pedido este año" }
      : { color: "#34c759", title: `${n} pedidos este año` };
}
function visTexto(v) {
  return "string" == typeof v ? v : v && v.text ? v.text : "";
}
function getTemperatura(c) {
  const todas = [
    ...(c.notas || []).map((n) =>
      "object" == typeof n && null !== n
        ? (n.fecha || "") + ": " + (n.texto || "")
        : n || "",
    ),
    ...(c.llamadas || []).map((l) =>
      "object" == typeof l && null !== l
        ? (l.fecha || "") + ": " + (l.texto || "")
        : l || "",
    ),
    ...(c.visitas || []).map((v) => visTexto(v)),
  ];
  if (!todas.length)
    return { nivel: "cold", label: "🧊 Inactivo", dias: 1 / 0 };
  const parseFechaES = (s) => {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m
      ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
      : null;
  };
  let masReciente = null;
  if (
    (todas.forEach((entry) => {
      const d = parseFechaES("string" == typeof entry ? entry : "");
      d && (!masReciente || d > masReciente) && (masReciente = d);
    }),
    !masReciente)
  )
    return { nivel: "cold", label: "🧊 Inactivo", dias: 1 / 0 };
  const dias = Math.floor((Date.now() - masReciente.getTime()) / 864e5);
  return dias <= 7
    ? { nivel: "hot", label: "🔥 Caliente", dias: dias, css: "temp-hot" }
    : dias <= 30
      ? { nivel: "warm", label: "☀️ Tibio", dias: dias, css: "temp-warm" }
      : dias <= 90
        ? { nivel: "cool", label: "❄ Frío", dias: dias, css: "temp-cool" }
        : { nivel: "cold", label: "🧊 Inactivo", dias: dias, css: "temp-cold" };
}
function setFiltroTemp(btn, nivel) {
  ((filtroTemp = nivel), (filtroRiesgo = !1));
  const banner = document.getElementById("riesgo-banner");
  (banner && (banner.style.background = ""),
    document
      .querySelectorAll(".btn-filtro-temp")
      .forEach((b) => b.classList.remove("active")),
    btn.classList.add("active"),
    cargarLista());
}
function calcularRiesgo() {
  const hoy = Date.now(),
    parseFechaISO = (s) => {
      const d = new Date(s);
      return isNaN(d) ? null : d;
    },
    parseFechaES = (s) => {
      const m = s ? s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null;
      return m
        ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
        : null;
    },
    ultimoPedidoFn = (c) => {
      let u = null;
      return (
        (c.pedidos || []).forEach((p) => {
          const d = parseFechaISO(p.fecha) || parseFechaES(p.fecha);
          d && (!u || d > u) && (u = d);
        }),
        u
      );
    };
  let hubosCambios = !1;
  (db.forEach((cl) => {
    const tienePedidos = (cl.pedidos || []).length > 0,
      up = ultimoPedidoFn(cl),
      dias = up ? Math.floor((hoy - up.getTime()) / 864e5) : null;
    let nuevaEtq = cl.etiqueta;
    (tienePedidos
      ? null !== dias &&
        (nuevaEtq =
          dias <= 180 ? "Recurrente" : dias <= 365 ? "Ocasional" : "Perdido")
      : (nuevaEtq = "NoCliente"),
      nuevaEtq !== cl.etiqueta &&
        ((cl.etiqueta = nuevaEtq), (hubosCambios = !0)));
  }),
    hubosCambios && save());
  const DIAS_RIESGO = 90,
    dormidos = db.filter((c) => {
      if ("Recurrente" !== c.etiqueta) return !1;
      const u = ultimoPedidoFn(c);
      return !u || (hoy - u.getTime()) / 864e5 > 90;
    }),
    banner = document.getElementById("riesgo-banner"),
    lista = document.getElementById("riesgo-lista"),
    btnDorm = document.getElementById("btn-dormidos"),
    badge = document.getElementById("dormidos-badge");
  if (
    (btnDorm &&
      (dormidos.length
        ? ((btnDorm.style.display = "block"),
          badge && (badge.textContent = `(${dormidos.length})`))
        : (btnDorm.style.display = "none")),
    !banner || !lista)
  )
    return;
  if (!dormidos.length) return void banner.classList.remove("visible");
  banner.classList.add("visible");
  const conDias = dormidos
    .map((c) => {
      const u = ultimoPedidoFn(c),
        diasSinPedido = void 0;
      return {
        c: c,
        diasSinPedido: u ? Math.floor((hoy - u.getTime()) / 864e5) : 9999,
      };
    })
    .sort((a, b) => b.diasSinPedido - a.diasSinPedido);
  lista.innerHTML =
    conDias
      .slice(0, 5)
      .map(
        ({ c: c, diasSinPedido: diasSinPedido }) =>
          `• <strong>${c.nombre}</strong> <span style="opacity:.7">(${9999 === diasSinPedido ? "sin pedidos" : diasSinPedido + " días sin pedir"})</span>`,
      )
      .join("<br>") +
    (dormidos.length > 5
      ? `<br><span style="opacity:.6">+${dormidos.length - 5} más...</span>`
      : "");
  const _hoy = Date.now(),
    _parseFechaISO2 = (s) => {
      const d = new Date(s);
      return isNaN(d) ? null : d;
    },
    _parseFechaES2 = (s) => {
      const m = s ? s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : [];
      return m
        ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
        : null;
    },
    _ultimoPedido2 = (cl) => {
      let u = null;
      return (
        (cl.pedidos || []).forEach((p) => {
          const d = _parseFechaISO2(p.fecha) || _parseFechaES2(p.fecha);
          d && (!u || d > u) && (u = d);
        }),
        u
      );
    };
  let _pipelineChanged = !1;
  if (
    (db.forEach(function (cl) {
      const p = cl.pipeline || "";
      if ("cliente-recurrente" !== p && "cliente-ocasional" !== p) return;
      const up = _ultimoPedido2(cl);
      if (!up) return;
      const dias = (_hoy - up.getTime()) / 864e5;
      "cliente-recurrente" === p
        ? dias > 365
          ? ((cl.pipeline = "cliente-perdido"), (_pipelineChanged = !0))
          : dias > 180 &&
            ((cl.pipeline = "cliente-ocasional"), (_pipelineChanged = !0))
        : "cliente-ocasional" === p &&
          dias > 365 &&
          ((cl.pipeline = "cliente-perdido"), (_pipelineChanged = !0));
    }),
    _pipelineChanged)
  )
    try {
      CRM_STORE.setItem("ncrm_crm", JSON.stringify(db));
    } catch (e) {}
}
function abrirDormidos() {
  const hoy = Date.now(),
    parseFechaISO = (s) => {
      const d = new Date(s);
      return isNaN(d) ? null : d;
    },
    parseFechaES = (s) => {
      const m = s ? s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null;
      return m
        ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
        : null;
    },
    ultimoPedidoFn = (c) => {
      let u = null;
      return (
        (c.pedidos || []).forEach((p) => {
          const d = parseFechaISO(p.fecha) || parseFechaES(p.fecha);
          d && (!u || d > u) && (u = d);
        }),
        u
      );
    },
    dormidos = db
      .filter((c) => "Recurrente" === c.etiqueta)
      .map((c) => {
        const u = ultimoPedidoFn(c);
        return {
          c: c,
          u: u,
          dias: u ? Math.floor((hoy - u.getTime()) / 864e5) : 9999,
        };
      })
      .filter((x) => x.dias > 90)
      .sort((a, b) => b.dias - a.dias),
    list = document.getElementById("dormidos-list");
  (dormidos.length
    ? (list.innerHTML = dormidos
        .map(({ c: c, u: u, dias: dias }) => {
          const diasLabel = 9999 === dias ? "Sin pedidos" : `${dias} días`,
            ultimaLabel = u
              ? u.toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Nunca";
          return `<div class="dormido-card" onclick="seleccionarClienteYCerrarModal(${c.id},'modal-dormidos')">\n        <div style="text-align:center;min-width:42px;">\n          <div class="dormido-dias">${9999 === dias ? "∞" : dias}</div>\n          <div class="dormido-dias-label">días</div>\n        </div>\n        <div style="flex:1;min-width:0;">\n          <div class="dormido-nombre">${c.nombre}</div>\n          <div class="dormido-meta">${c.provincia || ""}${c.provincia && c.sector ? " · " : ""}${c.sector || ""}</div>\n          <div class="dormido-meta" style="margin-top:3px;">Último pedido: ${ultimaLabel}</div>\n        </div>\n        <div style="flex-shrink:0;font-size:11px;color:var(--text3);">Ver →</div>\n      </div>`;
        })
        .join(""))
    : (list.innerHTML =
        '<div style="text-align:center;padding:30px;color:var(--text3);font-size:13px;">🎉 Ningún cliente recurrente dormido. ¡Buen trabajo!</div>'),
    abrirModal("modal-dormidos"));
}
function seleccionarClienteYCerrarModal(id, modalId) {
  (cerrarModal(modalId),
    (activeId = id),
    save(),
    cargarLista(),
    renderPerfil());
}
function filtrarRiesgo() {
  ((filtroRiesgo = !0),
    (filtroTemp = "todos"),
    document
      .querySelectorAll(".btn-filtro-temp")
      .forEach((b) => b.classList.remove("active")));
  const banner = document.getElementById("riesgo-banner");
  (banner && (banner.style.background = "rgba(255,59,48,0.18)"), cargarLista());
}
function limpiarFiltroRiesgo() {
  filtroRiesgo = !1;
  const banner = document.getElementById("riesgo-banner");
  (banner && (banner.style.background = ""),
    document.querySelector('.btn-filtro-temp[data-temp="todos"]')?.click());
}
function esMobil() {
  return window.innerWidth <= 768;
}
function cerrarSidebarMovil() {
  const sb = document.getElementById("sidebar"),
    ov = document.getElementById("mobile-overlay"),
    btn = document.getElementById("sidebar-toggle");
  esMobil() &&
    (sb.classList.remove("mobile-open"),
    ov.classList.remove("visible"),
    (btn.textContent = "☰"));
}
function renderAlertas() {
  var panel = document.getElementById("alerts-panel"),
    wrapper = document.getElementById("alerts-wrapper"),
    badge = document.getElementById("alerts-badge"),
    hoyStr = new Date().toISOString().slice(0, 10),
    vencidos = [];
  if (
    (db.forEach(function (cl) {
      ((cl.recordatorios || []).forEach(function (r) {
        !r.done &&
          r.fecha <= hoyStr &&
          vencidos.push({ empresa: cl.nombre, id: cl.id, rec: r });
      }),
        (cl.llamadas || []).forEach(function (l) {
          l &&
            "object" == typeof l &&
            "pendiente" === l.tipo &&
            l.fechaISO &&
            l.fechaISO <= hoyStr &&
            vencidos.push({
              empresa: cl.nombre,
              id: cl.id,
              rec: { texto: "Llamada: " + l.texto, fecha: l.fechaISO },
            });
        }));
    }),
    !vencidos.length)
  )
    return (
      wrapper && (wrapper.style.display = "none"),
      void (panel && (panel.innerHTML = ""))
    );
  (wrapper && (wrapper.style.display = "block"),
    badge && (badge.textContent = vencidos.length),
    vencidos.sort(function (a, b) {
      return a.rec.fecha < b.rec.fecha ? -1 : 1;
    }),
    panel &&
      (panel.innerHTML = vencidos
        .map(function (v) {
          var urg = v.rec.fecha < hoyStr;
          return (
            '<div class="alert-chip" onclick="seleccionarCliente(' +
            v.id +
            ')" style="' +
            (urg ? "border-left:3px solid #ef4444;" : "") +
            '"><span class="alert-ico">' +
            (urg ? "&#x1F534;" : "&#x26A0;") +
            '</span><div style="flex:1;min-width:0;"><div style="font-weight:600;color:var(--text);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
            v.empresa +
            '</div><div style="font-size:11px;">' +
            v.rec.texto +
            '</div><div style="font-size:10px;color:' +
            (urg ? "#ef4444" : "var(--text3)") +
            ';margin-top:1px;">' +
            (urg ? "Vencido: " : "Hoy: ") +
            v.rec.fecha +
            "</div></div></div>"
          );
        })
        .join("")));
}
function toggleAlertas() {
  var panel = document.getElementById("alerts-panel"),
    arrow = document.getElementById("alerts-arrow"),
    hidden = "none" === panel.style.display;
  ((panel.style.display = hidden ? "block" : "none"),
    arrow &&
      (arrow.style.transform = hidden ? "rotate(0deg)" : "rotate(-90deg)"));
  try {
    CRM_STORE.setItem("ncrm_alerts_open", hidden ? "1" : "0");
  } catch (e) {}
}
function initAlertasState() {
  var panel = document.getElementById("alerts-panel"),
    arrow = document.getElementById("alerts-arrow"),
    open = "0" !== CRM_STORE.getItem("ncrm_alerts_open");
  ((panel.style.display = open ? "block" : "none"),
    arrow &&
      (arrow.style.transform = open ? "rotate(0deg)" : "rotate(-90deg)"));
}
function seleccionarCliente(id) {
  ((activeId = id), save(), cargarLista(), renderPerfil());
}
function renderPanelHoy() {
  const panel = document.getElementById("panel-hoy");
  if (!panel) return;
  const hoyISO = new Date().toISOString().slice(0, 10),
    items = [];
  (db.forEach((c) => {
    ((c.llamadas || [])
      .filter(
        (l) =>
          l &&
          "object" == typeof l &&
          "pendiente" === l.tipo &&
          l.fechaISO &&
          l.fechaISO <= hoyISO,
      )
      .forEach((l) => {
        items.push({
          tipo: "crm",
          empresa: c.nombre,
          id: c.id,
          texto: "Llamada: " + l.texto,
          fecha: l.fechaISO,
          urgente: l.fechaISO < hoyISO,
        });
      }),
      (c.llamadas || [])
        .filter(
          (l) =>
            l &&
            "object" == typeof l &&
            "pendiente" === l.tipo &&
            l.fechaISO &&
            l.fechaISO <= hoyISO,
        )
        .forEach((l) => {
          items.push({
            tipo: "crm",
            empresa: c.nombre,
            id: c.id,
            texto: "Llamada: " + l.texto,
            fecha: l.fechaISO,
            urgente: l.fechaISO < hoyISO,
          });
        }),
      (c.recordatorios || [])
        .filter((r) => !r.done && r.fecha <= hoyISO)
        .forEach((r) => {
          items.push({
            tipo: "crm",
            empresa: c.nombre,
            id: c.id,
            texto: r.texto,
            fecha: r.fecha,
            urgente: r.fecha < hoyISO,
          });
        }));
  }),
    window._gCalEventosHoy &&
      window._gCalEventosHoy.length &&
      window._gCalEventosHoy.forEach((ev) => {
        items.push({
          tipo: "gcal",
          empresa: ev.summary || "(sin título)",
          id: null,
          texto: ev.hora || "",
          fecha: hoyISO,
          urgente: !1,
        });
      }),
    window._gTasksHoy &&
      window._gTasksHoy.length &&
      window._gTasksHoy.forEach((t) => {
        items.push({
          tipo: "gtask",
          empresa: t.title || "(sin título)",
          id: null,
          texto: t.due ? "Vence hoy" : "",
          fecha: hoyISO,
          urgente: !1,
        });
      }));
  const agendaBody = document.getElementById("acc-agenda"),
    agendaBtn = document.getElementById("acc-agenda-btn");
  if (!items.length)
    return (
      (panel.innerHTML =
        '<div style="font-size:12px;color:var(--text3);padding:6px 2px;text-align:center;">\n      ✅ Sin pendientes para hoy</div>'),
      agendaBody && agendaBody.classList.remove("open"),
      void (agendaBtn && agendaBtn.classList.remove("open"))
    );
  items.sort((a, b) => b.urgente - a.urgente || a.fecha.localeCompare(b.fecha));
  const iconos = { crm: "🔔", gcal: "📅", gtask: "☑️" },
    colBg = {
      crm: "rgba(255,149,0,",
      gcal: "rgba(124,58,237,",
      gtask: "rgba(16,185,129,",
    };
  ((panel.innerHTML = items
    .map((it) => {
      const urg = it.urgente,
        ico = iconos[it.tipo],
        bg = urg ? "rgba(255,59,48,0.07)" : colBg[it.tipo] + "0.06)",
        bc = urg ? "rgba(255,59,48,0.18)" : colBg[it.tipo] + "0.18)",
        tag = urg
          ? '<span style="font-size:9.5px;background:rgba(255,59,48,0.12);color:#dc2626;border-radius:4px;padding:1px 5px;font-weight:700;">VENCIDO</span>'
          : "gcal" === it.tipo
            ? '<span style="font-size:9.5px;background:rgba(124,58,237,0.10);color:var(--accent);border-radius:4px;padding:1px 5px;">Google Cal</span>'
            : "gtask" === it.tipo
              ? '<span style="font-size:9.5px;background:rgba(16,185,129,0.10);color:#059669;border-radius:4px;padding:1px 5px;">Google Task</span>'
              : "",
        click = null !== it.id ? `onclick="seleccionarCliente(${it.id})"` : "",
        btnHecho =
          "crm" === it.tipo && null !== it.id && it.texto && it.fecha
            ? `<button onclick="event.stopPropagation();marcarRecordatorioPorCliente(${it.id},'${(it.texto || "").replace(/'/g, "\\'")}','${it.fecha}')" style="flex-shrink:0;padding:2px 8px;border-radius:12px;border:1px solid rgba(34,197,94,0.35);background:rgba(34,197,94,0.08);color:#16a34a;cursor:pointer;font-size:10px;font-weight:700;">&#x2714;</button>`
            : "";
      return `<div style="padding:8px 10px;border-radius:9px;margin-bottom:5px;background:${bg};border:1px solid ${bc};">\n      <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">\n        <span ${click} style="font-size:13px;${null !== it.id ? "cursor:pointer;" : ""}">${ico}</span>\n        <span ${click} style="font-size:12px;font-weight:700;color:var(--text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${null !== it.id ? "cursor:pointer;" : ""}">${it.empresa}</span>\n        ${tag}${btnHecho}\n      </div>\n      ${it.texto ? `<div ${click} style="font-size:11px;color:var(--text2);padding-left:18px;${null !== it.id ? "cursor:pointer;" : ""}">${it.texto}</div>` : ""}\n    </div>`;
    })
    .join("")),
    agendaBody &&
      !agendaBody.classList.contains("open") &&
      (agendaBody.classList.add("open"),
      agendaBtn && agendaBtn.classList.add("open")));
  renderAgendaBar();
}
function calcFinanzas(c) {
  let total = 0,
    pagado = 0,
    pendiente = 0;
  return (
    (c.pedidos || []).forEach((p) => {
      const v = parseFloat(String(p.importe || 0).replace(",", ".")) || 0;
      ((total += v), "Pagado" === p.estado ? (pagado += v) : (pendiente += v));
    }),
    {
      total: total,
      pagado: pagado,
      pendiente: pendiente,
      nPedidos: c.pedidos.length,
    }
  );
}
function marcarRecordatorio(idx) {
  var cl = db.find(function (x) {
    return x.id === activeId;
  });
  if (cl) {
    var recs,
      rev,
      recTarget = cl.recordatorios
        .filter(function (r) {
          return !r.done;
        })
        .slice()
        .reverse()[idx],
      realIdx = cl.recordatorios.indexOf(recTarget);
    if (realIdx >= 0) {
      cl.recordatorios[realIdx].done = !0;
      const gtaskId = cl.recordatorios[realIdx].gtaskId;
      if (gtaskId && gToken) {
        gFetch(
          `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${gtaskId}`,
          { method: "PATCH", body: JSON.stringify({ status: "completed" }) },
        ).then((res) => {
          if (
            res &&
            res.ok &&
            "none" !== document.getElementById("gpanel-tasks")?.style.display
          )
            cargarTareasGoogle();
        });
      }
    }
    (save(), renderPerfil(), renderAlertas(), cargarLista(), renderPanelHoy());
  }
}
function marcarRecordatorioPorCliente(clientId, recTexto, recFecha) {
  var cl = db.find(function (x) {
    return x.id === clientId;
  });
  if (cl) {
    var found = !1;
    if (
      ((cl.recordatorios || []).forEach(function (r) {
        if (!r.done && r.texto === recTexto && r.fecha === recFecha) {
          r.done = !0;
          found = !0;
          const gtaskId = r.gtaskId;
          if (gtaskId && gToken) {
            gFetch(
              `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${gtaskId}`,
              {
                method: "PATCH",
                body: JSON.stringify({ status: "completed" }),
              },
            ).then((res) => {
              if (
                res &&
                res.ok &&
                "none" !==
                  document.getElementById("gpanel-tasks")?.style.display
              )
                cargarTareasGoogle();
            });
          }
        }
      }),
      (cl.llamadas || []).forEach(function (l) {
        l &&
          "object" == typeof l &&
          "pendiente" === l.tipo &&
          l.texto === recTexto &&
          ((l.tipo = "realizada"), (found = !0));
      }),
      found)
    ) {
      (save(),
        renderPerfil(),
        renderAlertas(),
        cargarLista(),
        renderPanelHoy(),
        mostrarToast("Tarea completada ✓", "ok"));
      var modal = document.getElementById("modal-hoy");
      modal && modal.classList.contains("active") && abrirModalHoy();
    }
  }
}
function abrirDashboard() {
  let totFac = 0,
    totPag = 0,
    totPend = 0;
  (db.forEach((c) => {
    const f = calcFinanzas(c);
    ((totFac += f.total), (totPag += f.pagado), (totPend += f.pendiente));
  }),
    (document.getElementById("dash-stats").innerHTML =
      `\n    <div class="dash-stat"><div class="dash-stat-val">${db.length}</div><div class="dash-stat-lbl">Empresas</div></div>\n    <div class="dash-stat"><div class="dash-stat-val" style="color:var(--accent)">${fmt(totFac)} €</div><div class="dash-stat-lbl">Total facturado</div></div>\n    <div class="dash-stat"><div class="dash-stat-val" style="color:var(--accent2)">${fmt(totPag)} €</div><div class="dash-stat-lbl">Total cobrado</div></div>\n    <div class="dash-stat"><div class="dash-stat-val" style="color:var(--accent4)">${fmt(totPend)} €</div><div class="dash-stat-lbl">Pendiente cobro</div></div>`),
    abrirModal("modal-dashboard"),
    chartDonut && (chartDonut.destroy(), (chartDonut = null)),
    chartBars && (chartBars.destroy(), (chartBars = null)),
    chartTop && (chartTop.destroy(), (chartTop = null)),
    setTimeout(() => {
      Chart.defaults.color = "#6d6d72";
      let nPag = 0,
        nEnv = 0,
        nPend = 0;
      (db.forEach((c) =>
        c.pedidos.forEach((p) => {
          "Pagado" === p.estado
            ? nPag++
            : "Enviado" === p.estado
              ? nEnv++
              : nPend++;
        }),
      ),
        (chartDonut = new Chart(document.getElementById("chart-donut"), {
          type: "doughnut",
          data: {
            labels: ["Pagado", "Enviado", "Pendiente"],
            datasets: [
              {
                data: [nPag, nEnv, nPend],
                backgroundColor: ["#00d4a0", "#60a5fa", "#f7c948"],
                borderWidth: 0,
                hoverOffset: 6,
              },
            ],
          },
          options: {
            responsive: !0,
            plugins: {
              legend: {
                position: "bottom",
                labels: { padding: 16, font: { size: 12 } },
              },
            },
            cutout: "65%",
          },
        })));
      const anoActual = new Date().getFullYear(),
        meses = Array(12).fill(0);
      (db.forEach((c) =>
        c.pedidos.forEach((p) => {
          if (!p.fecha) return;
          const parts = p.fecha.split("-");
          if (parts.length < 2) return;
          const y = parseInt(parts[0]),
            m = parseInt(parts[1]) - 1;
          y === anoActual &&
            m >= 0 &&
            m < 12 &&
            (meses[m] +=
              parseFloat(String(p.importe || 0).replace(",", ".")) || 0);
        }),
      ),
        (chartBars = new Chart(document.getElementById("chart-bars"), {
          type: "bar",
          data: {
            labels: [
              "Ene",
              "Feb",
              "Mar",
              "Abr",
              "May",
              "Jun",
              "Jul",
              "Ago",
              "Sep",
              "Oct",
              "Nov",
              "Dic",
            ],
            datasets: [
              {
                label: "Facturado €",
                data: meses,
                backgroundColor: "rgba(124,58,237,0.85)",
                borderRadius: 5,
                borderSkipped: !1,
              },
            ],
          },
          options: {
            responsive: !0,
            plugins: { legend: { display: !1 } },
            scales: {
              x: {
                grid: { color: "rgba(209,209,214,.6)" },
                ticks: { font: { size: 11 } },
              },
              y: {
                grid: { color: "rgba(209,209,214,.6)" },
                ticks: { callback: (v) => fmt(v) + " €", font: { size: 11 } },
              },
            },
          },
        })));
      const ranking = db
        .map((c) => ({ nombre: c.nombre, total: calcFinanzas(c).total }))
        .filter((x) => x.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      chartTop = new Chart(document.getElementById("chart-top"), {
        type: "bar",
        data: {
          labels: ranking.map((x) =>
            x.nombre.length > 28 ? x.nombre.slice(0, 26) + "…" : x.nombre,
          ),
          datasets: [
            {
              data: ranking.map((x) => x.total),
              backgroundColor: "rgba(124,58,237,.75)",
              borderRadius: 4,
              borderSkipped: !1,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: !0,
          plugins: { legend: { display: !1 } },
          scales: {
            x: {
              grid: { color: "rgba(209,209,214,.6)" },
              ticks: { callback: (v) => fmt(v) + " €", font: { size: 11 } },
            },
            y: { grid: { display: !1 }, ticks: { font: { size: 11 } } },
          },
        },
      });
    }, 100));
}
function renderPresupuestosHist(cl) {
  var card = document.getElementById("card-presupuestos-hist"),
    lista = document.getElementById("lista-presupuestos-hist");
  if (card && lista) {
    var pres = cl.presupuestos || [];
    pres.length
      ? ((card.style.display = "block"),
        (lista.innerHTML =
          '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:rgba(139,92,246,0.08);"><th style="padding:5px 8px;text-align:left;color:var(--text3);font-weight:600;">Ref.</th><th style="padding:5px 8px;text-align:left;color:var(--text3);font-weight:600;">Fecha</th><th style="padding:5px 8px;text-align:left;color:var(--text3);font-weight:600;">Concepto</th><th style="padding:5px 8px;text-align:right;color:var(--text3);font-weight:600;">Importe</th><th style="padding:5px 8px;"></th></tr></thead><tbody>' +
          pres
            .slice()
            .reverse()
            .map(function (p, ri) {
              var i = pres.length - 1 - ri;
              return (
                '<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px 8px;font-family:monospace;font-size:11px;color:var(--text3);">' +
                p.ref +
                '</td><td style="padding:5px 8px;color:var(--text3);">' +
                p.fecha +
                (p.hora
                  ? ' <span style="font-size:10px;">' + p.hora + "</span>"
                  : "") +
                '</td><td style="padding:5px 8px;">' +
                (p.modelo || p.material || "—").slice(0, 28) +
                '</td><td style="padding:5px 8px;text-align:right;font-weight:700;color:#8b5cf6;">' +
                (p.importe
                  ? parseFloat(p.importe).toLocaleString("es-ES", {
                      minimumFractionDigits: 2,
                    }) + " €"
                  : "—") +
                '</td><td style="padding:5px 8px;white-space:nowrap;"><button onclick="reimprimirPresupuesto(' + i + ')" title="Ver / imprimir" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--text2);cursor:pointer;margin-right:4px;">📄</button><button onclick="borrarPresupuestoHist(' +
                i +
                ')" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid rgba(239,68,68,0.3);background:transparent;color:#ef4444;cursor:pointer;">✕</button></td></tr>'
              );
            })
            .join("") +
          "</tbody></table>"))
      : (card.style.display = "none");
  }
}
function borrarPresupuestoHist(idx) {
  var cl = db.find(function (x) {
    return x.id === activeId;
  });
  cl &&
    cl.presupuestos &&
    confirm("¿Eliminar este presupuesto del historial?") &&
    (cl.presupuestos.splice(idx, 1), save(), renderPerfil());
}
function renderPerfil() {
  const area = document.getElementById("main-area"),
    c = db.find((x) => x.id === activeId);
  if (!c)
    return void (area.innerHTML =
      '<div class="empty-screen">\n      <div class="empty-icon">🏢</div>\n      <div class="empty-title">Sin empresas aún</div>\n      <div class="empty-sub">Importa tu CSV o crea una empresa nueva para empezar.</div>\n    </div>');
  const visTexto = (v) => ("string" == typeof v ? v : v.text || ""),
    fmtActivityNotas = (arr) => {
      if (!arr || 0 === arr.length)
        return '<div class="empty-state">Sin notas.</div>';
      for (var html = "", ri = arr.length - 1; ri >= 0; ri--) {
        var x = arr[ri],
          realIdx = ri,
          isObj = "object" == typeof x && null !== x,
          texto,
          fecha,
          adj,
          adjT,
          adjN;
        if (isObj)
          ((texto = x.texto || ""),
            (fecha = x.fecha || ""),
            (adj = x.adjunto || null),
            (adjT = x.adjuntoTipo || ""),
            (adjN = x.adjuntoNombre || ""));
        else {
          var pp = (x || "").split(": ");
          ((fecha = pp.shift() || ""),
            (texto = pp.join(": ")),
            (adj = null),
            (adjT = ""),
            (adjN = ""));
        }
        var adjHTML = "",
          horaDisplay;
        (adj &&
          (0 === adjT.indexOf("image/")
            ? (adjHTML =
                '<div style="margin-top:6px;"><img src="' +
                adj +
                '" style="max-width:100%;max-height:200px;border-radius:6px;cursor:pointer;border:1px solid var(--border);" onclick="verAdjuntoNota(' +
                realIdx +
                ')"></div>')
            : "application/pdf" === adjT &&
              (adjHTML =
                '<div style="margin-top:6px;"><button onclick="verAdjuntoNota(' +
                realIdx +
                ')" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--accent);cursor:pointer;font-size:11px;">PDF: ' +
                adjN +
                "</button></div>")),
          (html +=
            '<div class="activity-item nota" style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;"><div style="flex:1;min-width:0;"><div class="activity-date">' +
            fecha +
            (isObj && x.hora
              ? ' <span style="font-size:10px;color:var(--text3);">' +
                x.hora +
                "</span>"
              : "") +
            '</div><div class="activity-text">' +
            texto +
            "</div>" +
            adjHTML +
            '</div><button onclick="delNota(' +
            realIdx +
            ')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0;">&#x2715;</button></div>'));
      }
      return html;
    },
    fmtActivity = (arr, cls) =>
      0 === arr.length
        ? '<div class="empty-state">Sin registros todavía.</div>'
        : [...arr]
            .reverse()
            .map((x, revIdx) => {
              const realIdx = arr.length - 1 - revIdx,
                isLlamObj = "object" == typeof x && null !== x && x.tipo,
                raw = isLlamObj ? x.fecha + ": " + x.texto : visTexto(x),
                hora = isLlamObj
                  ? x.hora || ""
                  : ("object" == typeof x && null !== x && x.horaRegistro) ||
                    "",
                pendiente = isLlamObj && "pendiente" === x.tipo,
                [date, ...rest] = raw.split(": "),
                canDelete =
                  "nota" === cls || "visita" === cls || "llamada" === cls,
                gcalId =
                  ("visita" === cls && "object" == typeof x && x.gcalEventId) ||
                  "",
                gcalTag = void 0,
                delFn =
                  "visita" === cls
                    ? `eliminarVisita(${realIdx})`
                    : "llamada" === cls
                      ? `eliminarActividad('llamada',${realIdx})`
                      : `eliminarActividad('nota',${realIdx})`;
              return `<div class="activity-item ${cls}" style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;">\n          <div style="flex:1;min-width:0;">\n            <div class="activity-date">${date}${hora ? ` <span style="font-size:10px;color:var(--text3);margin-left:4px;">${hora}</span>` : ""} ${pendiente ? '<span style="font-size:10px;padding:1px 7px;border-radius:8px;background:rgba(245,158,11,0.15);color:#d97706;font-weight:700;margin-left:4px;">Pendiente</span>' : ""} ${gcalId ? '<span title="Vinculado a Google Calendar" style="font-size:10px;color:var(--accent);margin-left:4px;">📅</span>' : ""}</div>\n            <div class="activity-text">${rest.join(": ")}</div>\n          </div>\n          <div style="display:flex;align-items:center;gap:4px;">\n            ${"visita" === cls ? `<button style="font-size:11px;padding:3px 9px;border-radius:6px;border:1px solid rgba(99,102,241,0.35);background:rgba(99,102,241,0.08);color:var(--accent);cursor:pointer;margin-right:4px;" onclick="abrirReplanVisita(${realIdx})">📅 Replanificar</button>` : ""}\n            ${canDelete ? `<button onclick="${delFn}" title="Borrar" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 4px;flex-shrink:0;line-height:1;" onmouseover="this.style.color='var(--accent3)'" onmouseout="this.style.color='var(--text3)'">✕</button>` : ""}\n          </div>\n        </div>`;
            })
            .join(""),
    statusCls = (s) =>
      "Pagado" === s
        ? "status-pagado"
        : "Enviado" === s
          ? "status-enviado"
          : "status-pendiente",
    pedRows =
      0 === c.pedidos.length
        ? '<tr><td colspan="13"><span class="empty-state">Sin pedidos.</span></td></tr>'
        : [...c.pedidos]
            .reverse()
            .map(
              (p) =>
                `\n        <tr>\n          <td><span style="font-family:var(--mono);font-size:11.5px;">${p.id}</span></td>\n          <td style="font-size:11.5px;">${p.empresa || c.nombre || "—"}</td>\n          <td style="font-size:11.5px;color:var(--text3);">${p.cif || c.cif || "—"}</td>\n          <td style="font-size:11.5px;color:var(--text3);">${p.ref || "—"}</td>\n          <td style="text-align:right;">${p.cantidad ? Number(p.cantidad).toLocaleString("es-ES") : "—"}</td>\n          <td style="text-align:right;color:var(--text2);">${p.precio ? p.precio + " €" : "—"}</td>\n          <td>${p.fechaRegistro || p.fecha || "—"}${p.horaRegistro ? ' <span style="font-size:10px;color:var(--text3);">' + p.horaRegistro + "</span>" : ""}</td>\n          <td>${p.fechaEntrega || "—"}</td>\n          <td><strong>${p.importe ? p.importe + " €" : "—"}</strong>${p.extras ? `<span style="font-size:11px;color:var(--text3);margin-left:6px;">(${p.extras > 0 ? "+" : "−"} ${Math.abs(p.extras).toFixed(2)} € extras)</span>` : ''}</td>\n          <td>\n            <select class="status-select ${statusCls(p.estado)}" onchange="cambiarEstado('${p.id}',this)">\n              <option value="Pendiente" ${"Pendiente" === p.estado ? "selected" : ""}>Pendiente</option>\n              <option value="Enviado"   ${"Enviado" === p.estado ? "selected" : ""}>Enviado</option>\n              <option value="Pagado"    ${"Pagado" === p.estado ? "selected" : ""}>Pagado</option>\n            </select>\n          </td>\n          <td style="white-space:nowrap;"><button class="btn-reorder" onclick="repetirPedido('${p.id}')">🔁 Repetir</button> <button class="btn-reorder" style="background:rgba(99,102,241,0.08);color:#6366f1;border-color:rgba(99,102,241,0.25);" onclick="generarPDFPedido('${p.id}')">📄 PDF</button></td>\n          <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--text3);" title="${p.notas || ""}">${p.notas ? "📝 " + p.notas.substring(0, 25) + "…" : "—"}</td>\n          <td><button class="btn-del-order" onclick="eliminarPedido('${p.id}')">✕</button></td>\n        </tr>`,
            )
            .join(""),
    fin = calcFinanzas(c),
    telLimpio = void 0,
    waLink = (function () {
      var _t = (c.telefono || "").replace(/\D/g, "");
      if (!_t) return "";
      var _n = (_t.length <= 9 ? "34" : "") + _t;
      return (
        '<a class="meta-chip wa" href="https://wa.me/' +
        _n +
        '" target="_blank" rel="noopener"><span class="ico">💬</span>WhatsApp</a>'
      );
    })(),
    dir = void 0,
    mapsLink = `<a class="meta-chip maps" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((c.municipio || c.direccion || c.provincia || c.nombre) + " España")}" target="_blank"><span class="ico">📍</span>Ir con Maps</a>`,
    hoyStr = new Date().toISOString().slice(0, 10),
    recs = (c.recordatorios || []).filter((r) => !r.done),
    recsHtml =
      0 === recs.length
        ? '<div class="empty-state">Sin recordatorios.</div>'
        : [...recs]
            .reverse()
            .map((r, ri) => {
              let cls = "futuro";
              r.fecha < hoyStr
                ? (cls = "vencido")
                : r.fecha === hoyStr && (cls = "hoy");
              const lbl =
                r.fecha < hoyStr
                  ? "Vencido"
                  : r.fecha === hoyStr
                    ? "Hoy"
                    : r.fecha;
              return `<div class="activity-item recordatorio">\n        <div style="flex:1"><div class="activity-date">Vence: ${r.fecha}</div><div class="activity-text">${r.texto}</div></div>\n        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">\n          <span class="rec-due ${cls}">${lbl}</span>\n          <div style="display:flex;gap:4px;"><button class="btn-rec-done" onclick="marcarRecordatorio(${ri})">✔ Hecho</button><button class="btn-rec-done" style="background:var(--bg);color:var(--text3);border-color:var(--border);" onclick="abrirReplanRecordatorio(${ri})" title="Replanificar">📅</button><button class="btn-rec-done" style="background:var(--bg);color:var(--text3);border-color:var(--border);" onclick="eliminarRecordatorio(${ri})">✕</button></div>\n        </div></div>`;
            })
            .join(""),
    _isCartera = false;
  ((area.innerHTML = `\n    \n    <div style="">\n    <div class="profile-header" style="margin-top:12px;">\n      <div class="profile-header-top">\n        <div>\n          <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:4px;">\n            <div class="company-name" style="margin-bottom:0;">${esc(c.nombre)}</div>\n            ${(() => {
    const e = getEtqInfo(c);
    return `<span class="etq-pill ${e.cls}">${esc(e.label)}</span>`;
  })()}\n          </div>\n          <div class="contact-name" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">\n            <span>👤 <span style="background:rgba(124,58,237,0.10);color:var(--accent);border-radius:5px;padding:2px 8px;font-size:12px;font-weight:500;">${esc(c.contacto) || "Sin contacto"}</span></span>\n            <span class="temp-badge ${getTemperatura(c).css}">${getTemperatura(c).label}${getTemperatura(c).dias !== 1 / 0 ? " · " + getTemperatura(c).dias + "d" : ""}</span>\n          </div>\n          <div class="profile-meta">\n            ${c.telefono ? `<div class="meta-chip"><span class="ico">&#128241;</span>${c.telefono}</div>` : ""}\n            ${c.telefonoFijo ? `<div class="meta-chip"><span class="ico">&#9742;&#65039;</span>${c.telefonoFijo}</div>` : ""}\n            ${waLink}\n            ${c.email ? `<div class="meta-chip" style="cursor:pointer;" onclick="window.open('mailto:${c.email}?body=${encodeURIComponent("Hola, solicito presupuesto para: ")}','_blank')" title="Enviar email"><span class="ico">✉️</span><u>${c.email}</u></div>` : ""}\n            ${mapsLink}\n            ${c.provincia ? `<div class="meta-chip"><span class="ico">🗺️</span>${c.provincia}</div>` : ""}\n            ${c.sector ? `<div class="meta-chip"><span class="ico">📦</span>${c.sector}</div>` : ""}\n          </div>\n        </div>\n        <div class="header-actions">\n          <button class="btn-edit" onclick="abrirPlantillas()" style="background:rgba(37,211,102,0.10);color:#16a34a;border:1px solid rgba(37,211,102,0.3);">💬 Plantillas</button>\n          <button class="btn-edit" onclick="abrirModalCliente(true)">✏️ Editar</button>\n          <button class="btn-del-client" onclick="eliminarCliente()">🗑️ Eliminar</button>\n        </div>\n      </div>\n    </div>\n<!-- RESUMEN FINANCIERO -->\n    <div class="fin-summary" style="padding:0 32px 4px;">\n      <div class="fin-card">\n        <div class="fin-label">Total facturado</div>\n        <div class="fin-value total">${fmt(fin.total)} €</div>\n        <div class="fin-sub">${fin.nPedidos} pedido${1 !== fin.nPedidos ? "s" : ""}</div>\n      </div>\n      <div class="fin-card">\n        <div class="fin-label">Pendiente de cobro</div>\n        <div class="fin-value pendiente">${fmt(fin.pendiente)} €</div>\n        <div class="fin-sub">${c.pedidos.filter((p) => "Pagado" !== p.estado).length} sin cobrar</div>\n      </div>\n      <div class="fin-card">\n        <div class="fin-label">Total pagado</div>\n        <div class="fin-value pagado">${fmt(fin.pagado)} €</div>\n        <div class="fin-sub">${c.pedidos.filter((p) => "Pagado" === p.estado).length} cobrados</div>\n      </div>\n    </div>\n\n    \n\n    <div class="content-area">\n      <div class="grid-2">\n        <div class="card">\n          <div class="card-title green">Llamadas</div>\n          <textarea class="inner-textarea" id="nueva-llamada" rows="2" placeholder="Resumen de la llamada..."></textarea>\n          <div style="display:flex;gap:6px;margin-top:6px;">\n            <button class="btn-add btn-add-green" onclick="addActivity('llamada')" style="flex:1;">+ Registrar llamada</button>\n            <button class="btn-add" onclick="abrirPlanificar('llamada')" style="flex:1;background:rgba(34,197,94,0.07);color:#16a34a;border:1px solid rgba(34,197,94,0.3);">Planificar llamada</button>\n          </div>\n          <div class="activity-list">${fmtActivity(c.llamadas, "llamada")}</div>\n        </div>\n        <div class="card">\n          <div class="card-title blue">Visitas</div>\n          <div style="display:flex;gap:6px;margin-bottom:4px;">\n            <button class="btn-add btn-add-blue" onclick="abrirModalVisita()" style="flex:1;">Registrar visita</button>\n            <button class="btn-add" onclick="abrirPlanificar('visita')" style="flex:1;background:rgba(59,130,246,0.07);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);">Planificar visita</button>\n          </div>\n          <div class="activity-list">${fmtActivity(c.visitas, "visita")}</div>\n        </div>\n      </div>\n\n      <div class="grid-2">\n        <div class="card">\n          <div class="card-title yellow">Notas generales</div>\n          <textarea class="inner-textarea" id="nueva-nota" rows="2" placeholder="Añade un apunte..."></textarea>\n          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">\n            <button class="btn-add btn-add-gray" onclick="addActivity('nota')" style="flex:1;">+ Añadir nota</button>\n            \n          </div>\n          <div class="activity-list">${fmtActivityNotas(c.notas)}</div>\n        </div>\n        <!-- HISTÓRICO DE OFERTAS (columna derecha del grid) -->\n        <div class="card">\n          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">\n            <div class="card-title" style="margin-bottom:0;padding-bottom:0;border:none;display:flex;align-items:center;gap:8px;">\n              <span style="display:inline-block;width:4px;height:18px;border-radius:2px;background:#f59e0b;"></span>\n              💼 Histórico de Ofertas\n            </div>\n            \n            <button class="btn-add" onclick="abrirModalPresupuesto()" style="margin:0;padding:5px 12px;font-size:12px;background:rgba(99,102,241,0.09);color:#6366f1;border:1px solid rgba(99,102,241,0.3);">Nuevo presupuesto</button>\n          </div>\n          <div id="lista-ofertas" style="display:flex;flex-direction:column;gap:8px;">\n            ${renderDocsList(c.id, "oferta")}\n          </div>\n        </div>\n      </div>\n\n      <div class="card" id="card-presupuestos-hist" style="display:none;">\n        <div class="card-title" style="margin-bottom:10px;color:#8b5cf6;">📄 Presupuestos enviados</div>\n        <div id="lista-presupuestos-hist"></div>\n      </div>\n      <div class="card">\n        <div class="card-title red" style="margin-bottom:12px;">Historial de Pedidos / Ofertas</div>\n        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;">\n          <button class="btn-add btn-add-blue" onclick="abrirModalPedido()" style="flex:1;">Nuevo pedido</button>\n          <button class="btn-add" onclick="abrirModalPresupuesto()" style="flex:1;background:rgba(99,102,241,0.09);color:#6366f1;border:1px solid rgba(99,102,241,0.3);">Nuevo presupuesto</button>\n        </div>\n        <div class="table-wrap">\n          <table>\n            <thead><tr><th>Nº pedido</th><th>Empresa</th><th>CIF</th><th>Concepto</th><th>Cant.</th><th>Precio ud.</th><th>Fecha</th><th>Entrega</th><th>Importe</th><th>Estado</th><th>Notas</th><th></th><th></th></tr></thead>\n            <tbody>${pedRows}</tbody>\n          </table>\n        </div>\n      </div>\n\n      <!-- FICHAS TÉCNICAS -->\n      <div class="card" style="margin-top:16px;">\n        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">\n          <div class="card-title" style="margin-bottom:0;padding-bottom:0;border:none;display:flex;align-items:center;gap:8px;">\n            <span style="display:inline-block;width:4px;height:18px;border-radius:2px;background:#8b5cf6;"></span>\n            📐 Fichas Técnicas\n          </div>\n          \n        </div>\n        <div id="lista-fichas" style="display:flex;flex-direction:column;gap:8px;">\n          ${renderDocsList(c.id, "ficha")}\n        </div>\n      </div>\n\n      <!-- RECORDATORIOS -->\n      <div class="card" style="margin-top:16px;">\n        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">\n          <div class="card-title purple" style="margin-bottom:0;">Recordatorios</div>\n          <button class="btn-add btn-add-purple" onclick="abrirModal('modal-recordatorio')" style="margin:0;padding:5px 14px;font-size:12px;">🔔 Añadir recordatorio</button>\n        </div>\n        <div class="activity-list" style="margin-top:10px;">${recsHtml}</div>\n      </div>\n\n    <div style="margin-top:24px;padding:0 0 16px;">\n  <div id="historial-acciones-cont">\n    <p style="color:var(--text3);font-size:12px;">Cargando historial...</p>\n  </div>\n</div>\n\n    </div>`),
    c && renderPresupuestosHist(c));
  if (typeof cargarHistorialAcciones === 'function') {
    cargarHistorialAcciones(activeId);
  }
  // FIX AUTOFOCUS: al cargar la ficha, poner foco en txt de llamada
  setTimeout(function () {
    var elL = document.getElementById("nueva-llamada");
    if (elL && document.activeElement !== elL) elL.focus();
  }, 80);
}
function docsKey(clientId, tipo) {
  return `ncrm_docs_${clientId}_${tipo}`;
}
function getDocs(clientId, tipo) {
  try {
    const raw = CRM_STORE.getItem(docsKey(clientId, tipo));
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveDocs(clientId, tipo, arr) {
  try {
    CRM_STORE.setItem(docsKey(clientId, tipo), JSON.stringify(arr));
  } catch (e) {
    alert(
      "No hay espacio suficiente en el navegador para guardar este PDF. Intenta eliminar documentos antiguos.",
    );
  }
}
function renderDocsList(clientId, tipo) {
  const docs = getDocs(clientId, tipo);
  if (!docs.length) {
    const label = void 0;
    return `<div style="color:var(--text3);font-size:12.5px;padding:8px 0;">Sin ${"ficha" === tipo ? "fichas técnicas" : "ofertas"} guardadas.</div>`;
  }
  return docs
    .map(
      (d, i) =>
        `\n    <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg2);border-radius:8px;border:1px solid var(--border);">\n      <span style="font-size:20px;">📄</span>\n      <div style="flex:1;min-width:0;">\n        <div style="font-size:13px;font-weight:600;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${d.nombre}</div>\n        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${d.fecha}${d.hora ? " · " + d.hora : ""}</div>\n      </div>\n      <button onclick="verDoc('${clientId}','${tipo}',${i})"\n        style="border:none;background:#1a73e8;color:#fff;padding:5px 12px;border-radius:5px;font-size:12px;cursor:pointer;font-weight:500;white-space:nowrap;">\n        👁️ Ver\n      </button>\n      <button onclick="eliminarDoc('${clientId}','${tipo}',${i})"\n        style="border:none;background:var(--accent3);color:#fff;padding:5px 10px;border-radius:5px;font-size:12px;cursor:pointer;">\n        ✕\n      </button>\n    </div>`,
    )
    .join("");
}
function subirDocs(event, tipo, clientId) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  const docs = getDocs(clientId, tipo);
  let pending = files.length;
  (files.forEach((file) => {
    if ("application/pdf" !== file.type)
      return (alert(`"${file.name}" no es un PDF.`), void pending--);
    const reader = new FileReader();
    ((reader.onload = (e) => {
      if (
        (docs.push({
          id: Date.now() + Math.random(),
          nombre: file.name,
          fecha: new Date().toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          hora: fechaHoraAhora().hora,
          data: e.target.result,
        }),
        pending--,
        pending <= 0)
      ) {
        saveDocs(clientId, tipo, docs);
        const listaId = "ficha" === tipo ? "lista-fichas" : "lista-ofertas",
          el = document.getElementById(listaId);
        (el && (el.innerHTML = renderDocsList(clientId, tipo)),
          mostrarToast(
            "📄 " +
              (files.length > 1
                ? files.length + " documentos guardados"
                : '"' + files[0].name + '" guardado'),
            "ok",
          ));
      }
    }),
      reader.readAsDataURL(file));
  }),
    (event.target.value = ""));
}
function verDoc(clientId, tipo, idx) {
  var doc = getDocs(clientId, tipo)[idx];
  if (!doc) {
    alert("Documento no encontrado.");
    return;
  }

  // El PDF se guardó como data:application/pdf;base64,... o data:...
  var dataUrl = doc.data || "";

  if (!dataUrl) {
    alert("El archivo no tiene datos guardados.");
    return;
  }

  try {
    // Convertir data URL a Blob para evitar problemas de CSP
    var arr = dataUrl.split(",");
    var mime = (arr[0].match(/:(.*?);/) || [])[1] || "application/pdf";
    var bstr = atob(arr[1]);
    var n = bstr.length;
    var u8 = new Uint8Array(n);
    for (var i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
    var blob = new Blob([u8], { type: mime });
    var blobUrl = URL.createObjectURL(blob);

    // Abrir en ventana nueva con wrapper HTML para iframe a pantalla completa
    var win = window.open("", "_blank", "width=960,height=820");
    if (!win) {
      // El bloqueador de popups intervino: abrir directamente el blob URL
      var a = document.createElement("a");
      a.href = blobUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
      return;
    }
    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' +
        doc.nombre.replace(/</g, "&lt;") +
        "</title>" +
        "<style>*{margin:0;padding:0;box-sizing:border-box;}html,body{width:100%;height:100%;background:#525659;}" +
        "iframe{display:block;width:100%;height:100%;border:none;}</style></head>" +
        '<body><iframe src="' +
        blobUrl +
        '"></iframe></body></html>',
    );
    win.document.close();
    // Liberar el blob URL cuando se cierre la ventana
    win.addEventListener("unload", function () {
      URL.revokeObjectURL(blobUrl);
    });
  } catch (err) {
    console.error("Error abriendo PDF:", err);
    // Fallback: abrir el data URL directamente
    var w = window.open("", "_blank");
    if (w) {
      w.document.write(
        '<iframe src="' +
          dataUrl +
          '" style="width:100vw;height:100vh;border:none;"></iframe>',
      );
      w.document.close();
    } else {
      alert("Activa ventanas emergentes para ver el PDF.");
    }
  }
}
function eliminarDoc(clientId, tipo, idx) {
  const docs = getDocs(clientId, tipo),
    doc = docs[idx];
  if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
  (docs.splice(idx, 1), saveDocs(clientId, tipo, docs));
  const listaId = "ficha" === tipo ? "lista-fichas" : "lista-ofertas",
    el = document.getElementById(listaId);
  (el && (el.innerHTML = renderDocsList(clientId, tipo)),
    mostrarToast("Documento eliminado", "ok"));
}
function addActivity(tipo) {
  var c = db.find(function (x) {
    return x.id === activeId;
  });
  if (!c) return;
  var el = document.getElementById("nueva-" + tipo);
  var txt = el ? el.value.trim() : "";
  if (!txt) return;

  if ("nota" === tipo) {
    var fh = fechaHoraAhora();
    c.notas.push({
      texto: txt,
      fecha: fh.fecha,
      hora: fh.hora,
      ts: fh.ts,
      adjunto: null,
      adjuntoTipo: null,
      adjuntoNombre: null,
    });
  } else if ("llamada" === tipo) {
    var fh = fechaHoraAhora();
    c.llamadas.push({
      texto: txt,
      fecha: fh.fecha,
      hora: fh.hora,
      tipo: "realizada",
      ts: fh.ts,
    });
  }

  save();
  if (el) el.value = "";

  // FIX SCROLL: guardamos la posición del scroll del main antes de re-renderizar
  var mainEl = document.getElementById("main-area");
  var scrollPos = mainEl ? mainEl.scrollTop : 0;

  renderPerfil();
  renderPanelHoy();

  // Restaurar scroll para evitar el salto brusco al inicio
  if (mainEl) mainEl.scrollTop = scrollPos;

  // FIX AUTOFOCUS: devolver foco al textarea de llamada/nota tras guardar
  setTimeout(function () {
    var elPost = document.getElementById("nueva-" + tipo);
    if (elPost) elPost.focus();
  }, 50);
}
function abrirModalVisita() {
  const c = db.find((x) => x.id === activeId);
  c &&
    ((document.getElementById("vis-fecha").value = new Date()
      .toISOString()
      .slice(0, 10)),
    (document.getElementById("vis-hora-ini").value = "09:00"),
    (document.getElementById("vis-hora-fin").value = ""),
    (document.getElementById("vis-lugar").value =
      c.direccion || c.provincia || ""),
    (document.getElementById("vis-notas").value = ""),
    abrirModal("modal-visita"));
}
function guardarVisita() {
  const c = db.find((x) => x.id === activeId);
  if (!c) return;
  const fecha = document.getElementById("vis-fecha").value,
    horaIni = document.getElementById("vis-hora-ini").value,
    horaFin = document.getElementById("vis-hora-fin").value,
    lugar = document.getElementById("vis-lugar").value.trim(),
    notas = document.getElementById("vis-notas").value.trim();
  if (!fecha) return void alert("Indica la fecha de la visita");
  let resumen = notas || "(sin notas)";
  (horaIni &&
    (resumen = `${horaIni}${horaFin ? " – " + horaFin : ""} | ${resumen}`),
    lugar && (resumen += ` | 📍 ${lugar}`));
  const fechaES = new Date(fecha + "T12:00:00").toLocaleDateString("es-ES"),
    fhV = fechaHoraAhora(),
    visObj = {
      text: `${fechaES}: ${resumen}`,
      gcalEventId: "",
      horaRegistro: fhV.hora,
      ts: fhV.ts,
    };
  c.visitas.push(visObj);
  const visIdx = c.visitas.length - 1;
  (save(), cerrarModal("modal-visita"), renderPerfil(), renderPanelHoy());
  const titulo = void 0,
    desc = void 0;
  ofrecerGCal({
    fecha: fecha,
    horaIni: horaIni,
    horaFin: horaFin,
    titulo: `Visita: ${c.nombre}`,
    desc: [notas, lugar ? "📍 " + lugar : ""].filter(Boolean).join("\n"),
    clienteId: c.id,
    visIdx: visIdx,
  });
}
function sumarHora(hhmm, horas) {
  const [h, m] = hhmm.split(":").map(Number),
    total = 60 * h + m + 60 * horas;
  return (
    String(Math.floor(total / 60) % 24).padStart(2, "0") +
    ":" +
    String(total % 60).padStart(2, "0")
  );
}
function ofrecerGCal({
  fecha: fecha,
  horaIni: horaIni,
  horaFin: horaFin,
  titulo: titulo,
  desc: desc,
  clienteId: clienteId,
  visIdx: visIdx,
}) {
  const c = db.find((x) => x.id === (null != clienteId ? clienteId : activeId));
  const horaLabel = horaIni
    ? ` · ${horaIni}${horaFin ? " – " + horaFin : ""}`
    : "";
  const fechaLabel = new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const textoEl = document.getElementById("gcal-confirm-texto");
  const accionEl = document.getElementById("gcal-confirm-acciones");

  const toGCalDT = (fechaISO, hora) => {
    return `${fechaISO.replace(/-/g, "")}T${(hora || "09:00").replace(":", "") + "00"}`;
  };
  const ini = toGCalDT(fecha, horaIni || "09:00");
  const finH = horaFin || sumarHora(horaIni || "09:00", 1);
  const finStr = toGCalDT(fecha, finH);

  const loc = c?.direccion || c?.provincia || "";
  const gcalUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
    encodeURIComponent(titulo) +
    "&dates=" +
    ini +
    "/" +
    finStr +
    "&details=" +
    encodeURIComponent(desc || "Visita registrada en el CRM") +
    (loc ? "&location=" + encodeURIComponent(loc) : "");

  document.getElementById("gcal-confirm-titulo").textContent =
    "¿Añadir a Google Calendar?";
  document.getElementById("gcal-confirm-ico").textContent = "📅";
  textoEl.innerHTML = `<strong>${titulo}</strong><br>${fechaLabel}${horaLabel}${desc ? '<br><span style="opacity:.65;font-size:12px;">' + desc + "</span>" : ""}`;

  if (gToken) {
    const formatearGCalISO = (f, h) => {
      const partes = f.split("-");
      const hParts = (h || "09:00").split(":");
      return (
        partes[0] +
        "-" +
        partes[1] +
        "-" +
        partes[2] +
        "T" +
        hParts[0].padStart(2, "0") +
        ":" +
        (hParts[1] || "00").padStart(2, "0") +
        ":00+02:00"
      );
    };

    window._calData = {
      summary: titulo,
      description: desc || "Visita registrada en el CRM",
      location: loc,
      start: {
        dateTime: formatearGCalISO(fecha, horaIni || "09:00"),
        timeZone: "Europe/Madrid",
      },
      end: {
        dateTime: formatearGCalISO(fecha, finH),
        timeZone: "Europe/Madrid",
      },
      visIdx: visIdx,
      clienteId: clienteId || activeId,
    };
    accionEl.innerHTML = `\n    <button class="btn-cancel" onclick="cerrarModal('modal-gcal-confirm')">No, gracias</button>\n    <button class="btn-save" onclick="enviarVisitaGCalAPI()" style="background:#1a73e8;">📅 Guardar en Google Calendar</button>`;
  } else {
    accionEl.innerHTML = `\n    <button class="btn-cancel" onclick="cerrarModal('modal-gcal-confirm')">No, gracias</button>\n    <button class="btn-save" onclick="cerrarModal('modal-gcal-confirm');window.open('${gcalUrl}','_blank')">📅 Abrir en Google Calendar</button>`;
  }

  abrirModal("modal-gcal-confirm");
}

async function enviarVisitaGCalAPI() {
  cerrarModal("modal-gcal-confirm");
  const data = window._calData;
  if (!data || !gToken) return;

  // Evitar mandar ids internos a la API de Google
  const evento = {
    summary: data.summary,
    description: data.description,
    location: data.location,
    start: data.start,
    end: data.end,
  };

  console.log("Creando evento GCal (Visita):", JSON.stringify(evento));
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + gToken,
      },
      body: JSON.stringify(evento),
    },
  );

  if (res.ok) {
    const evData = await res.json();
    const c = db.find((x) => x.id === data.clienteId);
    if (
      c &&
      c.visitas[data.visIdx] &&
      typeof c.visitas[data.visIdx] === "object"
    ) {
      c.visitas[data.visIdx].gcalEventId = evData.id;
      save();
      renderPerfil();
    }
    mostrarToast("📅 Evento creado en Google Calendar", "ok");
    cargarEventosGoogle(); // Actualizar el panel lateral si estuviera abierto
  } else if (res.status === 401) {
    gToken = null;
    try {
      CRM_STORE.removeItem("ncrm_gtoken");
    } catch (e) {}
    renderBtnGoogle();
    alert("Sesión expirada. Vuelve a conectar a Google.");
  } else {
    const errData = await res.json().catch(() => ({}));
    console.error("Error GCal API (Visitas):", res.status, errData);
    mostrarToast(
      "Error API Calendar: " + (errData.error?.message || res.status),
      "err",
    );
  }
}
async function eliminarVisita(idx) {
  const c = db.find((x) => x.id === activeId);
  if (!c) return;
  const vis = c.visitas[idx],
    gcalId = vis && "object" == typeof vis ? vis.gcalEventId : "";
  if (gcalId && gToken) {
    if (
      confirm(
        "Esta visita tiene un evento en Google Calendar.\n¿Quieres borrar también el evento del calendario?",
      )
    ) {
      await gFetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events/" +
          gcalId,
        { method: "DELETE" },
      );
      mostrarToast("📅 Evento eliminado de Google Calendar", "ok");
    }
  }
  c.visitas.splice(idx, 1);
  save();
  renderPerfil();
  renderPanelHoy();
}
function guardarRecordatorio() {
  const fecha = document.getElementById("rec-fecha").value,
    texto = document.getElementById("rec-texto").value.trim(),
    notas = document.getElementById("rec-notas").value.trim();
  if (!texto) return void alert("Escribe el título de la tarea");
  const c = db.find((x) => x.id === activeId);
  c.recordatorios = c.recordatorios || [];
  const fhR = fechaHoraAhora();
  (c.recordatorios.push({
    fecha: fecha,
    texto: texto,
    notas: notas,
    done: !1,
    creadoEn: fhR.ts,
    horaCreadoEn: fhR.hora,
    fechaCreadoEn: fhR.fecha,
  }),
    save(),
    cerrarModal("modal-recordatorio"),
    (document.getElementById("rec-fecha").value = ""),
    (document.getElementById("rec-texto").value = ""),
    (document.getElementById("rec-notas").value = ""),
    renderPerfil(),
    renderAlertas(),
    cargarLista(),
    renderPanelHoy(),
    enviarAGoogleTasks({
      titulo: texto,
      notas: notas,
      fecha: fecha,
      empresa: c.nombre,
      clienteId: c.id,
      recIdx: c.recordatorios.length - 1,
    }));
}
async function enviarAGoogleTasks({
  titulo: titulo,
  notas: notas,
  fecha: fecha,
  empresa: empresa,
}) {
  const tituloFinal = `[${empresa}] ${titulo}`;
  if (gToken) {
    const body = { title: tituloFinal };
    (notas && (body.notes = notas),
      fecha && (body.due = new Date(fecha + "T12:00:00").toISOString()));
    const res = await gFetch(
      "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
      { method: "POST", body: JSON.stringify(body) },
    );
    return void (res && res.ok
      ? (mostrarToast("☑️ Tarea creada en Google Tasks", "ok"),
        "none" !== document.getElementById("gpanel-tasks")?.style.display &&
          cargarTareasGoogle())
      : alert(
          "No se pudo crear la tarea en Google Tasks. Verifica la conexión.",
        ));
  }
  ((_pendienteGTask = { titulo: tituloFinal, notas: notas, fecha: fecha }),
    mostrarOverlayGTask(tituloFinal, notas, fecha));
}
let _pendienteGTask = null;
function mostrarOverlayGTask(titulo, notas, fecha) {
  const fechaLabel = fecha
    ? new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Sin fecha";
  navigator.clipboard?.writeText(titulo).catch(() => {});
  const textoEl = document.getElementById("gtask-confirm-texto"),
    accionEl = document.getElementById("gtask-confirm-acciones");
  ((document.getElementById("gtask-confirm-titulo").textContent =
    "Abrir en Google Tasks"),
    (document.getElementById("gtask-confirm-ico").textContent = "☑️"),
    (textoEl.innerHTML = `\n    <div style="text-align:left;background:#fff;border-radius:10px;border:1px solid #e0e0e0;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);">\n      \x3c!-- Simula la interfaz de Google Tasks --\x3e\n      <div style="padding:14px 16px;border-bottom:1px solid #f1f3f4;display:flex;align-items:center;gap:10px;">\n        <div style="width:18px;height:18px;border-radius:50%;border:2px solid #bbb;flex-shrink:0;"></div>\n        <span style="font-size:14px;font-weight:500;color:#202124;">${titulo}</span>\n      </div>\n      ${notas ? `<div style="padding:10px 16px 10px 44px;border-bottom:1px solid #f1f3f4;font-size:12.5px;color:#5f6368;">${notas}</div>` : ""}\n      <div style="padding:10px 16px 10px 44px;font-size:12.5px;color:#1a73e8;">📅 ${fechaLabel}</div>\n    </div>\n    <div style="font-size:12px;color:#5f6368;line-height:1.6;background:#fef9e7;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;">\n      <strong>📋 Título copiado al portapapeles.</strong><br>\n      Al abrirse Google Tasks, pega <kbd style="background:#e8eaed;border-radius:3px;padding:1px 5px;font-size:11px;">Ctrl+V</kbd> en el campo título y ajusta la fecha.\n    </div>`),
    (accionEl.innerHTML =
      '\n    <button onclick="cerrarModal(\'modal-gtask-confirm\')" style="border:1px solid #dadce0;background:#fff;padding:9px 18px;border-radius:4px;font-size:13px;cursor:pointer;font-family:inherit;color:#444;">No por ahora</button>\n    <button onclick="abrirGTasksWeb()" style="background:#1a73e8;color:#fff;border:none;padding:9px 20px;border-radius:4px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">☑️ Abrir Google Tasks</button>'),
    abrirModal("modal-gtask-confirm"));
}
function abrirGTasksWeb() {
  (cerrarModal("modal-gtask-confirm"),
    _pendienteGTask &&
      navigator.clipboard?.writeText(_pendienteGTask.titulo).catch(() => {}),
    window.open("https://tasks.google.com", "_blank"),
    (_pendienteGTask = null));
}
async function ofrecerGTask({
  titulo: titulo,
  fecha: fecha,
  empresa: empresa,
}) {
  return enviarAGoogleTasks({
    titulo: titulo,
    notas: "",
    fecha: fecha,
    empresa: empresa,
  });
}
async function crearGTaskDesdeRecordatorio(titulo, fecha) {
  const body = { title: titulo };
  fecha && (body.due = new Date(fecha + "T12:00:00").toISOString());
  const res = await gFetch(
    "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
    { method: "POST", body: JSON.stringify(body) },
  );
  res && res.ok
    ? (mostrarToast("☑️ Tarea añadida a Google Tasks", "ok"),
      "none" !== document.getElementById("gpanel-tasks")?.style.display &&
        cargarTareasGoogle())
    : alert("No se pudo crear la tarea. Verifica la conexión con Google.");
}
function descargarICS(titulo, fecha, empresa) {
  const dt = fecha.replace(/-/g, ""),
    uid = void 0,
    now = void 0,
    ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CRM//ES",
      "BEGIN:VEVENT",
      "UID:" + ("ncrm-" + Date.now() + "@crm"),
      "DTSTAMP:" +
        (new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"),
      `DTSTART;VALUE=DATE:${dt}`,
      `DTEND;VALUE=DATE:${dt}`,
      `SUMMARY:${titulo}`,
      `DESCRIPTION:Recordatorio CRM — ${empresa}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:Recordatorio: ${titulo}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"),
    blob = new Blob([ics], { type: "text/calendar;charset=utf-8" }),
    a = document.createElement("a");
  ((a.href = URL.createObjectURL(blob)),
    (a.download = `recordatorio-${empresa.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.ics`),
    document.body.appendChild(a),
    a.click(),
    document.body.removeChild(a),
    URL.revokeObjectURL(a.href),
    mostrarToast(
      "📥 Archivo .ics descargado — ábrelo para añadirlo al calendario",
      "ok",
    ));
}
function abrirGoogleCalendar(titulo, fecha, empresa) {
  const dt = fecha.replace(/-/g, ""),
    dtEnd = dt,
    params = new URLSearchParams({
      action: "TEMPLATE",
      text: titulo,
      dates: dt + "/" + dt,
      details: "Recordatorio CRM — " + empresa,
      sf: "true",
      output: "xml",
    });
  (window.open(
    "https://calendar.google.com/calendar/render?" + params.toString(),
    "_blank",
  ),
    mostrarToast("📅 Abriendo Google Calendar en el navegador...", "ok"));
}
function mostrarToast(msg, tipo = "ok") {
  let t = document.getElementById("crm-toast");
  (t ||
    ((t = document.createElement("div")),
    (t.id = "crm-toast"),
    Object.assign(t.style, {
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%) translateY(20px)",
      padding: "11px 22px",
      borderRadius: "99px",
      fontSize: "13px",
      fontWeight: "600",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      zIndex: "2000",
      transition: "all .25s",
      opacity: "0",
      fontFamily: "var(--font)",
      pointerEvents: "none",
    }),
    document.body.appendChild(t)),
    (t.textContent = msg),
    (t.style.background = "ok" === tipo ? "var(--accent2)" : "var(--accent3)"),
    (t.style.color = "#fff"),
    (t.style.opacity = "1"),
    (t.style.transform = "translateX(-50%) translateY(0)"),
    clearTimeout(t._timer),
    (t._timer = setTimeout(() => {
      ((t.style.opacity = "0"),
        (t.style.transform = "translateX(-50%) translateY(10px)"));
    }, 3e3)));
}
function guardarCliente() {
  const nombre = void 0;
  if (!document.getElementById("cli-nombre").value.trim())
    return void alert("El nombre es obligatorio");
  const datos = {};
  ([
    "nombre",
    "contacto",
    "telefono",
    "telefonoFijo",
    "email",
    "direccion",
    "provincia",
    "sector",
  ].forEach((f) => {
    const el = document.getElementById("cli-" + f);
    datos[f] = el ? el.value.trim() : "";
  }),
    (datos.municipio = (document.getElementById("cli-municipio") || { value: "" }).value.trim()),
    (datos.cp = (
      document.getElementById("cli-cp") || { value: "" }
    ).value.trim()),
    (datos.etiqueta = document.getElementById("cli-etiqueta").value));
  const _pipe = document.getElementById("cli-pipeline");
  if (((datos.pipeline = _pipe ? _pipe.value : "prospecto"), editMode))
    Object.assign(
      db.find((x) => x.id === activeId),
      datos,
    );
  else {
    const id = db.length ? Math.max(...db.map((x) => x.id)) + 1 : 1;
    (db.push({
      id: id,
      ...datos,
      notas: [],
      llamadas: [],
      visitas: [],
      pedidos: [],
      etiqueta: datos.etiqueta || "NoCliente",
    }),
      (activeId = id));
  }
  (save(),
    cerrarModal("modal-cliente"),
    actualizarProvincias(),
    cargarLista(),
    renderPerfil());
  registrarAccion(activeId, 'Datos del cliente actualizados', 'Pipeline: ' + datos.pipeline);
}
function abrirModalCliente(esEdicion) {
  ((editMode = esEdicion),
    (document.getElementById("modal-cli-title").textContent = esEdicion
      ? "Editar Empresa"
      : "Nueva Empresa"));
  var cl = esEdicion
      ? db.find(function (x) {
          return x.id === activeId;
        })
      : null,
    g = function (f) {
      return (cl && cl[f]) || "";
    },
    s = function (id, v) {
      var el = document.getElementById(id);
      el && (el.value = v);
    };
  (s("cli-nombre", g("nombre")),
    s("cli-contacto", g("contacto")),
    s("cli-email", g("email")),
    s("cli-direccion", g("direccion")),
    (function () {
      var sel = document.getElementById("cli-sector"),
        val = g("sector");
      if (
        val &&
        ![
          "Comercio y retail",
          "Industria y manufactura",
          "Servicios profesionales",
          "Tecnología",
          "Alimentación y bebidas",
          "Hostelería y restauración",
          "Salud y farmacia",
          "Construcción e inmobiliaria",
          "Educación",
          "Administración pública / ONG",
          "Otros",
        ].includes(val)
      ) {
        var opt = document.createElement("option");
        opt.value = val;
        opt.textContent = val + " (*)";
        sel.appendChild(opt);
      }
      sel.value = val;
    })(),
    s("cli-cif", g("cif")),
    s("cli-telefono", g("telefono")),
    s("cli-telefono-fijo", g("telefonoFijo")));
  var cpEl = document.getElementById("cli-cp");
  (cpEl &&
    ((cpEl.value = g("cp")),
    (cpEl.placeholder = "Código postal"),
    (cpEl.style.borderColor = "")),
    s("cli-provincia", g("provincia")),
    s("cli-municipio", g("municipio")));
  var etq = document.getElementById("cli-etiqueta");
  etq && (etq.value = g("etiqueta"));
  var pip = document.getElementById("cli-pipeline");
  (pip && (pip.value = (cl && cl.pipeline) || "prospecto"),
    abrirModal("modal-cliente"));
}
function eliminarCliente() {
  var cl = db.find(function (x) {
    return x.id === activeId;
  });
  if (
    cl &&
    confirm(
      '¿Mover "' +
        cl.nombre +
        '" a la papelera?\nTendrás 30 días para recuperarlo.',
    )
  ) {
    var pap = getPapelera();
    (pap.push({
      cliente: cl,
      borradoEn: new Date().toISOString(),
      borradoEnTexto: new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    }),
      savePapelera(pap),
      (db = db.filter(function (x) {
        return x.id !== activeId;
      })),
      (activeId = db.length ? db[0].id : null),
      save(),
      actualizarProvincias(),
      cargarLista(),
      renderPerfil(),
      mostrarToast(cl.nombre + " movido a la papelera", "ok"));
    var btn = document.getElementById("btn-papelera");
    if (btn) {
      var p2 = getPapelera();
      btn.textContent = p2.length
        ? "🗑️ Papelera (" + p2.length + ")"
        : "Papelera";
    }
  }
}
function getPapelera() {
  try {
    return JSON.parse(CRM_STORE.getItem("ncrm_papelera") || "[]");
  } catch (e) {
    return [];
  }
}
function savePapelera(p) {
  var limite = Date.now() - 2592e6;
  p = p.filter(function (e) {
    return new Date(e.borradoEn).getTime() > limite;
  });
  try {
    CRM_STORE.setItem("ncrm_papelera", JSON.stringify(p));
  } catch (e) {}
}
function restaurarCliente(idx) {
  var pap = getPapelera(),
    entrada = pap[idx];
  if (entrada) {
    var cl = entrada.cliente,
      maxId = db.length
        ? Math.max.apply(
            null,
            db.map(function (x) {
              return x.id || 0;
            }),
          )
        : 0;
    ((cl.id = maxId + 1),
      db.push(cl),
      pap.splice(idx, 1),
      savePapelera(pap),
      (activeId = cl.id),
      save(),
      actualizarProvincias(),
      cargarLista(),
      renderPerfil(),
      mostrarToast(cl.nombre + " restaurado ✓", "ok"),
      abrirPapelera());
  }
}
function borrarDefinitivo(idx) {
  var pap = getPapelera(),
    entrada = pap[idx];
  entrada &&
    confirm(
      '¿Borrar definitivamente "' +
        entrada.cliente.nombre +
        '"? No se puede deshacer.',
    ) &&
    (pap.splice(idx, 1),
    savePapelera(pap),
    mostrarToast("Eliminado definitivamente", "ok"),
    abrirPapelera());
}
function vaciarPapelera() {
  confirm("¿Vaciar toda la papelera? No se puede deshacer.") &&
    (CRM_STORE.removeItem("ncrm_papelera"),
    mostrarToast("Papelera vaciada", "ok"),
    abrirPapelera());
}
function abrirPapelera() {
  var pap = getPapelera(),
    div = document.getElementById("papelera-lista");
  if (div) {
    var btn = document.getElementById("btn-papelera");
    btn &&
      (btn.textContent = pap.length
        ? "🗑️ Papelera (" + pap.length + ")"
        : "Papelera");
    var cnt = document.getElementById("papelera-count");
    if (!pap.length)
      return (
        div &&
          (div.innerHTML =
            '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px;">La papelera está vacía.</div>'),
        cnt && (cnt.textContent = ""),
        void abrirModal("modal-papelera")
      );
    var hoy = Date.now();
    (cnt &&
      (cnt.textContent =
        pap.length + " cliente" + (1 !== pap.length ? "s" : "")),
      (div.innerHTML = pap
        .map(function (e, i) {
          var dias,
            resto =
              30 - Math.floor((hoy - new Date(e.borradoEn).getTime()) / 864e5),
            urg = resto <= 7;
          return (
            '<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--surface);border:1px solid var(--border);border-radius:9px;"><div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:var(--text);">' +
            e.cliente.nombre +
            '</div><div style="font-size:11px;color:var(--text3);">' +
            (e.cliente.provincia || "") +
            (e.cliente.sector ? " · " + e.cliente.sector : "") +
            '</div><div style="font-size:10px;margin-top:3px;color:' +
            (urg ? "#dc2626" : "var(--text3)") +
            ';">Borrado: ' +
            e.borradoEnTexto +
            " · " +
            (urg ? "<strong>" : "") +
            "Expira en " +
            resto +
            " días" +
            (urg ? "</strong>" : "") +
            '</div></div><button onclick="restaurarCliente(' +
            i +
            ')" style="padding:5px 11px;border-radius:6px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#16a34a;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;">↩ Restaurar</button><button onclick="borrarDefinitivo(' +
            i +
            ')" title="Borrar definitivamente" style="padding:5px 9px;border-radius:6px;border:1px solid rgba(220,38,38,0.3);background:rgba(220,38,38,0.07);color:#dc2626;cursor:pointer;font-size:14px;">🗑</button></div>'
          );
        })
        .join("")),
      abrirModal("modal-papelera"));
  }
}



function cambiarEstado(pedId, sel) {
  const c = void 0,
    p = db.find((x) => x.id === activeId).pedidos.find((x) => x.id === pedId);
  ((p.estado = sel.value),
    (sel.className =
      "status-select " +
      ("Pagado" === p.estado
        ? "status-pagado"
        : "Enviado" === p.estado
          ? "status-enviado"
          : "status-pendiente")),
    save());
}
function eliminarPedido(pedId) {
  if (!confirm("¿Borrar este pedido?")) return;
  const c = db.find((x) => x.id === activeId);
  ((c.pedidos = c.pedidos.filter((x) => x.id !== pedId)),
    save(),
    renderPerfil());
}
async function eliminarActividad(tipo, idx) {
  const c = db.find((x) => x.id === activeId);
  if (c) {
    if ("nota" === tipo) {
      c.notas.splice(idx, 1);
    } else if ("llamada" === tipo) {
      const ll = c.llamadas[idx];
      const gcalId = ll && "object" == typeof ll ? ll.gcalEventId : "";
      if (
        gcalId &&
        gToken &&
        confirm(
          "Esta llamada está en Google Calendar.\n¿Borrar también el evento?",
        )
      ) {
        await gFetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events/" +
            gcalId,
          { method: "DELETE" },
        );
        mostrarToast("📅 Evento borrado de Google Calendar", "ok");
      }
      c.llamadas.splice(idx, 1);
    }
    save();
    renderPerfil();
  }
}
function eliminarRecordatorio(idx) {
  const cl = db.find((x) => x.id === activeId);
  if (cl) {
    const recs = cl.recordatorios
      .filter((r) => !r.done)
      .slice()
      .reverse();
    const recTarget = recs[idx];
    const realIdx = cl.recordatorios.indexOf(recTarget);
    if (realIdx >= 0) {
      const gtaskId = cl.recordatorios[realIdx].gtaskId;
      if (
        gtaskId &&
        gToken &&
        confirm(
          "Este recordatorio está en Google Tasks.\n¿Borrar también de Google?",
        )
      ) {
        gFetch(
          "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/" +
            gtaskId,
          { method: "DELETE" },
        ).then((res) => {
          if (
            res &&
            res.ok &&
            "none" !== document.getElementById("gpanel-tasks")?.style.display
          )
            cargarTareasGoogle();
        });
      }
      cl.recordatorios.splice(realIdx, 1);
      save();
      renderPerfil();
      renderAlertas();
      cargarLista();
      renderPanelHoy();
    }
  }
}

let gToken = null;
try {
  gToken = CRM_STORE.getItem("ncrm_gtoken") || null;
} catch (e) {}
function renderBtnGoogle() {
  const btn = document.getElementById("btn-google");
  btn &&
    (gToken
      ? ((btn.innerHTML = "🟢 Google conectado"), (btn.style.color = "#1a7a35"))
      : ((btn.innerHTML = "🔗 Vincular Google"),
        (btn.style.color = "var(--text2)")));
}
function abrirGoogle() {
  (abrirModal("modal-google"),
    gToken && (cargarEventosGoogle(), cargarTareasGoogle()));
  try {
    const saved = CRM_STORE.getItem("ncrm_gclientid");
    const _cid = saved || CRM_CONFIG.google.clientId;
    _cid && (document.getElementById("g-client-id").value = _cid);
  } catch (e) {}
}
function switchGTab(tab) {
  (["cal", "tasks"].forEach((t) => {
    ((document.getElementById("gpanel-" + t).style.display =
      t === tab ? "" : "none"),
      document
        .getElementById("gtab-" + t)
        .classList.toggle("active", t === tab));
  }),
    "cal" === tab && gToken && cargarEventosGoogle(),
    "tasks" === tab && gToken && cargarTareasGoogle());
}
function conectarGoogle() {
  const cid = document.getElementById("g-client-id").value.trim();
  if (!cid) return void alert("Introduce tu Google Client ID");
  try {
    CRM_STORE.setItem("ncrm_gclientid", cid);
  } catch (e) {}
  
  if (typeof google === "undefined" || !google.accounts) {
    alert("La librería de Google no ha cargado totalmente. Espera unos segundos y vuelve a intentarlo.");
    return;
  }

  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: cid,
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks",
    callback: (tokenResponse) => {
      if (tokenResponse.error !== undefined) {
        console.error("Error GIS:", tokenResponse);
        alert("Error de autenticación: " + tokenResponse.error);
        return;
      }
      gToken = tokenResponse.access_token;
      try {
        CRM_STORE.setItem("ncrm_gtoken", gToken);
        CRM_STORE.setItem("ncrm_crm", JSON.stringify(db));
        CRM_STORE.setItem("ncrm_active", activeId || "");
      } catch (e) {}
      renderBtnGoogle();
      cargarEventosGoogle();
      cargarTareasGoogle();
      mostrarToast("🟢 Conexión a Google exitosa", "ok");
      cerrarModal("modal-google");
    },
  });
  
  tokenClient.requestAccessToken({ prompt: "consent" });
}
function desconectarGoogle() {
  gToken = null;
  try {
    CRM_STORE.removeItem("ncrm_gtoken");
  } catch (e) {}
  (renderBtnGoogle(),
    (document.getElementById("gcal-eventos").innerHTML =
      '<div style="color:var(--text3);font-size:12px;padding:8px;">Desconectado</div>'),
    (document.getElementById("gtasks-lista").innerHTML =
      '<div style="color:var(--text3);font-size:12px;padding:8px;">Desconectado</div>'));
}
async function gFetch(url, opts = {}) {
  if (!gToken) return (alert("Conecta tu cuenta de Google primero"), null);
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: "Bearer " + gToken,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (401 === res.status) {
    gToken = null;
    try {
      CRM_STORE.removeItem("ncrm_gtoken");
    } catch (e) {}
    return (
      renderBtnGoogle(),
      alert("Sesión expirada. Vuelve a conectar."),
      null
    );
  }
  return res;
}
async function cargarEventosGoogle() {
  const el = document.getElementById("gcal-eventos");
  if (!el) return;
  el.innerHTML =
    '<div style="color:var(--text3);font-size:12px;padding:8px;">Cargando...</div>';
  const d = new Date();
  d.setMilliseconds(0);
  const desde = d.toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=15&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(desde)}`;
  const res = await gFetch(url);
  if (!res) return;
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Error cargarEventosGoogle:", res.status, errData);
    mostrarToast(
      "Error Calendar: " + (errData.error?.message || res.status),
      "err",
    );
    return;
  }
  const dRes = await res.json();
  dRes.items?.length
    ? (el.innerHTML = dRes.items
        .map((ev) => {
          const dt = ev.start?.dateTime
            ? new Date(ev.start.dateTime).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : ev.start?.date || "";
          return `<div style="padding:8px 10px;border-radius:9px;background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.12);margin-bottom:6px;display:flex;align-items:center;gap:8px;">\n      <div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--text);">${ev.summary || "Sin título"}</div><div style="font-size:11px;color:var(--text3);">📅 ${dt}</div></div>\n      <button onclick="borrarEvento('${ev.id}')" style="background:rgba(255,59,48,0.07);border:1px solid rgba(255,59,48,0.15);color:var(--accent3);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;white-space:nowrap;">✕ Borrar</button>\n    </div>`;
        })
        .join(""))
    : (el.innerHTML =
        '<div style="color:var(--text3);font-size:12px;padding:8px;">Sin eventos próximos</div>');
}
async function anadirEvento() {
  const titulo = document.getElementById("gcal-titulo").value.trim(),
    fecha = document.getElementById("gcal-fecha").value,
    hora = document.getElementById("gcal-hora").value || "09:00";
  if (!titulo || !fecha) return void alert("Rellena título y fecha");

  const dateStr = fecha + "T" + hora + ":00";
  const startISO = new Date(dateStr).toISOString();
  const endISO = new Date(new Date(dateStr).getTime() + 3600000).toISOString();

  const evento = {
    summary: titulo,
    description: "Evento creado desde el CRM",
    start: { dateTime: startISO },
    end: { dateTime: endISO },
  };

  console.log("JSON FINAL (Añadir Evento):", JSON.stringify(evento));
  const res = await gFetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      body: JSON.stringify(evento),
    },
  );
  if (!res) return;
  if (401 === res.status) {
    gToken = null;
    try {
      CRM_STORE.removeItem("ncrm_gtoken");
    } catch (e) {}
    renderBtnGoogle();
    alert("Sesión expirada. Vuelve a conectar.");
    return;
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Error Calendar API [anadirEvento]:", res.status, errData);
    return void mostrarToast(
      "Error API Calendar: " + (errData.error?.message || res.status),
      "err",
    );
  }
  (["gcal-titulo", "gcal-fecha", "gcal-hora"].forEach(
    (id) => (document.getElementById(id).value = ""),
  ),
    cargarEventosGoogle(),
    mostrarToast("📅 Evento creado en Google Calendar", "ok"));
}
async function borrarEvento(id) {
  confirm("¿Borrar este evento de Google Calendar?") &&
    (await gFetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`,
      { method: "DELETE" },
    ),
    cargarEventosGoogle());
}
async function cargarTareasGoogle() {
  const el = document.getElementById("gtasks-lista");
  if (!el) return;
  el.innerHTML =
    '<div style="color:var(--text3);font-size:12px;padding:8px;">Cargando...</div>';
  const res = await gFetch(
    "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=20&showCompleted=false",
  );
  if (!res) return;
  const d = await res.json();
  d.items?.length
    ? (el.innerHTML = d.items
        .map(
          (t) =>
            `\n    <div style="padding:8px 10px;border-radius:9px;background:rgba(255,255,255,0.55);border:1px solid rgba(255,255,255,0.65);margin-bottom:6px;display:flex;align-items:center;gap:8px;">\n      <div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--text);">☐ ${t.title || "Sin título"}</div>${t.due ? `<div style="font-size:11px;color:var(--text3);">📅 ${new Date(t.due).toLocaleDateString("es-ES")}</div>` : ""}</div>\n      <div style="display:flex;gap:4px;">\n        <button onclick="completarTarea('${t.id}')" style="background:rgba(52,199,89,0.08);border:1px solid rgba(52,199,89,0.2);color:#1a7a35;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;">✓</button>\n        <button onclick="borrarTarea('${t.id}')" style="background:rgba(255,59,48,0.07);border:1px solid rgba(255,59,48,0.15);color:var(--accent3);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:11px;">✕</button>\n      </div>\n    </div>`,
        )
        .join(""))
    : (el.innerHTML =
        '<div style="color:var(--text3);font-size:12px;padding:8px;">Sin tareas pendientes</div>');
}
async function anadirTarea() {
  const titulo = document.getElementById("gtask-titulo").value.trim(),
    fecha = document.getElementById("gtask-fecha").value;
  if (!titulo) return void alert("Escribe el título");
  const body = { title: titulo };
  if (fecha) body.due = new Date(fecha + "T12:00:00").toISOString();

  const res = await gFetch("https://tasks.googleapis.com/tasks/v1/lists/@default/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res) return;
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    console.error("Error Tasks API [anadirTarea]:", res.status, errData);
    return void mostrarToast("Error Tasks: " + (errData.error?.message || res.status), "err");
  }
  ["gtask-titulo", "gtask-fecha"].forEach((id) => (document.getElementById(id).value = ""));
  cargarTareasGoogle();
  mostrarToast("☑️ Tarea creada en Google Tasks", "ok");
}
async function completarTarea(id) {
  (await gFetch(
    `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${id}`,
    { method: "PATCH", body: JSON.stringify({ status: "completed" }) },
  ),
    cargarTareasGoogle());
}
async function borrarTarea(id) {
  confirm("¿Borrar esta tarea?") &&
    (await gFetch(
      `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${id}`,
      { method: "DELETE" },
    ),
    cargarTareasGoogle());
}
function importarCSV(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const log = document.getElementById("import-log");
  log.innerHTML = "";

  function procesarTexto(texto) {
    try {
      const lines = texto.split(/\r?\n/);
      if (lines.length < 2) {
        log.innerHTML +=
          '<span class="log-err">El archivo parece estar vacío o no tiene filas de datos.</span>\n';
        return;
      }
      const header = lines[0] || "";
      // Detección robusta del separador: cuenta ; , y \t
      const cntSemi = header.split(";").length - 1;
      const cntComma = header.split(",").length - 1;
      const cntTab = header.split("\t").length - 1;
      let sep = ",";
      if (cntSemi >= cntComma && cntSemi >= cntTab) sep = ";";
      else if (cntTab >= cntComma && cntTab >= cntSemi) sep = "\t";

      function parseLine(line) {
        const cols = [];
        let cur = "",
          inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQ = !inQ;
          } else if (ch === sep && !inQ) {
            cols.push(cur.trim().replace(/^"|"$/g, ""));
            cur = "";
          } else {
            cur += ch;
          }
        }
        cols.push(cur.trim().replace(/^"|"$/g, ""));
        return cols;
      }

      log.innerHTML +=
        '<span class="log-info">📌 Separador detectado: "' +
        sep +
        '"</span>\n';
      log.innerHTML +=
        '<span class="log-info">📋 Cabecera raw: ' +
        header.substring(0, 120) +
        "</span>\n\n";

      const headerCols = parseLine(header);
      log.innerHTML +=
        '<span class="log-info">Columnas encontradas (' +
        headerCols.length +
        "): " +
        headerCols.join(" | ") +
        "</span>\n\n";

      const norm = (s) =>
        s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "")
          .trim();
      const hdrMap = {};
      headerCols.forEach((h, i) => {
        hdrMap[norm(h)] = i;
      });

      // Función para buscar el índice de una columna por múltiples sinónimos
      // Devuelve -1 si no se encuentra (no 0, para evitar que todo apunte a la 1ª columna)
      function findCol(...syns) {
        for (const s of syns) {
          const k = norm(s);
          if (hdrMap[k] !== undefined) return hdrMap[k];
        }
        return -1;
      }

      const idx = {
        nombre: findCol(
          "cliente",
          "empresa",
          "nombre",
          "razon social",
          "razonsocial",
          "company",
          "nombre empresa",
          "nombreempresa",
        ),
        contacto: findCol(
          "contacto",
          "persona",
          "persona de contacto",
          "responsable",
          "contact",
          "nombre contacto",
        ),
        telefono: findCol(
          "telefono",
          "tel",
          "movil",
          "telefono movil",
          "telefonomovil",
          "phone",
          "mobile",
        ),
        telefonoFijo: findCol(
          "fijo",
          "telefonofijo",
          "telefono fijo",
          "landline",
          "telfijo",
        ),
        email: findCol(
          "email",
          "e-mail",
          "correo",
          "correo electronico",
          "mail",
        ),
        direccion: findCol(
          "direccion",
          "calle",
          "address",
          "domicilio",
          "direccion fiscal",
        ),
        provincia: findCol("provincia", "province", "region"),
        municipio: findCol(
          "municipio",
          "localidad",
          "ciudad",
          "poblacion",
          "city",
          "town",
        ),
        cp: findCol("cp", "codigo postal", "codigopostal", "zip", "postal"),
        nif: findCol("nif", "cif", "dni", "nifcif", "n.i.f.", "c.i.f."),
        sector: findCol(
          "sector",
          "actividad",
          "industria",
          "industry",
          "activity",
          "producto",
        ),
        notas: findCol("notas", "observaciones", "comentarios", "notes", "obs"),
      };

      // Si no se encontró columna de nombre, intentar usar la primera columna
      if (idx.nombre === -1) idx.nombre = 0;

      log.innerHTML +=
        '<span class="log-info">Mapeo → NOMBRE:' +
        idx.nombre +
        " | CONTACTO:" +
        idx.contacto +
        " | TEL:" +
        idx.telefono +
        " | EMAIL:" +
        idx.email +
        " | DIR:" +
        idx.direccion +
        " | PROV:" +
        idx.provincia +
        " | NIF:" +
        idx.nif +
        " | SECTOR:" +
        idx.sector +
        "</span>\n\n";

      const provinciasKnown = [
        "Sevilla",
        "Huelva",
        "Cádiz",
        "Málaga",
        "Córdoba",
        "Granada",
        "Jaén",
        "Almería",
        "Badajoz",
        "Cáceres",
        "Madrid",
        "Barcelona",
        "Valencia",
        "Alicante",
        "Murcia",
        "Zaragoza",
        "Navarra",
        "Bilbao",
        "Vizcaya",
        "Guipúzcoa",
        "Álava",
      ];
      let added = 0,
        skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = parseLine(line);
        const get = (key) =>
          idx[key] >= 0 && idx[key] < cols.length
            ? neutralizar((cols[idx[key]] || "").trim())
            : "";
        const empresa = get("nombre");
        if (!empresa) {
          skipped++;
          continue;
        }
        if (db.some((c) => c.nombre.toLowerCase() === empresa.toLowerCase())) {
          log.innerHTML +=
            '<span class="log-err">⚠ Omitida (ya existe): ' +
            empresa +
            "</span>\n";
          skipped++;
          continue;
        }
        const nifVal = get("nif");
        const notaExcel = get("notas");
        const hoy = new Date().toLocaleDateString("es-ES");
        const notas = [];
        if (notaExcel) notas.push(hoy + ": (importado) " + notaExcel);
        if (nifVal) notas.push(hoy + ": CIF/NIF: " + nifVal);
        const dirRaw = get("direccion");
        let provDetected = get("provincia");
        if (!provDetected && dirRaw) {
          provDetected =
            provinciasKnown.find((p) =>
              dirRaw.toLowerCase().includes(p.toLowerCase()),
            ) || "";
        }
        const newId = db.length ? Math.max(...db.map((x) => x.id)) + 1 : 1;
        db.push({
          id: newId,
          nombre: empresa,
          contacto: get("contacto"),
          telefono: get("telefono"),
          telefonoFijo: get("telefonoFijo"),
          email: get("email"),
          direccion: dirRaw,
          provincia: provDetected,
          municipio: get("municipio"),
          cp: get("cp"),
          sector: get("sector"),
          cif: nifVal,
          notas: notas,
          llamadas: [],
          visitas: [],
          pedidos: [],
          recordatorios: [],
          etiqueta: "NoCliente",
          pipeline: "prospecto",
        });
        log.innerHTML +=
          '<span class="log-ok">✔ Importada: ' + empresa + "</span>\n";
        added++;
      }
      if (added > 0) {
        save();
        actualizarProvincias();
        activeId = db[db.length - 1].id;
        cargarLista();
        renderPerfil();
      }
      log.innerHTML +=
        '\n<span class="log-info">─────────────────────────────────</span>\n';
      log.innerHTML +=
        '<span class="log-ok">✔ Añadidas: ' +
        added +
        '</span>  <span class="log-err">⚠ Omitidas: ' +
        skipped +
        "</span>\n";
      if (added === 0 && skipped === 0) {
        log.innerHTML +=
          '<span class="log-err">⚠ No se encontraron filas válidas. Revisa que la primera fila sea la cabecera y que exista una columna de nombre de empresa.</span>\n';
      }
      abrirModal("modal-import");
    } catch (err) {
      alert("Error procesando el archivo: " + err.message);
      console.error(err);
    }
  }

  const isExcel = file.name.match(/\.(xlsx|xls)$/i);
  if (isExcel) {
    if (typeof XLSX === "undefined") {
      // SheetJS aún no cargó (defer), esperamos un momento y reintentamos
      log.innerHTML =
        '<span class="log-info">⏳ Cargando librería Excel... por favor espera un momento y vuelve a importar.</span>';
      abrirModal("modal-import");
      // Intentar de nuevo en 2 segundos
      setTimeout(() => {
        if (typeof XLSX !== "undefined") {
          const reader2 = new FileReader();
          reader2.onload = function (e) {
            try {
              const data = new Uint8Array(e.target.result);
              const wb = XLSX.read(data, { type: "array" });
              const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {
                FS: ";",
              });
              procesarTexto(csv);
            } catch (err2) {
              alert("Error procesando Excel: " + err2.message);
              console.error(err2);
            }
          };
          reader2.readAsArrayBuffer(file);
        } else {
          log.innerHTML =
            '<span class="log-err">❌ La librería Excel (SheetJS) no se pudo cargar. Verifica tu conexión a internet y recarga la página.</span>';
        }
      }, 2000);
    } else {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], {
            FS: ";",
          });
          procesarTexto(csv);
        } catch (err) {
          alert("Error procesando Excel: " + err.message);
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  } else {
    const reader = new FileReader();
    reader.onload = function (e) {
      procesarTexto(e.target.result);
    };
    reader.readAsText(file, "UTF-8");
  }
  ev.target.value = "";
}
function exportarCSV() {
  if (!db.length) return void alert("No hay empresas para exportar.");
  const esc = (t) => (t ? `"${String(t).replace(/"/g, '""')}"` : '""');
  let csv =
    "ID,Empresa,Contacto,Telefono,Email,Direccion,Provincia,Sector,Pedidos,Notas,Llamadas,Visitas\n";
  db.forEach((c) => {
    csv +=
      [
        c.id,
        esc(c.nombre),
        esc(c.contacto),
        esc(c.telefono),
        esc(c.email),
        esc(c.direccion),
        esc(c.provincia),
        esc(c.sector),
        c.pedidos.length,
        c.notas.length,
        c.llamadas.length,
        c.visitas.length,
      ].join(",") + "\n";
  });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }),
    a = document.createElement("a");
  ((a.href = URL.createObjectURL(blob)),
    (a.download = `CRM_${new Date().toLocaleDateString("es-ES").replace(/\//g, "-")}.csv`),
    a.click());
}
!(function () {
  if (!location.hash.includes("access_token")) return;
  const p = void 0,
    tok = new URLSearchParams(location.hash.slice(1)).get("access_token");
  if (tok) {
    gToken = tok;
    try {
      CRM_STORE.setItem("ncrm_gtoken", tok);
    } catch (e) {}
    (history.replaceState(null, "", location.pathname),
      renderBtnGoogle(),
      setTimeout(() => {
        alert("✅ Conectado a Google correctamente");
      }, 300));
  }
})();
let modoInforme = "email";
function setModoInforme(modo) {
  ((modoInforme = modo),
    document
      .getElementById("modo-email-btn")
      .classList.toggle("active", "email" === modo),
    document
      .getElementById("modo-rapido-btn")
      .classList.toggle("active", "rapido" === modo),
    (document.getElementById("texto-informe").value = ""));
}
function abrirModalInforme() {
  ((document.getElementById("texto-informe").value = ""),
    (modoInforme = "email"),
    document.getElementById("modo-email-btn").classList.add("active"),
    document.getElementById("modo-rapido-btn").classList.remove("active"),
    abrirModal("modal-informe"));
}
function generarInforme(tipo) {
  const hoy = new Date(),
    dias = "diario" === tipo ? 0 : 6,
    fechas = [];
  for (let i = 0; i <= dias; i++) {
    const d = new Date(hoy);
    (d.setDate(d.getDate() - i), fechas.push(d.toLocaleDateString("es-ES")));
  }
  const isoToES = (f) => {
      if (!f) return "";
      if (f.includes("/")) return f;
      const p = f.split("-");
      return 3 === p.length ? `${p[2]}/${p[1]}/${p[0]}` : f;
    },
    isoToLabel = (f) => {
      if (!f) return "—";
      try {
        return new Date(f + "T12:00:00").toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } catch (e) {
        return f;
      }
    },
    periodoLabel =
      "diario" === tipo
        ? hoy.toLocaleDateString("es-ES", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : `Semana del ${fechas[fechas.length - 1]} al ${fechas[0]}`,
    visitas = [],
    llamadas = [],
    notas = [],
    pedidos = [];
  db.forEach((c) => {
    const fn = (arr) => arr.filter((x) => fechas.includes(x.split(": ")[0])),
      visTxts = (c.visitas || []).map((v) => visTexto(v)),
      notaStrs = (c.notas || []).map((n) =>
        "object" == typeof n && null !== n
          ? (n.fecha || "") + ": " + (n.texto || "")
          : n || "",
      ),
      vF = fn(visTxts),
      lF = fn(
        (c.llamadas || []).map((l) =>
          "object" == typeof l && null !== l ? (l.fecha || "") + ": " + (l.texto || "") : l || "",
        ),
      ),
      nF = fn(notaStrs),
      pF = (c.pedidos || []).filter((p) => {
        const regES = p.fechaRegistro || "",
          pedES = isoToES(p.fecha);
        return fechas.includes(regES) || fechas.includes(pedES);
      });
    (vF.forEach((v) =>
      visitas.push({
        empresa: c.nombre,
        texto: v.substring(v.indexOf(": ") + 2),
      }),
    ),
      lF.forEach((l) =>
        llamadas.push({
          empresa: c.nombre,
          texto: l.substring(l.indexOf(": ") + 2),
        }),
      ),
      nF.forEach((n) =>
        notas.push({
          empresa: c.nombre,
          texto: n.substring(n.indexOf(": ") + 2),
        }),
      ),
      pF.forEach((p) => pedidos.push({ empresa: c.nombre, ...p })));
  });
  const totalPedidos = pedidos.reduce(
      (s, p) => s + (parseFloat(String(p.importe || 0).replace(",", ".")) || 0),
      0,
    ),
    fmtEur = (v) =>
      v > 0
        ? v.toLocaleString("es-ES", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) + " €"
        : "—";
  if ("rapido" === modoInforme) {
    let txt =
      ("diario" === tipo ? "REPORTE DIARIO" : "REPORTE SEMANAL") +
      " — " + EMP.nombre + "\n";
    ((txt += `Periodo: ${periodoLabel}\n${"─".repeat(46)}\n\n`),
      (txt += `Resumen:\n  🚗 Visitas: ${visitas.length}   📞 Llamadas: ${llamadas.length}   📝 Notas: ${notas.length}   💰 Pedidos: ${pedidos.length}`),
      totalPedidos > 0 && (txt += `   (${fmtEur(totalPedidos)})`),
      (txt += "\n\n"));
    const empresas = new Set(
      [...visitas, ...llamadas, ...notas, ...pedidos].map((x) => x.empresa),
    );
    return (
      empresas.size
        ? empresas.forEach((emp) => {
            ((txt += `🏢 ${emp}\n`),
              visitas
                .filter((x) => x.empresa === emp)
                .forEach((x) => (txt += `   🚗 ${x.texto}\n`)),
              llamadas
                .filter((x) => x.empresa === emp)
                .forEach((x) => (txt += `   📞 ${x.texto}\n`)),
              notas
                .filter((x) => x.empresa === emp)
                .forEach((x) => (txt += `   📝 ${x.texto}\n`)),
              pedidos
                .filter((x) => x.empresa === emp)
                .forEach((x) => {
                  ((txt += `   💰 Pedido ${x.id || "—"} · ${x.importe ? fmtEur(parseFloat(String(x.importe).replace(",", "."))) : "sin importe"} · ${x.estado || "—"}\n`),
                    x.fecha &&
                      (txt += `      Fecha pedido:   ${isoToLabel(x.fecha)}\n`),
                    x.fechaEntrega &&
                      (txt += `      Fecha entrega:  ${isoToLabel(x.fechaEntrega)}\n`));
                }),
              (txt += "\n"));
          })
        : (txt += "Sin actividad registrada en este periodo."),
      void (document.getElementById("texto-informe").value = txt)
    );
  }
  const hoyStr = hoy.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  let txt = "";
  ((txt += `Asunto: Informe de actividad comercial — ${periodoLabel}\n`),
    (txt += `${"─".repeat(60)}\n\n`),
    (txt += "Estimado/a [Nombre del supervisor],\n\n"),
    (txt += `A continuación te detallo el resumen de las gestiones comerciales, visitas y prospección realizadas ${"diario" === tipo ? "hoy, " + hoy.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) : "durante esta semana"} para ${EMP.nombre}.\n\n`),
    (txt += "📊 RESUMEN DE ACTIVIDAD\n"),
    (txt += `${"─".repeat(40)}\n`),
    (txt += `  Visitas presenciales realizadas:       ${visitas.length}\n`),
    (txt += `  Llamadas de prospección/seguimiento:   ${llamadas.length}\n`),
    (txt += `  Pedidos registrados en el periodo:     ${pedidos.length}`),
    totalPedidos > 0 && (txt += `  (${fmtEur(totalPedidos)} en total)`),
    (txt += "\n"));
  const empresasContactadas = [
    ...new Set([...visitas, ...llamadas].map((x) => x.empresa)),
  ].length;
  if (
    ((txt += `  Empresas contactadas:                  ${empresasContactadas}\n\n`),
    visitas.length &&
      ((txt += `🚗 VISITAS A CLIENTES (DETALLE)\n${"─".repeat(40)}\n`),
      visitas.forEach((v) => {
        ((txt += `\n  Empresa: ${v.empresa}\n`),
          (txt += `  Resumen de visita: ${v.texto}\n`));
      }),
      (txt += "\n")),
    llamadas.length &&
      ((txt += `📞 LLAMADAS Y PROSPECCIÓN DESTACADAS\n${"─".repeat(40)}\n`),
      llamadas.forEach((l) => {
        ((txt += `\n  Empresa: ${l.empresa}\n`),
          (txt += `  Resumen de la llamada: ${l.texto}\n`));
      }),
      (txt += "\n")),
    pedidos.length)
  ) {
    txt += `💰 PEDIDOS REGISTRADOS EN EL PERIODO\n${"─".repeat(40)}\n`;
    const empsPed = void 0;
    [...new Set(pedidos.map((p) => p.empresa))].forEach((emp) => {
      const pEmp = pedidos.filter((p) => p.empresa === emp);
      ((txt += `\n  Empresa: ${emp}\n`),
        pEmp.forEach((p, i) => {
          const imp = parseFloat(String(p.importe || 0).replace(",", "."));
          ((txt += `  Pedido ${i + 1}:\n`),
            (txt += `    · Referencia:      ${p.id || "Sin referencia"}\n`),
            (txt += `    · Importe:         ${imp > 0 ? fmtEur(imp) : "No especificado"}\n`),
            (txt += `    · Estado:          ${p.estado || "Pendiente"}\n`),
            (txt += `    · Fecha pedido:    ${p.fecha ? isoToLabel(p.fecha) : "No registrada"}\n`),
            (txt += `    · Fecha entrega:   ${p.fechaEntrega ? isoToLabel(p.fechaEntrega) : "No especificada"}\n`));
        }));
    });
    const porEstado = { Pendiente: 0, Enviado: 0, Pagado: 0 };
    (pedidos.forEach((p) => {
      const imp = parseFloat(String(p.importe || 0).replace(",", ".")) || 0;
      porEstado[p.estado || "Pendiente"] =
        (porEstado[p.estado || "Pendiente"] || 0) + imp;
    }),
      (txt += "\n  Resumen económico del periodo:\n"),
      porEstado.Pendiente > 0 &&
        (txt += `    · Pendientes:  ${fmtEur(porEstado.Pendiente)}\n`),
      porEstado.Enviado > 0 &&
        (txt += `    · Enviados:    ${fmtEur(porEstado.Enviado)}\n`),
      porEstado.Pagado > 0 &&
        (txt += `    · Cobrados:    ${fmtEur(porEstado.Pagado)}\n`),
      totalPedidos > 0 &&
        (txt += `    · TOTAL:       ${fmtEur(totalPedidos)}\n`),
      (txt += "\n"));
  }
  (notas.length &&
    ((txt += `📝 OTRAS GESTIONES Y NOTAS\n${"─".repeat(40)}\n`),
    notas.forEach((n) => {
      txt += `  · ${n.empresa}: ${n.texto}\n`;
    }),
    (txt += "\n")),
    (txt += `🗂️ OTRAS GESTIONES Y TRABAJO DE OFICINA\n${"─".repeat(40)}\n`),
    (txt +=
      "  · Actualización de la base de datos CRM con los datos recopilados en las visitas.\n"),
    (txt +=
      "  · Seguimiento de pedidos pendientes y gestión de incidencias.\n\n"),
    (txt += `🎯 FOCO PARA ${"diario" === tipo ? "MAÑANA" : "LA PRÓXIMA SEMANA"}\n${"─".repeat(40)}\n`),
    (txt +=
      "  [RELLENAR MANUALMENTE — borrar este texto y añadir los objetivos]\n\n"),
    (txt += `${"─".repeat(60)}\n`),
    (txt += `Informe generado desde el CRM · ${hoyStr}\n`),
    (txt += "Cualquier duda, quedo a tu disposición.\n\nSaludos,\n[Tu nombre]"),
    (document.getElementById("texto-informe").value = txt));
}
function copiarInforme() {
  const ta = document.getElementById("texto-informe");
  if (!ta.value.trim()) return;
  (ta.select(), document.execCommand("copy"));
  const btn = event.target;
  ((btn.textContent = "✓ Copiado"),
    setTimeout(() => (btn.textContent = "📋 Copiar texto"), 2e3));
}

function cambiarFasePipeline(id, fase) {
  const cl = db.find((x) => x.id === id);
  cl && ((cl.pipeline = fase), save(), abrirKanban());
}
function seleccionarYCerrarKanban(id) {
  (cerrarModal("modal-kanban"),
    (activeId = id),
    save(),
    cargarLista(),
    renderPerfil());
}
function borrarTodo() {
  confirm(
    "⚠️ ¿Borrar TODOS los datos del CRM? Esta acción no se puede deshacer.",
  ) &&
    confirm("⚠️ ÚLTIMO AVISO. ¿Confirmas que quieres VACIAR el CRM?") &&
    ((db = []),
    (activeId = null),
    save(),
    actualizarProvincias(),
    cargarLista(),
    renderPerfil());
}
var _lastSave = CRM_STORE.getItem("ncrm_ts") || "0";
function backupJSON() {
  const data = { ts: Date.now(), db: db, version: "14" },
    blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  ((a.href = URL.createObjectURL(blob)),
    (a.download =
      "CRM_Backup_" +
      new Date().toLocaleDateString("es-ES").replace(/\//g, "-") +
      ".json"),
    a.click(),
    mostrarToast("💾 Backup descargado", "ok"));
}
function exportarExcel() {
  if (!db.length) return void alert("No hay empresas para exportar.");
  if ("undefined" == typeof XLSX)
    return void alert(
      "Librería Excel no cargada. Comprueba la conexión a internet.",
    );
  const cli = [
    [
      "ID",
      "Empresa",
      "Contacto",
      "Teléfono",
      "Email",
      "Provincia",
      "Sector",
      "Pedidos",
      "Importe Total",
    ],
  ];
  db.forEach(function (x) {
    const imp = (x.pedidos || []).reduce(function (s, p) {
      return s + (parseFloat(p.importe) || 0);
    }, 0);
    cli.push([
      x.id,
      x.nombre || "",
      x.contacto || "",
      x.telefono || "",
      x.email || "",
      x.provincia || "",
      x.sector || "",
      (x.pedidos || []).length,
      imp.toFixed(2),
    ]);
  });
  const ped = [
    [
      "Empresa",
      "ID Pedido",
      "Concepto",
      "Cantidad",
      "Precio ud.",
      "Fecha",
      "Entrega",
      "Importe",
      "Estado",
      "Notas",
    ],
  ];
  db.forEach(function (x) {
    (x.pedidos || []).forEach(function (p) {
      ped.push([
        x.nombre || "",
        p.id || "",
        p.ref || "",
        p.cantidad || "",
        p.precio || "",
        p.fecha || "",
        p.fechaEntrega || "",
        p.importe || "",
        p.estado || "",
        p.notas || "",
      ]);
    });
  });
  var wb = XLSX.utils.book_new();
  (XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cli), "Clientes"),
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ped), "Pedidos"),
    XLSX.writeFile(
      wb,
      "CRM_" +
        new Date().toLocaleDateString("es-ES").replace(/\//g, "-") +
        ".xlsx",
    ),
    mostrarToast("📊 Excel exportado", "ok"));
}
(actualizarProvincias(),
  cargarLista(),
  renderPerfil(),
  renderAlertas(),
  initAlertasState(),
  renderPanelHoy(),
  renderBtnGoogle(),
  (function () {
    var p = getPapelera(),
      b = document.getElementById("btn-papelera");
    b && p.length && (b.textContent = "Papelera (" + p.length + ")");
  })(),
  (function () {
    if (SB_DISABLED) sbSetStatus("local");
    else {
      var loadStart = new Date().toISOString(),
        localHasData = db && db.length > 0;
      sbLoad().then(function (result) {
        var remoteIsEmpty = !result || !result.data || !result.data.length,
          remoteTs = (result && result.ts) || "0",
          remoteTsMs = new Date(remoteTs).getTime() || 0,
          localTsMs = new Date(_lastSave).getTime() || 0;
        if (localHasData && remoteIsEmpty) sbSave(db, _lastSave);
        else {
          if (!localHasData && !remoteIsEmpty)
            return (
              (db = result.data),
              (activeId = db[0] ? db[0].id : null),
              (_lastSave = remoteTs),
              CRM_STORE.setItem("ncrm_crm", JSON.stringify(db)),
              CRM_STORE.setItem("ncrm_active", activeId || ""),
              CRM_STORE.setItem("ncrm_ts", remoteTs),
              actualizarProvincias(),
              cargarLista(),
              renderPerfil(),
              renderAlertas(),
              renderPanelHoy(),
              void mostrarToast("☁ Datos cargados desde la nube", "ok")
            );
          if (localHasData && !remoteIsEmpty) {
            if (_lastSave > loadStart) return;
            remoteTsMs > localTsMs
              ? ((db = result.data),
                db.find(function (x) {
                  return x.id === activeId;
                }) || (activeId = db[0] ? db[0].id : null),
                (_lastSave = remoteTs),
                CRM_STORE.setItem("ncrm_crm", JSON.stringify(db)),
                CRM_STORE.setItem("ncrm_active", activeId || ""),
                CRM_STORE.setItem("ncrm_ts", remoteTs),
                actualizarProvincias(),
                cargarLista(),
                renderPerfil(),
                renderAlertas(),
                renderPanelHoy(),
                mostrarToast("☁ Datos actualizados desde la nube", "ok"))
              : sbSave(db, _lastSave);
          }
        }
      });
    }
  })(),
  actualizarBtnDark(
    "dark" === document.documentElement.getAttribute("data-theme"),
  ),
  document.getElementById("ul-clientes").addEventListener("click", () => {
    esMobil() && cerrarSidebarMovil();
  }));






var _tipoPlt = "wa",
  PLANTILLAS = {
    wa: [
      {
        nombre: "Presentación inicial",
        texto:
          "Hola {contacto}, soy de " + EMP.nombre + ". Me pongo en contacto con {nombre} para presentarles nuestros servicios para el sector {sector}. ¿Podríamos hablar esta semana?",
      },
      {
        nombre: "Seguimiento oferta",
        texto:
          "Hola {contacto}, ¿recibisteis la oferta que os envié? Quería asegurarme de que os ha llegado bien y resolver cualquier duda.",
      },
      {
        nombre: "Check-in",
        texto:
          "Hola {contacto}, ¿cómo va todo en {nombre}? Llevo un tiempo sin noticias y quería saber si podemos ayudaros con algo.",
      },
      {
        nombre: "Confirmación pedido",
        texto:
          "Hola {contacto}, confirmamos que hemos recibido vuestro pedido correctamente. En breve os enviamos la confirmación con todos los detalles.",
      },
    ],
    email: [
      {
        nombre: "Presentación formal",
        texto:
          "Estimado/a {contacto},\n\nMe pongo en contacto con ustedes en nombre de " + EMP.nombre + " para presentarles nuestros servicios para el sector {sector}.\n\nEstaríamos encantados de ofrecer una propuesta personalizada para {nombre}.\n\nUn cordial saludo,\nEquipo " + EMP.nombre + "",
      },
      {
        nombre: "Envío de oferta",
        texto:
          "Estimado/a {contacto},\n\nAdjunto le remitimos nuestra propuesta de precios para {nombre}, tal como acordamos.\n\nCualquier duda, no duden en contactarnos.\n\nAtentamente,\nEquipo " + EMP.nombre + "",
      },
      {
        nombre: "Seguimiento post-visita",
        texto:
          "Estimado/a {contacto},\n\nFue un placer visitarles en {nombre}. Tal como comentamos, les hago llegar el resumen de lo tratado.\n\nEsperamos poder colaborar pronto.\n\nUn cordial saludo,\nEquipo " + EMP.nombre + "",
      },
      {
        nombre: "Propuesta renovación",
        texto:
          "Estimado/a {contacto},\n\nNos ponemos en contacto para ofrecerles una actualización de precios para {nombre}.\n\nAtentamente,\nEquipo " + EMP.nombre + "",
      },
    ],
  };
function setTipoPlantilla(tipo) {
  _tipoPlt = tipo;
  var btnWa = document.getElementById("plt-btn-wa");
  var btnEmail = document.getElementById("plt-btn-email");
  var btnEnviar = document.getElementById("plt-btn-enviar");
  // Clase active para estilo CSS completo, opacidad como refuerzo visual
  if (btnWa) {
    btnWa.classList.toggle("active", "wa" === tipo);
    btnWa.style.opacity = "wa" === tipo ? "1" : "0.55";
  }
  if (btnEmail) {
    btnEmail.classList.toggle("active", "email" === tipo);
    btnEmail.style.opacity = "email" === tipo ? "1" : "0.55";
  }
  if (btnEnviar)
    btnEnviar.textContent =
      "wa" === tipo ? "📱 Abrir WhatsApp" : "✉️ Abrir email";
  var sel = document.getElementById("plt-selector");
  if (sel)
    sel.innerHTML = PLANTILLAS[tipo]
      .map(function (p, i) {
        return '<option value="' + i + '">' + p.nombre + "</option>";
      })
      .join("");
  cargarPlantilla();
}
function cargarPlantilla() {
  var idx = parseInt(document.getElementById("plt-selector").value);
  var cl = db.find(function (x) {
    return x.id === activeId;
  });
  var plantilla = PLANTILLAS[_tipoPlt][idx];
  if (!plantilla) {
    document.getElementById("plt-texto").value = "";
    return;
  }
  // Usar _textoOriginal si existe (guardado sin sustituciones), si no el texto directo
  var txt = plantilla._textoOriginal || plantilla.texto || "";
  if (cl) {
    txt = txt
      .replace(/{nombre}/g, cl.nombre || "")
      .replace(/{contacto}/g, cl.contacto || "(contacto)")
      .replace(/{sector}/g, cl.sector || "vuestra empresa");
  }
  document.getElementById("plt-texto").value = txt;
}

function getCuotaObjetivo() {
  return parseFloat(CRM_STORE.getItem("ncrm_cuota") || "50000");
}
function toggleCuotaEdit() {
  var w = document.getElementById("cuota-edit-wrap"),
    inp = document.getElementById("cuota-input");
  var open = w.style.display !== "none";
  w.style.display = open ? "none" : "block";
  if (!open) inp.value = getCuotaObjetivo();
}
function guardarCuota() {
  var v = parseFloat(document.getElementById("cuota-input").value);
  if (!isNaN(v) && v > 0) {
    CRM_STORE.setItem("ncrm_cuota", String(v));
    document.getElementById("cuota-edit-wrap").style.display = "none";
    actualizarCuota();
    mostrarToast("Objetivo guardado ✓", "ok");
  }
}
function actualizarCuota() {
  var obj = getCuotaObjetivo();
  var ahora = new Date(),
    mes =
      ahora.getFullYear() + "-" + String(ahora.getMonth() + 1).padStart(2, "0");
  var total = 0;
  db.forEach(function (cl) {
    (cl.pedidos || []).forEach(function (p) {
      if (p.fecha && p.fecha.slice(0, 7) === mes && p.importe)
        total += parseFloat(p.importe) || 0;
    });
  });
  var pct = obj > 0 ? Math.min((total / obj) * 100, 110) : 0;
  var barra = document.getElementById("cuota-barra");
  var label = document.getElementById("cuota-label");
  if (!barra || !label) return;
  barra.style.width = Math.min(pct, 100) + "%";
  var color =
    pct >= 100
      ? "#229954"
      : pct >= 66
        ? "#27ae60"
        : pct >= 33
          ? "#f39c12"
          : "#e74c3c";
  barra.style.background = color;
  var fmtTotal = total.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  var fmtObj = obj.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  label.textContent =
    "€" + fmtTotal + " / €" + fmtObj + " — " + pct.toFixed(1) + "%";
}
function abrirDetalleCuota() {
  var ahora = new Date(),
    mes = ahora.getMonth(),
    anio = ahora.getFullYear(),
    meses = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
    mesISO = anio + "-" + String(mes + 1).padStart(2, "0"),
    pedidos = [];
  db.forEach(function (cl) {
    (cl.pedidos || []).forEach(function (p) {
      if (p.fecha && p.fecha.slice(0, 7) === mesISO) {
        var cid = cl.id;
        pedidos.push({
          cliente: cl.nombre,
          cid: cid,
          importe: parseFloat(p.importe) || 0,
          fecha: p.fecha,
          estado: p.estado || "Pendiente",
        });
      }
    });
  });
  pedidos.sort(function (a, b) {
    return b.fecha.localeCompare(a.fecha);
  });
  var total = pedidos.reduce(function (s, p) {
      return s + p.importe;
    }, 0),
    html;
  if (pedidos.length) {
    var rows = pedidos
      .map(function (p) {
        return (
          '<tr style="border-bottom:1px solid var(--border);cursor:pointer;" onclick="cerrarModal(\'modal-cuota-detalle\');seleccionarCliente(' +
          p.cid +
          ')">' +
          '<td style="padding:6px 8px;font-weight:600;">' +
          p.cliente +
          "</td>" +
          '<td style="padding:6px 8px;text-align:right;font-weight:700;color:var(--accent);">€' +
          p.importe.toLocaleString("es-ES", { minimumFractionDigits: 2 }) +
          "</td>" +
          '<td style="padding:6px 8px;color:var(--text3)">' +
          p.fecha +
          "</td>" +
          '<td style="padding:6px 8px;">' +
          p.estado +
          "</td></tr>"
        );
      })
      .join("");
    html =
      '<div style="margin-bottom:10px;font-size:12px;color:var(--text3);">' +
      pedidos.length +
      " pedidos en " +
      meses[mes] +
      " " +
      anio +
      " · <strong>€" +
      total.toLocaleString("es-ES", { minimumFractionDigits: 2 }) +
      "</strong></div>" +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="border-bottom:2px solid var(--border);"><th style="text-align:left;padding:6px 8px;">Cliente</th><th style="text-align:right;padding:6px 8px;">Importe</th><th style="padding:6px 8px;">Fecha</th><th style="padding:6px 8px;">Estado</th></tr></thead><tbody>' +
      rows +
      "</tbody></table>";
  } else {
    html =
      '<div style="text-align:center;padding:30px;color:var(--text3);">Sin pedidos registrados este mes</div>';
  }
  document.getElementById("cuota-detalle-content").innerHTML = html;
  abrirModal("modal-cuota-detalle");
}

function abrirNotaRapida() {
  document.getElementById("nr-buscar").value = "";
  document.getElementById("nr-cliente-id").value = "";
  document.getElementById("nr-cliente-sel").style.display = "none";
  document.getElementById("nr-texto").value = "";
  document.getElementById("nr-counter").textContent = "0/500";
  document.getElementById("nr-sugerencias").style.display = "none";
  abrirModal("modal-nota-rapida");
  setTimeout(function () {
    document.getElementById("nr-buscar").focus();
  }, 150);
}
function buscarClienteNR() {
  var q = document.getElementById("nr-buscar").value.toLowerCase().trim(),
    sug = document.getElementById("nr-sugerencias");
  if (!q) {
    sug.style.display = "none";
    return;
  }
  var res = db
    .filter(function (cl) {
      return (
        cl.nombre.toLowerCase().includes(q) ||
        (cl.contacto || "").toLowerCase().includes(q)
      );
    })
    .slice(0, 8);
  if (!res.length) {
    sug.innerHTML =
      "<div style='padding:10px 12px;font-size:12px;color:var(--text3);'>Sin resultados</div>";
    sug.style.display = "block";
    return;
  }
  sug.innerHTML = res
    .map(function (cl) {
      return (
        '<div onclick="seleccionarClienteNR(' +
        cl.id +
        ",'" +
        cl.nombre.replace(/'/g, "\'") +
        '\')" style="padding:9px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);" onmouseenter="this.style.background=\'var(--bg2)\'" onmouseleave="this.style.background=\'\'">' +
        "<span style='font-weight:600;'>" +
        cl.nombre +
        "</span>" +
        (cl.provincia
          ? "<span style='font-size:11px;color:var(--text3);margin-left:6px;'>" +
            cl.provincia +
            "</span>"
          : "") +
        "</div>"
      );
    })
    .join("");
  sug.style.display = "block";
}
function seleccionarClienteNR(id, nombre) {
  document.getElementById("nr-cliente-id").value = id;
  document.getElementById("nr-buscar").value = "";
  document.getElementById("nr-sugerencias").style.display = "none";
  var sel = document.getElementById("nr-cliente-sel");
  sel.textContent = "✓ " + nombre;
  sel.style.display = "block";
}
function guardarNotaRapida() {
  var cid = parseInt(document.getElementById("nr-cliente-id").value),
    txt = document.getElementById("nr-texto").value.trim(),
    btn = document.getElementById("nr-btn-guardar");
  if (!cid) {
    mostrarToast("Selecciona un cliente", "err");
    return;
  }
  if (!txt) {
    mostrarToast("Escribe algo en la nota", "err");
    return;
  }
  var cl = db.find(function (x) {
    return x.id === cid;
  });
  if (!cl) {
    mostrarToast("Cliente no encontrado", "err");
    return;
  }
  btn.disabled = true;
  btn.textContent = "Guardando...";
  var fh = fechaHoraAhora();
  cl.notas = cl.notas || [];
  cl.notas.push({
    texto: txt,
    fecha: fh.fecha,
    hora: fh.hora,
    ts: fh.ts,
    adjunto: null,
    adjuntoTipo: null,
    adjuntoNombre: null,
  });
  save();
  if (activeId === cid) renderPerfil();
  cerrarModal("modal-nota-rapida");
  btn.disabled = false;
  btn.textContent = "💾 Guardar nota";
  mostrarToast("✅ Nota guardada en " + cl.nombre, "ok");
}
function guardarTextoEnPlantilla() {
  var idx = parseInt(document.getElementById("plt-selector").value);
  var txt = document.getElementById("plt-texto").value;
  if (isNaN(idx) || !txt) {
    mostrarToast("Selecciona una plantilla primero", "err");
    return;
  }
  // Revertir sustituciones automaticas antes de guardar,
  // para que {nombre}, {contacto} y {sector} funcionen con futuros clientes
  var cl = db.find(function (x) {
    return x.id === activeId;
  });
  if (cl) {
    if (cl.nombre && cl.nombre.length > 0)
      txt = txt.split(cl.nombre).join("{nombre}");
    if (cl.contacto && cl.contacto.length > 0)
      txt = txt.split(cl.contacto).join("{contacto}");
    if (cl.sector && cl.sector.length > 0)
      txt = txt.split(cl.sector).join("{sector}");
  }
  PLANTILLAS[_tipoPlt][idx].texto = txt;
  try {
    CRM_STORE.setItem("ncrm_plantillas", JSON.stringify(PLANTILLAS));
  } catch (e) {}
  mostrarToast("Plantilla guardada", "ok");
  cargarPlantilla();
}
function nuevaPlantillaDesdeTexto() {
  var txt = document.getElementById("plt-texto").value;
  if (!txt) {
    mostrarToast("Escribe el texto primero", "err");
    return;
  }
  var nom = prompt("Nombre para la nueva plantilla:");
  if (!nom) return;
  // Revertir sustituciones antes de guardar
  var cl = db.find(function (x) {
    return x.id === activeId;
  });
  if (cl) {
    if (cl.nombre && cl.nombre.length > 0)
      txt = txt.split(cl.nombre).join("{nombre}");
    if (cl.contacto && cl.contacto.length > 0)
      txt = txt.split(cl.contacto).join("{contacto}");
    if (cl.sector && cl.sector.length > 0)
      txt = txt.split(cl.sector).join("{sector}");
  }
  PLANTILLAS[_tipoPlt].push({ nombre: nom, texto: txt });
  try {
    CRM_STORE.setItem("ncrm_plantillas", JSON.stringify(PLANTILLAS));
  } catch (e) {}
  setTipoPlantilla(_tipoPlt);
  document.getElementById("plt-selector").selectedIndex =
    PLANTILLAS[_tipoPlt].length - 1;
  cargarPlantilla();
  mostrarToast("Nueva plantilla guardada", "ok");
}
function borrarPlantillaActual() {
  var idx = parseInt(document.getElementById("plt-selector").value);
  if (isNaN(idx)) {
    mostrarToast("Selecciona una plantilla", "err");
    return;
  }
  if (PLANTILLAS[_tipoPlt].length <= 1) {
    mostrarToast("Debe quedar al menos una plantilla", "err");
    return;
  }
  if (!confirm('¿Eliminar "' + PLANTILLAS[_tipoPlt][idx].nombre + '"?')) return;
  PLANTILLAS[_tipoPlt].splice(idx, 1);
  try {
    CRM_STORE.setItem("ncrm_plantillas", JSON.stringify(PLANTILLAS));
  } catch (e) {}
  setTipoPlantilla(_tipoPlt);
  mostrarToast("🗑️ Plantilla eliminada", "ok");
}
function abrirPlantillas() {
  try {
    var _s = JSON.parse(CRM_STORE.getItem("ncrm_plantillas") || "null");
    _s && _s.wa && _s.email && (PLANTILLAS = _s);
  } catch (e) {}
  (setTipoPlantilla(_tipoPlt || "wa"), abrirModal("modal-plantillas-msg"));
}
function copiarPlantilla() {
  try {
    CRM_STORE.setItem("ncrm_plantillas", JSON.stringify(PLANTILLAS));
  } catch (e) {}
  var txt = document.getElementById("plt-texto").value;
  navigator.clipboard
    ? navigator.clipboard.writeText(txt).then(function () {
        mostrarToast("📋 Texto copiado", "ok");
      })
    : (document.getElementById("plt-texto").select(),
      document.execCommand("copy"),
      mostrarToast("📋 Texto copiado", "ok"));
}
function enviarPlantilla() {
  var txt = document.getElementById("plt-texto").value,
    cl = db.find(function (x) {
      return x.id === activeId;
    });
  var plantillaSeleccionada = (function () {
    var s = document.getElementById("plt-selector");
    var idx = s ? parseInt(s.value) : -1;
    var p = PLANTILLAS[_tipoPlt] && PLANTILLAS[_tipoPlt][idx];
    return p ? p.nombre : null;
  })();
  if ("wa" === _tipoPlt) {
    var tel = (cl && cl.telefono ? cl.telefono : "").replace(/\D/g, "");
    if (tel && !tel.startsWith("34") && tel.length <= 9) tel = "34" + tel;
    registrarAccion(activeId, 'Plantilla enviada por WhatsApp', plantillaSeleccionada || 'Presentación inicial');
    (function() {
      var _c = db.find(function(x){ return x.id === activeId; });
      if (_c) {
        if (!_c.notas) _c.notas = [];
        var _ahora = new Date();
        var _fecha = _ahora.toLocaleDateString('es-ES');
        var _hora = _ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        var _canal = 'WhatsApp';
        var _nombrePlantilla = plantillaSeleccionada || 'Presentación inicial';
        _c.notas.unshift({
          texto: '📤 ' + _canal + ' enviado · Plantilla: "' + _nombrePlantilla + '" · ' + _fecha + ' ' + _hora,
          fecha: _ahora.toISOString(),
          auto: true
        });
        save();
      }
    })();
    window.open(
      "https://wa.me/" + tel + "?text=" + encodeURIComponent(txt),
      "_blank",
    );
  } else {
    var nombreEmpresa = (cl && cl.nombre) ? cl.nombre : 'Empresa desconocida';
    var asunto = 'Propuesta de ' + EMP.nombre + ' - ' + nombreEmpresa;
    registrarAccion(activeId, 'Plantilla enviada por Email', plantillaSeleccionada || 'Presentación inicial');
    (function() {
      var _c = db.find(function(x){ return x.id === activeId; });
      if (_c) {
        if (!_c.notas) _c.notas = [];
        var _ahora = new Date();
        var _fecha = _ahora.toLocaleDateString('es-ES');
        var _hora = _ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        var _canal = 'Email';
        var _nombrePlantilla = plantillaSeleccionada || 'Presentación inicial';
        _c.notas.unshift({
          texto: '📤 ' + _canal + ' enviado · Plantilla: "' + _nombrePlantilla + '" · ' + _fecha + ' ' + _hora,
          fecha: _ahora.toISOString(),
          auto: true
        });
        save();
      }
    })();
    (function() {
      var _c = db.find(function(x){ return x.id === activeId; });
      if (!_c) return;
      _c.recordatorios = _c.recordatorios || [];
      var _fechaSeg = new Date();
      _fechaSeg.setDate(_fechaSeg.getDate() + 3);
      var _fechaSegStr = _fechaSeg.toISOString().slice(0, 10);
      var _notasSeg = 'Plantilla: "' + (plantillaSeleccionada || 'Presentación inicial') + '"';
      var fhR = fechaHoraAhora();
      _c.recordatorios.push({
        fecha: _fechaSegStr,
        texto: 'Seguimiento presupuesto enviado',
        notas: _notasSeg,
        done: false,
        creadoEn: fhR.ts,
        horaCreadoEn: fhR.hora,
        fechaCreadoEn: fhR.fecha,
      });
      var _recIdx = _c.recordatorios.length - 1;
      save();
      renderPerfil();
      renderAlertas();
      cargarLista();
      renderPanelHoy();
      enviarAGoogleTasks({
        titulo: 'Seguimiento presupuesto enviado',
        notas: _notasSeg,
        fecha: _fechaSegStr,
        empresa: nombreEmpresa,
        clienteId: _c.id,
        recIdx: _recIdx,
      });
    })();
    window.open(
      "mailto:" +
        (cl && cl.email ? cl.email : "") +
        "?subject=" +
        encodeURIComponent(asunto) +
        "&body=" +
        encodeURIComponent(txt),
      "_blank",
    );
  }
}
function generarPDFPedido(pedId) {
  var cl = db.find(function (x) {
    return (x.pedidos || []).some(function (p) {
      return p.id === pedId;
    });
  });
  if (cl) {
    var p = cl.pedidos.find(function (x) {
      return x.id === pedId;
    });
    if (p) {
      var logoSrc = EMP.logoUrl || "",
        hoy = new Date().toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        numDoc =
          "PED-" +
          p.id
            .replace(/[^0-9A-Z]/gi, "")
            .toUpperCase()
            .substring(0, 10),
        eColor =
          "Pagado" === p.estado
            ? "#22c55e"
            : "Enviado" === p.estado
              ? "#3b82f6"
              : "#f59e0b",
        imp = p.importe
          ? parseFloat(p.importe).toLocaleString("es-ES", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }) + " €"
          : "—",
        empresa = p.empresa || cl.nombre || "—",
        cif = p.cif || cl.cif || "—",
        scO = "<script>",
        scC = "<\/script>",
        logoHtml,
        html =
          '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Contrato</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:\'Segoe UI\',sans-serif;color:#1a1a2e;background:#fff;padding:20px 30px;}@page{margin:8mm 10mm;size:A4;}@media print{body{padding:0}.no-print{display:none!important}.fd{display:none!important}.fi{display:block!important}}.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #4C1D95;}.stitle{font-size:9px;font-weight:700;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}.ibox{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:14px;}.igrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 16px;}.ilbl{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;}.ival{font-size:12px;font-weight:600;color:#1e293b;}table{width:100%;border-collapse:collapse;margin-bottom:14px;}thead th{background:#4C1D95;color:#fff;padding:7px 10px;font-size:10px;text-align:left;}tbody td{padding:8px 10px;font-size:11px;border-bottom:1px solid #f1f5f9;}.tr td{background:#eff6ff;font-weight:800;border-top:2px solid #4C1D95;padding:8px 10px;}.claus{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:14px;}.claus p{font-size:10px;color:#475569;line-height:1.7;margin-bottom:2px;}.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:10px;}.flbl{font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:4px;}.fd{border:2px dashed #cbd5e1;border-radius:6px;overflow:hidden;}.fd canvas{display:block;touch-action:none;cursor:crosshair;}.fdb{display:flex;padding:4px;background:#f8fafc;border-top:1px solid #e2e8f0;}.fdb button{font-size:10px;padding:2px 7px;border-radius:4px;border:1px solid #cbd5e1;background:#fff;cursor:pointer;}.fi{display:none;}.fl{border-bottom:1.5px solid #1e293b;height:50px;margin-top:3px;}.fsl{font-size:8px;color:#94a3b8;margin-top:3px;}.foot{margin-top:14px;padding-top:10px;border-top:1px solid #e2e8f0;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;}.fdel p,.fright p{font-size:9px;color:#64748b;line-height:1.6;}.fdel strong,.fright strong{font-size:10px;color:#1e293b;display:block;}.fright{text-align:right;}</style></head><body onload="initF()"><div class="hdr"><div>' +
          (logoSrc
            ? logoCandy(56)
            : '<b style="font-size:20px;color:#4C1D95;">' + EMP.nombre + '</b>') +
          '</div><div style="text-align:right;"><div style="font-size:22px;font-weight:900;color:#4C1D95;">PEDIDO</div><div style="display:inline-block;padding:2px 9px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:9px;font-size:9px;font-weight:700;">DOCUMENTO CON VALIDEZ DE CONTRATO</div><div style="font-size:11px;color:#475569;font-weight:600;">' +
          numDoc +
          '</div><span style="display:inline-block;padding:3px 10px;border-radius:16px;font-size:10px;font-weight:700;background:' +
          eColor +
          "22;color:" +
          eColor +
          ";border:1px solid " +
          eColor +
          '55;">' +
          (p.estado || "Pendiente") +
          '</span></div></div><div class="stitle">Datos del Cliente</div><div class="ibox"><div class="igrid"><div><div class="ilbl">Empresa</div><div class="ival">' +
          empresa +
          '</div></div><div><div class="ilbl">CIF</div><div class="ival">' +
          cif +
          '</div></div><div><div class="ilbl">Contacto</div><div class="ival">' +
          (cl.contacto || "—") +
          '</div></div><div><div class="ilbl">Teléfono</div><div class="ival">' +
          (cl.telefono || "—") +
          '</div></div><div><div class="ilbl">Email</div><div class="ival">' +
          (cl.email || "—") +
          '</div></div></div></div><div class="stitle">Detalle del Pedido</div><table><thead><tr><th>Ref.</th><th>Concepto</th><th>Cant.</th><th>Precio ud.</th><th>F.Pedido</th><th>F.Entrega</th><th>Importe</th></tr></thead><tbody><tr><td style="font-family:monospace;font-size:10px;">' +
          p.id +
          "</td><td>" +
          (p.ref || "—") +
          '</td><td style="text-align:right;">' +
          (p.cantidad
            ? Number(p.cantidad).toLocaleString("es-ES")
            : "—") +
          '</td><td style="text-align:right;">' +
          (p.precio ? p.precio + " €" : "—") +
          "</td><td>" +
          (p.fecha || "—") +
          "</td><td>" +
          (p.fechaEntrega || "—") +
          '</td><td style="text-align:right;font-weight:700;">' +
          imp +
          '</td></tr></tbody><tfoot><tr class="tr"><td colspan="6">TOTAL</td><td style="text-align:right;">' +
          imp +
          '</td></tr></tfoot></table><div class="stitle">Condiciones Contractuales</div><div class="claus"><p><strong>1. Aceptación:</strong> La firma implica aceptación expresa del pedido, precio y condiciones.</p><p><strong>2. Pago:</strong> Según condiciones pactadas. El impago genera intereses legales.</p><p><strong>3. Entrega:</strong> La fecha es orientativa. Se notificará cualquier variación.</p><p><strong>4. Cancelaciones:</strong> Una vez iniciada la producción no se admiten sin coste.</p><p><strong>5. Propiedad:</strong> Los diseños aportados por el cliente son de su responsabilidad.</p></div><div class="stitle">Firmas de Conformidad</div><div class="fgrid"><div><div class="flbl">Firma del Cliente — ' +
          empresa +
          '</div><div class="fd"><canvas id="cv1" width="260" height="80"></canvas><div class="fdb"><button onclick="document.getElementById(\'cv1\').getContext(\'2d\').clearRect(0,0,260,80)">Borrar</button></div></div><div class="fi"><div class="fl"></div><div class="fsl">Firma y sello del cliente</div></div></div><div><div class="flbl">Firma ' + EMP.nombre + '</div><div class="fd"><canvas id="cv2" width="260" height="80"></canvas><div class="fdb"><button onclick="document.getElementById(\'cv2\').getContext(\'2d\').clearRect(0,0,260,80)">Borrar</button></div></div><div class="fi"><div class="fl"></div><div class="fsl">Firma y sello ' + EMP.nombre + '</div></div></div></div><div class="no-print" style="text-align:center;margin-top:10px;"><button onclick="window.print()" style="padding:7px 20px;background:#4C1D95;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">Imprimir / Guardar PDF</button></div><div class="foot">' +
          (logoSrc
            ? logoCandy(22, "opacity:0.7;")
            : "<span></span>") +
          '<div class="fdel"><strong>' + EMP.cargo + '</strong><p>' + EMP.responsable + ' · ' + EMP.telefono + ' · ' + EMP.email + '</p></div><div class="fright"><strong>' + EMP.razonSocial + '</strong><p>C.I.F. ' + EMP.cif + '</p></div></div>' +
          scO +
          'function initF(){var a=document.getElementById("cv1"),b=document.getElementById("cv2");sw(a);sw(b);}function sw(cv){var ctx=cv.getContext("2d"),dr=false,lx=0,ly=0;ctx.strokeStyle="#4C1D95";ctx.lineWidth=2.5;ctx.lineCap="round";function pt(e){var r=cv.getBoundingClientRect(),t=e.touches?e.touches[0]:e;return{x:(t.clientX-r.left)*(cv.width/r.width),y:(t.clientY-r.top)*(cv.height/r.height)};}cv.onmousedown=function(e){dr=true;var p=pt(e);lx=p.x;ly=p.y;};cv.onmousemove=function(e){if(!dr)return;var p=pt(e);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(p.x,p.y);ctx.stroke();lx=p.x;ly=p.y;};cv.onmouseup=function(){dr=false;};cv.onmouseleave=function(){dr=false;};}' +
          scC +
          "</body></html>",
        blob = new Blob([html], { type: "text/html" }),
        url = URL.createObjectURL(blob),
        win;
      window.open(url, "_blank", "width=880,height=780")
        ? mostrarToast("Contrato generado", "ok")
        : mostrarToast("Activa pop-ups para ver el contrato", "err");
    }
  }
}
function abrirSeguimiento() {
  (abrirModal("modal-seguimiento"), renderSeguimiento());
}
function renderSeguimiento() {
  var dias = parseInt(document.getElementById("seg-dias").value) || 30,
    hoy = new Date(),
    lista = document.getElementById("seg-lista");
  function parseFechaES(s) {
    var m = s ? s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null;
    return m
      ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
      : null;
  }
  var resultado = db
    .map(function (cl) {
      var fechas = [];
      ((cl.llamadas || []).forEach(function (e) {
        var d = parseFechaES(e.split(":")[0]);
        d && fechas.push(d);
      }),
        (cl.visitas || []).forEach(function (e) {
          var d = parseFechaES((e.split("|")[0] || "").trim());
          d && fechas.push(d);
        }),
        (cl.notas || []).forEach(function (e) {
          var s,
            d = parseFechaES(
              ("object" == typeof e && null !== e
                ? e.fecha || ""
                : e || ""
              ).split(":")[0],
            );
          d && fechas.push(d);
        }));
      var ultima = fechas.length
          ? new Date(
              Math.max.apply(
                null,
                fechas.map(function (d) {
                  return d.getTime();
                }),
              ),
            )
          : null,
        dp;
      return {
        cl: cl,
        dp: ultima ? Math.floor((hoy - ultima) / 864e5) : 1 / 0,
        ultima: ultima,
      };
    })
    .filter(function (x) {
      return x.dp > dias;
    })
    .sort(function (a, b) {
      return b.dp - a.dp;
    });
  resultado.length
    ? (lista.innerHTML = resultado
        .map(function (x) {
          return (
            '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg2);border-radius:8px;border:1px solid var(--border);cursor:pointer;" onclick="cerrarModal(\'modal-seguimiento\');seleccionarCliente(' +
            x.cl.id +
            ')"><div style="flex:1;"><div style="font-weight:600;font-size:13px;">' +
            x.cl.nombre +
            '</div><div style="font-size:11px;color:var(--text3);">' +
            (x.cl.contacto ? "👤 " + x.cl.contacto + " · " : "") +
            " " +
            (x.cl.provincia || "") +
            '</div></div><div style="text-align:right;"><div style="font-weight:700;color:' +
            (x.dp > 90 ? "#e53e3e" : "#d97706") +
            ';">' +
            (x.dp === 1 / 0 ? "Sin actividad" : x.dp + " días") +
            '</div><div style="font-size:10px;color:var(--text3);">' +
            (x.ultima
              ? "Última: " + x.ultima.toLocaleDateString("es-ES")
              : "Sin registro") +
            '</div></div><span style="font-size:18px;">›</span></div>'
          );
        })
        .join(""))
    : (lista.innerHTML =
        '<div style="color:var(--text3);text-align:center;padding:20px;">Todos los clientes tienen actividad reciente (menos de ' +
        dias +
        " días)</div>");
}
var _calYear = new Date().getFullYear(),
  _calMonth = new Date().getMonth();
function setSegTab(tab) {
  var sList = document.getElementById("seg-panel-lista"),
    sCal = document.getElementById("seg-panel-cal"),
    btnL = document.getElementById("seg-tab-lista"),
    btnC = document.getElementById("seg-tab-cal");
  "lista" === tab
    ? ((sList.style.display = ""),
      (sCal.style.display = "none"),
      (btnL.style.background = "var(--accent)"),
      (btnL.style.color = "#fff"),
      (btnC.style.background = "var(--surface2)"),
      (btnC.style.color = "var(--text2)"),
      renderSeguimiento())
    : ((sList.style.display = "none"),
      (sCal.style.display = ""),
      (btnC.style.background = "var(--accent)"),
      (btnC.style.color = "#fff"),
      (btnL.style.background = "var(--surface2)"),
      (btnL.style.color = "var(--text2)"),
      renderCalendario());
}
function cambiarMesCal(delta) {
  ((_calMonth += delta) > 11 && ((_calMonth = 0), _calYear++),
    _calMonth < 0 && ((_calMonth = 11), _calYear--),
    renderCalendario());
}
function _getEventosRecordatorios() {
  var eventos = {};
  return (
    db.forEach(function (cl) {
      (cl.recordatorios || [])
        .filter(function (r) {
          return !r.done;
        })
        .forEach(function (r) {
          r.fecha &&
            (eventos[r.fecha] || (eventos[r.fecha] = []),
            eventos[r.fecha].push({
              texto: r.texto,
              clienteNombre: cl.nombre,
              clienteId: cl.id,
            }));
        });
    }),
    eventos
  );
}
function renderCalendario() {
  var eventos = _getEventosRecordatorios(),
    meses = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ],
    diasSem = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
  document.getElementById("cal-titulo").textContent =
    meses[_calMonth] + " " + _calYear;
  var primerDia = new Date(_calYear, _calMonth, 1),
    ultimoDia = new Date(_calYear, _calMonth + 1, 0).getDate(),
    inicioSem = (primerDia.getDay() + 6) % 7,
    hoyStr = new Date().toISOString().slice(0, 10),
    html = '<table style="width:100%;border-collapse:collapse;">';
  ((html += "<thead><tr>"),
    diasSem.forEach(function (d) {
      html +=
        '<th style="padding:6px 2px;font-size:11px;font-weight:700;color:var(--text3);text-align:center;">' +
        d +
        "</th>";
    }),
    (html += "</tr></thead><tbody>"));
  for (
    var dia = 1, filas = Math.ceil((ultimoDia + inicioSem) / 7), f = 0;
    f < filas;
    f++
  ) {
    html += "<tr>";
    for (var c = 0; c < 7; c++)
      if ((0 === f && c < inicioSem) || dia > ultimoDia)
        html += '<td style="padding:3px;"></td>';
      else {
        var dStr =
            _calYear +
            "-" +
            String(_calMonth + 1).padStart(2, "0") +
            "-" +
            String(dia).padStart(2, "0"),
          evs = eventos[dStr] || [],
          esHoy = dStr === hoyStr,
          bgHoy = esHoy
            ? "background:var(--accent);color:#fff;border-radius:50%;"
            : "",
          hasEvs = evs.length > 0,
          dotBg = hasEvs
            ? esHoy
              ? "background:#fff"
              : "background:#f59e0b"
            : "background:transparent";
        ((html +=
          '<td style="padding:2px;text-align:center;cursor:' +
          (hasEvs ? "pointer" : "default") +
          ';vertical-align:top;"' +
          (hasEvs ? " onclick=\"mostrarDiaCalendario('" + dStr + "')\"" : "") +
          ' title="' +
          (hasEvs ? evs.length + " recordatorio(s)" : "") +
          '"><div style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:30px;height:30px;' +
          bgHoy +
          '"><span style="font-size:12px;font-weight:' +
          (esHoy ? "800" : hasEvs ? "700" : "400") +
          ';">' +
          dia +
          '</span></div><div style="width:6px;height:6px;border-radius:50%;' +
          dotBg +
          ';margin:1px auto 0;"></div></td>'),
          dia++);
      }
    if (((html += "</tr>"), dia > ultimoDia)) break;
  }
  ((html += "</tbody></table>"),
    (document.getElementById("cal-grid").innerHTML = html));
  var totalMes = 0,
    mesKey = _calYear + "-" + String(_calMonth + 1).padStart(2, "0");
  (Object.keys(eventos).forEach(function (k) {
    k.startsWith(mesKey) && (totalMes += eventos[k].length);
  }),
    (document.getElementById("cal-detalle").innerHTML =
      totalMes > 0
        ? '<div style="font-size:12px;color:var(--text3);padding:6px 0 2px;">&#x1F514; <strong>' +
          totalMes +
          " recordatorio" +
          (1 !== totalMes ? "s" : "") +
          "</strong> este mes &mdash; toca un punto naranja para ver el detalle.</div>"
        : '<div style="font-size:12px;color:var(--text3);padding:8px 0;">Sin recordatorios pendientes este mes.</div>'));
}
function mostrarDiaCalendario(fecha) {
  var eventos,
    evs = _getEventosRecordatorios()[fecha] || [];
  if (evs.length) {
    var d,
      label = new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      det;
    document.getElementById("cal-detalle").innerHTML =
      '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px;text-transform:capitalize;">' +
      label +
      "</div>" +
      evs
        .map(function (e) {
          return (
            '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;background:var(--surface2);border-radius:8px;border-left:3px solid #f59e0b;margin-bottom:4px;cursor:pointer;" onclick="cerrarModal(\'modal-seguimiento\');seleccionarCliente(' +
            e.clienteId +
            ')"><span style="font-size:15px;margin-top:1px;">&#x1F514;</span><div><div style="font-size:12px;font-weight:700;color:var(--text);">' +
            e.clienteNombre +
            '</div><div style="font-size:11px;color:var(--text2);margin-top:2px;">' +
            e.texto +
            '</div></div><span style="margin-left:auto;color:var(--text3);font-size:14px;align-self:center;">&#x203A;</span></div>'
          );
        })
        .join("");
  }
}



function abrirModalHoy() {
  var hoy = new Date(),
    hISO = hoy.toISOString().slice(0, 10),
    dias,
    meses = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
    fechaStr =
      [
        "domingo",
        "lunes",
        "martes",
        "miércoles",
        "jueves",
        "viernes",
        "sábado",
      ][hoy.getDay()] +
      ", " +
      hoy.getDate() +
      " de " +
      meses[hoy.getMonth()] +
      " de " +
      hoy.getFullYear(),
    recs = [],
    entregas = [],
    presRec = [],
    hace7 = new Date(hoy);
  hace7.setDate(hace7.getDate() - 7);
  var h7 = hace7.toISOString().slice(0, 10);
  db.forEach(function (cl) {
    ((cl.recordatorios || [])
      .filter(function (r) {
        return !r.done && r.fecha <= hISO;
      })
      .forEach(function (r) {
        recs.push({
          empresa: cl.nombre,
          id: cl.id,
          texto: r.texto,
          urgente: r.fecha < hISO,
          fecha: r.fecha,
        });
      }),
      (cl.llamadas || [])
        .filter(function (l) {
          return (
            l &&
            "object" == typeof l &&
            "pendiente" === l.tipo &&
            l.fechaISO &&
            l.fechaISO <= hISO
          );
        })
        .forEach(function (l) {
          recs.push({
            empresa: cl.nombre,
            id: cl.id,
            texto: "Llamada: " + l.texto,
            urgente: l.fechaISO < hISO,
            fecha: l.fechaISO,
          });
        }),
      (cl.pedidos || [])
        .filter(function (p) {
          return (
            p.fechaEntrega &&
            p.fechaEntrega <= hISO &&
            "Pagado" !== p.estado &&
            "Entregado" !== p.estado
          );
        })
        .forEach(function (p) {
          entregas.push({
            empresa: cl.nombre,
            id: cl.id,
            ref: p.id,
            fecha: p.fechaEntrega,
            estado: p.estado || "Pendiente",
          });
        }),
      (cl.presupuestos || [])
        .filter(function (p) {
          return p.fecha && p.fecha >= h7;
        })
        .forEach(function (p) {
          presRec.push({
            empresa: cl.nombre || p.empresa,
            id: cl.id,
            ref: p.ref,
            importe: p.importe,
            fecha: p.fecha,
          });
        }));
  });
  var PIPE_LABEL = {
      prospecto: "🔵 Prospecto",
      "pendiente-datos": "📋 Pdte. datos",
      presupuestado: "📄 Presupuestado",
      negociacion: "🤝 Negociación",
      "pedido-curso": "📦 Pedido en curso",
      "pedido-entregado": "✅ Entregado",
    },
    pStats = {
      prospecto: 0,
      presupuestado: 0,
      negociacion: 0,
      "pedido-curso": 0,
      "cliente-recurrente": 0,
      perdido: 0,
    };
  db.forEach(function (cl) {
    var f = cl.pipeline || "prospecto";
    void 0 !== pStats[f] ? pStats[f]++ : pStats.prospecto++;
  });
  var mesActual = hISO.slice(0, 7),
    totalPed = 0,
    factMes = 0;
  function goClient(id) {
    (cerrarModal("modal-hoy"),
      (activeId = id),
      save(),
      cargarLista(),
      renderPerfil());
  }
  function recRow(r) {
    var esTxt = (r.texto || "").replace(/'/g, "\\'");
    return (
      '<div class="hoy-item" style="display:flex;align-items:center;gap:8px;"><div style="cursor:pointer;flex:1;display:flex;align-items:center;gap:8px;" onclick="goClient(\'' +
      r.id +
      '\')"><div class="hoy-dot" style="background:' +
      (r.urgente ? "#ef4444" : "#f59e0b") +
      '"></div><div><div class="hoy-empresa">' +
      r.empresa +
      '</div><div class="hoy-sub">' +
      r.texto +
      " · " +
      r.fecha +
      '</div></div></div><button onclick="marcarRecordatorioPorCliente(' +
      r.id +
      ",'" +
      esTxt +
      "','" +
      r.fecha +
      '\')" style="flex-shrink:0;padding:3px 10px;border-radius:20px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#16a34a;cursor:pointer;font-size:11px;font-weight:600;">✔ Hecho</button></div>'
    );
  }
  function entRow(e) {
    return (
      '<div class="hoy-item" style="cursor:pointer;" onclick="goClient(\'' +
      e.id +
      '\')"><div class="hoy-dot" style="background:' +
      (e.fecha < hISO ? "#ef4444" : "#3b82f6") +
      '"></div><div><div class="hoy-empresa">' +
      e.empresa +
      '</div><div class="hoy-sub">' +
      e.ref +
      " · " +
      e.estado +
      " · " +
      e.fecha +
      "</div></div></div>"
    );
  }
  function presRow(p) {
    return (
      '<div class="hoy-item"><div class="hoy-dot" style="background:#8b5cf6"></div><div><div class="hoy-empresa">' +
      p.empresa +
      '</div><div class="hoy-sub">' +
      p.ref +
      " · " +
      (p.importe
        ? parseFloat(p.importe).toLocaleString("es-ES", {
            minimumFractionDigits: 2,
          }) + " €"
        : "s/imp.") +
      " · " +
      p.fecha +
      "</div></div></div>"
    );
  }
  db.forEach(function (cl) {
    (cl.pedidos || []).forEach(function (p) {
      (p.fecha || "").slice(0, 7) === mesActual &&
        (totalPed++, p.importe && (factMes += parseFloat(p.importe || 0)));
    });
  });
  var html =
    '<p style="color:var(--text3);font-size:12px;margin-bottom:12px;">' +
    fechaStr +
    '</p><div class="hoy-grid2"><div class="hoy-card"><div class="hoy-card-title">Clientes en cartera</div><div class="hoy-card-stat">' +
    db.length +
    '</div><div class="hoy-card-sub">registrados</div></div><div class="hoy-card"><div class="hoy-card-title">Pedidos este mes</div><div class="hoy-card-stat">' +
    totalPed +
    '</div><div class="hoy-card-sub">Facturado: ' +
    factMes.toLocaleString("es-ES", { minimumFractionDigits: 2 }) +
    ' €</div></div></div><div class="hoy-grid2"><div class="hoy-card"><div class="hoy-card-title">⚠️ Recordatorios pendientes (' +
    recs.length +
    ")</div>" +
    (recs.length
      ? recs.slice(0, 7).map(recRow).join("")
      : '<div style="color:var(--text3);font-size:12px;padding:8px 0;">✅ Sin recordatorios</div>') +
    '</div><div class="hoy-card"><div class="hoy-card-title">📦 Entregas pendientes (' +
    entregas.length +
    ")</div>" +
    (entregas.length
      ? entregas.slice(0, 7).map(entRow).join("")
      : '<div style="color:var(--text3);font-size:12px;padding:8px 0;">✅ Sin entregas vencidas</div>') +
    '</div></div><div class="hoy-grid2"><div class="hoy-card"><div class="hoy-card-title">📄 Presupuestos últimos 7 días (' +
    presRec.length +
    ")</div>" +
    (presRec.length
      ? presRec.slice(0, 6).map(presRow).join("")
      : '<div style="color:var(--text3);font-size:12px;padding:8px 0;">Sin presupuestos esta semana</div>') +
    '</div><div class="hoy-card"><div class="hoy-card-title">🗂️ Estado Pipeline</div>' +
    Object.entries(pStats)
      .map(function (e) {
        return (
          '<div class="pipe-row"><span>' +
          PIPE_LABEL[e[0]] +
          "</span><strong>" +
          e[1] +
          "</strong></div>"
        );
      })
      .join("") +
    "</div></div>";
  ((document.getElementById("hoy-content").innerHTML = html),
    abrirModal("modal-hoy"));
  actualizarCuota();
}







function exportarInformePDF() {
  var hoy = new Date().toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    totalFact = 0;
  db.forEach(function (cl) {
    (cl.pedidos || []).forEach(function (p) {
      p.importe && (totalFact += parseFloat(p.importe || 0));
    });
  });
  var top = db
      .slice()
      .sort(function (a, b) {
        var fa = (a.pedidos || []).reduce(function (s, p) {
            return s + parseFloat(p.importe || 0);
          }, 0),
          fb;
        return (
          (b.pedidos || []).reduce(function (s, p) {
            return s + parseFloat(p.importe || 0);
          }, 0) - fa
        );
      })
      .slice(0, 10),
    PIPE = {
      prospecto: "Prospecto",
      "pendiente-datos": "Pdte. datos",
      presupuestado: "Presupuestado",
      negociacion: "🤝 Negociación",
      "pedido-curso": "Pedido en curso",
      "pedido-entregado": "Entregado",
    },
    pStats = {};
  (Object.keys(PIPE).forEach(function (k) {
    pStats[k] = 0;
  }),
    db.forEach(function (cl) {
      var f = cl.pipeline || "prospecto";
      void 0 !== pStats[f] ? pStats[f]++ : pStats.prospecto++;
    }));
  var logoSrc = EMP.logoUrl || "",
    html =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Informe CRM</title><style>body{font-family:Segoe UI,Arial,sans-serif;color:#1a1a2e;padding:20mm 22mm;font-size:10pt;}h1{font-size:16pt;color:#4C1D95;border-bottom:2px solid #4C1D95;padding-bottom:6px;margin-bottom:14px;}h2{font-size:11pt;color:#4C1D95;margin:14px 0 7px;}table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:9pt;}th{background:#4C1D95;color:#fff;padding:6px 8px;text-align:left;}td{padding:5px 8px;border-bottom:1px solid #e2e8f0;}.stats{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0;}.stat{flex:1;min-width:100px;background:#f0f4ff;border-radius:8px;padding:10px 14px;text-align:center;}.stat b{display:block;font-size:18pt;color:#4C1D95;font-weight:900;}.stat small{font-size:8.5pt;color:#64748b;}@page{margin:10mm 15mm;size:A4;}@media print{body{padding:0}}</style></head><body>' +
      (logoSrc
        ? logoCandy(30, "margin-bottom:10px;") + "<br>"
        : "") +
      '<h1>Informe CRM — ' + escHtml(EMP.razonSocial) + '</h1><p style="color:#64748b;font-size:9.5pt;margin-bottom:12px;">Generado el ' +
      hoy +
      " · " +
      db.length +
      ' clientes en cartera</p><div class="stats"><div class="stat"><b>' +
      db.length +
      '</b><small>Clientes</small></div><div class="stat"><b>' +
      db.reduce(function (a, cl) {
        return a + (cl.pedidos || []).length;
      }, 0) +
      '</b><small>Pedidos totales</small></div><div class="stat"><b>' +
      totalFact.toLocaleString("es-ES", { minimumFractionDigits: 2 }) +
      ' €</b><small>Facturación total</small></div><div class="stat"><b>' +
      db.reduce(function (a, cl) {
        return a + (cl.presupuestos || []).length;
      }, 0) +
      "</b><small>Presupuestos</small></div></div><h2>Pipeline de Ventas</h2><table><tr>" +
      Object.entries(pStats)
        .map(function (e) {
          return "<th>" + PIPE[e[0]] + "</th>";
        })
        .join("") +
      "</tr><tr>" +
      Object.entries(pStats)
        .map(function (e) {
          return (
            '<td style="text-align:center;font-weight:700;font-size:13pt;">' +
            e[1] +
            "</td>"
          );
        })
        .join("") +
      '</tr></table><h2>Top 10 Clientes por Facturación</h2><table><tr><th>#</th><th>Empresa</th><th>Sector</th><th>Provincia</th><th>Pedidos</th><th style="text-align:right">Facturado</th></tr>' +
      top
        .map(function (cl, i) {
          var fact = (cl.pedidos || []).reduce(function (s, p) {
            return s + parseFloat(p.importe || 0);
          }, 0);
          return (
            "<tr><td>" +
            (i + 1) +
            "</td><td><strong>" +
            cl.nombre +
            "</strong></td><td>" +
            (cl.sector || "—") +
            "</td><td>" +
            (cl.provincia || "—") +
            '</td><td style="text-align:center;">' +
            (cl.pedidos || []).length +
            '</td><td style="text-align:right;font-weight:700;color:#4C1D95;">' +
            fact.toLocaleString("es-ES", { minimumFractionDigits: 2 }) +
            " €</td></tr>"
          );
        })
        .join("") +
      '</table><div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:8pt;color:#94a3b8;text-align:center;">' + escHtml(EMP.pieLegal) + '</div></body></html>',
    blob = new Blob([html], { type: "text/html" }),
    win;
  window.open(URL.createObjectURL(blob), "_blank", "width=920,height=820")
    ? mostrarToast("Informe listo — Ctrl+P para guardar PDF", "ok")
    : mostrarToast("Activa los pop-ups", "err");
}
function exportarICal() {
  var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CRM//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ],
    count = 0;
  if (
    (db.forEach(function (cl) {
      (cl.recordatorios || [])
        .filter(function (r) {
          return !r.done;
        })
        .forEach(function (r) {
          if (r.fecha) {
            var uid =
                "ncrm-" + cl.id + "-" + count++ + "-" + Date.now() + "@crm",
              dtStart = r.fecha.replace(/-/g, "") + "T090000",
              dtEnd = r.fecha.replace(/-/g, "") + "T100000",
              desc = (r.texto || "").split(",").join(",").split(";").join(";"),
              stamp =
                new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) +
                "Z";
            lines.push(
              "BEGIN:VEVENT",
              "UID:" + uid,
              "DTSTAMP:" + stamp,
              "DTSTART;TZID=Europe/Madrid:" + dtStart,
              "DTEND;TZID=Europe/Madrid:" + dtEnd,
              "SUMMARY:CRM: " + cl.nombre,
              "DESCRIPTION:" + desc,
              "CATEGORIES:CRM",
              "END:VEVENT",
            );
          }
        });
    }),
    lines.push("END:VCALENDAR"),
    count)
  ) {
    var CRLF = String.fromCharCode(13, 10),
      blob = new Blob([lines.join(CRLF)], {
        type: "text/calendar;charset=utf-8",
      }),
      a = document.createElement("a");
    ((a.href = URL.createObjectURL(blob)),
      (a.download = "recordatorios.ics"),
      a.click(),
      mostrarToast(count + " recordatorios exportados a iCal ✓", "ok"));
  } else mostrarToast("No hay recordatorios pendientes", "err");
}
var _sbSyncing = !1,
  _sbSaveTimer = null,
  _sbToken = null;
function _sbHeaders() {
  return {
    apikey: SB_KEY,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
    Authorization: "Bearer " + (_sbToken || SB_KEY),
  };
}
function sbSave(data, tsISO) {
  if (!SB_DISABLED) {
    var ts = tsISO || new Date().toISOString();
    (sbSetStatus("busy"),
      fetch(SB_URL + "/rest/v1/crm_data?id=eq.main", {
        method: "PATCH",
        headers: _sbHeaders(),
        body: JSON.stringify({ id: "main", data: data, updated_at: ts }),
      })
        .then(function (r) {
          if (r.ok || 204 === r.status) {
            sbSetStatus("ok");
          } else if (r.status !== 500 && r.status !== 409) {
            fetch(SB_URL + "/rest/v1/crm_data", {
              method: "POST",
              headers: _sbHeaders(),
              body: JSON.stringify({ id: "main", data: data, updated_at: ts }),
            }).then(function (r2) {
              sbSetStatus(r2.ok || 201 === r2.status ? "ok" : "err");
            });
          } else {
            sbSetStatus("err");
            if (r.status === 500)
              console.error(
                "Supabase 500: Posible Payload Too Large (DB excede limite REST).",
              );
          }
        })
        .catch(function () {
          sbSetStatus("err");
        }));
  }
}
function sbLoad() {
  return SB_DISABLED
    ? (sbSetStatus("local"), Promise.resolve(null))
    : (sbSetStatus("busy"),
      fetch(SB_URL + "/rest/v1/crm_data?id=eq.main&select=data,updated_at", {
        headers: {
          apikey: SB_KEY,
          Authorization: "Bearer " + (_sbToken || SB_KEY),
        },
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (rows) {
          return rows && rows.length && rows[0].data
            ? (sbSetStatus("ok"),
              { ts: rows[0].updated_at, data: rows[0].data })
            : (sbSetStatus("ok"), null);
        })
        .catch(function (e) {
          return (
            console.warn("Supabase offline", e),
            sbSetStatus("err"),
            null
          );
        }));
}
function sbSetStatus(s) {
  var w = document.getElementById("sync-status-wrap");
  w &&
    ("ok" === s &&
      (w.innerHTML =
        '<span class="sync-badge sync-ok">&#x2601; Sincronizado</span>'),
    "err" === s &&
      (w.innerHTML =
        '<span class="sync-badge sync-err">&#x26A0; Sin conexion</span>'),
    "busy" === s &&
      (w.innerHTML =
        '<span class="sync-badge sync-busy"><span class="sync-spin">&#x27F3;</span> Sincronizando...</span>'),
    "local" === s &&
      (w.innerHTML =
        '<span class="sync-badge sync-local" title="Se guarda solo en Supabase a través del panel (solo admins con doble factor)">&#x2601;&#xFE0F; Guardado en el panel</span>'));
}
function sbForzarSync() {
  SB_DISABLED
    ? mostrarToast("Los cambios se guardan solos en Supabase a través del panel. El estado aparece arriba, junto a «CRM».", "info")
    : (sbSetStatus("busy"),
      sbSave(db, _lastSave),
      sbLoad().then(function (result) {
        var remoteTsMs, localTsMs;
        result && result.data
          ? (new Date(result.ts).getTime() >
              (new Date(_lastSave).getTime() || 0) &&
              ((db = result.data),
              db.find(function (x) {
                return x.id === activeId;
              }) || (activeId = db[0] ? db[0].id : null),
              (_lastSave = result.ts),
              CRM_STORE.setItem("ncrm_crm", JSON.stringify(db)),
              CRM_STORE.setItem("ncrm_active", activeId || ""),
              CRM_STORE.setItem("ncrm_ts", result.ts),
              actualizarProvincias(),
              cargarLista(),
              renderPerfil(),
              renderAlertas(),
              renderPanelHoy()),
            mostrarToast("☁ Sincronizacion completada", "ok"))
          : mostrarToast("Sincronizado", "ok");
      }));
}
function addNotaConAdjunto(event) {
  var file = event.target.files[0];
  if (!file) return;
  var cl = db.find(function (x) {
    return x.id === activeId;
  });
  if (!cl) return;
  var txt = document.getElementById("nueva-nota").value.trim();
  var fh = fechaHoraAhora();
  var reader = new FileReader();
  reader.onload = function (e) {
    cl.notas.push({
      texto: txt || file.name,
      fecha: fh.fecha,
      hora: fh.hora,
      ts: fh.ts,
      adjunto: e.target.result,
      adjuntoTipo: file.type,
      adjuntoNombre: file.name,
    });
    save();
    document.getElementById("nueva-nota").value = "";
    event.target.value = "";

    // FIX SCROLL: preservar posición al re-renderizar
    var mainEl = document.getElementById("main-area");
    var scrollPos = mainEl ? mainEl.scrollTop : 0;
    renderPerfil();
    if (mainEl) mainEl.scrollTop = scrollPos;

    mostrarToast("Archivo adjuntado", "ok");
    setTimeout(function () {
      var el = document.getElementById("nueva-nota");
      if (el) el.focus();
    }, 50);
  };
  reader.readAsDataURL(file);
}
function verAdjuntoNota(idx) {
  var cl = db.find(function (x) {
    return x.id === activeId;
  });
  if (cl) {
    var nota = cl.notas[idx];
    if (nota && nota.adjunto)
      if ("application/pdf" === nota.adjuntoTipo) {
        for (
          var pts = nota.adjunto.split(","),
            mime = pts[0].match(/:(.*?);/)[1],
            bstr = atob(pts[1]),
            n = bstr.length,
            u8 = new Uint8Array(n);
          n--;
        )
          u8[n] = bstr.charCodeAt(n);
        window.open(
          URL.createObjectURL(new Blob([u8], { type: mime })),
          "_blank",
        );
      } else {
        var win = window.open("", "_blank");
        (win.document.write(
          '<html><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="' +
            nota.adjunto +
            '" style="max-width:100%;max-height:100vh;object-fit:contain;"></body></html>',
        ),
          win.document.close());
      }
  }
}
function delNota(idx) {
  eliminarActividad("nota", idx);
}
var _planTipo = "llamada";
function abrirPlanificar(tipo) {
  ((_planTipo = tipo),
    (document.getElementById("plan-title").textContent =
      "llamada" === tipo ? "Planificar llamada" : "Planificar visita"),
    (document.getElementById("plan-asunto").value = ""),
    (document.getElementById("plan-hora").value = ""),
    (document.getElementById("plan-notas").value = ""));
  var d = new Date();
  (d.setDate(d.getDate() + 1),
    (document.getElementById("plan-fecha").value = d
      .toISOString()
      .slice(0, 10)),
    abrirModal("modal-planificar"));
}
function guardarPlanificado() {
  var fecha = document.getElementById("plan-fecha").value,
    hora = document.getElementById("plan-hora").value,
    asunto = document.getElementById("plan-asunto").value.trim(),
    notas = document.getElementById("plan-notas").value.trim();
  if (fecha)
    if (asunto) {
      var cl = db.find(function (x) {
        return x.id === activeId;
      });
      if (cl) {
        var fechaES = new Date(fecha + "T12:00:00").toLocaleDateString("es-ES"),
          desc =
            asunto +
            (notas ? " | " + notas : "") +
            (hora ? " a las " + hora : "");
        if (
          ((cl.recordatorios = cl.recordatorios || []),
          cl.recordatorios.push({
            fecha: fecha,
            texto:
              ("llamada" === _planTipo
                ? "Llamada pendiente: "
                : "Visita planificada: ") +
              asunto +
              (hora ? " (" + hora + ")" : ""),
            notas: notas,
            done: !1,
            creadoEn: new Date().toISOString(),
          }),
          "llamada" !== _planTipo)
        ) {
          cl.visitas = cl.visitas || [];
          var visIdx = cl.visitas.length;
          return (
            cl.visitas.push({
              text:
                fechaES +
                ": [Planificada]" +
                (hora ? " " + hora + " |" : "") +
                " " +
                asunto +
                (notas ? " | " + notas : ""),
              gcalEventId: "",
              planificada: !0,
              fechaISO: fecha,
              ts: new Date().toISOString(),
            }),
            save(),
            cerrarModal("modal-planificar"),
            renderPerfil(),
            renderAlertas(),
            renderPanelHoy(),
            cargarLista(),
            mostrarToast("Visita planificada para " + fechaES, "ok"),
            void ofrecerGCal({
              fecha: fecha,
              horaIni: hora || "09:00",
              horaFin: hora ? sumarHora(hora, 1) : "10:00",
              titulo: "Visita: " + cl.nombre,
              desc: asunto + (notas ? " | " + notas : ""),
              clienteId: cl.id,
              visIdx: visIdx,
            })
          );
        }
        ((cl.llamadas = cl.llamadas || []),
          cl.llamadas.push({
            texto: desc,
            fecha: fechaES,
            hora: hora,
            tipo: "pendiente",
            fechaISO: fecha,
            ts: new Date().toISOString(),
          }),
          save(),
          cerrarModal("modal-planificar"),
          renderPerfil(),
          renderAlertas(),
          renderPanelHoy(),
          cargarLista(),
          mostrarToast("Llamada planificada para " + fechaES, "ok"));
      }
    } else alert("El asunto es obligatorio");
  else alert("La fecha es obligatoria");
}
function fechaHoraAhora() {
  var d = new Date(),
    fecha,
    hora;
  return {
    fecha: d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    hora: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    ts: d.toISOString(),
  };
}















function normaliz(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}










function exportarClientesExcel() {
  if ("undefined" != typeof XLSX) {
    var rows = [
      [
        "Empresa",
        "Contacto",
        "Tel. Movil",
        "Tel. Fijo",
        "Email",
        "Municipio",
        "Direccion",
        "Provincia",
        "Sector",
        "CIF",
        "Pipeline",
        "Tipo de cliente",
        "Pedidos",
        "Facturado",
        "Ultima actividad",
      ],
    ];
    db.forEach(function (cl) {
      var fact = (cl.pedidos || []).reduce(function (s, p) {
          return s + parseFloat(p.importe || 0);
        }, 0),
        up = null,
        parseFES = function (s) {
          if (!s) return null;
          var m = (s || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          return m
            ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
            : null;
        };
      ((cl.pedidos || []).forEach(function (p) {
        var d = new Date(p.fecha) || parseFES(p.fecha);
        d && (!up || d > up) && (up = d);
      }),
        rows.push([
          cl.nombre || "",
          cl.contacto || "",
          cl.telefono || "",
          cl.telefonoFijo || "",
          cl.email || "",
          cl.municipio || "",
          cl.direccion || "",
          cl.provincia || "",
          cl.sector || "",
          cl.cif || "",
          cl.pipeline || "",
          cl.etiqueta || "",
          (cl.pedidos || []).length,
          Math.round(100 * fact) / 100,
          up ? up.toLocaleDateString("es-ES") : "",
        ]));
    });
    var wb = XLSX.utils.book_new(),
      ws = XLSX.utils.aoa_to_sheet(rows);
    ((ws["!cols"] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 25 },
      { wch: 18 },
      { wch: 30 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 8 },
      { wch: 12 },
      { wch: 14 },
    ]),
      XLSX.utils.book_append_sheet(wb, ws, "Clientes"),
      XLSX.writeFile(
        wb,
        "clientes_" + new Date().toISOString().slice(0, 10) + ".xlsx",
      ),
      mostrarToast("Exportados " + db.length + " clientes", "ok"));
  } else mostrarToast("Libreria Excel no disponible", "err");
}










document.addEventListener("click", function (e) {
  var s = document.getElementById("nr-sugerencias");
  if (s && !s.contains(e.target) && e.target.id !== "nr-buscar")
    s.style.display = "none";
});

// --- KANBAN BOARD LOGIC ---
function abrirKanban() {
  var board = document.getElementById("kanban-board");
  if (!board) return;
  board.innerHTML = "";

  var columns = [
    { id: "prospecto", name: "Prospecto / Lead" },
    { id: "pendiente-datos", name: "Pendiente Datos" },
    { id: "presupuestado", name: "Presupuestado" },
    { id: "negociacion", name: "🤝 Negociación" },
    { id: "pedido-curso", name: "Pedido en Curso" },
  ];

  columns.forEach(function (col) {
    var colDiv = document.createElement("div");
    colDiv.className = "kanban-col";

    var titleDiv = document.createElement("div");
    titleDiv.className = "kanban-col-title";
    titleDiv.textContent = col.name;

    var countSpan = document.createElement("span");
    countSpan.className = "kanban-col-count";
    countSpan.style.background = "var(--surface3)";
    countSpan.style.borderRadius = "10px";
    countSpan.style.padding = "2px 8px";
    countSpan.style.fontSize = "11px";
    countSpan.style.fontWeight = "700";

    var cardsDiv = document.createElement("div");
    cardsDiv.style.flex = "1";
    cardsDiv.style.overflowY = "auto";
    cardsDiv.style.paddingRight = "5px";

    var count = 0;

    if (typeof db !== "undefined" && db) {
      db.forEach(function (cl) {
        if (cl.pipeline === col.id) {
          count++;
          var card = document.createElement("div");
          card.className = "kanban-card";

          var title = document.createElement("div");
          title.className = "kanban-card-title";
          title.textContent = cl.nombre || "Sin nombre";

          var meta = document.createElement("div");
          meta.className = "kanban-card-meta";
          var ctc = cl.contacto ? "👤 " + cl.contacto : "";
          var tel = cl.telefono ? " - 📱 " + cl.telefono : "";
          meta.textContent = ctc + tel;

          var selectContainer = document.createElement("div");
          selectContainer.style.marginTop = "8px";

          var sel = document.createElement("select");
          sel.className = "kanban-select";
          sel.onchange = function (e) {
            cambiarFaseKanban(cl.id, e.target.value);
          };

          columns.forEach(function (c) {
            var opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = "Mover a: " + c.name;
            if (c.id === col.id) opt.selected = true;
            sel.appendChild(opt);
          });

          selectContainer.appendChild(sel);

          var btnView = document.createElement("button");
          btnView.textContent = "Ver ficha";
          btnView.style =
            "width:100%;margin-top:6px;padding:4px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);font-size:10.5px;cursor:pointer;";
          btnView.onclick = function () {
            cerrarModal("modal-kanban");
            seleccionarCliente(cl.id);
          };
          sel.style.marginBottom = "4px";

          card.appendChild(title);
          if (cl.contacto || cl.telefono) card.appendChild(meta);
          card.appendChild(selectContainer);
          card.appendChild(btnView);

          cardsDiv.appendChild(card);
        }
      });
    }

    countSpan.textContent = count;
    titleDiv.appendChild(countSpan);
    colDiv.appendChild(titleDiv);
    colDiv.appendChild(cardsDiv);

    board.appendChild(colDiv);
  });

  if (typeof abrirModal === "function") {
    abrirModal("modal-kanban");
  } else {
    document.getElementById("modal-kanban").style.display = "flex";
  }
}

function cambiarFaseKanban(id, nuevaFase) {
  var cl = null;
  if (typeof db !== "undefined") {
    for (var i = 0; i < db.length; i++) {
      if (db[i].id == id) {
        cl = db[i];
        break;
      }
    }
  }
  if (cl) {
    cl.pipeline = nuevaFase;
    if (typeof save === "function") save();
    if (typeof mostrarToast === "function")
      mostrarToast("Fase actualizada a " + nuevaFase, "ok");
    abrirKanban();
  }
}

// --- OVERRIDE setSegTab para 3 pestañas: Lista + Calendario + Dormidos ---
setSegTab = function (tab) {
  var sList = document.getElementById("seg-panel-lista");
  var sCal = document.getElementById("seg-panel-cal");
  var sDorm = document.getElementById("seg-panel-dormidos");
  var btnL = document.getElementById("seg-tab-lista");
  var btnC = document.getElementById("seg-tab-cal");
  var btnD = document.getElementById("seg-tab-dormidos");
  var off = "var(--surface2)",
    offC = "var(--text2)";
  if (sList) sList.style.display = "none";
  if (sCal) sCal.style.display = "none";
  if (sDorm) sDorm.style.display = "none";
  if (btnL) {
    btnL.style.background = off;
    btnL.style.color = offC;
  }
  if (btnC) {
    btnC.style.background = off;
    btnC.style.color = offC;
  }
  if (btnD) {
    btnD.style.background = off;
    btnD.style.color = offC;
  }
  if (tab === "lista") {
    if (sList) sList.style.display = "";
    if (btnL) {
      btnL.style.background = "var(--accent)";
      btnL.style.color = "#fff";
    }
    renderSeguimiento();
  } else if (tab === "cal") {
    if (sCal) sCal.style.display = "";
    if (btnC) {
      btnC.style.background = "var(--accent)";
      btnC.style.color = "#fff";
    }
    renderCalendario();
  } else if (tab === "dormidos") {
    if (sDorm) sDorm.style.display = "";
    if (btnD) {
      btnD.style.background = "var(--accent)";
      btnD.style.color = "#fff";
    }
    renderDormidosInline();
  }
};

function renderDormidosInline() {
  var hoy = Date.now();
  var parseFechaISO = function (s) {
    var d = new Date(s);
    return isNaN(d) ? null : d;
  };
  var parseFechaES = function (s) {
    var m = s ? s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null;
    return m
      ? new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]))
      : null;
  };
  var ultimoPedidoFn = function (c) {
    var u = null;
    (c.pedidos || []).forEach(function (p) {
      var d = parseFechaISO(p.fecha) || parseFechaES(p.fecha);
      if (d && (!u || d > u)) u = d;
    });
    return u;
  };
  var dormidos = db
    .filter(function (c) {
      return c.etiqueta === "Recurrente";
    })
    .map(function (c) {
      var u = ultimoPedidoFn(c);
      return {
        c: c,
        u: u,
        dias: u ? Math.floor((hoy - u.getTime()) / 864e5) : 9999,
      };
    })
    .filter(function (x) {
      return x.dias > 90;
    })
    .sort(function (a, b) {
      return b.dias - a.dias;
    });
  var list = document.getElementById("seg-dormidos-list");
  if (!list) return;
  if (dormidos.length) {
    list.innerHTML = dormidos
      .map(function (x) {
        var diasLabel = x.dias === 9999 ? "Sin pedidos" : x.dias + " dias";
        var ultimaLabel = x.u
          ? x.u.toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Nunca";
        return (
          '<div class="dormido-card" onclick="cerrarModal(\'modal-seguimiento\');seleccionarCliente(' +
          x.c.id +
          ')">' +
          '<div style="text-align:center;min-width:42px;">' +
          '<div class="dormido-dias">' +
          (x.dias === 9999 ? "∞" : x.dias) +
          "</div>" +
          '<div class="dormido-dias-label">dias</div>' +
          "</div>" +
          '<div style="flex:1;min-width:0;">' +
          '<div class="dormido-nombre">' +
          x.c.nombre +
          "</div>" +
          '<div class="dormido-meta">' +
          (x.c.provincia || "") +
          (x.c.provincia && x.c.sector ? " · " : "") +
          (x.c.sector || "") +
          "</div>" +
          '<div class="dormido-meta" style="margin-top:3px;">Ultimo pedido: ' +
          ultimaLabel +
          "</div>" +
          "</div>" +
          '<div style="flex-shrink:0;font-size:11px;color:var(--text3);">Ver ›</div>' +
          "</div>"
        );
      })
      .join("");
  } else {
    list.innerHTML =
      '<div style="text-align:center;padding:30px;color:var(--text3);font-size:13px;">✅ Ningun cliente recurrente dormido. ¡Buen trabajo!</div>';
  }
}

// ===== GOOGLE BIDIRECTIONAL SYNC MODULE =====
// Sincronización bidireccional Calendar + Tasks

// 1. Crear evento en Google Calendar via REST API (devuelve eventId)
async function crearEventoCalendarAPI(opts) {
  if (!gToken) return null;
  var startISO, endISO;
  if (opts.horaIni) {
    var dInicio = new Date(opts.fecha + "T" + opts.horaIni + ":00");
    startISO = dInicio.toISOString();
    var hFin = opts.horaFin || "";
    var dFin;
    if (hFin) {
      dFin = new Date(opts.fecha + "T" + hFin + ":00");
      if (dFin <= dInicio) dFin = new Date(dInicio.getTime() + 3600000);
    } else {
      dFin = new Date(dInicio.getTime() + 3600000);
    }
    endISO = dFin.toISOString();
  } else {
    var dStart = new Date(opts.fecha + "T09:00:00");
    startISO = dStart.toISOString();
    var dEnd = new Date(dStart.getTime() + 3600000);
    endISO = dEnd.toISOString();
  }

  var body = {
    summary: opts.titulo || "CRM",
    description: (opts.desc || "") + "\n---\nRegistrado desde el CRM",
    start: { dateTime: startISO },
    end: { dateTime: endISO },
    extendedProperties: {
      private: {
        crmApp: "true",
        crmClienteId: String(opts.clienteId || ""),
        crmTipo: opts.tipo || "visita",
      },
    },
  };
  if (opts.location) body.location = opts.location;
  try {
    var res = await gFetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    if (!res) return null;
    if (res.ok) {
      var data = await res.json();
      return data.id;
    } else {
      var errData = await res.json().catch(function() { return {}; });
      console.error("[CRM Sync] Error en crearEventoCalendarAPI HTTP", res.status, errData);
    }
  } catch (e) {
    console.error("[CRM Sync] crearEventoCalendarAPI ex:", e);
  }
  return null;
}

// 2. Override ofrecerGCal: cuando hay token, crear via API directamente
(function () {
  var _origOfrecerGCal = typeof ofrecerGCal === "function" ? ofrecerGCal : null;
  ofrecerGCal = async function (p) {
    if (!gToken) {
      if (_origOfrecerGCal) return _origOfrecerGCal(p);
      return;
    }
    var c = db.find(function (x) {
      return x.id === (p.clienteId != null ? p.clienteId : activeId);
    });
    var eventId = await crearEventoCalendarAPI({
      fecha: p.fecha,
      horaIni: p.horaIni || null,
      horaFin: p.horaFin || null,
      titulo: p.titulo || "Visita: " + (c ? c.nombre : "Cliente"),
      desc: p.desc || "",
      location: c ? c.direccion || "" : "",
      clienteId: p.clienteId != null ? p.clienteId : activeId,
      tipo: "visita",
    });
    if (eventId) {
      if (c && p.visIdx != null && c.visitas && c.visitas[p.visIdx]) {
        var vis = c.visitas[p.visIdx];
        if (typeof vis === "object") vis.gcalEventId = eventId;
        save();
      }
      mostrarToast("Visita sincronizada con Google Calendar", "ok");
    } else {
      mostrarToast("No se pudo crear el evento en Calendar", "err");
    }
  };
})();

// 3. Override addActivity: crear eventos Calendar para llamadas
(function () {
  var _origAddActivity = addActivity;
  addActivity = function (tipo) {
    var c = null,
      prevLen = 0;
    if (tipo === "llamada" && gToken) {
      c = db.find(function (x) {
        return x.id === activeId;
      });
      if (c) prevLen = (c.llamadas || []).length;
    }
    _origAddActivity(tipo);
    if (
      tipo === "llamada" &&
      gToken &&
      c &&
      (c.llamadas || []).length > prevLen
    ) {
      var last = c.llamadas[c.llamadas.length - 1];
      var hoy = new Date().toISOString().slice(0, 10);
      crearEventoCalendarAPI({
        fecha: hoy,
        horaIni: null,
        titulo: "Llamada: " + c.nombre,
        desc: typeof last === "object" ? last.texto || "" : String(last || ""),
        clienteId: c.id,
        tipo: "llamada",
      }).then(function (evId) {
        if (evId && typeof last === "object") {
          last.gcalEventId = evId;
          save();
        }
      });
    }
  };
})();

// 4. Override enviarAGoogleTasks: almacenar taskId en el recordatorio
(function () {
  enviarAGoogleTasks = async function (params) {
    var tituloFinal =
      (params.titulo || "Tarea CRM") + " - " + (params.empresa || "");
    // BUG FIX 1: sin token → mostrar overlay igual que la función original
    if (!gToken) {
      _pendienteGTask = { titulo: tituloFinal, notas: params.notas, fecha: params.fecha };
      mostrarOverlayGTask(tituloFinal, params.notas || "", params.fecha || "");
      return;
    }
    var body = { title: tituloFinal };
    if (params.notas) body.notes = params.notas;
    if (params.fecha) body.due = new Date(params.fecha + "T12:00:00").toISOString();
    try {
      var res = await gFetch(
        "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      if (!res) return;
      if (res.ok) {
        var data = await res.json();
        // BUG FIX 2: usar params.clienteId explícito (no activeId que puede haber cambiado)
        var cid = params.clienteId != null ? params.clienteId : activeId;
        var c = db.find(function (x) { return x.id === cid; });
        // BUG FIX 3: usar params.recIdx para apuntar al recordatorio exacto (no el último)
        if (c && params.recIdx != null && c.recordatorios && c.recordatorios[params.recIdx]) {
          var rec = c.recordatorios[params.recIdx];
          if (typeof rec === "object") {
            rec.gtaskId = data.id;
            save();
          }
        }
        mostrarToast("☑️ Tarea creada en Google Tasks", "ok");
        var gpanel = document.getElementById("gpanel-tasks");
        if (gpanel && gpanel.style.display !== "none") cargarTareasGoogle();
      } else {
        var errData = await res.json().catch(function() { return {}; });
        console.error("[CRM Sync] Error en enviarAGoogleTasks HTTP " + res.status, errData);
        alert("Error de Google Tasks: " + (errData.error?.message || res.status));
      }
    } catch (e) {
      console.error("[CRM Sync] enviarAGoogleTasks excepcion:", e);
    }
  };
})();

// 5. Motor de sincronizacion bidireccional (polling)
async function sincronizarGoogle() {
  if (!gToken) return;
  var cambios = 0;

  // --- A) Calendar: verificar si los eventos vinculados siguen existiendo ---
  var calItems = [];
  db.forEach(function (c) {
    (c.visitas || []).forEach(function (v, i) {
      if (typeof v === "object" && v.gcalEventId) {
        calItems.push({
          cid: c.id,
          tipo: "visita",
          idx: i,
          gcalId: v.gcalEventId,
        });
      }
    });
    (c.llamadas || []).forEach(function (l, i) {
      if (typeof l === "object" && l.gcalEventId) {
        calItems.push({
          cid: c.id,
          tipo: "llamada",
          idx: i,
          gcalId: l.gcalEventId,
        });
      }
    });
  });

  if (calItems.length > 0) {
    try {
      var now = new Date();
      var from = new Date(now.getTime() - 180 * 86400000);
      var to = new Date(now.getTime() + 90 * 86400000);
      var url =
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?" +
        "timeMin=" +
        from.toISOString() +
        "&timeMax=" +
        to.toISOString() +
        "&maxResults=2500&singleEvents=true";
      var res = await gFetch(url);
      if (res && res.ok) {
        var data = await res.json();
        var existingIds = {};
        (data.items || []).forEach(function (ev) {
          existingIds[ev.id] = true;
        });
        var toRemove = calItems.filter(function (item) {
          return !existingIds[item.gcalId];
        });
        toRemove.sort(function (a, b) {
          return a.cid === b.cid ? b.idx - a.idx : 0;
        });
        toRemove.forEach(function (item) {
          var c = db.find(function (x) {
            return x.id === item.cid;
          });
          if (!c) return;
          var arr = item.tipo === "visita" ? c.visitas : c.llamadas;
          if (arr && arr[item.idx]) {
            var obj = arr[item.idx];
            if (typeof obj === "object" && obj.gcalEventId === item.gcalId) {
              arr.splice(item.idx, 1);
              cambios++;
              console.log(
                "[CRM Sync] Eliminado " +
                  item.tipo +
                  " de " +
                  c.nombre +
                  " (borrado en Google)",
              );
            }
          }
        });
      }
    } catch (e) {
      console.error("[CRM Sync] Calendar poll error:", e);
    }
  }

  // --- B) Tasks: verificar si las tareas vinculadas siguen activas ---
  var taskItems = [];
  db.forEach(function (c) {
    (c.recordatorios || []).forEach(function (r, i) {
      if (typeof r === "object" && r.gtaskId && !r.hecho) {
        taskItems.push({ cid: c.id, idx: i, gtaskId: r.gtaskId });
      }
    });
  });

  if (taskItems.length > 0) {
    try {
      var resT = await gFetch(
        "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=100&showCompleted=true&showHidden=true",
      );
      if (resT && resT.ok) {
        var dataT = await resT.json();
        var taskMap = {};
        (dataT.items || []).forEach(function (t) {
          taskMap[t.id] = t;
        });
        taskItems.sort(function (a, b) {
          return a.cid === b.cid ? b.idx - a.idx : 0;
        });
        taskItems.forEach(function (item) {
          var c = db.find(function (x) {
            return x.id === item.cid;
          });
          if (!c || !c.recordatorios || !c.recordatorios[item.idx]) return;
          var rec = c.recordatorios[item.idx];
          if (typeof rec !== "object" || rec.gtaskId !== item.gtaskId) return;
          var googleTask = taskMap[item.gtaskId];
          if (!googleTask || googleTask.status === "completed") {
            rec.hecho = true;
            cambios++;
            console.log(
              "[CRM Sync] Recordatorio completado de " +
                c.nombre +
                " (completado/borrado en Google)",
            );
          }
        });
      }
    } catch (e) {
      console.error("[CRM Sync] Tasks poll error:", e);
    }
  }

  if (cambios > 0) {
    save();
    if (typeof renderPerfil === "function") renderPerfil();
    if (typeof renderPanelHoy === "function") renderPanelHoy();
    if (typeof calcularAlertas === "function") calcularAlertas();
    mostrarToast("Google sincronizado: " + cambios + " cambio(s)", "ok");
  }
  return cambios;
}

// 6. Auto-polling: sincronizar al cargar y cada 5 minutos
(function () {
  if (gToken) {
    setTimeout(function () {
      sincronizarGoogle();
    }, 5000);
  }
  setInterval(function () {
    if (gToken) sincronizarGoogle();
  }, 300000);
})();

// ═══ ATAJO DE TECLADO: Ctrl+K o '/' → foco en buscador ═══
(function () {
  document.addEventListener("keydown", function (e) {
    // Ignorar si el foco está en un input, textarea o select
    var tag = (document.activeElement || {}).tagName || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    // Ctrl+K o tecla '/'  (sin modificadores salvo Ctrl+K)
    var isSlash = e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey;
    var isCtrlK = (e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey);
    if (isSlash || isCtrlK) {
      var bus = document.getElementById("input-buscador");
      if (bus) {
        e.preventDefault();
        bus.focus();
        bus.select();
      }
    }
    // Escape → quitar foco del buscador y limpiar
    if (e.key === "Escape") {
      var bus = document.getElementById("input-buscador");
      if (bus && document.activeElement === bus) {
        bus.value = "";
        bus.blur();
        filtrarClientes();
      }
    }
  });
})();
// ═══════════════════════════════════════════════════════════════════════
// HERRAMIENTAS — modal de acceso rápido
// ═══════════════════════════════════════════════════════════════════════
function abrirHerramientas() {
  abrirModal("modal-herramientas");
}

// ═══════════════════════════════════════════════════════════════════════
// AGENDA TOP BAR — franja de eventos de hoy sobre el área principal
// ═══════════════════════════════════════════════════════════════════════
function renderAgendaBar() {
  var bar = document.getElementById("agenda-top-bar");
  if (!bar) return;

  var todayStr = new Date().toISOString().slice(0, 10);
  var events = [];

  try {
    db.forEach(function (cl) {
      // Visitas de hoy
      (cl.visitas || []).forEach(function (v) {
        var fecha =
          typeof v === "object" && v !== null
            ? v.fecha || ""
            : String(v || "").split(": ")[0] || "";
        if (fecha && fecha.slice(0, 10) === todayStr) {
          var hora = typeof v === "object" && v.hora ? v.hora : "";
          events.push({
            tipo: "visita",
            empresa: cl.nombre,
            clId: cl.id,
            texto: "Visita programada",
            hora: hora,
            emoji: "📍",
          });
        }
      });
      // Llamadas pendientes de hoy
      (cl.llamadas || []).forEach(function (l) {
        if (
          typeof l === "object" &&
          l !== null &&
          l.tipo === "pendiente" &&
          l.fecha
        ) {
          if (l.fecha.slice(0, 10) === todayStr) {
            events.push({
              tipo: "llamada",
              empresa: cl.nombre,
              clId: cl.id,
              texto: l.texto || "Llamada pendiente",
              hora: l.hora || "",
              emoji: "📞",
            });
          }
        }
      });
      // Recordatorios de hoy
      (cl.recordatorios || []).forEach(function (r) {
        if (r && r.fecha && !r.done && r.fecha.slice(0, 10) === todayStr) {
          events.push({
            tipo: "rec",
            empresa: cl.nombre,
            clId: cl.id,
            texto: r.texto || "Recordatorio",
            hora: r.hora || "",
            emoji: "🔔",
          });
        }
      });
    });
  } catch (e) {
    /* db may not be ready yet */
  }

  if (events.length === 0) {
    bar.style.display = "none";
    return;
  }

  // Ordenar por hora
  events.sort(function (a, b) {
    return (a.hora || "99:99").localeCompare(b.hora || "99:99");
  });

  bar.style.display = "flex";
  var tipoLabelMap = {
    visita: "Visita",
    llamada: "Llamada",
    rec: "Recordatorio",
  };
  bar.innerHTML =
    '<div class="agenda-bar-empty" style="color:var(--text2);font-weight:700;margin-right:4px;white-space:nowrap;">📅 Hoy:</div>' +
    events
      .map(function (ev) {
        return (
          '<div class="agenda-bar-card ' +
          ev.tipo +
          '" onclick="seleccionarCliente(\'' +
          ev.clId +
          '\')" title="' +
          ev.texto +
          '">' +
          '<div class="agenda-bar-card-tipo">' +
          ev.emoji +
          " " +
          tipoLabelMap[ev.tipo] +
          "</div>" +
          '<div class="agenda-bar-card-empresa">' +
          ev.empresa +
          "</div>" +
          (ev.hora
            ? '<div class="agenda-bar-card-hora">' + ev.hora + "</div>"
            : "") +
          "</div>"
        );
      })
      .join("");
}

// ═══════════════════════════════════════════════════════════════════════
// CALENDARIO GLOBAL — vista mensual con todos los eventos de todos los clientes
// ═══════════════════════════════════════════════════════════════════════
var _calGlobalDate = new Date();

function abrirCalendarioGlobal() {
  _calGlobalDate = new Date();
  renderCalendarioGlobal();
  abrirModal("modal-cal-global");
}

function navCalGlobal(dir) {
  _calGlobalDate = new Date(
    _calGlobalDate.getFullYear(),
    _calGlobalDate.getMonth() + dir,
    1,
  );
  renderCalendarioGlobal();
}

function renderCalendarioGlobal() {
  var d = _calGlobalDate;
  var year = d.getFullYear();
  var month = d.getMonth();
  var todayStr = new Date().toISOString().slice(0, 10);

  // Título del mes
  var tituloRaw = d.toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
  var titulo = tituloRaw.charAt(0).toUpperCase() + tituloRaw.slice(1);
  var elTit = document.getElementById("cal-global-titulo");
  if (elTit) elTit.textContent = titulo;

  // Recopilar eventos del mes
  var events = {}; // 'YYYY-MM-DD' -> [{tipo, texto, empresa, clId}]
  var pad = function (n) {
    return n < 10 ? "0" + n : String(n);
  };
  var monthStr = year + "-" + pad(month + 1);

  function addEv(dateStr, tipo, texto, empresa, clId) {
    if (!dateStr) return;
    var key = String(dateStr).slice(0, 10);
    if (key.slice(0, 7) !== monthStr) return; // solo el mes actual
    if (!events[key]) events[key] = [];
    events[key].push({
      tipo: tipo,
      texto: texto,
      empresa: empresa,
      clId: clId,
    });
  }

  try {
    db.forEach(function (cl) {
      // Visitas
      (cl.visitas || []).forEach(function (v) {
        var fecha =
          typeof v === "object" && v !== null
            ? v.fecha || ""
            : String(v || "").split(": ")[0];
        addEv(fecha, "visita", "Visita", cl.nombre, cl.id);
      });
      // Llamadas pendientes
      (cl.llamadas || []).forEach(function (l) {
        if (
          typeof l === "object" &&
          l !== null &&
          l.tipo === "pendiente" &&
          l.fecha
        ) {
          addEv(l.fecha, "llamada", l.texto || "Llamada", cl.nombre, cl.id);
        }
      });
      // Recordatorios sin completar
      (cl.recordatorios || []).forEach(function (r) {
        if (r && r.fecha && !r.done) {
          addEv(r.fecha, "rec", r.texto || "Recordatorio", cl.nombre, cl.id);
        }
      });
    });
  } catch (e) {
    /* db may not exist */
  }

  // Generar cuadrícula
  var firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes=0
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var dias = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

  var html = dias
    .map(function (d) {
      return '<div class="cal-global-day-header">' + d + "</div>";
    })
    .join("");

  // Relleno de días vacíos al inicio
  for (var i = 0; i < firstDow; i++) {
    html += '<div class="cal-global-day otro-mes"></div>';
  }

  for (var day = 1; day <= daysInMonth; day++) {
    var key = year + "-" + pad(month + 1) + "-" + pad(day);
    var isHoy = key === todayStr;
    var evList = events[key] || [];

    var numHtml = '<div class="cal-global-day-num">' + day + "</div>";

    var badgesHtml = evList
      .slice(0, 3)
      .map(function (ev) {
        return (
          '<span class="cal-badge cal-badge-' +
          ev.tipo +
          '" ' +
          "onclick=\"cerrarModal('modal-cal-global');seleccionarCliente('" +
          ev.clId +
          "')\" " +
          'title="' +
          ev.empresa +
          ": " +
          ev.texto +
          '" ' +
          'style="cursor:pointer;">' +
          (ev.tipo === "visita"
            ? "📍"
            : ev.tipo === "llamada"
              ? "📞"
              : "🔔") +
          " " +
          ev.empresa.slice(0, 10) +
          "</span>"
        );
      })
      .join("");

    if (evList.length > 3) {
      badgesHtml +=
        '<span class="cal-mas">+' + (evList.length - 3) + " más</span>";
    }

    html +=
      '<div class="cal-global-day' +
      (isHoy ? " hoy" : "") +
      '">' +
      numHtml +
      badgesHtml +
      "</div>";
  }

  var grid = document.getElementById("cal-global-grid");
  if (grid) grid.innerHTML = html;
}



function abrirReplanRecordatorio(idx) {
  const c = db.find(x => x.id === activeId);
  if (!c) return;
  const recs = (c.recordatorios || []).filter(r => !r.done).slice().reverse();
  const rec = recs[idx];
  if (!rec) return;
  document.getElementById('replan-titulo').textContent = '🔔 Replanificar recordatorio';
  document.getElementById('replan-fecha').value = rec.fecha || '';
  document.getElementById('replan-hora-wrap').style.display = 'none';
  document.getElementById('replan-tipo').value = 'recordatorio';
  document.getElementById('replan-idx').value = idx;
  document.getElementById('modal-replan').style.display = 'flex';
}

async function guardarReplan() {
  const tipo = document.getElementById('replan-tipo').value;
  const nuevaFecha = document.getElementById('replan-fecha').value;
  const nuevaHora = document.getElementById('replan-hora').value;
  const idx = parseInt(document.getElementById('replan-idx').value);
  const c = db.find(x => x.id === activeId);
  if (!c) return;
  if (!nuevaFecha) { mostrarToast('Indica una fecha', 'warn'); return; }

  if (tipo === 'visita') {
    const vis = c.visitas[idx];
    if (!vis) return;
    const oldHoraIni = vis.horaIni || '09:00';
    const oldHoraFin = vis.horaFin || null;
    const gcalEventId = typeof vis === 'object' ? vis.gcalEventId : '';
    
    vis.fecha = nuevaFecha;
    if (nuevaHora) vis.horaIni = nuevaHora;

    if (gcalEventId && gToken) {
      try {
        const horaIni = nuevaHora || oldHoraIni;
        const [h, m] = horaIni.split(':').map(Number);
        const horaFin = oldHoraFin || `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const startDT = `${nuevaFecha}T${horaIni}:00`;
        const endDT = `${nuevaFecha}T${horaFin.length === 5 ? horaFin + ':00' : horaFin}`;
        await gFetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              start: { dateTime: startDT, timeZone: 'Europe/Madrid' },
              end: { dateTime: endDT, timeZone: 'Europe/Madrid' }
            })
          }
        );
        mostrarToast('📅 Visita actualizada en Google Calendar', 'ok');
      } catch (e) {
        mostrarToast('⚠️ No se pudo actualizar Google Calendar', 'warn');
      }
    }
  } else if (tipo === 'recordatorio') {
    const recs = (c.recordatorios || []).filter(r => !r.done).slice().reverse();
    const recTarget = recs[idx];
    if (!recTarget) return;
    const realIdx = c.recordatorios.indexOf(recTarget);
    if (realIdx < 0) return;
    const rec = c.recordatorios[realIdx];
    const gtaskId = rec.gtaskId;
    
    rec.fecha = nuevaFecha;

    if (gtaskId && gToken) {
      try {
        await gFetch(
          `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${gtaskId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ due: new Date(nuevaFecha + 'T00:00:00').toISOString() })
          }
        );
        mostrarToast('☑️ Recordatorio actualizado en Google Tasks', 'ok');
      } catch (e) {
        mostrarToast('⚠️ No se pudo actualizar Google Tasks', 'warn');
      }
    }
  }

  save();
  renderPerfil();
  renderAlertas();
  cerrarModal('modal-replan');
}

function abrirReplanVisita(idx) {
  var c = db.find(function(x){ return x.id === activeId; });
  if (!c || !c.visitas || !c.visitas[idx]) return;
  var vis = c.visitas[idx];
  document.getElementById('replan-fecha').value = vis.fecha || '';
  document.getElementById('replan-hora').value = vis.horaIni || '';
  document.getElementById('replan-idx').value = idx;
  document.getElementById('replan-tipo').value = 'visita';
  document.getElementById('modal-replan').style.display = 'flex';
}

async function guardarReplanVisita() {
  var nuevaFecha = document.getElementById('replan-fecha').value;
  var nuevaHora  = document.getElementById('replan-hora').value;
  var idx = parseInt(document.getElementById('replan-idx').value);
  var c = db.find(function(x){ return x.id === activeId; });
  if (!c || !c.visitas[idx]) return;
  if (!nuevaFecha) { mostrarToast('Indica una fecha', 'warn'); return; }
  var vis = c.visitas[idx];
  var gcalEventId = (typeof vis === 'object') ? vis.gcalEventId : '';
  vis.fecha = nuevaFecha;
  if (nuevaHora) vis.horaIni = nuevaHora;
  if (gcalEventId && gToken) {
    try {
      var hi = (nuevaHora || vis.horaIni || '09:00').replace(/^(\d{2}:\d{2})$/, '$1:00');
      var hiH = parseInt(hi.split(':')[0]);
      var hiM = hi.split(':')[1] || '00';
      var hf = vis.horaFin
        ? vis.horaFin.replace(/^(\d{2}:\d{2})$/, '$1:00')
        : (String(hiH < 23 ? hiH + 1 : 23).padStart(2,'0') + ':' + hiM + ':00');
      await gFetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + gcalEventId,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: { dateTime: nuevaFecha + 'T' + hi, timeZone: 'Europe/Madrid' },
            end:   { dateTime: nuevaFecha + 'T' + hf, timeZone: 'Europe/Madrid' }
          })
        }
      );
      mostrarToast('📅 Visita actualizada en Google Calendar', 'ok');
    } catch(e) {
      mostrarToast('⚠️ No se pudo actualizar Google Calendar', 'warn');
    }
  }
  save();
  renderPerfil();
  cerrarModal('modal-replan');
}

// ─── MÓDULO PRESUPUESTOS SOLICITADOS ──────────────────────────────────────









// ─── FIN MÓDULO PRESUPUESTOS ───────────────────────────────────────────────

// ─── MÓDULO HISTORIAL DE ACCIONES ──────────────────────────────────────────





// ─── FIN MÓDULO HISTORIAL DE ACCIONES ──────────────────────────────────────

/* ═══════════════════════════════════════════════════════════════════
   MÓDULO PEDIDOS (genérico): cantidad × precio unitario + extras
   ═══════════════════════════════════════════════════════════════════ */
function calcularImportePedido() {
  const cant = parseFloat(document.getElementById("ped-cantidad").value) || 0,
    precio = parseFloat(document.getElementById("ped-precio").value) || 0,
    extras = parseFloat(document.getElementById("ped-extras").value) || 0,
    label = document.getElementById("ped-formula-label"),
    out = document.getElementById("ped-importe");
  if (cant > 0 && precio > 0) {
    const total = cant * precio + extras;
    out.value = total.toFixed(2);
    if (label)
      label.textContent =
        cant.toLocaleString("es-ES") +
        " × " +
        precio.toFixed(2) +
        (extras
          ? (extras > 0 ? " + " : " − ") + Math.abs(extras).toFixed(2) + " " + CRM_CONFIG.presupuesto.moneda
          : "");
  } else {
    out.value = "";
    if (label) label.textContent = "";
  }
}
function guardarPedido() {
  let id = document.getElementById("ped-id").value.trim();
  const fhP = fechaHoraAhora();
  if (!id) {
    const yr = new Date().getFullYear();
    let n = 0;
    db.forEach((x) => (x.pedidos || []).forEach((p) => { if (String(p.id).indexOf("PED-" + yr + "-") === 0) n++; }));
    id = "PED-" + yr + "-" + String(n + 1).padStart(4, "0");
  }
  const c = db.find((x) => x.id === activeId);
  if (!c) return;
  c.pedidos.push({
    id: id,
    fechaRegistro: fhP.fecha,
    horaRegistro: fhP.hora,
    tsRegistro: fhP.ts,
    empresa: document.getElementById("ped-empresa").value.trim() || c.nombre || "",
    cif: document.getElementById("ped-cif").value.trim() || c.cif || "",
    ref: document.getElementById("ped-ref").value.trim(),
    cantidad: document.getElementById("ped-cantidad").value.trim(),
    precio: document.getElementById("ped-precio").value.trim(),
    extras: parseFloat(document.getElementById("ped-extras").value) || 0,
    fecha: document.getElementById("ped-fecha").value,
    fechaEntrega: document.getElementById("ped-entrega").value,
    importe: document.getElementById("ped-importe").value,
    estado: document.getElementById("ped-estado").value,
    notas: document.getElementById("ped-notas").value.trim(),
  });
  c.etiqueta = "Recurrente";
  save();
  cerrarModal("modal-pedido");
  renderPerfil();
  cargarLista();
}
function abrirModalPedido() {
  ["ped-id", "ped-ref", "ped-cantidad", "ped-precio", "ped-importe", "ped-notas", "ped-empresa", "ped-cif", "ped-extras"].forEach(
    (id) => (document.getElementById(id).value = ""),
  );
  const _cl = db.find((x) => x.id === activeId);
  if (_cl) {
    document.getElementById("ped-empresa").value = _cl.nombre || "";
    document.getElementById("ped-cif").value = _cl.cif || "";
  }
  document.getElementById("ped-formula-label").innerHTML = "";
  document.getElementById("ped-fecha").value = new Date().toISOString().slice(0, 10);
  document.getElementById("ped-entrega").value = "";
  document.getElementById("ped-estado").value = "Pendiente";
  document.getElementById("ped-modal-title").textContent = "📦 Nuevo Pedido";
  abrirModal("modal-pedido");
}
function repetirPedido(pedId) {
  const c = db.find((x) => x.id === activeId);
  if (!c) return;
  const orig = c.pedidos.find((x) => x.id === pedId);
  if (!orig) return;
  c.pedidos.push({
    id: orig.id,
    ref: orig.ref || "",
    cantidad: orig.cantidad || "",
    precio: orig.precio || "",
    extras: orig.extras || 0,
    fecha: new Date().toISOString().slice(0, 10),
    fechaEntrega: orig.fechaEntrega || "",
    importe: orig.importe || "",
    estado: "Pendiente",
    fechaRegistro: new Date().toLocaleDateString("es-ES"),
  });
  save();
  renderPerfil();
  setTimeout(() => {
    const rows = document.querySelectorAll("tbody tr");
    if (rows.length) {
      rows[0].style.background = "rgba(52,199,89,0.14)";
      setTimeout(() => (rows[0].style.background = ""), 1800);
    }
  }, 100);
}

/* ═══════════════════════════════════════════════════════════════════
   MÓDULO HISTORIAL DE ACCIONES (local, dentro de cada ficha de cliente)
   ═══════════════════════════════════════════════════════════════════ */
function registrarAccion(clienteId, tipoAccion, detalles) {
  if (!clienteId) return;
  const c = db.find((x) => x.id === clienteId);
  if (!c) return;
  c.historial = c.historial || [];
  c.historial.unshift({
    tipo_accion: tipoAccion,
    detalles: detalles || null,
    fecha: new Date().toISOString(),
  });
  if (c.historial.length > 200) c.historial.length = 200;
  save();
}
function cargarHistorialAcciones(clienteId) {
  const cont = document.getElementById("historial-acciones-cont");
  if (!cont) return;
  const c = db.find((x) => x.id === clienteId);
  const acciones = (c && c.historial) || [];
  if (!acciones.length) {
    cont.innerHTML = '<p style="color:var(--text3);font-size:12px;">Sin historial de acciones.</p>';
    return;
  }
  cont.innerHTML =
    '<div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">📋 Historial de Acciones</div>' +
    acciones
      .map(function (a) {
        const f = new Date(a.fecha);
        return (
          '<div style="border-left:3px solid var(--accent);padding:6px 10px;margin-bottom:6px;background:var(--surface2);font-size:11px;">' +
          '<div style="font-weight:600;color:var(--text);">' + escHtml(a.tipo_accion) + "</div>" +
          '<div style="color:var(--text3);font-size:10px;">' +
          f.toLocaleDateString("es-ES") + " · " +
          f.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) + "</div>" +
          (a.detalles ? '<div style="color:var(--text3);font-size:10px;margin-top:2px;">' + escHtml(a.detalles) + "</div>" : "") +
          "</div>"
        );
      })
      .join("");
}

/* ═══════════════════════════════════════════════════════════════════
   MÓDULO PRESUPUESTOS (genérico): líneas libres + IVA + PDF imprimible
   ═══════════════════════════════════════════════════════════════════ */
var _presLineas = [];
function presMoney(n) {
  return (
    Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " " + CRM_CONFIG.presupuesto.moneda
  );
}
function presNumeroAuto() {
  const year = new Date().getFullYear();
  let n = 0;
  db.forEach((c) =>
    (c.presupuestos || []).forEach((p) => {
      if (p.ref && String(p.ref).indexOf("-" + year + "-") > -1) n++;
    }),
  );
  return CRM_CONFIG.presupuesto.prefijo + "-" + year + "-" + String(n + 1).padStart(4, "0");
}
function abrirModalPresupuesto() {
  const c = db.find((x) => x.id === activeId) || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  const hoy = new Date();
  const validez = new Date(hoy.getTime() + CRM_CONFIG.presupuesto.validezDias * 864e5);
  set("pres-empresa", c.nombre || "");
  set("pres-num-ref", "");
  set("pres-cif", c.cif || "");
  set("pres-contacto", c.contacto || "");
  set("pres-direccion", [c.direccion, c.cp, c.municipio].filter(Boolean).join(", "));
  set("pres-fecha", hoy.toISOString().slice(0, 10));
  set("pres-validez", validez.toISOString().slice(0, 10));
  set("pres-asunto", "");
  set("pres-iva", CRM_CONFIG.presupuesto.ivaPorDefecto);
  set("pres-condiciones", CRM_CONFIG.presupuesto.condiciones.join("\n"));
  set("pres-notas", "");
  _presLineas = [{ desc: "", cant: 1, precio: "", dto: 0 }];
  presRender();
  abrirModal("modal-presupuesto");
}
function presRender() {
  const body = document.getElementById("pres-lineas-body");
  if (!body) return;
  body.innerHTML = _presLineas
    .map(
      (l, i) =>
        '<tr><td><textarea class="form-input" rows="1" placeholder="Descripción del concepto" oninput="presSet(' + i + ",'desc',this.value)\" style=\"resize:vertical;min-width:120px;width:100%;\">" + escHtml(l.desc) + "</textarea></td>" +
        '<td><input class="form-input" type="number" min="0" step="any" value="' + escHtml(l.cant) + '" oninput="presSet(' + i + ",'cant',this.value)\" style=\"width:56px;\"></td>" +
        '<td><input class="form-input" type="number" min="0" step="any" value="' + escHtml(l.precio) + '" placeholder="0.00" oninput="presSet(' + i + ",'precio',this.value)\" style=\"width:76px;\"></td>" +
        '<td><input class="form-input" type="number" min="0" max="100" step="any" value="' + escHtml(l.dto) + '" oninput="presSet(' + i + ",'dto',this.value)\" style=\"width:52px;\"></td>" +
        '<td style="text-align:right;white-space:nowrap;font-weight:600;" id="pres-imp-' + i + '"></td>' +
        '<td><button type="button" onclick="presDel(' + i + ')" style="border:none;background:none;color:#ef4444;cursor:pointer;font-size:16px;" title="Quitar línea">✕</button></td></tr>',
    )
    .join("");
  presCalc();
}
function presSet(i, campo, valor) {
  if (_presLineas[i]) _presLineas[i][campo] = valor;
  presCalc();
}
function presAdd() {
  _presLineas.push({ desc: "", cant: 1, precio: "", dto: 0 });
  presRender();
}
function presDel(i) {
  _presLineas.splice(i, 1);
  if (!_presLineas.length) _presLineas.push({ desc: "", cant: 1, precio: "", dto: 0 });
  presRender();
}
function presTotales(lineas, ivaPct) {
  let subtotal = 0;
  const imps = lineas.map((l) => {
    const imp =
      (parseFloat(l.cant) || 0) * (parseFloat(l.precio) || 0) * (1 - (parseFloat(l.dto) || 0) / 100);
    subtotal += imp;
    return imp;
  });
  const iva = subtotal * ((parseFloat(ivaPct) || 0) / 100);
  return { imps: imps, subtotal: subtotal, iva: iva, total: subtotal + iva };
}
function presCalc() {
  const ivaEl = document.getElementById("pres-iva");
  const t = presTotales(_presLineas, ivaEl ? ivaEl.value : 0);
  t.imps.forEach((imp, i) => {
    const el = document.getElementById("pres-imp-" + i);
    if (el) el.textContent = presMoney(imp);
  });
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("pres-subtotal", presMoney(t.subtotal));
  set("pres-iva-imp", presMoney(t.iva));
  set("pres-total", presMoney(t.total));
}
function presBuildHtml(d) {
  const e = EMP,
    P = CRM_CONFIG.presupuesto,
    x = escHtml,
    t = presTotales(d.lineas, d.ivaPct);
  const filas = d.lineas
    .filter((l) => (l.desc || "").trim() || parseFloat(l.precio))
    .map(
      (l, i) =>
        "<tr><td>" + x(l.desc).replace(/\n/g, "<br>") + '</td><td class="n">' + x(l.cant) + '</td><td class="n">' +
        presMoney(parseFloat(l.precio) || 0) + '</td><td class="n">' + (parseFloat(l.dto) ? x(l.dto) + " %" : "—") +
        '</td><td class="n"><b>' + presMoney((parseFloat(l.cant) || 0) * (parseFloat(l.precio) || 0) * (1 - (parseFloat(l.dto) || 0) / 100)) + "</b></td></tr>",
    )
    .join("");
  const conds = (d.condiciones || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => "<li>" + x(s) + "</li>")
    .join("");
  const fmtF = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" }) : "—");
  return (
    '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Presupuesto ' + x(d.ref) + "</title><style>" +
    "*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10.5pt;color:#111827;padding:16mm 18mm;line-height:1.45}" +
    "@page{size:A4;margin:8mm 10mm}@media print{body{padding:0}.no-print{display:none!important}}" +
    ".hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:10px;border-bottom:3px solid #6D28D9;margin-bottom:14px}" +
    ".hdr img{max-height:20mm;max-width:60mm;object-fit:contain}.bn{font-size:17pt;font-weight:800;color:#4C1D95}.bsub{font-size:8.5pt;color:#6b7280;margin-top:3px}" +
    ".doc{text-align:right}.dt{font-size:20pt;font-weight:800;color:#6D28D9;letter-spacing:1px}.dn{font-weight:700}.dd{font-size:9pt;color:#6b7280}" +
    ".cli{background:#f3f4f6;border-radius:6px;padding:9px 12px;margin-bottom:12px;font-size:10pt}.lbl{font-size:8pt;text-transform:uppercase;letter-spacing:1px;color:#6b7280}" +
    ".asunto{font-weight:700;font-size:12pt;margin:6px 0 8px}.intro{margin-bottom:8px}" +
    "table{width:100%;border-collapse:collapse}table.lin th{background:#4C1D95;color:#fff;text-align:left;padding:6px 8px;font-size:9pt}table.lin td{padding:7px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}" +
    ".n{text-align:right;white-space:nowrap}table.lin th.n{text-align:right}" +
    "table.tot{width:60mm;margin:10px 0 0 auto}table.tot td{padding:4px 8px;font-size:10pt}table.tot tr.gt td{border-top:2px solid #4C1D95;font-weight:800;font-size:12pt;color:#4C1D95}" +
    "h4{font-size:9pt;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin:14px 0 4px}ul.c{padding-left:6mm}ul.c li{margin-bottom:2px}" +
    ".legal{font-size:8.5pt;color:#4b5563;margin-top:10px;white-space:pre-line}.accept{margin-top:8px;font-style:italic}" +
    ".sign{display:grid;grid-template-columns:1fr 1fr;gap:16mm;margin-top:16mm}.sign div{border-top:1px solid #6b7280;padding-top:4px;font-size:9pt;color:#4b5563}" +
    ".foot{margin-top:12mm;border-top:1px solid #d1d5db;padding-top:4px;font-size:7.5pt;color:#6b7280;text-align:center}" +
    "</style></head><body>" +
    '<div class="hdr"><div>' +
    (e.logoUrl ? '<img src="' + x(e.logoUrl) + '" alt="">' : '<div class="bn">' + x(e.nombre) + "</div>") +
    '<div class="bsub">' + x(e.razonSocial) + " · CIF " + x(e.cif) + "<br>" + x(e.direccion) + ", " + x(e.ciudad) + "<br>" +
    x(e.telefono) + " · " + x(e.email) + (e.web ? " · " + x(e.web) : "") + "</div></div>" +
    '<div class="doc"><div class="dt">PRESUPUESTO</div><div class="dn">Nº ' + x(d.ref) + '</div><div class="dd">Fecha: ' + fmtF(d.fecha) +
    '</div><div class="dd">Válido hasta: ' + fmtF(d.validez) + "</div></div></div>" +
    '<div class="cli"><div class="lbl">Cliente</div><b>' + x(d.empresa) + "</b>" +
    (d.cif ? " · CIF " + x(d.cif) : "") + (d.contacto ? "<br>Att.: " + x(d.contacto) : "") + (d.direccion ? "<br>" + x(d.direccion) : "") + "</div>" +
    (d.asunto ? '<div class="asunto">' + x(d.asunto) + "</div>" : "") +
    '<p class="intro">' + x(P.textoIntroduccion) + "</p>" +
    '<table class="lin"><thead><tr><th>Descripción</th><th class="n">Cant.</th><th class="n">Precio ud.</th><th class="n">Dto.</th><th class="n">Importe</th></tr></thead><tbody>' +
    filas + "</tbody></table>" +
    '<table class="tot"><tr><td>Base imponible</td><td class="n">' + presMoney(t.subtotal) + "</td></tr><tr><td>IVA (" + x(d.ivaPct) +
    ' %)</td><td class="n">' + presMoney(t.iva) + '</td></tr><tr class="gt"><td>TOTAL</td><td class="n">' + presMoney(t.total) + "</td></tr></table>" +
    (conds ? "<h4>Condiciones</h4><ul class=\"c\">" + conds + "</ul>" : "") +
    (d.notas ? "<h4>Notas</h4><p>" + x(d.notas).replace(/\n/g, "<br>") + "</p>" : "") +
    (P.textoLegal ? '<div class="legal">' + x(P.textoLegal) + "</div>" : "") +
    '<div class="accept">' + x(P.textoAceptacion) + "</div>" +
    '<div class="sign"><div>Por ' + x(e.nombre) + "<br><b>" + x(e.responsable) + "</b> · " + x(e.cargo) +
    "</div><div>Conforme cliente (firma y sello)<br>&nbsp;</div></div>" +
    (e.pieLegal ? '<div class="foot">' + x(e.pieLegal) + "</div>" : "") +
    '<div class="no-print" style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:8px 22px;background:#6D28D9;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">Imprimir / Guardar PDF</button></div>' +
    "</body></html>"
  );
}
function presAbrirDocumento(d) {
  const url = URL.createObjectURL(new Blob([presBuildHtml(d)], { type: "text/html" }));
  const win = window.open(url, "_blank", "width=900,height=900");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return win;
}
function generarPDFPresupuesto() {
  const v = (id) => ((document.getElementById(id) || {}).value || "").trim();
  const empresa = v("pres-empresa");
  if (!empresa) return void alert("El nombre del cliente es obligatorio");
  const lineas = _presLineas.filter((l) => (l.desc || "").trim() || parseFloat(l.precio));
  if (!lineas.length) return void alert("Añade al menos una línea con descripción o precio");
  const ivaPct = parseFloat(v("pres-iva")) || 0;
  const t = presTotales(lineas, ivaPct);
  const d = {
    ref: v("pres-num-ref") || presNumeroAuto(),
    fecha: v("pres-fecha") || new Date().toISOString().slice(0, 10),
    validez: v("pres-validez"),
    empresa: empresa,
    cif: v("pres-cif"),
    contacto: v("pres-contacto"),
    direccion: v("pres-direccion"),
    asunto: v("pres-asunto"),
    lineas: lineas.map((l) => ({ desc: l.desc, cant: l.cant, precio: l.precio, dto: l.dto })),
    ivaPct: ivaPct,
    condiciones: v("pres-condiciones"),
    notas: v("pres-notas"),
  };
  const win = presAbrirDocumento(d);
  cerrarModal("modal-presupuesto");
  const cl = activeId && db.find((x) => x.id === activeId);
  if (cl) {
    cl.presupuestos = cl.presupuestos || [];
    cl.presupuestos.push(
      Object.assign({}, d, {
        hora: fechaHoraAhora().hora,
        subtotal: t.subtotal.toFixed(2),
        total: t.total.toFixed(2),
        importe: t.total.toFixed(2),
        modelo: d.asunto || (d.lineas[0] && d.lineas[0].desc) || "",
      }),
    );
    if (!cl.pipeline || ["prospecto", "pendiente-datos"].includes(cl.pipeline)) cl.pipeline = "presupuestado";
    save();
    cargarLista();
    renderPerfil();
    registrarAccion(cl.id, "Presupuesto generado", d.ref + " · " + presMoney(t.total));
  }
  win ? mostrarToast("Presupuesto guardado en histórico ✓", "ok") : mostrarToast("Activa los pop-ups para ver el PDF", "err");
}
function reimprimirPresupuesto(i) {
  const cl = db.find((x) => x.id === activeId);
  const p = cl && cl.presupuestos && cl.presupuestos[i];
  if (!p || !p.lineas) return void mostrarToast("Este presupuesto no tiene líneas guardadas", "warn");
  presAbrirDocumento(p) || mostrarToast("Activa los pop-ups para ver el PDF", "err");
}

/* ═══════════════════════════════════════════════════════════════════
   INTEGRACIÓN CON LA WEB CONTENEDORA (sin login propio)
   ═══════════════════════════════════════════════════════════════════
   Opción 1 — JS directo (misma página o iframe same-origin):
       CRM_API.getData()            → array de clientes
       CRM_API.setData(array)       → carga datos y refresca la interfaz
       CRM_API.onSave = (db, ts) => { ...persistir en tu backend... }
   Opción 2 — iframe de otro origen: poner CRM_CONFIG.hostOrigin = "https://tu-web.com"
       padre → CRM:  iframe.contentWindow.postMessage({type:"crm:setData", data:[...]}, origen)
       CRM → padre:  mensaje {type:"crm:save", data:[...]} en cada guardado
   ═══════════════════════════════════════════════════════════════════ */
var CRM_API = (window.CRM_API = {
  version: "1.0",
  getData: function () { return db; },
  getConfig: function () { return CRM_CONFIG; },
  setData: function (arr) {
    db = Array.isArray(arr) ? arr : [];
    db.forEach((c) => {
      c.notas = c.notas || [];
      c.llamadas = c.llamadas || [];
      c.visitas = c.visitas || [];
      c.pedidos = c.pedidos || [];
      c.recordatorios = c.recordatorios || [];
    });
    if (!db.find((c) => c.id === activeId)) activeId = db.length ? db[0].id : null;
    try { CRM_STORE.setItem("ncrm_crm", JSON.stringify(db)); } catch (e) {}
    actualizarProvincias();
    cargarLista();
    renderPerfil();
    renderAlertas();
    renderPanelHoy();
  },
  onSave: null,
});
window.addEventListener("message", function (e) {
  if (!CRM_CONFIG.hostOrigin || e.origin !== CRM_CONFIG.hostOrigin) return;
  if (e.data && e.data.type === "crm:setData") CRM_API.setData(e.data.data);
});
function _crmNotificarHost(data, ts) {
  try { if (typeof CRM_API.onSave === "function") CRM_API.onSave(data, ts); } catch (e) { console.warn("CRM_API.onSave:", e); }
  try {
    if (CRM_CONFIG.hostOrigin && window.parent !== window)
      window.parent.postMessage({ type: "crm:save", data: data, ts: ts }, CRM_CONFIG.hostOrigin);
  } catch (e) {}
}

/* ── Marca: nombre / logo en la cabecera y título de la pestaña ── */
(function () {
  document.title = EMP.nombre + " · CRM";
  const b = document.getElementById("brand-box");
  if (b)
    b.innerHTML = logoCandy(40);
})();
