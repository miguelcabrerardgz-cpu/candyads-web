// Preventa: cola de llamadas para la persona que hace la primera llamada a los prospectos.
//
// Vive dentro del CRM (mismo iframe aislado, mismos datos): cada empresa guarda su estado de preventa en
// c.preventa = { estado, intentos, ultima, proxima, resultados: [{ts, resultado, nota, operador}] } y cada
// llamada se apunta además en c.llamadas y en el historial de acciones, así el comercial la ve en la ficha.
// "Volver a llamar", "Interesado" y "Cita" crean un recordatorio, que sale en el aviso de pendientes.
//
// Todo el contenido se pinta con textContent (nada de innerHTML con datos). Esta vista no muestra importes,
// pero NO es una barrera de permisos: desde "Ver ficha" se llega a la ficha completa (ver CLAUDE.md, roles).
(function () {
  "use strict";

  var RESULTADOS = {
    no_contesta:   { txt: "No contesta",     ico: "📵", color: "#64748b" },
    volver:        { txt: "Volver a llamar", ico: "🔁", color: "#d97706", fecha: true },
    interesado:    { txt: "Interesado",      ico: "👍", color: "#16a34a" },
    cita:          { txt: "Cita",            ico: "📅", color: "#7C3AED", fecha: true },
    no_interesado: { txt: "No interesado",   ico: "✋", color: "#dc2626" },
    erroneo:       { txt: "Dato erróneo",    ico: "⚠️", color: "#9333ea" }
  };
  // Estados de la cola. "pendiente" = nunca llamada.
  var ESTADOS = {
    pendiente:     "Sin llamar",
    no_contesta:   "No contesta",
    volver:        "Volver a llamar",
    interesado:    "Interesado",
    cita:          "Cita",
    no_interesado: "No interesado",
    erroneo:       "Dato erróneo",
    sin_respuesta: "Sin respuesta (agotado)"
  };
  var EN_COLA = { pendiente: 1, no_contesta: 1, volver: 1 };
  var MAX_INTENTOS = 5;     // tras 5 "no contesta" sale de la cola
  var POR_PAGINA = 40;

  var filtro = { texto: "", sector: "", municipio: "", estado: "cola" };
  var mostrar = POR_PAGINA;
  var operador = "";        // solo en memoria: quién está llamando en esta sesión

  function hoyISO(dias) {
    var d = new Date();
    if (dias) d.setDate(d.getDate() + dias);
    // siguiente día laborable si cae en fin de semana
    if (dias) while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  function soloDigitos(t) { return String(t || "").replace(/[^\d+]/g, ""); }
  function fechaCorta(iso) {
    if (!iso) return "";
    var p = iso.slice(0, 10).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] : iso;
  }
  function h(tag, attrs, hijos) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "style") e.style.cssText = attrs[k];
      else if (k.slice(0, 2) === "on") e[k] = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (hijos || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  // Empresas que entran en Preventa: prospectos (aún no clientes) o cualquiera que ya tenga estado de preventa.
  function candidatas() {
    return db.filter(function (c) {
      return c.preventa || !c.pipeline || c.pipeline === "prospecto" || c.pipeline === "pendiente-datos";
    });
  }
  function estadoDe(c) { return (c.preventa && c.preventa.estado) || "pendiente"; }

  // Orden de la cola: 1) volver a llamar vencido, 2) sin llamar, 3) no contesta (menos intentos y más antiguo
  // primero), 4) volver a llamar futuro. Fuera de la cola, por fecha de última llamada.
  function prioridad(c) {
    var e = estadoDe(c), p = c.preventa || {}, hoy = hoyISO();
    if (e === "volver") return p.proxima && p.proxima > hoy ? 3 : 0;
    if (e === "pendiente") return 1;
    if (e === "no_contesta") return 2;
    return 4;
  }
  function ordenar(a, b) {
    var pa = prioridad(a), pb = prioridad(b);
    if (pa !== pb) return pa - pb;
    var A = a.preventa || {}, B = b.preventa || {};
    if (pa === 0 || pa === 3) return (A.proxima || "") < (B.proxima || "") ? -1 : 1;
    if (pa === 2 && (A.intentos || 0) !== (B.intentos || 0)) return (A.intentos || 0) - (B.intentos || 0);
    if (pa === 2) return (A.ultima || "") < (B.ultima || "") ? -1 : 1;
    if (pa === 4) return (A.ultima || "") > (B.ultima || "") ? -1 : 1;
    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
  }

  function filtradas() {
    var t = norm(filtro.texto);
    return candidatas().filter(function (c) {
      var e = estadoDe(c);
      if (filtro.estado === "cola" && !EN_COLA[e]) return false;
      if (filtro.estado === "hoy" && !(e === "volver" && (c.preventa.proxima || "") <= hoyISO())) return false;
      if (filtro.estado && filtro.estado !== "cola" && filtro.estado !== "hoy" && filtro.estado !== "todas" && e !== filtro.estado) return false;
      if (filtro.sector && c.sector !== filtro.sector) return false;
      if (filtro.municipio && c.municipio !== filtro.municipio) return false;
      if (t && norm([c.nombre, c.contacto, c.telefono, c.telefonoFijo, c.municipio].join(" ")).indexOf(t) < 0) return false;
      return true;
    }).sort(ordenar);
  }

  // ── Registrar un resultado ──────────────────────────────────────────────────────────────────────────
  function registrar(id, resultado, fecha, nota) {
    var c = db.find(function (x) { return x.id === id; });
    var R = RESULTADOS[resultado];
    if (!c || !R) return;
    if (R.fecha && !fecha) { mostrarToast("Elige la fecha para «" + R.txt + "».", "err"); return; }
    if (R.fecha && fecha < hoyISO()) { mostrarToast("La fecha no puede ser anterior a hoy.", "err"); return; }
    nota = String(nota || "").trim();
    var fh = fechaHoraAhora();
    var p = c.preventa = c.preventa || { estado: "pendiente", intentos: 0, resultados: [] };
    p.resultados = p.resultados || [];
    p.intentos = (p.intentos || 0) + 1;
    p.ultima = fh.ts;
    p.proxima = R.fecha ? fecha : "";
    p.estado = resultado;
    if (resultado === "no_contesta") {
      var seguidos = 1;
      for (var i = p.resultados.length - 1; i >= 0 && p.resultados[i].resultado === "no_contesta"; i--) seguidos++;
      if (seguidos >= MAX_INTENTOS) p.estado = "sin_respuesta";
    }
    p.resultados.push({ ts: fh.ts, resultado: resultado, fecha: p.proxima, nota: nota, operador: operador });
    if (p.resultados.length > 50) p.resultados.splice(0, p.resultados.length - 50);

    var quien = operador ? " (" + operador + ")" : "";
    var texto = "[Preventa] " + R.txt + (p.proxima ? " → " + fechaCorta(p.proxima) : "") + (nota ? ": " + nota : "") + quien;
    c.llamadas = c.llamadas || [];
    c.llamadas.push({ texto: texto, fecha: fh.fecha, hora: fh.hora, tipo: "realizada", ts: fh.ts });

    var rec = null;
    if (resultado === "volver") rec = { fecha: fecha, texto: "Volver a llamar (preventa)" };
    if (resultado === "cita") rec = { fecha: fecha, texto: "Cita conseguida en preventa" };
    if (resultado === "interesado") rec = { fecha: hoyISO(1), texto: "Prospecto interesado: llamar comercial" };
    if (rec) {
      // Un solo recordatorio de preventa abierto por empresa: el nuevo cierra el anterior.
      c.recordatorios = c.recordatorios || [];
      c.recordatorios.forEach(function (r) { if (r.preventa && !r.done) r.done = true; });
      c.recordatorios.push({ fecha: rec.fecha, texto: rec.texto, notas: nota + quien, done: false, preventa: true,
        creadoEn: fh.ts, horaCreadoEn: fh.hora, fechaCreadoEn: fh.fecha });
    } else if (resultado !== "no_contesta") {
      (c.recordatorios || []).forEach(function (r) { if (r.preventa && !r.done) r.done = true; });
    }
    registrarAccion(c.id, "Preventa: " + R.txt, (nota || "") + quien || null); // llama a save()
    try { renderAlertas(); } catch (e) {}
    try { cargarLista(); } catch (e) {}
    mostrarToast(R.ico + " " + (c.nombre || "") + ": " + (ESTADOS[p.estado] || R.txt), "ok");
    pintar();
  }

  function deshacer(id) {
    var c = db.find(function (x) { return x.id === id; });
    var p = c && c.preventa;
    if (!p || !p.resultados || !p.resultados.length) return;
    var ult = p.resultados.pop();
    var ant = p.resultados[p.resultados.length - 1];
    p.intentos = Math.max(0, (p.intentos || 1) - 1);
    p.estado = ant ? (ant.resultado === "no_contesta" ? "no_contesta" : ant.resultado) : "pendiente";
    p.proxima = ant ? ant.fecha || "" : "";
    p.ultima = ant ? ant.ts : "";
    c.llamadas = (c.llamadas || []).filter(function (l) { return !(l && l.ts === ult.ts && /^\[Preventa\]/.test(l.texto || "")); });
    c.recordatorios = (c.recordatorios || []).filter(function (r) { return !(r.preventa && r.creadoEn === ult.ts); });
    registrarAccion(c.id, "Preventa: deshecho «" + ((RESULTADOS[ult.resultado] || {}).txt || ult.resultado) + "»", null);
    try { renderAlertas(); } catch (e) {}
    mostrarToast("Último resultado deshecho.", "ok");
    pintar();
  }

  // ── Pintado ─────────────────────────────────────────────────────────────────────────────────────────
  var raiz = null, cuerpo = null, resumen = null;

  function montar() {
    if (raiz) return;
    raiz = h("div", { class: "modal-bg", id: "modal-preventa" });
    var caja = h("div", { class: "modal-box wide", style: "width:min(1100px,98vw);max-width:98vw;max-height:95vh;height:95vh;overflow:hidden;display:flex;flex-direction:column;background:var(--bg);padding:0;" });
    var cab = h("div", { style: "display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--border);flex-shrink:0;" }, [
      h("div", { class: "modal-title", style: "margin:0;border:none;padding:0;", text: "📞 Preventa" }),
      resumen = h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;flex:1;" }),
      h("button", { class: "btn-cancel", style: "margin:0;", text: "⬇ Excel", title: "Descarga el estado de preventa de todas las empresas", onclick: exportar }),
      h("button", { class: "btn-cancel", style: "margin:0;", text: "✕ Cerrar", onclick: function () { cerrarModal("modal-preventa"); } })
    ]);

    var inp = "padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:13px;";
    var buscar = h("input", { type: "text", placeholder: "🔍 Buscar nombre, teléfono, contacto…", style: inp + "flex:2;min-width:180px;" });
    buscar.oninput = function () { filtro.texto = buscar.value; mostrar = POR_PAGINA; pintarLista(); };
    var selEstado = h("select", { style: inp, id: "pv-estado" });
    [["cola", "En cola (por llamar)"], ["hoy", "Volver a llamar hoy"], ["todas", "Todas"]].concat(
      Object.keys(ESTADOS).map(function (k) { return [k, ESTADOS[k]]; })
    ).forEach(function (o) { selEstado.appendChild(h("option", { value: o[0], text: o[1] })); });
    selEstado.onchange = function () { filtro.estado = selEstado.value; mostrar = POR_PAGINA; pintarLista(); };
    var selSector = h("select", { style: inp, id: "pv-sector" });
    selSector.onchange = function () { filtro.sector = selSector.value; mostrar = POR_PAGINA; pintarLista(); };
    var selMun = h("select", { style: inp, id: "pv-municipio" });
    selMun.onchange = function () { filtro.municipio = selMun.value; mostrar = POR_PAGINA; pintarLista(); };
    var op = h("input", { type: "text", placeholder: "Tu nombre (quién llama)", maxlength: "40", style: inp + "max-width:190px;", title: "Se anota en cada llamada para saber quién la hizo. No se guarda al cerrar." });
    op.oninput = function () { operador = neutralizar(op.value.trim()); };
    var barra = h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;padding:10px 20px;border-bottom:1px solid var(--border);flex-shrink:0;" },
      [buscar, selEstado, selSector, selMun, op]);

    cuerpo = h("div", { style: "flex:1;overflow-y:auto;padding:12px 20px 24px;display:flex;flex-direction:column;gap:10px;" });
    caja.appendChild(cab); caja.appendChild(barra); caja.appendChild(cuerpo);
    raiz.appendChild(caja);
    document.body.appendChild(raiz);
  }

  function rellenarSelect(id, valores, vacio, actual) {
    var s = document.getElementById(id);
    s.textContent = "";
    s.appendChild(h("option", { value: "", text: vacio }));
    valores.forEach(function (v) { s.appendChild(h("option", { value: v, text: v })); });
    s.value = valores.indexOf(actual) >= 0 ? actual : "";
  }

  function chip(txt, valor, color) {
    return h("span", { style: "background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:3px 10px;font-size:12px;color:var(--text2);" }, [
      txt + " ", h("b", { text: String(valor), style: "color:" + (color || "var(--text)") + ";" })
    ]);
  }

  function pintarResumen() {
    var todas = candidatas(), hoy = hoyISO(), n = { cola: 0, hoy: 0, llamadasHoy: 0, interesado: 0, cita: 0 };
    todas.forEach(function (c) {
      var e = estadoDe(c), p = c.preventa || {};
      if (EN_COLA[e]) n.cola++;
      if (e === "volver" && (p.proxima || "") <= hoy) n.hoy++;
      if (e === "interesado") n.interesado++;
      if (e === "cita") n.cita++;
      (p.resultados || []).forEach(function (r) { if ((r.ts || "").slice(0, 10) === new Date().toISOString().slice(0, 10)) n.llamadasHoy++; });
    });
    resumen.textContent = "";
    resumen.appendChild(chip("En cola", n.cola));
    resumen.appendChild(chip("Rellamar hoy", n.hoy, n.hoy ? "#d97706" : ""));
    resumen.appendChild(chip("Llamadas hoy", n.llamadasHoy));
    resumen.appendChild(chip("Interesados", n.interesado, "#16a34a"));
    resumen.appendChild(chip("Citas", n.cita, "#7C3AED"));
  }

  function telLink(t, ico) {
    var d = soloDigitos(t);
    if (!d) return null;
    return h("a", { href: "tel:" + d, text: ico + " " + t, style: "color:var(--accent);font-weight:600;text-decoration:none;font-size:14px;" });
  }

  function fila(c) {
    var e = estadoDe(c), p = c.preventa || {};
    var ult = p.resultados && p.resultados.length ? p.resultados[p.resultados.length - 1] : null;
    var vencido = e === "volver" && (p.proxima || "") <= hoyISO();

    var cab = h("div", { style: "display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;" }, [
      h("div", { style: "min-width:0;" }, [
        h("div", { text: c.nombre || "Sin nombre", style: "font-weight:700;font-size:15px;color:var(--text);" }),
        h("div", { text: [c.sector, c.municipio, c.contacto ? "👤 " + c.contacto : ""].filter(Boolean).join(" · "), style: "font-size:12px;color:var(--text3);margin-top:2px;" })
      ]),
      h("div", { style: "display:flex;gap:12px;flex-wrap:wrap;align-items:center;" }, [
        telLink(c.telefono, "📱"), telLink(c.telefonoFijo, "☎️"),
        (!c.telefono && !c.telefonoFijo) ? h("span", { text: "Sin teléfono", style: "font-size:12px;color:#dc2626;" }) : null
      ])
    ]);

    var estadoTxt = ESTADOS[e] + (p.intentos ? " · " + p.intentos + " intento" + (p.intentos > 1 ? "s" : "") : "") +
      (p.proxima ? " · " + fechaCorta(p.proxima) : "") + (ult && ult.nota ? " · «" + ult.nota + "»" : "") +
      (ult && ult.operador ? " · " + ult.operador : "");
    var est = h("div", { text: estadoTxt, style: "font-size:12px;margin-top:6px;color:" + (vencido ? "#d97706;font-weight:700" : "var(--text2)") + ";" });

    var inp = "padding:6px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text);font:inherit;font-size:12.5px;";
    var nota = h("input", { type: "text", placeholder: "Nota breve (opcional)", maxlength: "300", style: inp + "flex:1;min-width:160px;" });
    var fecha = h("input", { type: "date", value: hoyISO(2), min: hoyISO(), style: inp, title: "Fecha para «Volver a llamar» o «Cita»" });
    var botones = Object.keys(RESULTADOS).map(function (k) {
      var R = RESULTADOS[k];
      return h("button", {
        text: R.ico + " " + R.txt, title: R.fecha ? "Usa la fecha de la izquierda" : "",
        style: "padding:6px 10px;border-radius:7px;border:1px solid " + R.color + "55;background:" + R.color + "14;color:" + R.color + ";font-weight:600;font-size:12px;cursor:pointer;",
        onclick: function () { registrar(c.id, k, fecha.value, nota.value); }
      });
    });
    var acciones = h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center;" },
      [nota, fecha].concat(botones).concat([
        ult ? h("button", { text: "↶ Deshacer", title: "Quita el último resultado registrado", style: "padding:6px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);font-size:12px;cursor:pointer;", onclick: function () { deshacer(c.id); } }) : null,
        h("button", { text: "Ver ficha", style: "padding:6px 9px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);font-size:12px;cursor:pointer;", onclick: function () { cerrarModal("modal-preventa"); seleccionarCliente(c.id); } })
      ]));

    return h("div", { style: "background:var(--surface);border:1px solid " + (vencido ? "#d9770688" : "var(--border)") + ";border-radius:12px;padding:12px 14px;" },
      [cab, est, acciones]);
  }

  function pintarLista() {
    var lista = filtradas();
    cuerpo.textContent = "";
    if (!lista.length) {
      cuerpo.appendChild(h("p", { text: filtro.estado === "cola" ? "No queda nadie por llamar con estos filtros. 🎉" : "Ninguna empresa con estos filtros.", style: "color:var(--text3);font-size:13px;text-align:center;margin-top:30px;" }));
      return;
    }
    cuerpo.appendChild(h("div", { text: lista.length + " empresa" + (lista.length > 1 ? "s" : ""), style: "font-size:12px;color:var(--text3);" }));
    lista.slice(0, mostrar).forEach(function (c) { cuerpo.appendChild(fila(c)); });
    if (lista.length > mostrar) {
      cuerpo.appendChild(h("button", { text: "Mostrar " + Math.min(POR_PAGINA, lista.length - mostrar) + " más", class: "btn-cancel", style: "align-self:center;margin:6px 0;",
        onclick: function () { mostrar += POR_PAGINA; pintarLista(); } }));
    }
  }

  function pintar() {
    if (!raiz) return;
    var todas = candidatas();
    var sectores = Array.from(new Set(todas.map(function (c) { return c.sector; }).filter(Boolean))).sort();
    var muns = Array.from(new Set(todas.map(function (c) { return c.municipio; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, "es"); });
    rellenarSelect("pv-sector", sectores, "Todos los sectores", filtro.sector);
    rellenarSelect("pv-municipio", muns, "Todos los municipios", filtro.municipio);
    filtro.sector = document.getElementById("pv-sector").value;
    filtro.municipio = document.getElementById("pv-municipio").value;
    document.getElementById("pv-estado").value = filtro.estado;
    pintarResumen();
    var scroll = cuerpo.scrollTop;
    pintarLista();
    cuerpo.scrollTop = scroll;
  }

  function exportar() {
    if (typeof XLSX === "undefined") { mostrarToast("No se pudo cargar el exportador.", "err"); return; }
    var filas = candidatas().map(function (c) {
      var p = c.preventa || {}, ult = p.resultados && p.resultados.length ? p.resultados[p.resultados.length - 1] : {};
      return { Empresa: c.nombre || "", Sector: c.sector || "", Municipio: c.municipio || "", Contacto: c.contacto || "",
        Movil: c.telefono || "", Fijo: c.telefonoFijo || "", Estado: ESTADOS[estadoDe(c)], Intentos: p.intentos || 0,
        "Ultima llamada": p.ultima ? p.ultima.slice(0, 10) : "", "Proxima fecha": p.proxima || "",
        "Ultima nota": ult.nota || "", "Quien": ult.operador || "" };
    });
    var hoja = XLSX.utils.json_to_sheet(filas), libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Preventa");
    XLSX.writeFile(libro, "preventa_" + hoyISO() + ".xlsx");
  }

  window.abrirPreventa = function () {
    montar();
    mostrar = POR_PAGINA;
    pintar();
    abrirModal("modal-preventa");
  };
  // Para pruebas.
  window._preventa = { registrar: registrar, deshacer: deshacer, filtradas: filtradas, estadoDe: estadoDe };
})();
