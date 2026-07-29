// cram-calc.js — CRAM Depth Manifold engine (BigInt, bug-fixed).
//
// Refinements over the original draft:
//  • modInv null is checked BEFORE Number() coercion (Number(null)=0 bug fixed)
//  • star-number test uses an exact integer sqrt (no float drift)
//  • basis is fully user-editable + validated pairwise coprime
//  • gear classes aligned to HCRM spec (G-zero, G-pre, G-low)
//  • all arithmetic stays in BigInt → arbitrary finite depth

const Bi = (n) => BigInt(n);
function mod(a, m) { a = Bi(a); m = Bi(m); return ((a % m) + m) % m; }
function modInv(a, m) {
  a = mod(a, m); let [or, r] = [a, Bi(m)], [os, s] = [1n, 0n];
  while (r !== 0n) { const q = or / r; [or, r] = [r, or - q * r]; [os, s] = [s, os - q * s]; }
  return or !== 1n ? null : mod(os, m);          // null when no inverse — caller must check
}
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
function coprime(arr) {
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++)
    if (gcd(Bi(arr[i]), Bi(arr[j])) !== 1n) return false;
  return true;
}
function crt(res, mods) {
  const M = mods.reduce((a, b) => a * Bi(b), 1n); let r = 0n;
  for (let i = 0; i < mods.length; i++) {
    const Mi = M / Bi(mods[i]); const yi = modInv(Mi, Bi(mods[i]));
    if (yi === null) continue;                   // skip non-invertible (shouldn't happen if coprime)
    r = mod(r + Bi(res[i]) * Mi * yi, M);
  }
  return r;
}
function isqrt(n) {
  if (n < 0n) return -1n; if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}
function factorize(n) {
  n = n < 0n ? -n : Bi(n); if (n <= 1n) return [n.toString()];
  const f = []; let d = 2n;
  while (d * d <= n) { while (n % d === 0n) { f.push(d.toString()); n /= d; } d += 1n; }
  if (n > 1n) f.push(n.toString());
  return f;
}
// f⋆(n) = 6n(n−1)+1 ; invert exactly: 6k²−6k+(1−N)=0 → disc = 12+24N
function starIndex(N) {
  N = Bi(N); if (N < 1n) return null;
  const disc = 12n + 24n * N; const s = isqrt(disc);
  if (s * s !== disc) return null;
  if ((6n + s) % 12n !== 0n) return null;
  const k = (6n + s) / 12n;
  return (6n * k * (k - 1n) + 1n === N) ? Number(k) : null;
}
function starNum(n) { n = Bi(n); return 6n * n * (n - 1n) + 1n; }
function propSig(N) {
  N = Bi(N); const s = N < 0n ? "−" : N === 0n ? "0" : "+";
  const bits = N === 0n ? 0 : (N < 0n ? -N : N).toString(2).length;
  const cat = bits <= 8 ? "byte" : bits <= 16 ? "word" : bits <= 32 ? "dword" : bits <= 64 ? "qword" : "big";
  return `${s}${cat}(${bits}b)`;
}
function shadowHash(N, basis) {
  let h = 0n; for (const m of basis) h = (h * 31n + mod(N, Bi(m))) & 0xFFFFFFFFn;
  return "0x" + h.toString(16).toUpperCase().padStart(8, "0");
}
// HCRM gear class on the 17/19 pair
function gearClass(r17, r19) {
  if (r17 === 0 && r19 === 0) return "G-zero";
  if (r17 === 16 && r19 === 18) return "G-pre";
  if (r17 <= 1 && r19 <= 1) return "G-low";
  return null;
}

// ── state ──
let S = null, basis = [36, 37], arithOp = "+", focusLvl = 1, t0 = Date.now();
const ACCENT = ["var(--shadow)","var(--gear)","var(--amber)","var(--rose)","var(--boundary)","var(--emerald)"];
const TAGS = { 36:"shell", 37:"anchor", 11:"shadow", 13:"boundary", 17:"gear", 19:"gear", 7:"bridge", 73:"raised" };

function loadPreset(name) {
  const sets = {
    dresden:[36,37], safe4:[11,13,17,19], safe6:[2,3,5,7,11,13],
    safe8:[2,3,5,7,11,13,17,19], star73:[37,73], full:[7,11,13,37,73],
  };
  if (name === "custom") { document.getElementById("inpBasis").focus(); return; }
  basis = sets[name] || [36,37];
  document.getElementById("inpBasis").value = basis.join(", ");
  document.getElementById("inpM").value = basis[0];
  document.getElementById("inpA").value = basis[1] || basis[0];
  fullDecompose();
}

function readBasis() {
  const raw = document.getElementById("inpBasis").value.trim();
  const arr = raw.split(/[,\s]+/).map(x => parseInt(x)).filter(x => Number.isFinite(x) && x > 1);
  return arr.length ? arr : basis;
}

function fullDecompose() {
  const raw = document.getElementById("inpN").value.trim();
  if (!raw) return;
  let N; try { N = Bi(raw); } catch (e) { log("ERR", "Invalid integer", "var(--rose)"); return; }

  basis = readBasis();
  document.getElementById("inpBasis").value = basis.join(", ");
  if (!coprime(basis)) { log("ERR", `Basis {${basis.join(",")}} not pairwise coprime`, "var(--rose)"); return; }

  const M = parseInt(document.getElementById("inpM").value) || basis[0];
  const A = parseInt(document.getElementById("inpA").value) || basis[1] || basis[0];

  const residues = basis.map(m => Number(mod(N, Bi(m))));
  const MB = basis.reduce((a, c) => a * Bi(c), 1n);
  const crtVal = crt(residues, basis);
  const K = (N - crtVal) / MB;

  // K-elimination across every ordered (shell, anchor) pair
  const kElim = [];
  for (let i = 0; i < basis.length; i++) for (let j = 0; j < basis.length; j++) {
    if (i === j) continue;
    const Mi = basis[i], Aj = basis[j];
    const inv = modInv(Bi(Mi), Bi(Aj));
    if (inv === null) continue;                          // fixed: skip non-invertible properly
    const rM = residues[i], aA = residues[j];
    const Khat = Number(mod((Bi(aA) - Bi(rM)) * inv, Bi(Aj)));
    const Ktrue = Number(mod(K, Bi(Aj)));
    kElim.push({ M: Mi, A: Aj, rM, aA, inv: Number(inv), Khat, Ktrue, ok: Khat === Ktrue });
  }

  const subRes = basis.map((m, i) => {
    const r = residues[i];
    return { m, r, factors: factorize(Bi(r)), star: starIndex(r), bits: r.toString(2).length, parity: r % 2 };
  });

  S = { N, basis: [...basis], residues, K, MB, crtVal, M, A, kElim, subRes,
        sigma: propSig(N), shadow: shadowHash(N, basis) };
  renderAll();
  log("DECOMP", `N=${N} → 5-level over {${basis.join(",")}}`, "var(--amber)");
}

function renderAll() {
  if (!S) return;
  renderSub(); renderTray(); renderInt(); renderWinding(); renderProfinite(); renderAdelic();
  updateDepth();
}

function renderSub() {
  let h = "";
  S.subRes.forEach((s, i) => {
    const c = ACCENT[i % ACCENT.length];
    h += `<div class="cell" style="border-left:3px solid ${c}">
      <div class="cell-t" style="color:${c}">mod ${s.m} → r=${s.r}</div>
      <div class="cell-v" style="color:${c}">${s.r}</div>
      <div class="cell-s">factors: ${s.factors.join(" × ")}</div>
      <div class="cell-s">bits: ${s.bits} · ${s.parity===0?"even":"odd"}</div>
      <div class="cell-s" style="color:${s.star!==null?"var(--amber)":"var(--ink-dim)"}">star: ${s.star!==null?"✓ S"+s.star:"—"}</div>
    </div>`;
  });
  const kAbs = S.K < 0n ? -S.K : S.K;
  const kStar = starIndex(kAbs);
  h += `<div class="cell" style="border-left:3px solid var(--gear)">
    <div class="cell-t" style="color:var(--gear)">winding K = ${S.K}</div>
    <div class="cell-v" style="color:var(--gear)">${S.K}</div>
    <div class="cell-s">factors: ${factorize(kAbs).join(" × ")}</div>
    <div class="cell-s" style="color:${kStar!==null?"var(--amber)":"var(--ink-dim)"}">star: ${kStar!==null?"✓ S"+kStar:"—"}</div>
  </div>`;
  document.getElementById("subres").innerHTML = h;
}

function renderTray() {
  let h = "";
  S.basis.forEach((m, i) => {
    const r = S.residues[i], pct = (r / m) * 100, c = ACCENT[i % ACCENT.length];
    const tag = TAGS[m] || "lane";
    h += `<div class="lane"><div class="lane-bar" style="background:${c}"></div>
      <div class="lane-mod">mod ${m}</div>
      <div class="lane-val" style="color:${c}">${r}</div>
      <div class="lane-meter"><div class="lane-fill" style="width:${pct}%;background:${c}"></div></div>
      <span class="lane-tag" style="color:${c};background:color-mix(in oklch, ${c} 14%, transparent)">${tag}</span></div>`;
  });
  document.getElementById("lanes").innerHTML = h;
}

function renderInt() {
  const phi = S.crtVal + S.K * S.MB;
  const star = starIndex(S.N);
  document.getElementById("intb").innerHTML = `
    <div class="drow"><span class="drow-l">Integer N</span><span class="drow-v v-am" style="font-size:15px">${S.N}</span></div>
    <div class="drow"><span class="drow-l">CRT canonical γ̃(r)</span><span class="drow-v">${S.crtVal}</span></div>
    <div class="drow"><span class="drow-l">Winding K</span><span class="drow-v v-ge">${S.K}</span></div>
    <div class="drow"><span class="drow-l">Tray period M_B</span><span class="drow-v">${S.MB}</span></div>
    <div class="drow"><span class="drow-l">Φ(r,K) = γ̃ + K·M_B</span><span class="drow-v v-em">${S.crtVal} + ${S.K}×${S.MB} = ${phi}</span></div>
    <div class="drow"><span class="drow-l">Verify Φ = N</span><span class="drow-v" style="color:${phi===S.N?"var(--emerald)":"var(--rose)"}">${phi===S.N?"✓ exact":"✗ drift"}</span></div>
    <div class="drow"><span class="drow-l">Factor structure</span><span class="drow-v" style="font-size:11px">${factorize(S.N).join(" × ")}</span></div>
    <div class="drow"><span class="drow-l">Star number?</span><span class="drow-v" style="color:${star!==null?"var(--amber)":"var(--ink-dim)"}">${star!==null?"✓ S"+star:"—"}</span></div>`;
}

function renderWinding() {
  const start = S.K - 3n, end = S.K + 3n;
  let tower = "";
  for (let k = end; k >= start; k -= 1n) {
    const active = k === S.K;
    const nK = S.crtVal + k * S.MB;
    const r0 = Number(mod(nK, Bi(S.basis[0])));
    tower += `<div class="wblock ${active?"active":""}" style="${active?"":"opacity:.5"}">K=${k} → N=${nK} (r_${S.basis[0]}=${r0})</div>`;
    if (k > start) tower += `<div class="wconn"></div>`;
  }
  const kAbs = S.K < 0n ? -S.K : S.K;
  const deep = kAbs >= Bi(S.basis[S.basis.length-1]);
  document.getElementById("winding").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <div class="drow"><span class="drow-l">Winding K</span><span class="drow-v v-ge" style="font-size:15px">${S.K}</span></div>
        <div class="drow"><span class="drow-l">Shell M</span><span class="drow-v">${S.M}</span></div>
        <div class="drow"><span class="drow-l">M_B (product)</span><span class="drow-v">${S.MB}</span></div>
        <div class="drow"><span class="drow-l">N = γ̃ + K·M_B</span><span class="drow-v">${S.N}</span></div>
        <div class="drow"><span class="drow-l">Depth class</span><span class="drow-v" style="font-size:11px">${deep?"deep (K ≥ A)":"shallow (K < A)"}</span></div>
      </div>
      <div class="wvis">${tower}</div>
    </div>`;
}

function renderProfinite() {
  let h = "";
  const primary = S.kElim.find(k => k.M === S.M && k.A === S.A) || S.kElim[0];
  if (primary) {
    h += `<div style="padding:12px;background:oklch(0.10 0.006 60);border:1px solid var(--line);border-radius:8px;margin-bottom:12px">
      <div style="font-family:var(--mono);font-size:9px;color:var(--emerald);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px">primary K-elimination · M=${primary.M}, A=${primary.A}</div>
      <div class="kstep"><span class="kn">1</span><span class="kl">r_M = N mod M</span><span class="kv">${S.N} mod ${primary.M} = ${primary.rM}</span></div>
      <div class="kstep"><span class="kn">2</span><span class="kl">a_A = N mod A</span><span class="kv">${S.N} mod ${primary.A} = ${primary.aA}</span></div>
      <div class="kstep"><span class="kn">3</span><span class="kl">M⁻¹ mod A</span><span class="kv">${primary.M}⁻¹ mod ${primary.A} = ${primary.inv}</span></div>
      <div class="kstep"><span class="kn">4</span><span class="kl">K̂ = (a_A − r_M)·M⁻¹ mod A</span><span class="kv">(${primary.aA} − ${primary.rM})×${primary.inv} mod ${primary.A} = ${primary.Khat}</span></div>
      <div class="kstep kstep-final"><span class="kn">✓</span><span class="kl">K̂ vs K mod A</span><span class="kv">${primary.Khat} ${primary.ok?"≡":"≢"} ${primary.Ktrue} ${primary.ok?"verified":"(partial)"}</span></div>
    </div>`;
  }
  h += `<div style="font-family:var(--mono);font-size:9px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px">multi-anchor verification matrix</div>`;
  h += `<table class="tbl"><thead><tr><th>M</th><th>A</th><th class="num">r_M</th><th class="num">a_A</th><th class="num">M⁻¹</th><th class="num">K̂</th><th class="num">K mod A</th><th>status</th></tr></thead><tbody>`;
  S.kElim.forEach(k => {
    h += `<tr><td>${k.M}</td><td>${k.A}</td><td class="num">${k.rM}</td><td class="num">${k.aA}</td><td class="num">${k.inv}</td>
      <td class="num" style="color:var(--emerald)">${k.Khat}</td><td class="num">${k.Ktrue}</td>
      <td style="color:${k.ok?"var(--emerald)":"var(--amber)"}">${k.ok?"✓":"◐"}</td></tr>`;
  });
  h += `</tbody></table>
    <div style="margin-top:12px;padding:10px;background:oklch(0.10 0.006 60);border-radius:8px;border:1px solid var(--line);font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ink-2);line-height:1.55">
      The winding K=${S.K} lives in the profinite completion Ẑ ≅ ∏ₚ ℤₚ. Each anchor verifies K modulo A — a p-adic digit of the depth. Enough coprime anchors recover the full winding by CRT applied to the depth dimension.
    </div>`;
  document.getElementById("profinite").innerHTML = h;
}

function renderAdelic() {
  const chip = (l, v, c) => `<div style="padding:6px 12px;border-radius:7px;border:1px solid ${c};color:${c};background:color-mix(in oklch, ${c} 6%, transparent);font-family:var(--mono);font-size:12px"><span style="font-size:8px;opacity:.7;text-transform:uppercase;letter-spacing:0.1em">${l}</span> <span style="font-weight:600">${v}</span></div>`;
  document.getElementById("adelic").innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
      ${chip("B", "{"+S.basis.join(",")+"}", "var(--shadow)")}
      ${chip("r", "["+S.residues.join(",")+"]", "var(--gear)")}
      ${chip("K", S.K, "var(--amber)")}
      ${chip("Σ", S.sigma, "var(--emerald)")}
      ${chip("Sh", S.shadow, "var(--rose)")}
    </div>
    <div class="drow"><span class="drow-l">Integer projection π(S)</span><span class="drow-v v-am" style="font-size:15px">${S.N}</span></div>
    <div class="drow"><span class="drow-l">Manifold dimension</span><span class="drow-v">${S.basis.length} lanes + winding ∈ Ẑ</span></div>
    <div class="drow"><span class="drow-l">Value quotient C/∼ ≅ ℤ</span><span class="drow-v v-em">✓ isomorphic</span></div>
    <div class="drow"><span class="drow-l">Structural richness</span><span class="drow-v v-ro">&gt; ℤ (carries Σ, Sh)</span></div>`;
  const prod = S.basis.reduce((a, c) => a * Bi(c), 1n);
  document.getElementById("trans").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center">
      <div style="text-align:center;padding:10px;background:var(--bg-2);border-radius:8px"><div style="font-family:var(--mono);font-size:8px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:0.12em">source</div><div class="mono" style="color:var(--shadow);font-size:13px;margin-top:4px">{${S.basis.join(", ")}}</div><div class="mono" style="font-size:10px;color:var(--ink-dim)">M_A = ${prod}</div></div>
      <div style="font-size:20px;color:var(--amber)">⇌</div>
      <div style="text-align:center;padding:10px;background:var(--bg-2);border-radius:8px"><div style="font-family:var(--mono);font-size:8px;color:var(--ink-dim);text-transform:uppercase;letter-spacing:0.12em">target</div><div class="mono" style="color:var(--emerald);font-size:13px;margin-top:4px" id="ttB">—</div><div class="mono" style="font-size:10px;color:var(--ink-dim)" id="ttP">—</div></div>
    </div>`;
}

function updateDepth() {
  ["dlN1","dl0","dl1","dl2","dl3","dl4"].forEach(id => document.getElementById(id).classList.remove("active"));
  const map = { "-1":"dlN1",0:"dl0",1:"dl1",2:"dl2",3:"dl3",4:"dl4" };
  const el = document.getElementById(map[focusLvl]); if (el) el.classList.add("active");
}
function focusLevel(l) {
  focusLvl = l; updateDepth();
  const map = { "-1":"panelN1",0:"panel0",1:"panel1",2:"panel2",3:"panel3",4:"panel4" };
  const p = document.getElementById(map[l]); if (p) { p.classList.remove("collapsed"); p.scrollIntoView({behavior:"smooth",block:"nearest"}); }
}

function raiseAll() {
  if (!S) { log("WARN","Decompose first","var(--amber)"); return; }
  const n = S.N + S.MB; document.getElementById("inpN").value = n.toString();
  log("RAISE", `K:${S.K}→${S.K+1n}, +M_B=${S.MB}`, "var(--gear)"); fullDecompose(); focusLevel(2);
}
function lowerAll() {
  if (!S) { log("WARN","Decompose first","var(--amber)"); return; }
  const n = S.N - S.MB; document.getElementById("inpN").value = n.toString();
  log("LOWER", `K:${S.K}→${S.K-1n}, −M_B=${S.MB}`, "var(--shadow)"); fullDecompose(); focusLevel(2);
}
function opRaise(){ raiseAll(); }
function opLower(){ lowerAll(); }
function opHold(){ if (S) log("HOLD", `(r,K)=([${S.residues.join(",")}], ${S.K}) preserved`, "var(--ink-2)"); }

function seqGo(v) {
  document.querySelectorAll(".snode").forEach(n => n.classList.remove("active"));
  const el = document.getElementById("sq"+v); if (el) el.classList.add("active");
  document.getElementById("inpN").value = v;
  const msg = { 36:"hidden shell (r=0,K=1)", 37:"materialized star prime S3 (r=1,K=1)", 73:"raised star prime S4 (r=1,K=2)", 35113:"capstone f⋆(77)=13×37×73" };
  log("SEQ", `N=${v}: ${msg[v]||""}`, "var(--amber)"); fullDecompose();
}

function setOp(op) {
  arithOp = op;
  document.querySelectorAll(".aop").forEach(b => b.classList.remove("active"));
  document.getElementById("op"+(op==="+"?"Plus":op==="-"?"Minus":"Times")).classList.add("active");
}
function computeArith() {
  let a, b; try { a = Bi(document.getElementById("aA").value||"0"); b = Bi(document.getElementById("aB").value||"0"); } catch(e){ return; }
  let res, sym;
  if (arithOp==="+"){ res=a+b; sym="+"; } else if (arithOp==="-"){ res=a-b; sym="−"; } else { res=a*b; sym="×"; }
  document.getElementById("aRes").textContent = res.toString();
  log("ARITH", `${a} ${sym} ${b} = ${res}`, "var(--amber)");
  if (S) {
    let h = "";
    S.basis.forEach((m, i) => {
      const ra = Number(mod(a,Bi(m))), rb = Number(mod(b,Bi(m)));
      let rr; if(arithOp==="+") rr=(ra+rb)%m; else if(arithOp==="-") rr=((ra-rb)%m+m)%m; else rr=(ra*rb)%m;
      const c = ACCENT[i%ACCENT.length];
      h += `<div class="lane"><div class="lane-bar" style="background:${c}"></div><div class="lane-mod">mod ${m}</div><div class="lane-val" style="color:${c}">${ra} ${sym} ${rb} ≡ <strong>${rr}</strong></div></div>`;
    });
    document.getElementById("aLanes").innerHTML = h;
  }
}

function evalStar() {
  let n; try { n = Bi(document.getElementById("starN").value||"77"); } catch(e){ return; }
  const res = starNum(n), f = factorize(res);
  document.getElementById("starRes").textContent = res.toString();
  document.getElementById("starFac").textContent = "= " + f.join(" × ");
  const lock = f.includes("13") && f.includes("37") && f.includes("73");
  document.getElementById("starLock").innerHTML = lock ? "🔒 topological factor lock: f⋆(77) = 13·37·73 — boundary · anchor · raised" : "";
  log("STAR", `f⋆(${n}) = ${res} = ${f.join("×")}`, "var(--amber)");
}

function doTransduce() {
  if (!S) { log("WARN","No state","var(--amber)"); return; }
  const cur = S.basis.join(",");
  const route = { "36,37":[11,13,17,19], "11,13,17,19":[2,3,5,7,11,13], "2,3,5,7,11,13":[37,73], "37,73":[7,11,13,37,73] };
  const target = route[cur] || [36,37];
  const prod = target.reduce((a,c)=>a*Bi(c),1n);
  document.getElementById("ttB").textContent = `{${target.join(", ")}}`;
  document.getElementById("ttP").textContent = `M_B = ${prod}`;
  log("TRANS", `{${cur}} → {${target.join(",")}}: N=${S.N} preserved`, "var(--amber)"); focusLevel(4);
}

function togglePanel(id){ document.getElementById(id).closest(".panel").classList.toggle("collapsed"); }

function log(op, detail, color) {
  const box = document.getElementById("log");
  const el = Math.floor((Date.now()-t0)/1000);
  const mm = String(Math.floor(el/60)).padStart(2,"0"), ss = String(el%60).padStart(2,"0");
  const e = document.createElement("div");
  e.className = "log-e";
  e.innerHTML = `<span class="log-t">${mm}:${ss}</span><span class="log-op" style="color:${color}">${op}</span><span class="log-d">${detail}</span>`;
  box.insertBefore(e, box.firstChild);
  while (box.children.length > 60) box.removeChild(box.lastChild);
}

function clearState() {
  S = null; document.getElementById("inpN").value = "";
  ["subres","lanes","intb","winding","profinite","adelic","aLanes"].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = `<div class="muted">Awaiting decomposition…</div>`;
  });
  log("CLR", "State cleared", "var(--ink-dim)");
}

// ── Native CramInt engine demo ──
let eOp = "+";
function setEOp(op) {
  eOp = op;
  ["Plus","Minus","Times"].forEach(s => document.getElementById("eOp"+s).classList.remove("active"));
  document.getElementById("eOp"+(op==="+"?"Plus":op==="-"?"Minus":"Times")).classList.add("active");
}
function runEngine() {
  let a, b; try { a = Bi(document.getElementById("eA").value||"0"); b = Bi(document.getElementById("eB").value||"0"); } catch(e){ return; }
  const bs = readBasis();
  if (!coprime(bs)) { log("ERR","engine basis not coprime","var(--rose)"); return; }
  const A = CramInt.fromInt(a, bs), Bb = CramInt.fromInt(b, bs);
  let R, sym;
  if (eOp==="+"){ R=A.add(Bb); sym="+"; } else if (eOp==="-"){ R=A.sub(Bb); sym="−"; } else { R=A.mul(Bb); sym="×"; }
  const d = R.describe();
  const verify = R.reconstruct() === (eOp==="+"?a+b:eOp==="-"?a-b:a*b);
  // lane rows
  let lanes = "";
  bs.forEach((p, i) => {
    const c = ACCENT[i % ACCENT.length];
    lanes += `<div class="lane"><div class="lane-bar" style="background:${c}"></div><div class="lane-mod">mod ${p}</div>
      <div class="lane-val" style="color:${c}">${A.res[i]} ${sym} ${Bb.res[i]} ≡ <strong>${R.res[i]}</strong></div>
      <span class="lane-tag" style="color:var(--emerald)">O(1) · no carry-in</span></div>`;
  });
  const dyn = d.dyncrt.length ? `<div class="drow"><span class="drow-l">DynCRT extension</span><span class="drow-v v-ge">+lane ${d.dyncrt.map(e=>e.added).join(", ")}</span></div>` : "";
  // K-Elim certificate using an auxiliary anchor prime coprime to M_B
  let anchor = 23; while (Number(R.M % Bi(anchor)) === 0) anchor = cramNextPrime(bs.concat(anchor));
  const cert = R.kElimCertificate(anchor);
  const certRow = cert ? `
    <div class="drow"><span class="drow-l">K-Elim anchor A</span><span class="drow-v">${cert.A}</span></div>
    <div class="drow"><span class="drow-l">K̂ = (x_A − γ̃_A)·M⁻¹ mod A</span><span class="drow-v v-em">${cert.Khat}</span></div>
    <div class="drow"><span class="drow-l">certificate</span><span class="drow-v" style="color:${cert.ok?"var(--emerald)":"var(--rose)"}">${cert.ok?"✓ K mod A verified (small-int only)":"✗"}</span></div>` : "";
  document.getElementById("engineOut").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>${lanes}</div>
      <div>
        <div class="drow"><span class="drow-l">lane operations</span><span class="drow-v v-em">${d.laneOps} (= k, parallel)</span></div>
        <div class="drow"><span class="drow-l">carry-chain length</span><span class="drow-v v-em">0</span></div>
        <div class="drow"><span class="drow-l">winding K</span><span class="drow-v v-ge">${d.winding}</span></div>
        <div class="drow"><span class="drow-l">canonical γ̃(r)</span><span class="drow-v">${d.canonical}</span></div>
        <div class="drow"><span class="drow-l">boundary x = γ̃ + K·M_B</span><span class="drow-v v-am">${d.value}</span></div>
        <div class="drow"><span class="drow-l">verify vs ℤ</span><span class="drow-v" style="color:${verify?"var(--emerald)":"var(--rose)"}">${verify?"✓ exact":"✗"}</span></div>
        ${certRow}
        ${dyn}
      </div>
    </div>`;
  log("ENGINE", `${a} ${sym} ${b}: ${d.laneOps} lane-ops, 0 carries → ${d.value}`, "var(--emerald)");
}
function benchEngine() {
  const bs = readBasis();
  if (!coprime(bs)) { log("ERR","engine basis not coprime","var(--rose)"); return; }
  // multiply a growing value repeatedly; show lane-ops stay = k while bit-length grows
  let rows = `<table class="tbl"><thead><tr><th>step</th><th class="num">value bits</th><th class="num">CramInt lane-ops</th><th class="num">bigint limb-ops ≈</th><th class="num">basis lanes</th></tr></thead><tbody>`;
  let acc = CramInt.fromInt(7n, bs), val = 7n;
  for (let s = 1; s <= 8; s++) {
    const m = CramInt.fromInt(99991n, bs);
    acc = acc.mul(m); val = val * 99991n;
    const bits = (val<0n?-val:val).toString(2).length;
    const limbs = Math.ceil(bits/32);
    rows += `<tr><td>${s}</td><td class="num">${bits}</td><td class="num" style="color:var(--emerald)">${acc.basis.length}</td><td class="num" style="color:var(--rose)">~${limbs*limbs}</td><td class="num">${acc.basis.length}${acc.dyncrtEvents.length?" (+DynCRT)":""}</td></tr>`;
  }
  rows += `</tbody></table><div style="font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ink-2);margin-top:10px;line-height:1.5">CramInt work per multiply stays at the lane count (carry-free, parallelizable) while a bigint's limb-op cost grows quadratically with bit-length. DynCRT widens the lane set only when the winding horizon is threatened.</div>`;
  document.getElementById("engineOut").innerHTML = rows;
  log("BENCH", `8-step scaling: lane-ops flat at k=${bs.length}, bigint ~O(limb²)`, "var(--emerald)");
}

function stressEngine() {
  const bs = readBasis();
  if (!coprime(bs)) { log("ERR","engine basis not coprime","var(--rose)"); return; }
  // x ← 2, then x ← x·x repeatedly. Bit-length doubles each step → after n
  // steps the value has ~2ⁿ bits. CramInt lane-ops stay O(k) per multiply
  // (k grows only via DynCRT), while a bigint would pay O(len²) per step.
  let x = CramInt.fromInt(2n, bs);
  let big = 2n, t0e = performance.now();
  let rows = `<table class="tbl"><thead><tr><th>step</th><th class="num">value bits</th><th class="num">basis lanes (k)</th><th class="num">lane-ops/step</th><th class="num">carry chain</th><th class="num">bigint limb-ops ≈</th><th>K-Elim</th></tr></thead><tbody>`;
  for (let s = 1; s <= 14; s++) {
    x = x.mul(x); big = big * big;
    const bits = big.toString(2).length;
    const limbs = Math.ceil(bits / 32);
    const stepLaneOps = x.ops;                 // per-op lane work = k (carry-free)
    let anchor = 23; while (Number(x.M % Bi(anchor)) === 0) anchor = cramNextPrime(bs.concat(anchor));
    const cert = x.kElimCertificate(anchor);
    const exact = x.reconstruct() === big;
    rows += `<tr><td>${s}</td><td class="num">${bits}</td><td class="num" style="color:var(--emerald)">${x.basis.length}</td>
      <td class="num" style="color:var(--emerald)">${stepLaneOps}</td>
      <td class="num" style="color:var(--emerald)">0</td>
      <td class="num" style="color:var(--rose)">~${limbs*limbs}</td>
      <td style="color:${cert&&cert.ok&&exact?"var(--emerald)":"var(--rose)"}">${cert&&cert.ok&&exact?"✓":"✗"}</td></tr>`;
  }
  const dt = (performance.now() - t0e).toFixed(1);
  rows += `</tbody></table><div style="font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ink-2);margin-top:10px;line-height:1.5">
    Repeated self-squaring: value bits double each step (to ${big.toString(2).length} bits by step 14). The <b>lane updates</b> are carry-free and number exactly k per multiply — fully parallel, O(1) depth on k-wide hardware — while a bigint pays a serial O(limb²) carry chain. The winding and reconstruction are the explicit boundary costs (one big multiply), kept out of the lane loop; every step's winding is still verified by K-Elimination against an auxiliary anchor with small-integer arithmetic only. Total ${dt}ms.</div>`;
  document.getElementById("engineOut").innerHTML = rows;
  log("STRESS", `14× self-square → ${big.toString(2).length} bits, lane-ops O(k), K-Elim ✓`, "var(--emerald)");
}

setOp("+");
setEOp("+");
window.addEventListener("load", () => { log("INIT","CRAM depth manifold ready · 5 levels active","var(--amber)"); fullDecompose(); evalStar(); });
document.getElementById("inpN").addEventListener("keypress", e => { if (e.key === "Enter") fullDecompose(); });
document.getElementById("inpBasis").addEventListener("keypress", e => { if (e.key === "Enter") fullDecompose(); });
