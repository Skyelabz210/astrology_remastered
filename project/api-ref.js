// api-ref.js — renders the live API reference from a spec table.
// Each endpoint has a runnable default call evaluated against window.CRAM.

const SPEC = [
  { ns: "CRAM", title: "Root", sub: "namespace · capability probe", eps: [
    { sig: "CRAM.version", ret: "string", desc: "Semver of the API surface.", code: "CRAM.version" },
    { sig: "CRAM.capabilities()", ret: "object", desc: "What's wired in this page (number core always; hcrm/astro need their .jsx).", code: "CRAM.capabilities()" },
    { sig: "CRAM.config", ret: "object", desc: "Global tunables — default basis, shell, gear anchors, aux anchor, DynCRT toggle. Mutate to change every subsequent call.", code: "CRAM.config" },
  ]},
  { ns: "CRAM.number", title: "Number", sub: "residue-native integers (CramInt)", eps: [
    { sig: "number.of(value, basis?)", ar: "int|string, int[]", ret: "CramInt", desc: "Construct a residue-native integer. Basis defaults to SafeS8.", code: "CRAM.number.describe(CRAM.number.of(35113))" },
    { sig: "number.add(a, b)", ar: "any, any", ret: "CramInt", desc: "Carry-free lane-wise addition; operands coerced.", code: "CRAM.number.toString(CRAM.number.add(35113, 35113))" },
    { sig: "number.mul(a, b)", ar: "any, any", ret: "CramInt", desc: "Lane-wise multiply; winding via one boundary multiply.", code: "CRAM.number.toString(CRAM.number.mul(99991, 99991))" },
    { sig: "number.divExact(a, d, anchor?)", ar: "any, int, int", ret: "CramInt|null", desc: "Exact division via K-elimination. The divisor must be coprime to the basis (not itself a basis prime) and divide exactly, else null. 35113 = 13×37×73.", code: "CRAM.number.toString(CRAM.number.divExact(35113, 37))" },
    { sig: "number.cmp(a, b)", ar: "any, any", ret: "-1|0|1", desc: "Winding-first comparison, no reconstruction.", code: "CRAM.number.cmp(35113, 70226)" },
    { sig: "number.describe(a)", ar: "any", ret: "object", desc: "Full state: basis, residues, winding, canonical, value, lane-ops, DynCRT events.", code: "CRAM.number.describe(CRAM.number.mul(CRAM.number.of(2), CRAM.number.of(2)))" },
    { sig: "number.extend(a, p)", ar: "any, prime", ret: "CramInt", desc: "Manually widen the basis with a coprime prime (DynCRT).", code: "CRAM.number.describe(CRAM.number.extend(CRAM.number.of(35113), 23)).basis" },
  ]},
  { ns: "CRAM.crt", title: "CRT & K-Elimination", sub: "reconstruction · winding recovery", eps: [
    { sig: "crt.residues(N, basis?)", ar: "int, int[]", ret: "int[]", desc: "Residue tray of N over the basis.", code: "CRAM.crt.residues(35113)" },
    { sig: "crt.winding(N, basis?)", ar: "int, int[]", ret: "string", desc: "Winding K = ⌊N/M_B⌋.", code: "CRAM.crt.winding(35113, [36,37])" },
    { sig: "crt.reconstruct(res, basis?)", ar: "int[], int[]", ret: "string", desc: "Canonical γ̃ from a residue tray.", code: "CRAM.crt.reconstruct([13,0],[36,37])" },
    { sig: "crt.kElim(γ̃modM, aRes, M, A)", ar: "int,int,int,int", ret: "int", desc: "Recover K mod A from canonical + anchor residue.", code: "CRAM.crt.kElim(481%37, 35113%37, 1332, 37)" },
    { sig: "crt.star(n)", ar: "int", ret: "string", desc: "Star number f⋆(n) = 6n(n−1)+1.", code: "CRAM.crt.star(77)" },
    { sig: "crt.starIndex(N)", ar: "int", ret: "int|null", desc: "Inverse: index k if N is a star number, else null.", code: "CRAM.crt.starIndex(35113)" },
  ]},
  { ns: "CRAM.basis", title: "Basis", sub: "presets · validation · DynCRT", eps: [
    { sig: "basis.presets", ret: "object", desc: "Named bases: dresden, safe4, safe6, safe8, star73, full.", code: "Object.keys(CRAM.basis.presets)" },
    { sig: "basis.get(name)", ar: "string", ret: "int[]", desc: "Fetch a preset basis array.", code: "CRAM.basis.get('safe8')" },
    { sig: "basis.coprime(arr)", ar: "int[]", ret: "bool", desc: "Pairwise-coprime check.", code: "CRAM.basis.coprime([36,37])" },
    { sig: "basis.product(arr)", ar: "int[]", ret: "string", desc: "Tray period M_B = ∏ basis.", code: "CRAM.basis.product([2,3,5,7,11,13,17,19])" },
    { sig: "basis.nextCoprime(arr)", ar: "int[]", ret: "int", desc: "Next prime coprime to all lanes (DynCRT pick).", code: "CRAM.basis.nextCoprime([2,3,5,7,11,13,17,19])" },
    { sig: "basis.capacityBits(arr)", ar: "int[]", ret: "number", desc: "log₂(M_B) — addressable bits.", code: "CRAM.basis.capacityBits(CRAM.basis.get('safe8')).toFixed(2)" },
  ]},
  { ns: "CRAM.hcrm", title: "HCRM", sub: "register-map computation · needs hcrm.jsx", eps: [
    { sig: "hcrm.available()", ret: "bool", desc: "Is the register-map engine loaded?", code: "CRAM.hcrm.available()" },
    { sig: "hcrm.gearClass(r17, r19)", ar: "int, int", ret: "string|null", desc: "G-zero / G-pre / G-low classification of a gear pair.", code: "CRAM.hcrm.gearClass(0,0)" },
    { sig: "hcrm.kElimWinding(arcsec)", ar: "int", ret: "object", desc: "Winding recovery for an ecliptic arcsecond address (shell M6, gear anchors).", code: "CRAM.hcrm.kElimWinding(381234).recovered" },
    { sig: "hcrm.basis()", ret: "int[]", desc: "The 8-prime HCRM basis.", code: "CRAM.hcrm.basis()" },
    { sig: "hcrm.fromChart(chart)", ar: "FullChart", ret: "object", desc: "Full register map: rows, edges, counts, signature, clusters. Pass a CRAM.astro.compute() result.", code: "CRAM.hcrm.fromChart(CRAM.astro.compute({dateISO:'1980-10-21T17:31:00-04:00',lat:35.14,lng:-79.01,houseSystem:'whole',sect:'auto'})).counts" },
  ]},
  { ns: "CRAM.astro", title: "Astro", sub: "natal chart · needs astro.jsx", eps: [
    { sig: "astro.available()", ret: "bool", desc: "Is the chart engine loaded?", code: "CRAM.astro.available()" },
    { sig: "astro.compute(birth)", ar: "{dateISO,lat,lng,houseSystem,sect}", ret: "FullChart", desc: "Full natal chart — planets, houses, dignities, aspects, phase, shape, lots.", code: "CRAM.astro.compute({dateISO:'1980-10-21T17:31:00-04:00',lat:35.14,lng:-79.01,houseSystem:'whole',sect:'auto'}).planets.map(p=>p.name+' '+p.lon.toFixed(2))" },
    { sig: "astro.longitude(planet, jd)", ar: "string, number", ret: "number", desc: "Ecliptic longitude at a Julian day.", code: "CRAM.astro.longitude('Mars', 2444534).toFixed(3)" },
    { sig: "astro.ascendant(date, lat, lng)", ar: "Date, num, num", ret: "number", desc: "Ascendant degree.", code: "CRAM.astro.ascendant(new Date('1980-10-21T17:31:00-04:00'),35.14,-79.01).toFixed(2)" },
    { sig: "astro.aspect(deltaDeg)", ar: "number", ret: "object|null", desc: "Nearest aspect for a separation.", code: "CRAM.astro.aspect(118.5)" },
    { sig: "astro.zodiac()", ret: "object[]", desc: "The 12 signs with element/modality/ruler.", code: "CRAM.astro.zodiac().map(s=>s.name)" },
  ]},
];

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

function fmt(v) {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "object") {
    try { return JSON.stringify(v, (k, val) => typeof val === "bigint" ? val.toString() : val, 1).replace(/\n\s*/g, " ").slice(0, 600); }
    catch (e) { return String(v); }
  }
  return String(v);
}

function render() {
  document.getElementById("ver").textContent = (window.CRAM && CRAM.version) || "—";
  // capabilities
  const caps = (window.CRAM && CRAM.capabilities()) || {};
  const capBox = document.getElementById("caps");
  [["number","number core"],["crt","crt"],["basis","basis"],["hcrm","hcrm"],["astro","astro"]].forEach(([k,label]) => {
    capBox.appendChild(el("span", `cap ${caps[k]?"on":"off"}`, `${label} ${caps[k]?"✓":"—"}`));
  });

  const nav = document.getElementById("nav"), groups = document.getElementById("groups");
  SPEC.forEach((g, gi) => {
    const id = "g" + gi;
    nav.appendChild(Object.assign(el("a", "ns", g.title), { href: "#" + id }));
    const grp = el("div", "grp"); grp.id = id;
    grp.appendChild(el("div", "grp-h", g.title));
    grp.appendChild(el("div", "grp-ns", g.ns));
    g.eps.forEach((ep) => {
      const box = el("div", "ep");
      const sig = el("div", "ep-sig");
      const m = ep.sig.match(/^([\w.]+)(\(.*\))?$/);
      sig.innerHTML = `<span class="fn">${ep.sig.split("(")[0]}</span>${ep.sig.includes("(") ? `<span class="ar">(${ep.ar||""})</span>` : ""}<span class="rt">→ ${ep.ret}</span>`;
      box.appendChild(sig);
      box.appendChild(el("div", "ep-desc", ep.desc));
      const tryBox = el("div", "ep-try");
      const ta = el("textarea", "ep-code"); ta.value = ep.code; ta.rows = ep.code.length > 70 ? 2 : 1;
      tryBox.appendChild(ta);
      const runRow = el("div", "ep-run");
      const btn = el("button", "ep-btn", "Run");
      const out = el("span", "ep-out", "—");
      btn.onclick = () => {
        try { const r = eval(ta.value); out.className = "ep-out"; out.textContent = fmt(r); }
        catch (e) { out.className = "ep-out err"; out.textContent = "✗ " + e.message; }
      };
      runRow.appendChild(btn); runRow.appendChild(out);
      tryBox.appendChild(runRow);
      box.appendChild(tryBox);
      grp.appendChild(box);
    });
    groups.appendChild(grp);
  });
}

// wait for CRAM + Babel-transpiled globals
(function boot(tries) {
  if (window.CRAM && (tries > 8 || typeof computeNatal !== "undefined")) return render();
  if (tries > 40) return render();
  setTimeout(() => boot((tries || 0) + 1), 120);
})(0);
