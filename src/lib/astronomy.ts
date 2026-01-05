export function raDecToCartesian(
  raDeg: number,
  decDeg: number,
  radius: number,
): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const cosDec = Math.cos(dec);
  const x = radius * cosDec * Math.cos(ra);
  const z = radius * cosDec * Math.sin(ra);
  const y = radius * Math.sin(dec);
  return [x, y, z];
}

export function distanceToSceneUnits(distanceLy: number) {
  const safe = Math.max(distanceLy, 0.1);
  return Math.max(4, Math.log10(safe + 1) * 8);
}

export function formatRa(raDeg: number) {
  const totalHours = raDeg / 15;
  const hours = Math.floor(totalHours);
  const minutes = Math.floor((totalHours - hours) * 60);
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

export function formatDec(decDeg: number) {
  const sign = decDeg >= 0 ? "+" : "-";
  const abs = Math.abs(decDeg);
  const degrees = Math.floor(abs);
  const minutes = Math.floor((abs - degrees) * 60);
  return `${sign}${String(degrees).padStart(2, "0")}deg ${String(minutes).padStart(2, "0")}'`;
}

export function formatDistance(distanceLy: number) {
  if (distanceLy >= 1_000_000) {
    return `${(distanceLy / 1_000_000).toFixed(2)} Mly`;
  }
  if (distanceLy >= 1_000) {
    return `${(distanceLy / 1_000).toFixed(1)} kly`;
  }
  return `${distanceLy.toFixed(1)} ly`;
}
