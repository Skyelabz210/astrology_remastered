import assert from "node:assert/strict";
import * as Astronomy from "astronomy-engine";
import { produceBrowserLedger } from "../../tools/ephemeris/browser-ledger.js";
import { produceLedgerEntries } from "../../tools/ephemeris/produce-ledger.mjs";
import { buildDiagnostics, buildTimeBasis, eclipseReading, realEclipsePoints } from "../../src/present/enhanced-reading.js";

export async function run() {
  const rows = [];
  const test = async (name, fn) => { try { await fn(); rows.push({name, ok:true}); } catch(e) { rows.push({name, ok:false, detail:e.message}); } };
  const birth = { dateISO:"1980-10-21T21:31:00Z", lat:35.14, lng:-79.0, houseSystem:"whole" };
  const chart = { birth, planets:[], asc:120, mc:30, ascSignIdx:4, houseSystemActual:"whole" };
  let entries;
  await test("browser producer matches CLI longitudes and checksums", async () => {
    entries = await produceBrowserLedger(Astronomy, birth);
    const expected = produceLedgerEntries({time:birth.dateISO, lat:birth.lat, lng:birth.lng});
    assert.equal(entries.length, expected.length);
    entries.forEach((e,i) => { assert.equal(e.longitude_arcsec, expected[i].longitude_arcsec); assert.equal(e.source.checksum, expected[i].source.checksum); });
  });
  await test("engine absence fails closed", async () => { await assert.rejects(produceBrowserLedger(null,birth)); });
  await test("admitted diagnostics preserve two axes and decimal strings", () => {
    const d = buildDiagnostics(entries, birth.dateISO);
    assert.equal(d.status,"ready");
    assert.equal(d.divisions.find(x=>x.divisor==="3").closure.closes,true);
    assert.equal(d.divisions.find(x=>x.divisor==="3").shadow.q,"3");
    assert.equal(d.divisions.find(x=>x.divisor==="13").closure.closes,false);
    assert.equal(d.divisions.find(x=>x.divisor==="13").shadow.q,"0");
    assert.doesNotThrow(()=>JSON.stringify(d));
    assert.equal(typeof d.registers[0].register.shell.K,"string");
  });
  await test("synthetic, malformed and wrong-epoch entries rejected atomically", () => {
    for (const bad of [ {...entries[0],certificate:{status:"SYNTHETIC_DEMO",notes:"demo"}}, {...entries[0],longitude_arcsec:"1.5"}, {...entries[0],event_id:"2000-01-01T00:00:00.000Z#Sun"} ]) {
      assert.throws(()=>buildDiagnostics([...entries,bad],birth.dateISO));
    }
  });
  await test("time basis uses actual house system and suppresses uncertain orientation", () => {
    const b = buildTimeBasis(chart);
    assert.ok(b.gmstDeg>=0 && b.gmstDeg<360);
    assert.ok(b.localSiderealDeg>=0 && b.localSiderealDeg<360);
    assert.equal(b.houseSystem,"whole");
    assert.equal(buildTimeBasis({...chart,timeUnknown:true}).localSiderealDeg,null);
  });
  await test("eclipse reading names actual contacts with orb and house", () => {
    const e = {type:"solar",lon:145,contacts:[{name:"Venus",aspect:"conjunction",orb:0.4}]};
    const t = eclipseReading(e,chart);
    assert.match(t,/Venus/); assert.match(t,/0.40/); assert.match(t,/house 1/);
    assert.doesNotMatch(eclipseReading(e,{...chart,timeUnknown:true}),/house/);
  });
  await test("eclipse targets are computed from engine and omit unsupported bodies", () => {
    const points = realEclipsePoints(Astronomy,{...chart,planets:[{name:"Sun",lon:0},{name:"Chiron",lon:1}]});
    assert.equal(points.length,3); assert.notEqual(points[0].lon,0);
    assert.equal(realEclipsePoints(Astronomy,{...chart,timeUnknown:true,planets:[{name:"Sun"}]}).length,1);
  });
  return rows;
}
