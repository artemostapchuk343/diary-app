export default function NatureBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* Atmospheric glow — subtle green warmth from corners */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(ellipse 65% 55% at 0% 100%, rgba(20,83,45,0.22) 0%, transparent 70%)',
          'radial-gradient(ellipse 50% 45% at 100% 0%, rgba(20,83,45,0.15) 0%, transparent 70%)',
        ].join(', '),
      }} />

      {/* Bottom-left botanical cluster */}
      <svg
        viewBox="0 0 280 385"
        className="absolute bottom-0 left-0 w-56 md:w-72"
        style={{ opacity: 0.09 }}
        fill="#4ade80"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Stem */}
        <path
          d="M 68 385 Q 90 318, 114 252 Q 140 200, 170 165"
          fill="none" stroke="#4ade80" strokeWidth="3.5" strokeLinecap="round"
        />
        {/* Large leaf leaning left */}
        <path d="M 55 378 C 14 342, -22 272, 7 194 C 48 252, 74 322, 55 378 Z" />
        {/* Main upright leaf */}
        <path d="M 78 372 C 54 308, 66 238, 112 160 C 146 228, 138 308, 78 372 Z" />
        {/* Sweeping right leaf */}
        <path d="M 118 322 C 152 280, 190 244, 200 188 C 162 224, 126 270, 118 322 Z" />
        {/* Medium accent leaf */}
        <path d="M 148 264 C 180 228, 204 196, 208 153 C 170 178, 148 218, 148 264 Z" />
        {/* Small tip leaf */}
        <path d="M 168 204 C 194 176, 214 150, 212 116 C 178 140, 158 172, 168 204 Z" />
        {/* Ground leaves */}
        <path d="M 0 378 C 18 354, 50 344, 74 358 C 52 370, 22 375, 0 378 Z" />
        <path d="M 94 374 C 114 352, 148 344, 166 358 C 144 368, 116 372, 94 374 Z" />
        {/* Small berries */}
        <circle cx="188" cy="148" r="4" />
        <circle cx="208" cy="120" r="3" />
        <circle cx="176" cy="128" r="3.5" />
      </svg>

      {/* Top-right botanical cluster */}
      <svg
        viewBox="0 0 242 305"
        className="absolute top-0 right-0 w-44 md:w-56"
        style={{ opacity: 0.06 }}
        fill="#4ade80"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Branch */}
        <path
          d="M 242 4 Q 220 28, 202 62 Q 184 98, 176 138 Q 166 174, 158 212"
          fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round"
        />
        {/* Large right-hanging leaf */}
        <path d="M 242 0 C 252 42, 242 90, 214 126 C 200 98, 214 50, 242 0 Z" />
        {/* Central hanging leaf */}
        <path d="M 242 14 C 220 50, 206 94, 210 138 C 192 112, 192 64, 242 14 Z" />
        {/* Left-hanging leaf */}
        <path d="M 220 0 C 198 32, 184 72, 190 116 C 172 90, 174 48, 220 0 Z" />
        {/* Lower cluster */}
        <path d="M 200 94 C 178 126, 166 166, 178 204 C 198 178, 206 138, 200 94 Z" />
        <path d="M 182 134 C 160 166, 150 206, 160 242 C 178 218, 186 176, 182 134 Z" />
        <path d="M 166 174 C 144 206, 134 246, 144 280 C 162 256, 170 214, 166 174 Z" />
      </svg>

    </div>
  )
}
