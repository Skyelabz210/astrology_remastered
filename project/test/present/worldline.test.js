// test/present/worldline.test.js — natal worldline / CRAM / GR model boundaries.
import { buildNatalWorldline } from "../../src/astro/worldline.js";

const BIRTH = "2000-01-01T00:00:00Z";
const place = { latitudeDeg: 35.1408, longitudeDeg: -79.0058 };

export function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });

  const atDays = (days, extra = {}) => buildNatalWorldline({
    birthISO: BIRTH,
    targetISO: new Date(Date.parse(BIRTH) + days * 86400000).toISOString(),
    ...place,
    ...extra,
  });

  const birth = atDays(0);
  t("birth instant starts at N=0, r=0, K=0, v37=0",
    birth.cram.N === "0" && birth.cram.r === "0" && birth.cram.K === "0" && birth.cram.vA === "0",
    JSON.stringify(birth.cram));

  t("worldline rotation trace is zeroed at the natal-meridian origin",
    birth.geometry.rotationAngleRad === 0,
    String(birth.geometry.rotationAngleRad));

  const shell = atDays(36);
  t("first completed shell increments K and signs anchor downward",
    shell.cram.N === "36" && shell.cram.r === "0" && shell.cram.K === "1" && shell.cram.vA === "36",
    JSON.stringify(shell.cram));

  const secondShell = atDays(72);
  t("second closed shell continues signed v37 sequence 36, 35",
    secondShell.cram.r === "0" && secondShell.cram.K === "2" && secondShell.cram.vA === "35",
    JSON.stringify(secondShell.cram));

  const nextDay = atDays(37);
  t("one tick after first shell advances phase while retaining K",
    nextDay.cram.r === "1" && nextDay.cram.K === "1" && nextDay.cram.vA === "0",
    JSON.stringify(nextDay.cram));

  const preBirth = buildNatalWorldline({
    birthISO: BIRTH,
    targetISO: "1999-12-31T00:00:00Z",
    ...place,
  });
  t("negative elapsed day uses mathematical floor decomposition",
    preBirth.cram.N === "-1" && preBirth.cram.r === "35" && preBirth.cram.K === "-1",
    JSON.stringify(preBirth.cram));

  t("shell and anchor are coprime",
    (() => { let a = 36, b = 37; while (b) [a, b] = [b, a % b]; return a === 1; })());

  t("GR clock rate is finite and below coordinate-time rate at Earth's surface",
    Number.isFinite(shell.relativity.properTimeRate) &&
    shell.relativity.properTimeRate > 0 &&
    shell.relativity.properTimeRate < 1,
    String(shell.relativity.properTimeRate));

  t("positive interval accumulates less proper time than coordinate time",
    shell.relativity.properSeconds > 0 &&
    shell.relativity.properSeconds < shell.relativity.coordinateSeconds,
    String(shell.relativity.clockOffsetSeconds));

  const elevated = atDays(36, { altitudeM: 1000 });
  t("higher altitude has a larger idealized proper-time rate",
    elevated.relativity.properTimeRate > shell.relativity.properTimeRate,
    elevated.relativity.properTimeRate + " vs " + shell.relativity.properTimeRate);

  const polar = atDays(36, { latitudeDeg: 90, longitudeDeg: 0 });
  t("polar reference point has zero Earth-rotation tangential speed",
    Math.abs(polar.relativity.localTangentialSpeedMS) < 1e-9,
    String(polar.relativity.localTangentialSpeedMS));

  t("worldline result keeps chart coordinates and model assumptions explicit",
    shell.schema === "NATAL_WORLDLINE_V1" &&
    shell.input.altitudeSource === "assumed sea level" &&
    shell.interval.timeScale.includes("leap seconds omitted") &&
    shell.relativity.model.includes("Schwarzschild"),
    shell.frame);

  let rejectedNoOffset = false;
  try {
    buildNatalWorldline({ birthISO: "2000-01-01T00:00:00", targetISO: "2000-01-02T00:00:00Z", ...place });
  } catch { rejectedNoOffset = true; }
  t("ambiguous local timestamps without explicit offsets are rejected", rejectedNoOffset);

  let rejectedLatitude = false;
  try {
    buildNatalWorldline({ birthISO: BIRTH, targetISO: BIRTH, ...place, latitudeDeg: 91 });
  } catch { rejectedLatitude = true; }
  t("invalid geographic coordinates are rejected", rejectedLatitude);

  return rows;
}
