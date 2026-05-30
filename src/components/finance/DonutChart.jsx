const SIZE = 200
const R = 72
const CX = SIZE / 2
const CY = SIZE / 2
const CIRC = 2 * Math.PI * R

export default function DonutChart({ segments, centerLabel, centerSub }) {
  const total = segments.reduce((s, d) => s + d.value, 0)

  let arcs = []
  if (total === 0) {
    arcs = [{ color: '#1e293b', len: CIRC, offset: 0 }]
  } else {
    let offset = 0
    arcs = segments
      .filter(d => d.value > 0)
      .map(d => {
        const len = (d.value / total) * CIRC
        const arc = { ...d, len, offset }
        offset += len
        return arc
      })
  }

  return (
    <div className="relative inline-block">
      <svg width={SIZE} height={SIZE}>
        <g transform={`rotate(-90 ${CX} ${CY})`}>
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth={30}
              strokeDasharray={`${arc.len} ${CIRC - arc.len}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </g>
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-white text-xl font-bold">{centerLabel}</span>
        {centerSub && <span className="text-slate-500 text-xs mt-0.5">{centerSub}</span>}
      </div>
    </div>
  )
}
