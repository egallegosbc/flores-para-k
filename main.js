const canvas = document.getElementById('ramo');
const ctx = canvas.getContext('2d');

// Lienzo oculto a baja resolución: ahí se dibuja la escena y luego se convierte en letras
const buf = document.createElement('canvas');
const bctx = buf.getContext('2d', { willReadFrequently: true });

const CHARS = ':=+*x%#&@';         // de tenue a denso
const CANTIDAD = 16;               // número de lirios (abiertos + botones)
const MARGARITAS = 12;             // flores blancas pequeñas
const VELOCIDAD = 0.75;            // 1 = normal, menos = más lento

const PALETAS = {
  rosaFuerte: { fondo: '#a8285e', medio: '#ec5f9a', borde: '#f8b4cf' },
  rosaClaro:  { fondo: '#d4709a', medio: '#f6a9c6', borde: '#fde3ee' },
  blanco:     { fondo: '#e597b6', medio: '#f1e6ea', borde: '#ffffff' },
};
const VERDE = { tallo: '#4f9a4a', hoja: '#5fb357', luz: '#9ad88a' };
const POLEN = '#e9b26a';

let W, H, S, CW, CH, cols, rows, ruido, BASE;
let lirios = [], hojas = [], estrellas = [];
let inicio = performance.now();

// ---------- Semilla: el mismo número siempre da el mismo ramo ----------
let SEMILLA = 1;                   // cuando encuentres el ramo que te gusta, pon aquí su número
const MODO_BUSQUEDA = false;        // true: cada toque prueba otra semilla | false: ramo fijo
let semillaActual = SEMILLA;

// Generador de números "aleatorios" repetible (mulberry32)
function crearAleatorio(semilla) {
  let a = semilla >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let aleatorio = crearAleatorio(SEMILLA);

// "Te quiero" en otros idiomas: cada semilla muestra uno distinto
const IDIOMAS = [
  ['I love you', 'Inglés'],
  ["Je t'aime", 'Francés'],
  ['Ti amo', 'Italiano'],
  ['Eu te amo', 'Portugués'],
  ['Ich liebe dich', 'Alemán'],
  ['In yaabilmech', 'Maya yucateco'],
  ['Nimitztlazohtla', 'Náhuatl'],
  ['愛してる', 'Japonés'],
  ['사랑해', 'Coreano'],
  ['我爱你', 'Chino mandarín'],
  ["Σ' αγαπώ", 'Griego'],
  ['Я тебя люблю', 'Ruso'],
  ['أحبك', 'Árabe'],
  ['Seni seviyorum', 'Turco'],
  ['Ik hou van jou', 'Neerlandés'],
  ['Jag älskar dig', 'Sueco'],
  ["T'estimo", 'Catalán'],
  ['Kocham cię', 'Polaco'],
  ['Nakupenda', 'Suajili'],
  ['Mahal kita', 'Tagalo'],
  ['Aku cinta kamu', 'Indonesio'],
  ['Te amo', 'Latín'],
  ['Tá grá agam duit', 'Irlandés'],
  ['Jeg elsker dig', 'Danés'],
  ['Minä rakastan sinua', 'Finlandés'],
  ['Aloha au iā ʻoe', 'Hawaiano'],
];
const FUENTE = '"Cormorant Garamond", Georgia, serif';

const rand  = (a, b) => a + aleatorio() * (b - a);
const pick  = arr => arr[Math.floor(aleatorio() * arr.length)];
const clamp = v => Math.max(0, Math.min(1, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const suave = t => -(Math.cos(Math.PI * t) - 1) / 2;   // entra y sale muy suave
const fase  = (seg, t, dur) => suave(clamp((seg - t) / dur));

// Mezcla dos colores hex: t = 0 → a, t = 1 → b
function mezcla(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = s => Math.round(lerp((A >> s) & 255, (B >> s) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const VERDE_BOTON = '#7fbf6a';
const SOMBRA = '#2a0614';           // tono oscuro para contornos y pecas

function bezier(p0, p1, p2, p3, n = 60) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push({
      x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
      y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
    });
  }
  return pts;
}

// ---------- Armado del ramo ----------

function construirRamo() {
  aleatorio = crearAleatorio(semillaActual);   // reinicia la secuencia: mismo número, mismo ramo
  lirios = []; hojas = [];
  S = Math.min(W, H * 0.8) / 520;
  BASE = { x: W / 2, y: H * 0.88 };
  const centro = { x: W / 2, y: H * 0.42 };   // centro del óvalo de flores
  const RX = 160 * S, RY = 200 * S;
  const nombres = Object.keys(PALETAS);

  // 1) Repartir lirios en un óvalo
  for (let intento = 0; intento < 800 && lirios.length < CANTIDAD; intento++) {
    const a = rand(0, Math.PI * 2);
    const d = Math.sqrt(aleatorio());
    const pos = { x: centro.x + Math.cos(a) * d * RX, y: centro.y + Math.sin(a) * d * RY };
    const abre = aleatorio() < 0.7;                       // 70% abre, 30% se queda en botón
    const r = (abre ? rand(60, 90) : rand(30, 42)) * S;
    const choca = lirios.some(l =>
      Math.hypot(l.pos.x - pos.x, l.pos.y - pos.y) < (l.r + r) * (l.abre && abre ? 0.6 : 0.5));
    if (choca) continue;
    const manchas = Array.from({ length: 6 }, () =>
      Array.from({ length: 5 }, () => ({ u: rand(0.15, 0.5), v: rand(-0.35, 0.35) })));
    lirios.push({ tipo: 'lirio', pos, r, abre, manchas, pal: PALETAS[pick(nombres)], giro: rand(0, Math.PI * 2) });
  }

  // 1b) Margaritas blancas en los huecos
  let puestas = 0;
  for (let intento = 0; intento < 800 && puestas < MARGARITAS; intento++) {
    const a = rand(0, Math.PI * 2);
    const d = Math.sqrt(rand(0.15, 1));
    const pos = { x: centro.x + Math.cos(a) * d * RX * 1.15, y: centro.y + Math.sin(a) * d * RY * 1.05 };
    const r = rand(22, 32) * S;
    const choca = lirios.some(l => Math.hypot(l.pos.x - pos.x, l.pos.y - pos.y) <
      (l.r + r) * (l.tipo === 'margarita' ? 0.95 : 0.45));
    if (choca) continue;
    lirios.push({ tipo: 'margarita', pos, r, giro: rand(0, Math.PI * 2) });
    puestas++;
  }

  // 2) Tallos
  for (const l of lirios) {
    const k = (l.pos.x - BASE.x) / RX;
    const b = { x: BASE.x + k * 10 * S, y: BASE.y };
    l.t = Math.hypot(l.pos.x - centro.x, l.pos.y - centro.y) / RY * 1.2 + rand(0, 0.5);
    l.tallo = bezier(b, { x: b.x + k * 5 * S, y: b.y - 120 * S },
                        { x: l.pos.x - k * 20 * S, y: l.pos.y + 120 * S }, l.pos, 60);
    const q = l.tallo[l.tallo.length - 4];
    l.dir = Math.atan2(l.pos.y - q.y, l.pos.x - q.x);
  }

  // 3) Hojas: un manojo en la base y algunas en los tallos
  for (let i = 0; i < 12; i++) {
    const lado = i % 2 ? 1 : -1;
    hojas.push({
      p: { x: BASE.x + rand(-25, 25) * S, y: BASE.y - rand(0, 80) * S },
      ang: -Math.PI / 2 + lado * rand(0.25, 1.1),
      L: rand(70, 120) * S, w: rand(9, 14) * S, curva: lado * rand(0.1, 0.4),
      t: 0.6 + rand(0, 1.5),
    });
  }
  for (const l of lirios) {
    if (aleatorio() > 0.6) continue;
    const i = Math.floor(rand(0.45, 0.75) * l.tallo.length);
    const p = l.tallo[i], q = l.tallo[i + 1];
    const lado = aleatorio() < 0.5 ? -1 : 1;
    hojas.push({
      p, ang: Math.atan2(q.y - p.y, q.x - p.x) + lado * 0.6,
      L: rand(45, 70) * S, w: rand(6, 9) * S, curva: lado * 0.3, t: l.t + 1.2,
    });
  }

  // Los chicos atrás, los grandes al frente
  lirios.sort((a, b) => a.r - b.r);
}

// ---------- Dibujo (en el lienzo oculto) ----------

function dibujarTallo(l, seg) {
  const p = fase(seg, l.t, 2.4);
  if (p <= 0) return;
  const tramo = (l.tallo.length - 1) * p;
  const k = Math.floor(tramo);
  bctx.strokeStyle = VERDE.tallo;
  bctx.lineWidth = Math.max(CW * 0.9, 2.5 * S);
  bctx.beginPath();
  for (let i = 0; i <= k; i++) {
    const q = l.tallo[i];
    i === 0 ? bctx.moveTo(q.x, q.y) : bctx.lineTo(q.x, q.y);
  }
  if (k < l.tallo.length - 1) {                 // punta del tallo sin saltos
    const a = l.tallo[k], b = l.tallo[k + 1], f = tramo - k;
    bctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
  }
  bctx.stroke();
}

function dibujarHoja(h, seg) {
  const p = fase(seg, h.t, 1.4);
  if (p <= 0) return;
  const L = h.L * p, w = h.w * p, b = h.curva * L;
  bctx.save();
  bctx.translate(h.p.x, h.p.y);
  bctx.rotate(h.ang);
  bctx.beginPath();
  bctx.moveTo(0, 0);
  bctx.bezierCurveTo(L * 0.3, w, L * 0.7, w * 0.6 + b, L, b);
  bctx.bezierCurveTo(L * 0.7, -w * 0.6 + b, L * 0.3, -w, 0, 0);
  bctx.fillStyle = VERDE.hoja;
  bctx.fill();
  bctx.strokeStyle = VERDE.luz;
  bctx.lineWidth = CW * 0.5;
  bctx.beginPath();
  bctx.moveTo(0, 0);
  bctx.quadraticCurveTo(L * 0.6, b * 0.5, L, b);
  bctx.stroke();
  bctx.restore();
}

function dibujarMargarita(m, seg) {
  const crece = fase(seg, m.t + 2.2, 0.9);
  if (crece <= 0) return;
  const abre = fase(seg, m.t + 2.8, 2.2);
  const n = 14;
  bctx.save();
  bctx.translate(m.pos.x, m.pos.y);
  for (let i = 0; i < n; i++) {
    const p = clamp(abre * 1.4 - (i / n) * 0.4);   // los pétalos salen en cascada
    if (p <= 0) continue;
    const L = m.r * suave(p);
    const w = Math.max(m.r * 0.15, CW * 0.7);
    bctx.save();
    bctx.rotate(m.giro + i * 2 * Math.PI / n);
    bctx.beginPath();
    bctx.ellipse(L * 0.55, 0, L * 0.5, w * suave(p), 0, 0, Math.PI * 2);
    bctx.fillStyle = i % 2 ? '#ffffff' : '#f3eef0';
    bctx.fill();
    bctx.globalAlpha = 0.5;
    bctx.strokeStyle = '#d9c9cf';
    bctx.lineWidth = CW * 0.5;
    bctx.stroke();
    bctx.globalAlpha = 1;
    bctx.restore();
  }
  bctx.fillStyle = mezcla(VERDE_BOTON, '#e9b84a', abre);   // verde de botón → amarillo
  bctx.beginPath();
  bctx.arc(0, 0, m.r * 0.25 * crece, 0, Math.PI * 2);
  bctx.fill();
  bctx.fillStyle = mezcla(VERDE.tallo, '#c98b2e', abre);
  for (let i = 0; i < 10; i++) {                  // centro con textura
    const a = i * 2.4, rr = m.r * 0.16 * Math.sqrt(i / 10) * crece;
    bctx.beginPath();
    bctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, CW * 0.5, 0, Math.PI * 2);
    bctx.fill();
  }
  bctx.restore();
}

function dibujarLirio(l, seg) {
  if (l.tipo === 'margarita') return dibujarMargarita(l, seg);
  const crece = fase(seg, l.t + 2.0, 1.2);                  // el botón se forma e hincha
  if (crece <= 0) return;
  const color = l.abre ? fase(seg, l.t + 2.6, 1.4) : 0.45;  // de verde a su color

  const fondo = mezcla(VERDE_BOTON, l.pal.fondo, color);
  const medio = mezcla(VERDE_BOTON, l.pal.medio, color);
  const borde = mezcla(VERDE_BOTON, l.pal.borde, color);

  bctx.save();
  bctx.translate(l.pos.x, l.pos.y);

  // Primero los 3 pétalos de atrás (sépalos) y luego los 3 de enfrente, que abren un poco después
  const orden = [0, 2, 4, 1, 3, 5];
  for (const i of orden) {
    const retraso = i % 2 ? 0.45 : 0;
    const abre = l.abre ? fase(seg, l.t + 3.2 + retraso, 2.8) : 0;
    const largo = l.r * (l.abre ? lerp(0.5, 1, abre) : 1) * lerp(0.6, 1, crece) * (i % 2 ? 0.92 : 1);
    const ancho = largo * lerp(0.16, i % 2 ? 0.34 : 0.27, abre) * lerp(0.7, 1, crece);
    const curva = ancho * 0.5 * abre * (i % 3 ? 1 : -1);    // la punta se dobla hacia atrás

    const cerrado = l.dir + (i - 2.5) * 0.06;
    const abierto = l.giro + i * Math.PI / 3;
    let d = abierto - cerrado;
    d = Math.atan2(Math.sin(d), Math.cos(d));

    const g = bctx.createLinearGradient(0, 0, largo, 0);
    g.addColorStop(0, fondo);
    g.addColorStop(0.45, medio);
    g.addColorStop(1, borde);

    bctx.save();
    bctx.rotate(cerrado + d * abre);
    bctx.beginPath();
    bctx.moveTo(0, 0);
    bctx.bezierCurveTo(largo * 0.25, ancho, largo * 0.7, ancho * 0.8 + curva, largo, curva);
    bctx.bezierCurveTo(largo * 0.7, -ancho * 0.8 + curva, largo * 0.25, -ancho, 0, 0);
    bctx.fillStyle = g;
    bctx.fill();

    // Contorno: separa un pétalo del otro
    bctx.globalAlpha = 0.85;
    bctx.strokeStyle = mezcla(l.pal.fondo, SOMBRA, 0.65 * color);
    bctx.lineWidth = CW * 1.1;
    bctx.stroke();

    if (abre > 0.2) {
      // Nervio central
      bctx.globalAlpha = abre * 0.9;
      bctx.beginPath();
      bctx.moveTo(largo * 0.08, 0);
      bctx.quadraticCurveTo(largo * 0.6, curva * 0.3, largo * 0.9, curva * 0.9);
      bctx.stroke();
      // Pecas típicas del lirio
      bctx.fillStyle = mezcla(l.pal.fondo, SOMBRA, 0.6);
      for (const m of l.manchas[i]) {
        bctx.beginPath();
        bctx.arc(m.u * largo, m.v * ancho, CW * 0.9, 0, Math.PI * 2);
        bctx.fill();
      }
    }
    bctx.globalAlpha = 1;
    bctx.restore();
  }

  // Estambres curvos con anteras y pistilo al centro
  const est = l.abre ? fase(seg, l.t + 4.8, 1.4) : 0;
  if (est > 0) {
    const largo = l.r * 0.62 * est;
    bctx.lineWidth = CW * 0.45;
    for (let i = 0; i < 6; i++) {
      const a = l.giro + (i + 0.5) * Math.PI / 3;
      const x = Math.cos(a) * largo, y = Math.sin(a) * largo;
      const cx = Math.cos(a + 0.25) * largo * 0.5, cy = Math.sin(a + 0.25) * largo * 0.5;
      bctx.strokeStyle = VERDE.luz;
      bctx.beginPath();
      bctx.moveTo(0, 0);
      bctx.quadraticCurveTo(cx, cy, x, y);
      bctx.stroke();
      bctx.fillStyle = POLEN;
      bctx.beginPath();
      bctx.ellipse(x, y, CW * 1.3, CW * 0.6, a + Math.PI / 2, 0, Math.PI * 2);
      bctx.fill();
    }
    const pa = l.giro + 0.1, pl = largo * 1.1;            // pistilo
    bctx.strokeStyle = '#cfe8b8';
    bctx.lineWidth = CW * 0.6;
    bctx.beginPath();
    bctx.moveTo(0, 0);
    bctx.lineTo(Math.cos(pa) * pl, Math.sin(pa) * pl);
    bctx.stroke();
    bctx.fillStyle = '#b8d99a';
    bctx.beginPath();
    bctx.arc(Math.cos(pa) * pl, Math.sin(pa) * pl, CW * 1.0, 0, Math.PI * 2);
    bctx.fill();
  }
  bctx.restore();
}

// ---------- Cuadro por cuadro ----------

function loop(now) {
  const seg = (now - inicio) / 1000 * VELOCIDAD;

  // 1) Escena en el lienzo oculto (1 píxel = 1 letra)
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, cols, rows);
  bctx.setTransform(1 / CW, 0, 0, 1 / CH, 0, 0);
  bctx.lineCap = 'round';
  const brisa = Math.sin(seg * 0.7) * 0.012 * clamp(seg / 4);
  bctx.translate(BASE.x, BASE.y);
  bctx.rotate(brisa);
  bctx.translate(-BASE.x, -BASE.y);
  for (const l of lirios) dibujarTallo(l, seg);
  for (const h of hojas) dibujarHoja(h, seg);
  for (const l of lirios) dibujarLirio(l, seg);

  // 2) Convertir cada píxel en una letra de su color
  const datos = bctx.getImageData(0, 0, cols, rows).data;
  ctx.clearRect(0, 0, W, H);

  // Resplandor suave debajo de las letras: hace legibles las formas
  ctx.globalAlpha = 0.28;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf, 0, 0, cols * CW, rows * CH);
  ctx.globalAlpha = 1;

  for (const e of estrellas) {
    ctx.fillStyle = `rgba(255,240,245,${0.15 + 0.2 * Math.sin(seg * 1.5 + e.f)})`;
    ctx.fillText('.', e.x, e.y);
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const a = datos[i + 3];
      if (a < 30) continue;
      const r = datos[i], g = datos[i + 1], b = datos[i + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      let k = Math.floor(lum * (CHARS.length - 1)) + ruido[y * cols + x] - 1;
      k = Math.max(0, Math.min(CHARS.length - 1, k));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillText(CHARS[k], x * CW, y * CH);
    }
  }
  textoLateral(seg);
  if (MODO_BUSQUEDA) {                           // muestra la semilla mientras buscas
    ctx.fillStyle = 'rgba(255, 240, 245, 0.55)';
    ctx.font = `italic 12px ${FUENTE}`;
    ctx.textAlign = 'left';
    ctx.fillText('semilla ' + semillaActual + '  ·  toca para cambiar', 16, 16);
  }
  ctx.font = `bold ${CH}px Menlo, Consolas, monospace`;
  requestAnimationFrame(loop);
}

// "Te quiero" en otro idioma, a la izquierda; aparece al terminar el ramo
function textoLateral(seg) {
  const alpha = fase(seg, 7.2, 1.8);
  if (alpha <= 0) return;
  const [frase, idioma] = IDIOMAS[(semillaActual - 1) % IDIOMAS.length];
  const angosta = W < 600;                       // en celular va arriba para no tapar flores
  const x = angosta ? 16 : Math.max(16, W * 0.07);
  const y = angosta ? H * 0.1 : H / 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = `rgba(249, 211, 224, ${0.9 * alpha})`;
  ctx.font = `italic ${angosta ? 15 : 18}px ${FUENTE}`;
  ctx.fillText(frase, x, y);
  ctx.fillStyle = `rgba(249, 211, 224, ${0.5 * alpha})`;
  ctx.font = `italic ${angosta ? 11 : 12}px ${FUENTE}`;
  ctx.fillText(idioma, x, y + (angosta ? 20 : 24));
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const anchoAnterior = W;
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  CW = Math.max(3, Math.min(4, Math.round(Math.min(W, H) / 220))); // ancho de cada letra (menos = más detalle)
  CH = Math.round(CW * 1.6);                                         // alto de cada letra
  cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
  buf.width = cols; buf.height = rows;
  const textura = crearAleatorio(SEMILLA + 999);   // textura de letras y estrellas, también fija
  ruido = Uint8Array.from({ length: cols * rows }, () => Math.floor(textura() * 3));

  ctx.font = `bold ${CH}px Menlo, Consolas, monospace`;
  ctx.textBaseline = 'top';
  estrellas = Array.from({ length: 90 }, () => ({ x: textura() * W, y: textura() * H * 0.95, f: textura() * 6.28 }));

  if (W !== anchoAnterior) construirRamo();
}

// En modo búsqueda, cada toque prueba la siguiente semilla; en modo fijo, repite el mismo ramo
addEventListener('pointerdown', () => {
  if (MODO_BUSQUEDA) semillaActual++;
  construirRamo();
  inicio = performance.now();
});
addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);