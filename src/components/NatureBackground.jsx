// Leaf paths in local coords — tip points up, base at origin
const L  = 'M0 0 C14 -24,14 -50,0 -74 C-14 -50,-14 -24,0 0Z'
const M  = 'M0 0 C10 -17,10 -34,0 -52 C-10 -34,-10 -17,0 0Z'
const S  = 'M0 0 C7 -12,7 -24,0 -36 C-7 -24,-7 -12,0 0Z'
const XS = 'M0 0 C4 -7,4 -13,0 -20 C-4 -13,-4 -7,0 0Z'

function Leaf({ d, x, y, angle, scale = 1 }) {
  return (
    <path
      d={d}
      transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}
    />
  )
}

export default function NatureBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* Atmospheric corner glows */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(ellipse 65% 50% at 0% 100%, rgba(34,120,70,0.18) 0%, transparent 65%)',
          'radial-gradient(ellipse 50% 44% at 100% 0%, rgba(34,120,70,0.13) 0%, transparent 65%)',
          'radial-gradient(ellipse 35% 30% at 100% 100%, rgba(22,90,50,0.08) 0%, transparent 60%)',
          'radial-gradient(ellipse 28% 25% at 0% 0%, rgba(22,90,50,0.06) 0%, transparent 55%)',
        ].join(', '),
      }} />

      {/* ── Bottom-left — main cluster ── */}
      <svg viewBox="0 0 320 420" className="absolute bottom-0 left-0 w-60 md:w-76"
        style={{ opacity: 0.15 }} fill="#86efac" xmlns="http://www.w3.org/2000/svg">

        {/* Main stem */}
        <path d="M 18 420 C 38 360,62 290,82 225 C 94 190,104 165,112 142"
          fill="none" stroke="#86efac" strokeWidth="2.8" strokeLinecap="round" />

        {/* Secondary branch right from mid-stem */}
        <path d="M 78 238 C 105 215,132 198,158 182 C 174 172,185 165,192 158"
          fill="none" stroke="#86efac" strokeWidth="1.6" strokeLinecap="round" />

        {/* Tertiary branch left */}
        <path d="M 56 310 C 38 282,24 252,28 222"
          fill="none" stroke="#86efac" strokeWidth="1.2" strokeLinecap="round" />

        {/* Main branch leaves — alternating L and R of stem */}
        <Leaf d={L}  x={52}  y={382} angle={-62} />
        <Leaf d={L}  x={68}  y={360} angle={72} />
        <Leaf d={L}  x={62}  y={330} angle={-66} />
        <Leaf d={M}  x={76}  y={305} angle={70} />
        <Leaf d={M}  x={72}  y={278} angle={-68} />
        <Leaf d={M}  x={82}  y={255} angle={68} />
        <Leaf d={M}  x={78}  y={232} angle={-65} />
        <Leaf d={S}  x={90}  y={210} angle={65} />
        <Leaf d={S}  x={88}  y={192} angle={-63} />
        <Leaf d={S}  x={100} y={175} angle={62} />
        <Leaf d={XS} x={106} y={158} angle={-58} />
        <Leaf d={XS} x={112} y={144} angle={58} />

        {/* Secondary branch leaves */}
        <Leaf d={M}  x={102} y={228} angle={-48} />
        <Leaf d={M}  x={122} y={214} angle={-42} />
        <Leaf d={S}  x={144} y={200} angle={-38} />
        <Leaf d={S}  x={162} y={188} angle={-35} />
        <Leaf d={XS} x={180} y={175} angle={-32} />
        <Leaf d={XS} x={194} y={163} angle={-28} />

        {/* Left tertiary branch leaves */}
        <Leaf d={S}  x={50}  y={302} angle={-105} />
        <Leaf d={S}  x={38}  y={278} angle={-110} />
        <Leaf d={XS} x={30}  y={252} angle={-108} />

        {/* Ground-level leaves fanning out */}
        <Leaf d={M}  x={8}   y={418} angle={-88} scale={0.9} />
        <Leaf d={M}  x={48}  y={420} angle={-82} scale={0.9} />
        <Leaf d={S}  x={88}  y={418} angle={-78} scale={0.9} />
        <Leaf d={S}  x={124} y={416} angle={-74} scale={0.85} />
        <Leaf d={XS} x={158} y={414} angle={-72} scale={0.85} />
        <Leaf d={XS} x={188} y={412} angle={-70} />

        {/* Berry accent dots */}
        <circle cx={118} cy={136} r="4" />
        <circle cx={107} cy={126} r="3" />
        <circle cx={128} cy={128} r="2.5" />
        <circle cx={198} cy={154} r="3.5" />
        <circle cx={188} cy={145} r="2.5" />
      </svg>

      {/* ── Top-right — hanging cluster ── */}
      <svg viewBox="0 0 280 340" className="absolute top-0 right-0 w-48 md:w-64"
        style={{ opacity: 0.12 }} fill="#86efac" xmlns="http://www.w3.org/2000/svg">

        {/* Main descending stem */}
        <path d="M 270 0 C 252 40,232 85,212 130 C 198 162,184 192,172 222"
          fill="none" stroke="#86efac" strokeWidth="2.2" strokeLinecap="round" />

        {/* Side branch right */}
        <path d="M 238 72 C 255 95,268 124,265 155"
          fill="none" stroke="#86efac" strokeWidth="1.4" strokeLinecap="round" />

        {/* Side branch left-down */}
        <path d="M 200 145 C 185 170,175 198,174 225"
          fill="none" stroke="#86efac" strokeWidth="1.2" strokeLinecap="round" />

        {/* Hanging leaves along main stem — drooping down */}
        <Leaf d={L}  x={258} y={18}  angle={155} />
        <Leaf d={L}  x={245} y={10}  angle={-150} />
        <Leaf d={L}  x={238} y={40}  angle={158} />
        <Leaf d={M}  x={226} y={30}  angle={-155} />
        <Leaf d={M}  x={220} y={65}  angle={160} />
        <Leaf d={M}  x={210} y={55}  angle={-158} />
        <Leaf d={M}  x={205} y={95}  angle={162} />
        <Leaf d={S}  x={196} y={85}  angle={-160} />
        <Leaf d={S}  x={196} y={120} angle={163} />
        <Leaf d={S}  x={188} y={112} angle={-162} />
        <Leaf d={S}  x={182} y={148} angle={165} />
        <Leaf d={XS} x={176} y={140} angle={-164} />
        <Leaf d={XS} x={176} y={172} angle={165} />
        <Leaf d={XS} x={170} y={164} angle={-165} />

        {/* Right side branch leaves */}
        <Leaf d={S}  x={248} y={88}  angle={125} />
        <Leaf d={S}  x={262} y={118} angle={120} />
        <Leaf d={XS} x={266} y={148} angle={118} />

        {/* Berry accent */}
        <circle cx={268} cy={0}  r="4" />
        <circle cx={278} cy={8}  r="3" />
        <circle cx={260} cy={4}  r="2.5" />
      </svg>

      {/* ── Top-left — faint accent ── */}
      <svg viewBox="0 0 160 180" className="absolute top-0 left-0 w-28 md:w-40"
        style={{ opacity: 0.055 }} fill="#86efac" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0 0 C 18 20,28 55,18 88 C 4 62,-4 28,0 0Z" />
        <path d="M 22 0 C 40 22,50 58,40 92 C 24 66,14 30,22 0Z" />
        <path d="M 48 0 C 64 24,72 60,60 94 C 44 68,34 32,48 0Z" />
        <path d="M 74 0 C 88 26,94 62,80 96 C 64 70,56 34,74 0Z" />
        <path d="M 100 0 C 112 28,116 64,100 96 C 85 70,78 34,100 0Z" />
        <path d="M 126 0 C 136 30,138 65,122 96 C 108 70,102 35,126 0Z" />
        <path d="M 150 0 C 158 32,158 66,142 96 C 130 70,124 36,150 0Z" />
      </svg>

      {/* ── Bottom-right — faint accent ── */}
      <svg viewBox="0 0 200 160" className="absolute bottom-0 right-0 w-36 md:w-48"
        style={{ opacity: 0.06 }} fill="#86efac" xmlns="http://www.w3.org/2000/svg">
        <path d="M 200 160 C 170 140,150 108,164 76 C 186 102,200 134,200 160Z" />
        <path d="M 200 136 C 172 118,154 86,168 54 C 190 80,202 112,200 136Z" />
        <path d="M 200 112 C 174 96,158 66,172 36 C 192 60,204 90,200 112Z" />
        <path d="M 200 88 C 176 74,162 46,175 18 C 194 40,205 68,200 88Z" />
        <path d="M 178 158 C 150 138,132 108,146 76 C 167 102,180 132,178 158Z" />
        <path d="M 156 154 C 130 135,114 106,128 74 C 148 100,160 130,156 154Z" />
        <path d="M 134 150 C 110 132,96 104,110 72 C 129 98,140 128,134 150Z" />
        {/* Stem */}
        <path d="M 200 160 Q 176 132,158 102 Q 140 72,138 44"
          fill="none" stroke="#86efac" strokeWidth="1.8" strokeLinecap="round" />
      </svg>

    </div>
  )
}
