import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as enhanced from "../../src/present/enhanced-reading.js";

export function run() {
  const rows=[];
  const test=(name,fn)=>{try {fn();rows.push({name,ok:true});}catch(e){rows.push({name,ok:false,detail:e.message});}};
  const chart={birth:{dateISO:"2000-01-01T12:00:00Z",lat:29,lng:-98,houseSystem:"whole"},houseSystemActual:"whole"};
  const src=readFileSync(new URL("../../enhanced-reading-view.jsx",import.meta.url),"utf8");
  function render(result=null,activeChart=chart) {
    let call=0;
    const stub={...React,useState:()=>[call++===0 ? true : result,()=>{}],useEffect:()=>{}};
    const ctx={React:stub,window:{EnhancedReading:enhanced}};
    vm.runInNewContext(transformSync(src,{loader:"jsx"}).code,ctx);
    return renderToStaticMarkup(React.createElement(ctx.window.EnhancedReadingPanel,{chart:activeChart}));
  }
  test("advanced panel renders time units and labeled disclosure controls",()=>{
    const html=render(); assert.match(html,/Time Basis/);assert.match(html,/seconds/);assert.match(html,/Preparing real ephemeris/);
  });
  test("stale chart results never render",()=>{
    const html=render({chart:{...chart},error:"stale result"});
    assert.doesNotMatch(html,/stale result/);assert.match(html,/Preparing real ephemeris/);
  });
  test("admission failures render a recoverable message",()=>{
    assert.match(render({chart,error:"Real ephemeris required"}),/Diagnostics unavailable: Real ephemeris required/);
  });
  test("real admitted registers render as accessible table data",()=>{
    const entry={ledger_version:"hcrm-ephemeris-ledger-v1",event_id:"2000-01-01T12:00:00.000Z#Sun",body:"Sun",longitude_arcsec:"30030",source:{kind:"fixture",name:"fixture",checksum:"fixture"},certificate:{status:"IMPORTED_INTEGER_LEDGER",notes:"test"}};
    const data=enhanced.buildDiagnostics([entry],chart.birth.dateISO);
    const html=render({chart,data});
    assert.match(html,/Sun residue lanes/);assert.match(html,/Thirteen-fold/);assert.match(html,/Off-ring/);assert.match(html,/Signed winding/);
  });
  test("eclipse narrative preserves segment offsets",()=>{
    const ctx={window:{}};
    vm.runInNewContext(readFileSync(new URL("../../narrative.jsx",import.meta.url),"utf8"),ctx);
    const n=ctx.window.buildChartNarrative({cards:[],birth:{}},{eclipseText:"Prenatal solar eclipse contacts Venus."});
    const seg=n.segments.find(s=>s.kind==="eclipses");
    assert.ok(seg);assert.equal(n.text.slice(seg.start,seg.end),seg.text);assert.equal(seg.cardIdx,null);
  });
  return rows;
}
