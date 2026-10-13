/* ==========================================================
   Mandats pratiques — moteur du site
   Lit mandats.yml et construit les pages. Aucune modification
   n'est nécessaire ici : tout se règle dans mandats.yml.
   ========================================================== */
(function(){
"use strict";

/* ---------- Thèmes ----------
   Chaque apprenti choisit son thème ; le choix reste sur son appareil. */
const SKINS = {
  classique:{label:"Classique", sw:["#EEF1F5","#2F6CC4"],
    palette:["#2F6CC4","#A35C00","#2E8558","#A8378A","#137F8C","#6849C4","#C43E57","#5B7316"]},
  soiree:{label:"Soirée", sw:["#160F2E","#FF4FA3"],
    palette:["#FF4FA3","#3EE0F0","#B6F23A","#FFB020","#B590FF","#FF7A5C","#4DFFB0","#F5E04A"]},
  ferme:{label:"Ferme", sw:["#F1E8D6","#B3261E"],
    palette:["#B3261E","#2F6B3A","#8A5D00","#2D5F8A","#7A4A23","#8A3E6B","#55661C","#B0480F"]},
  plage:{label:"Plage", sw:["#DDF3F5","#0A7FA6"],
    palette:["#0A7FA6","#C7402B","#0B7F74","#B4530B","#2E59A8","#B8336A","#5E7213","#8F5A08"]},
  banque:{label:"Banque", sw:["#0F1E33","#B08A2E"],
    palette:["#1B3A6B","#1F5E4A","#8A1C34","#7D5F10","#4A5A70","#5A3E7A","#2D6E7E","#6B4E2E"]},
  sport:{label:"Sport", sw:["#FFFFFF","#E11D2E"],
    palette:["#D61A2B","#1D4ED8","#15803D","#C2410C","#111827","#7C3AED","#0E7490","#A16207"]}
};
let SKIN = "classique";
try{ const k = localStorage.getItem("mp-theme"); if (SKINS[k]) SKIN = k; }catch(e){}
document.documentElement.dataset.skin = SKIN;
const palette = () => SKINS[SKIN].palette;
const FORMATS = {
  officiel:"Consigne officielle", journal:"Journal de bord",
  outil:"Outil à créer", retour:"Retour d'expérience"
};
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MOIS_COURT = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const JOURS = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];
const DAY = 86400000;

/* ---------- Petits outils ---------- */
const $ = (sel, root=document) => root.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function toDate(v){
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())){
    const [y,m,d] = v.trim().split("-").map(Number); return new Date(Date.UTC(y,m-1,d));
  }
  return null;
}
function today(){ const n=new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
function daysBetween(a,b){ return Math.round((b-a)/DAY); }
function fmtLong(d){ return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`; }
function fmtShort(d){ return `${d.getUTCDate()} ${MOIS_COURT[d.getUTCMonth()]}`; }
function ymd(d){ return d.toISOString().slice(0,10).replace(/-/g,""); }
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function inDays(n){
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "demain";
  if (n > 1) return `dans ${n} jours`;
  if (n === -1) return "hier";
  return `il y a ${-n} jours`;
}
function asList(v){ return Array.isArray(v) ? v.filter(x => x !== null && x !== undefined && String(x).trim() !== "") : []; }
function hasText(v){ return typeof v === "string" && v.trim() !== ""; }

/* Mise en forme légère : **gras**, *italique*, [lien](url), listes « - » */
function inline(s){
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function md(text){
  if (!hasText(text)) return "";
  const lines = String(text).replace(/\r/g,"").split("\n");
  let html = "", para = [], list = null;
  const flushP = () => { if (para.length){ html += `<p>${inline(para.join(" "))}</p>`; para = []; } };
  const flushL = () => { if (list){ html += `<ul>${list.map(i=>`<li>${inline(i)}</li>`).join("")}</ul>`; list = null; } };
  for (const raw of lines){
    const line = raw.trim();
    const m = line.match(/^[-•]\s+(.*)$/);
    if (m){ flushP(); (list ||= []).push(m[1]); }
    else if (line === ""){ flushP(); flushL(); }
    else if (list && /^\s{2,}/.test(raw)){ list[list.length-1] += " " + line; }
    else { flushL(); para.push(line); }
  }
  flushP(); flushL();
  return html;
}

/* ---------- Fichier source ----------
   Par défaut : mandats.yml (la version que voient les apprentis).
   Aperçu d'un brouillon : ajouter ?fichier=nom.yml à l'adresse. */
const DEFAULT_SRC = "mandats.yml";
const SRC = (() => {
  const f = new URLSearchParams(location.search).get("fichier");
  return f && /^[\w-]+\.yml$/.test(f) ? f : DEFAULT_SRC;
})();
const DRAFT = SRC !== DEFAULT_SRC;

/* En aperçu, chaque lien interne garde le paramètre ?fichier= */
function keepDraftInLinks(){
  if (!DRAFT) return;
  document.querySelectorAll('a[href^="mp.html"], a[href^="./"]').forEach(a => {
    const u = new URL(a.getAttribute("href"), location.href);
    u.searchParams.set("fichier", SRC);
    a.setAttribute("href", (u.pathname.split("/").pop() || "./") + u.search);
  });
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="draft-bar">Aperçu du brouillon <b>${esc(SRC)}</b>. Les apprentis ne voient pas cette version. <a href="./">Voir le site publié</a></div>`);
}

/* ---------- Chargement des données ---------- */
async function load(){
  let txt;
  try{
    const r = await fetch(SRC + "?v=" + Date.now(), {cache:"no-store"});
    if (!r.ok) throw new Error("HTTP " + r.status);
    txt = await r.text();
  }catch(e){
    throw {title:`Le fichier ${SRC} est introuvable`,
      detail:"Vérifie qu'il se trouve bien à côté de index.html, avec ce nom exact.\n(" + e.message + ")"};
  }
  let data;
  try{ data = jsyaml.load(txt); }
  catch(e){
    const line = e.mark ? e.mark.line + 1 : "?";
    throw {title:`Erreur dans ${SRC}, ligne ${line}`,
      detail:"Le site ne peut pas lire le fichier maître. Causes les plus fréquentes :\n" +
        "– une tabulation au lieu d'espaces, ou un décalage d'indentation ;\n" +
        "– un texte contenant « : » ou « # » sans guillemets ;\n" +
        "– un guillemet ouvert et pas refermé.\n\nMessage technique : " + (e.reason || e.message)};
  }
  return normalize(data || {});
}

function normalize(d){
  const site = d.site || {}, sem = d.semestre || {};
  const groups = asList(d.groupes).filter(g => g && g.id && g.actif !== false);
  if (!groups.length) groups.push({id:"g1", nom:""});
  const warnings = [];
  const limit = toDate(sem.dernier_rendu);
  const mps = asList(d.mandats).map((m,i) => {
    if (!m.id) warnings.push(`Le MP n°${i+1} (« ${m.titre || "sans titre"} ») n'a pas d'id.`);
    return Object.assign({}, m, {color: m.couleur || palette()[i % palette().length], index:i});
  });
  return {
    site, warnings, groups, limit,
    start: toDate(sem.debut), end: toDate(sem.fin),
    cal: asList(d.calendrier).map(c => ({...c, debut:toDate(c.debut), fin:toDate(c.fin) || toDate(c.debut)})).filter(c => c.debut),
    mps, learnings: d.learnings || {}
  };
}

/* Groupe choisi : ?g=… dans l'adresse, sinon dernier choix, sinon le premier */
function currentGroup(data){
  const ids = data.groups.map(g => g.id);
  const q = new URLSearchParams(location.search).get("g");
  if (q && ids.includes(q)) { store("mp-groupe", q); return q; }
  const saved = store("mp-groupe");
  return ids.includes(saved) ? saved : ids[0];
}
function store(k, v){
  try{
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  }catch(e){ return null; }
}

/* MP vu par un groupe : dates du groupe + variantes éventuelles */
function forGroup(mp, g){
  const v = (mp.variantes && mp.variantes[g]) || {};
  const out = Object.assign({}, mp, v);
  const dd = (mp.dates && mp.dates[g]) || {};
  out.debut = toDate(dd.debut); out.reddition = toDate(dd.reddition);
  return out;
}

/* ---------- Fichier agenda (.ics) ---------- */
function icsEscape(s){ return String(s||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/[,;]/g, m => "\\"+m); }
function fold(line){
  const out = []; let s = line;
  while (s.length > 74){ out.push(s.slice(0,74)); s = " " + s.slice(74); }
  out.push(s); return out.join("\r\n");
}
function buildIcs(data, items, g){
  const rem = asList(data.site.rappels_agenda).map(Number).filter(n => n > 0);
  const base = location.href.replace(/[^/]*([?#].*)?$/, "");
  const stamp = new Date().toISOString().replace(/[-:]/g,"").slice(0,15) + "Z";
  const L = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//mandats-pratiques//FR","CALSCALE:GREGORIAN","METHOD:PUBLISH"];
  for (const mp of items){
    if (!mp.reddition) continue;
    const url = `${base}mp.html?id=${encodeURIComponent(mp.id)}&g=${encodeURIComponent(g)}`;
    const title = `Rendu MP ${(mp.co||"").toUpperCase()} – ${mp.titre}`;
    L.push("BEGIN:VEVENT",
      `UID:${mp.id}-${g}@mandats-pratiques`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(mp.reddition)}`,
      `DTEND;VALUE=DATE:${ymd(new Date(+mp.reddition + DAY))}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape((mp.en_bref||"").replace(/\s+/g," ").trim() + "\n\nTout le détail : " + url)}`,
      `URL:${url}`);
    for (const n of rem){
      /* alarme à 9 h, n jours avant la date */
      const trig = n === 1 ? "-PT15H" : `-P${n-1}DT15H`;
      L.push("BEGIN:VALARM","ACTION:DISPLAY",`DESCRIPTION:${icsEscape(title + " – " + inDays(n))}`,`TRIGGER:${trig}`,"END:VALARM");
    }
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n");
}
function downloadIcs(name, text){
  if (DRAFT && !confirm("Ceci est un brouillon : les dates peuvent encore changer. Télécharger quand même ?")) return;
  const blob = new Blob([text], {type:"text/calendar;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>';
const ICON_DOC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';
const ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>';

/* ---------- Éléments communs ---------- */
function groupPicker(data, g){
  if (data.groups.length < 2) return "";
  return `<label class="group-pick">Mon groupe
    <select id="grp">${data.groups.map(x => `<option value="${esc(x.id)}" ${x.id===g?"selected":""}>${esc(x.nom||x.id)}</option>`).join("")}</select></label>`;
}
function bindPicker(){
  const s = $("#grp"); if (!s) return;
  s.addEventListener("change", () => {
    const u = new URL(location.href); u.searchParams.set("g", s.value); location.href = u.toString();
  });
}
function decoHero(){
  const d = window.MP_DECO && window.MP_DECO[SKIN];
  return d ? `<div class="deco deco-hero" aria-hidden="true">${d.hero}</div>` : "";
}
function themePicker(){
  return `<div class="skins" role="group" aria-label="Thème du site"><span class="skins-k">Thème</span>${
    Object.entries(SKINS).map(([k,v]) => `<button type="button" class="skin${k===SKIN?" on":""}" data-skin="${k}" aria-pressed="${k===SKIN}">
      <i style="--a:${v.sw[0]};--b:${v.sw[1]}"></i>${v.label}</button>`).join("")}</div>`;
}
function footer(data){
  const s = data.site;
  const bits = [];
  if (hasText(s.formateur)) bits.push(`Formateur : ${esc(s.formateur)}`);
  if (hasText(s.contact)) bits.push(`<a href="mailto:${esc(s.contact)}">${esc(s.contact)}</a>`);
  return `<footer class="foot wrap">${document.body.dataset.page === "mp" ? themePicker() : ""}${bits.join("<br>")}</footer>`;
}
function showError(err){
  const t = err && err.title ? err : {title:"Erreur inattendue", detail:String(err && err.message || err)};
  document.body.innerHTML = `<main class="wrap narrow"><div class="error" role="alert"><h2>${esc(t.title)}</h2><pre>${esc(t.detail)}</pre></div></main>`;
}
function warningsHtml(data, mps){
  const w = [...data.warnings];
  if (data.limit) for (const m of mps)
    if (m.reddition && m.reddition > data.limit)
      w.push(`« ${m.titre} » a une reddition (${fmtShort(m.reddition)}) après le dernier rendu du semestre (${fmtShort(data.limit)}).`);
  for (const m of mps) if (m.id && !m.reddition) w.push(`« ${m.titre} » n'a pas de date de reddition pour ce groupe.`);
  if (!w.length) return "";
  return `<div class="warn" role="status"><b>À corriger dans ${esc(SRC)} :</b><ul style="margin:6px 0 0;padding-left:20px">${w.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`;
}

/* ==========================================================
   PAGE D'ACCUEIL
   ========================================================== */
function renderHome(data){
  const g = currentGroup(data);
  const grp = data.groups.find(x => x.id === g);
  const mps = data.mps.map(m => forGroup(m, g)).filter(m => m.id);
  const now = today();
  const dated = mps.filter(m => m.reddition).sort((a,b) => a.reddition - b.reddition);
  const next = dated.find(m => m.reddition >= now);
  const s = data.site;
  document.title = s.titre || "Mandats pratiques";

  let hero;
  if (next){
    const n = daysBetween(now, next.reddition);
    const same = dated.filter(m => +m.reddition === +next.reddition);
    const link = m => `mp.html?id=${encodeURIComponent(m.id)}&g=${g}`;
    const bar = same.length > 1
      ? `linear-gradient(${same.map((m,i)=>`${m.color} ${i*100/same.length}% ${(i+1)*100/same.length}%`).join(",")})`
      : next.color;
    const what = same.length > 1
      ? `<p class="kicker">Prochains rendus : ${same.length} mandats le même jour</p>
         <ul class="next-list">${same.map(m=>`<li style="--c:${m.color}"><a href="${link(m)}"><span class="co">${esc((m.co||"").toUpperCase())}</span>${esc(m.titre)}</a></li>`).join("")}</ul>`
      : `<p class="kicker">Prochain rendu</p>
         <h2><a href="${link(next)}">${esc(next.titre)}</a></h2>`;
    const others = mps.filter(m => m.reddition && m.reddition > next.reddition && m.debut && m.debut <= now);
    hero = `<section class="next${same.length>1?" multi":""}${decoHero()?" has-deco":""}" style="--c:${next.color};--bar:${bar}" aria-label="Prochain rendu">
      <div class="days">${n}<small>${n===1?"jour":"jours"}</small></div>
      <div class="what">
        ${what}
        <p class="when">${cap(fmtLong(next.reddition))}, ${inDays(n)}.</p>
      </div>
      ${same.length === 1 ? `<div class="actions"><a class="btn solid" href="${link(next)}">Voir la consigne</a></div>` : ""}
      ${decoHero()}
    </section>
    ${others.length ? `<div class="also"><span class="also-k">Aussi en cours</span>${others.map(m=>`<a class="also-mp" style="--c:${m.color}" href="${link(m)}"><i></i>${esc((m.co||"").toUpperCase())}, rendu le ${fmtShort(m.reddition)}</a>`).join("")}</div>` : ""}`;
  } else if (dated.length){
    hero = `<section class="next done" style="--c:var(--ink)"><div class="what"><h2>Tous les mandats du semestre sont rendus.</h2>
      <p class="when">Prochaine étape : les entretiens d'évaluation.</p></div></section>`;
  } else hero = "";

  document.body.innerHTML = `
  <header class="wrap top">
    <div><h1 class="brand"><a href="./">${esc(s.titre || "Mes mandats pratiques")}</a></h1>
      <p class="sub">${esc([s.sous_titre, grp && grp.nom].filter(Boolean).join(", "))}</p></div>
    <div class="top-tools">${groupPicker(data, g)}${themePicker()}</div>
  </header>
  <main class="wrap">
    ${warningsHtml(data, mps)}
    ${hero}
    <div class="section-head">
      <h2>Le semestre</h2>
      <div class="actions"><button class="btn" id="ics-all">${ICON_CAL}Tous les rendus dans mon agenda</button></div>
    </div>
    ${gantt(data, mps, g, now)}
    ${mobileList(data, mps, g, now)}
  </main>
  ${footer(data)}`;
  bindPicker();
  $("#ics-all").addEventListener("click", () => downloadIcs("mandats-pratiques.ics", buildIcs(data, dated, g)));
}

function weekStart(d){ const w = (d.getUTCDay()+6)%7; return new Date(+d - w*DAY); }

function gantt(data, mps, g, now){
  if (!data.start || !data.end) return `<p class="warn">Indique semestre.debut et semestre.fin dans ${esc(SRC)} pour afficher le planning.</p>`;
  const t0 = weekStart(data.start);
  const t1 = new Date(+weekStart(data.end) + 7*DAY);
  const total = daysBetween(t0, t1);
  const pct = d => (Math.max(0, Math.min(total, daysBetween(t0, d))) / total * 100).toFixed(3) + "%";
  const inRange = d => d >= t0 && d <= t1;

  let months = "", weeks = "", cols = "";
  let m = new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth(), 1));
  while (m < t1){
    const left = m < t0 ? t0 : m;
    const nextM = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth()+1, 1));
    const width = daysBetween(left, nextM < t1 ? nextM : t1);
    if (width >= 6) months += `<div class="g-month" style="left:${pct(left)}">${cap(MOIS[m.getUTCMonth()])}</div>`;
    m = nextM;
  }
  for (let w = new Date(t0); w < t1; w = new Date(+w + 7*DAY)){
    weeks += `<div class="g-week" style="left:${pct(w)}">${w.getUTCDate()}.${w.getUTCMonth()+1}</div>`;
    cols += `<div class="g-col" style="left:${pct(w)}"></div>`;
  }
  let off = "";
  for (const c of data.cal){
    if (!(inRange(c.debut) || inRange(c.fin))) continue;
    if (c.type === "evenement"){
      off += `<div class="g-event" style="left:${pct(c.debut)}" title="${esc(c.nom)}"><span>${esc(c.nom)}</span></div>`;
    } else {
      const end = new Date(+c.fin + DAY);
      off += `<div class="g-off" style="left:${pct(c.debut)};width:calc(${pct(end)} - ${pct(c.debut)})" title="${esc(c.nom)}">${daysBetween(c.debut,end) >= 3 ? `<span>${esc(c.nom)}</span>` : ""}</div>`;
    }
  }
  const limit = data.limit && inRange(data.limit) ? `<div class="g-limit" style="left:${pct(new Date(+data.limit + DAY))}"><span>Dernier rendu</span></div>` : "";
  const todayLine = inRange(now) ? `<div class="g-today" style="left:${pct(now)}"><span>Aujourd'hui</span></div>` : "";

  const names = mps.map(mp => `<div class="g-row"><a class="g-name" style="--c:${mp.color}" href="mp.html?id=${encodeURIComponent(mp.id)}&g=${g}">
      <span class="dot"></span><span class="t"><span class="co">${esc((mp.co||"").toUpperCase())}</span><span class="tt">${esc(mp.titre)}</span></span></a></div>`).join("");
  const bars = mps.map(mp => {
    if (!mp.reddition) return `<div class="g-bar-row"></div>`;
    const end = new Date(+mp.reddition + DAY);
    const startD = mp.debut && mp.debut < mp.reddition ? mp.debut : null;
    const past = mp.reddition < now ? " past" : "";
    const label = `${mp.titre}, rendu le ${fmtLong(mp.reddition)}`;
    const href = `mp.html?id=${encodeURIComponent(mp.id)}&g=${g}`;
    return startD
      ? `<div class="g-bar-row"><a class="g-bar${past}" style="--c:${mp.color};left:${pct(startD)};width:calc(${pct(end)} - ${pct(startD)})" href="${href}" title="${esc(label)}" aria-label="${esc(label)}"><span class="pin"></span></a></div>`
      : `<div class="g-bar-row"><a class="g-bar milestone${past}" style="--c:${mp.color};left:calc(${pct(end)} - 30px)" href="${href}" title="${esc(label)}" aria-label="${esc(label)}"><span class="pin"></span></a></div>`;
  }).join("");

  return `<section class="gantt" aria-label="Planning du semestre">
    <div class="g-grid">
      <div class="g-names"><div class="g-head"></div>${names}</div>
      <div class="g-track">
        <div class="g-months">${months}</div><div class="g-weeks">${weeks}</div>
        ${cols}${off}${limit}${todayLine}
        <div class="g-bars">${bars}</div>
      </div>
    </div>
    <div class="g-legend">
      <span><i style="background:var(--ink-soft);border-radius:999px"></i>Période de travail, le rond marque le jour du rendu</span>
      <span><i class="h"></i>Vacances et jours fériés</span>
      ${data.cal.some(c=>c.type==="evenement") ? '<span><i class="e"></i>Événement</span>' : ""}
      ${limit ? '<span><i class="l"></i>Dernier rendu du semestre</span>' : ""}
    </div>
  </section>`;
}

function mobileList(data, mps, g, now){
  const items = [];
  for (const mp of mps) if (mp.reddition) items.push({d:mp.reddition, k:"mp", mp});
  for (const c of data.cal){
    if (data.start && data.end && (c.fin < data.start || c.debut > data.end)) continue;
    items.push({d:c.debut, k:"off", c});
  }
  if (data.limit) items.push({d:data.limit, k:"limit", o:1});
  items.sort((a,b) => (a.d - b.d) || ((a.o||0) - (b.o||0)));
  const li = items.map(it => {
    if (it.k === "mp"){
      const mp = it.mp, n = daysBetween(now, mp.reddition);
      return `<li><a class="l-mp${n<0?" past":""}" style="--c:${mp.color}" href="mp.html?id=${encodeURIComponent(mp.id)}&g=${g}">
        <span class="l-date"><b>${mp.reddition.getUTCDate()}</b><small>${MOIS_COURT[mp.reddition.getUTCMonth()]}</small></span>
        <span><span class="co">${esc((mp.co||"").toUpperCase())}</span><span class="t">${esc(mp.titre)}</span>
        <span class="muted" style="font-size:14px;color:var(--ink-soft)">Rendu ${inDays(n)}</span></span></a></li>`;
    }
    if (it.k === "limit") return `<li class="l-limit">Dernier rendu du semestre : ${fmtLong(data.limit)}</li>`;
    const c = it.c, same = +c.debut === +c.fin;
    return `<li class="l-off${c.type==="evenement"?" ev":""}"><i></i>${esc(c.nom)}, ${same ? fmtShort(c.debut) : `du ${fmtShort(c.debut)} au ${fmtShort(c.fin)}`}</li>`;
  }).join("");
  return `<ol class="list" aria-label="Planning du semestre">${li}</ol>`;
}

/* ==========================================================
   PAGE D'UN MANDAT
   ========================================================== */
function renderMp(data){
  const g = currentGroup(data);
  const id = new URLSearchParams(location.search).get("id");
  const raw = data.mps.find(m => m.id === id);
  if (!raw){
    showError({title:"Ce mandat n'existe pas", detail:`Aucun MP avec l'id « ${id || ""} » dans ${SRC}.\nRetourne à l'accueil pour choisir un mandat.`});
    document.querySelector(".error").insertAdjacentHTML("beforeend", '<p><a class="btn" href="./">Retour à l\'accueil</a></p>');
    return;
  }
  const mp = forGroup(raw, g);
  const now = today();
  const s = data.site;
  document.title = `${mp.titre} – ${s.titre || "Mandats pratiques"}`;
  document.documentElement.style.setProperty("--c", mp.color);

  const n = mp.reddition ? daysBetween(now, mp.reddition) : null;
  const pdf = hasText(mp.pdf_officiel) ? mp.pdf_officiel : (hasText(s.dossier_pdf) ? s.dossier_pdf : "");
  const items = asList(mp.items_autoeval);
  const L = data.learnings || {};

  const facts = [];
  if (mp.reddition) facts.push(`<div class="fact"><p class="k">À rendre le</p><p class="v">${cap(fmtLong(mp.reddition))}<small>${cap(inDays(n))}</small></p></div>`);
  if (mp.debut) facts.push(`<div class="fact"><p class="k">Consigne donnée le</p><p class="v">${cap(fmtLong(mp.debut))}</p></div>`);
  if (items.length) facts.push(`<div class="fact"><p class="k">Autoévaluation${hasText(mp.grille_autoeval) ? ", " + esc(mp.grille_autoeval) : ""}</p>
     <div class="bubbles" aria-label="Items à remplir : ${items.join(", ")}">${items.map(i=>`<span class="bubble">${esc(i)}</span>`).join("")}</div></div>`);

  const blocks = [];
  if (hasText(mp.mission_terrain)) blocks.push(block("Ta mission", `<div class="prose">${md(mp.mission_terrain)}</div>`));
  const liv = asList(mp.livrables);
  if (liv.length) blocks.push(block("À déposer sur Konvink", `<ul>${liv.map(x=>`<li>${inline(x)}</li>`).join("")}</ul>`));

  if (items.length || hasText(mp.questions_directrices)){
    blocks.push(block("Ton autoévaluation", `
      ${items.length ? `<p>Dans la grille${hasText(mp.grille_autoeval) ? ` <strong>${esc(mp.grille_autoeval)}</strong>` : ""}, remplis ${items.length>1?"les items":"l'item"} :</p>
        <div class="bubbles" style="margin-bottom:14px">${items.map(i=>`<span class="bubble">${esc(i)}</span>`).join("")}</div>` : ""}
      ${hasText(mp.questions_directrices) ? `<h3>Les questions à te poser</h3><ul>${String(mp.questions_directrices).replace(/\s+/g," ").trim().split(/(?<=\?)\s+(?=[A-ZÀ-Ý])/).filter(Boolean).map(x=>`<li>${inline(x)}</li>`).join("")}</ul>` : ""}`));
  }

  const lq = asList(L.questions), lp = asList(mp.learnings_pistes), lr = asList(L.regles);
  if (hasText(L.intro) || lq.length || lp.length){
    blocks.push(block("Ta case Learnings", `
      ${hasText(L.intro) ? `<div class="prose">${md(L.intro)}</div>` : ""}
      ${lq.length ? `<ol class="learn-q">${lq.map(x=>`<li>${inline(x)}</li>`).join("")}</ol>` : ""}
      ${lp.length ? `<div class="learn-extra"><strong>Pour ce mandat :</strong> ${lp.map(inline).join(" ")}</div>` : ""}
      ${lr.length ? `<ul class="rules">${lr.map(x=>`<li>${inline(x)}</li>`).join("")}</ul>` : ""}`));
  }

  const nv = mp.niveau_cfc || {};
  const ni = asList(nv.insuffisant), na = asList(nv.acquis), nm = asList(nv.maitrise);
  if (ni.length || na.length || nm.length){
    const col = (cls, t, arr) => arr.length ? `<div class="level ${cls}"><h3>${t}</h3><ul>${arr.map(x=>`<li>${inline(x)}</li>`).join("")}</ul></div>` : "";
    blocks.push(block("Le niveau attendu", `<div class="levels">${col("i","Pas encore",ni)}${col("a","Niveau CFC",na)}${col("m","Au-delà",nm)}</div>`));
  }

  const links = asList(mp.liens_theorie).filter(l => l && hasText(l.titre));
  if (hasText(mp.theorie_essentiel) || links.length){
    blocks.push(block("L'essentiel de la théorie", `
      <div class="prose">${md(mp.theorie_essentiel)}</div>
      ${links.length ? `<div class="actions" style="margin-top:12px">${links.map(l => hasText(l.url)
        ? `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${ICON_LINK}${esc(l.titre)}</a>`
        : `<span class="muted">${esc(l.titre)}</span>`).join("")}</div>` : ""}`));
  }
  const pg = asList(mp.pieges);
  if (pg.length) blocks.push(block("Les pièges à éviter", `<ul>${pg.map(x=>`<li>${inline(x)}</li>`).join("")}</ul>`));

  const ck = asList(mp.avant_de_rendre);
  if (ck.length){
    blocks.push(block("Avant de rendre", `<p class="progress" id="ck-prog"></p>
      <ul class="check">${ck.map((x,i)=>`<li><label><input type="checkbox" data-i="${i}"><span>${inline(x)}</span></label></li>`).join("")}</ul>
      <p class="muted" style="font-size:14px;margin-top:8px">Tes coches restent enregistrées sur cet appareil.</p>`));
  }

  document.body.innerHTML = `
  <main class="wrap narrow">
    <a class="back" href="./?g=${g}">Retour au semestre</a>
    <header class="mp-head${decoHero()?" has-deco":""}">${decoHero()}
      <div class="ids">
        ${mp.co ? `<span class="chip">Compétence ${esc(String(mp.co).toLowerCase())}</span>` : ""}
        ${hasText(mp.mp_officiel) ? `<span class="chip">${esc(mp.mp_officiel)}</span>` : ""}
        ${FORMATS[mp.format] ? `<span class="chip">${FORMATS[mp.format]}</span>` : ""}
      </div>
      <h1>${esc(mp.titre)}</h1>
      ${hasText(mp.co_titre) ? `<p class="co-line">${esc(mp.co_titre)}</p>` : ""}
      ${hasText(mp.en_bref) ? `<div class="lead">${md(mp.en_bref)}</div>` : ""}
    </header>
    ${mp.statut === "proposition" ? `<div class="warn"><b>Consigne provisoire.</b> Elle peut encore changer : attends la validation de ton formateur avant de commencer.</div>` : ""}
    ${warningsHtml({warnings:[], limit:data.limit}, [mp])}
    <div class="facts">${facts.join("")}</div>
    <div class="actions" style="margin-bottom:22px">
      ${pdf ? `<a class="btn solid" href="${esc(pdf)}" target="_blank" rel="noopener">${ICON_DOC}Le mandat officiel (PDF)</a>` : ""}
      ${mp.reddition ? `<button class="btn" id="ics-one">${ICON_CAL}Ajouter à mon agenda</button>` : ""}
    </div>
    ${blocks.join("")}
  </main>
  ${footer(data)}`;

  const b = $("#ics-one");
  if (b) b.addEventListener("click", () => downloadIcs(`mp-${mp.id}.ics`, buildIcs(data, [mp], g)));
  bindChecklist(`mp-check-${mp.id}`, ck.length);
}

function block(title, inner){ return `<section class="block"><h2>${title}</h2>${inner}</section>`; }

function bindChecklist(key, total){
  const boxes = [...document.querySelectorAll(".check input")];
  if (!boxes.length) return;
  let state = [];
  try{ state = JSON.parse(store(key) || "[]"); }catch(e){ state = []; }
  boxes.forEach(b => { b.checked = state.includes(+b.dataset.i); });
  const upd = () => {
    const on = boxes.filter(b => b.checked).map(b => +b.dataset.i);
    store(key, JSON.stringify(on));
    $("#ck-prog").textContent = on.length === total ? "Tout est prêt : tu peux rendre." : `${on.length} sur ${total} cochés`;
  };
  boxes.forEach(b => b.addEventListener("change", upd));
  upd();
}

/* ---------- Lancement ---------- */
function render(data){
  const y = window.scrollY;
  if (document.body.dataset.page === "mp") renderMp(data); else renderHome(data);
  const d = window.MP_DECO && window.MP_DECO[SKIN];
  if (d && d.strip) document.body.insertAdjacentHTML("afterbegin", '<div class="deco-strip" aria-hidden="true"></div>');
  keepDraftInLinks();
  document.querySelectorAll(".skin").forEach(b => b.addEventListener("click", () => {
    SKIN = b.dataset.skin;
    try{ localStorage.setItem("mp-theme", SKIN); }catch(e){}
    document.documentElement.dataset.skin = SKIN;
    data.mps.forEach((m,i) => { if (!m.couleur) m.color = palette()[i % palette().length]; });
    render(data);
    window.scrollTo(0, y);
    const again = document.querySelector(`.skin[data-skin="${SKIN}"]`); if (again) again.focus();
  }));
}
document.addEventListener("DOMContentLoaded", async () => {
  try{
    const data = await load();
    render(data);
  }catch(e){ console.error(e); showError(e); }
});
})();
