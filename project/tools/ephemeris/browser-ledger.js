// Browser producer boundary. Matches the CLI's geocentric longitude and
// checksum convention; never derives an admitted value from chart/demo floats.
import { eclipticLongitudeOf } from "../../eclipses.js";

export const LEDGER_BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

export async function produceBrowserLedger(Astronomy, {dateISO, lat, lng}) {
  if (!Astronomy) throw new Error("Real ephemeris required for exact-register input.");
  if (!Number.isFinite(lat) || Math.abs(lat)>90 || !Number.isFinite(lng) || Math.abs(lng)>180) throw new Error("Valid birthplace coordinates required.");
  const time = Astronomy.MakeTime(new Date(dateISO));
  const iso = time.date.toISOString();
  return Promise.all(LEDGER_BODIES.map(async body => {
    const lon = eclipticLongitudeOf(Astronomy, body, time);
    if (!Number.isFinite(lon)) throw new Error(`Unavailable ephemeris for ${body}`);
    const longitude_arcsec = String(Math.floor(lon * 3600 + 0.5) % 1296000);
    const payload = `2.1.19|${iso}|${lat}|${lng}|${body}|${longitude_arcsec}`;
    const hash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const checksum = Array.from(new Uint8Array(hash), x=>x.toString(16).padStart(2,"0")).join("");
    return {
      ledger_version:"hcrm-ephemeris-ledger-v1", event_id:`${iso}#${body}`, body, longitude_arcsec,
      source:{kind:"astronomy-engine", name:"2.1.19", checksum},
      certificate:{status:"IMPORTED_INTEGER_LEDGER", notes:"Browser producer: geocentric apparent ecliptic-of-date; nearest integer arcsecond. Arithmetic is exact after quantization."},
      meta:{jd_tt:2451545+time.tt, delta_t_seconds:(time.tt-time.ut)*86400},
    };
  }));
}
