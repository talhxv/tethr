// Recolours the white/grey isometric layer art (talentcardone.svg,
// midlayer.svg, imported ?raw) into the site blue for light backgrounds.
export function toBlue(svgRaw) {
  return svgRaw
    .replace(/rgba\(255,255,255,([^)]+)\)/g, (_, a) => `rgba(7,85,233,${a})`)
    .replace(/fill="white"/g,   'fill="#0755E9"')
    .replace(/stroke="white"/g, 'stroke="#0755E9"')
    .replace(/fill="#D9D9D9"/g, 'fill="rgba(7,85,233,0.10)"')
    .replace(/fill="#515050"/g, 'fill="rgba(7,85,233,0.18)"')
    .replace(/stroke="black"/g, 'stroke="rgba(7,85,233,0.5)"')
    .replace(/fill="black"/g,   'fill="#0755E9"')
}
