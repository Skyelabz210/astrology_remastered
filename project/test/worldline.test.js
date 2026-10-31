import { calculateWorldline, positiveMod } from "../src/astro/worldline.js";

export function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  const birth = 2451545;
  const zero = calculateWorldline(birth, birth, 0, 0);
  t("birth event has zero elapsed coordinate and proper time",
    zero.coordinateSeconds === 0 && zero.properSeconds === 0);
  t("CRAM origin is shell 0 / winding 0 / anchor 0",
    zero.cram.N === 0 && zero.cram.residue === 0 &&
    zero.cram.winding === 0 && zero.cram.signedAnchor === 0);

  const oneShell = calculateWorldline(birth, birth + 36, 29.5, -98.5);
  t("36 elapsed days close one 36-day shell",
    oneShell.cram.N === 36 && oneShell.cram.residue === 0 &&
    oneShell.cram.winding === 1 && oneShell.cram.signedAnchor === 36);
  const twoShells = calculateWorldline(birth, birth + 72, 29.5, -98.5);
  t("72 elapsed days produce signed anchor 35",
    twoShells.cram.residue === 0 && twoShells.cram.winding === 2 &&
    twoShells.cram.signedAnchor === 35);

  t("proper time is less than coordinate time for a positive Earth-surface interval",
    oneShell.properSeconds > 0 && oneShell.properSeconds < oneShell.coordinateSeconds);
  t("GR lag is positive and metric rate is timelike",
    oneShell.lagSeconds > 0 && oneShell.metricRateSquared > 0);
  const pole = calculateWorldline(birth, birth + 1, 90, 0);
  const equator = calculateWorldline(birth, birth + 1, 0, 0);
  t("rotational time-dilation term makes equatorial proper rate lower than polar rate",
    equator.properRate < pole.properRate);

  const before = calculateWorldline(birth, birth - 40, 45, 10);
  t("pre-birth worldline is signed and uses floor-based winding",
    before.coordinateSeconds < 0 && before.properSeconds < 0 &&
    before.cram.N === -40 && before.cram.residue === 32 &&
    before.cram.winding === -2 && before.cram.signedAnchor === 34);
  t("positiveMod handles negative inputs", positiveMod(-1, 37) === 36);
  t("longitude advances with Earth rotation",
    oneShell.longitudeAtTargetRad !== oneShell.longitudeAtBirthRad);

  let badLatitude = false;
  try { calculateWorldline(birth, birth + 1, 91, 0); } catch { badLatitude = true; }
  t("latitude outside geographic range is rejected", badLatitude);
  return rows;
}
