export function selectMeters(meters) {
  const selected = meters.find((item) => item.windowSeconds === 18000 || item.label === '5 часов') ?? meters[0]
  return { selected, other: meters.find((item) => item !== selected) }
}

export function meterTitle(meter, stale = false) {
  return `${meter.label === '5 часов' ? '5ч' : meter.label}: ${stale ? '! ' : ''}${Math.round(100 - meter.usedPercent)}%`
}
