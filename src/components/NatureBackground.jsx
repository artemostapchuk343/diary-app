export default function NatureBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden" style={{ zIndex: 0 }}>

      {/* Atmospheric corner glows */}
      <div className="absolute inset-0" style={{
        background: [
          'radial-gradient(ellipse 70% 55% at 0% 100%, rgba(22,101,52,0.24) 0%, transparent 68%)',
          'radial-gradient(ellipse 55% 48% at 100% 0%, rgba(22,101,52,0.18) 0%, transparent 68%)',
          'radial-gradient(ellipse 40% 35% at 100% 100%, rgba(20,83,45,0.10) 0%, transparent 65%)',
          'radial-gradient(ellipse 30% 28% at 0% 0%, rgba(20,83,45,0.08) 0%, transparent 60%)',
        ].join(', '),
      }} />

      {/* ── Bottom-left — main cluster ── */}
      <svg viewBox="0 0 340 440" className="absolute bottom-0 left-0 w-64 md:w-80"
        style={{ opacity: 0.12 }} fill="#86efac" xmlns="http://www.w3.org/2000/svg">
        {/* Stems */}
        <path d="M 72 440 Q 95 368, 120 295 Q 150 222, 182 175"
          fill="none" stroke="#86efac" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 132 288 Q 168 252, 200 218 Q 226 196, 248 178"
          fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
        <path d="M 95 348 Q 72 310, 58 268 Q 48 238, 55 205"
          fill="none" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" />

        {/* Large leaves */}
        <path d="M 55 435 C 12 392, -28 315, 8 228 C 50 286, 76 366, 55 435 Z" />
        <path d="M 82 425 C 54 352, 68 272, 118 185 C 154 256, 146 348, 82 425 Z" />
        <path d="M 126 370 C 162 322, 205 282, 218 218 C 175 256, 134 308, 126 370 Z" />
        <path d="M 158 305 C 196 262, 228 225, 235 175 C 192 202, 160 250, 158 305 Z" />
        <path d="M 185 242 C 218 208, 245 178, 248 140 C 208 162, 180 202, 185 242 Z" />

        {/* Secondary branch leaves */}
        <path d="M 178 255 C 215 232, 245 206, 252 172 C 215 190, 182 222, 178 255 Z" />
        <path d="M 205 218 C 234 198, 258 172, 262 144 C 228 162, 202 190, 205 218 Z" />
        <path d="M 228 185 C 255 166, 275 145, 276 120 C 246 138, 225 162, 228 185 Z" />

        {/* Left-leaning accent leaves */}
        <path d="M 58 348 C 28 315, 18 278, 38 248 C 66 268, 72 312, 58 348 Z" />
        <path d="M 42 295 C 15 268, 5 235, 22 208 C 48 226, 55 268, 42 295 Z" />

        {/* Thin frond details */}
        <path d="M 98 338 C 74 312, 66 278, 82 252 C 104 270, 110 312, 98 338 Z" />
        <path d="M 148 278 C 172 254, 186 225, 178 198 C 152 216, 136 250, 148 278 Z" />
        <path d="M 168 222 C 192 202, 208 178, 200 152 C 174 168, 158 198, 168 222 Z" />

        {/* Ground-level leaves */}
        <path d="M 0 440 C 22 412, 58 400, 85 416 C 60 430, 25 436, 0 440 Z" />
        <path d="M 102 434 C 124 408, 162 398, 182 412 C 158 426, 126 432, 102 434 Z" />
        <path d="M 192 428 C 212 408, 242 400, 258 412 C 236 422, 212 427, 192 428 Z" />
        <path d="M 268 422 C 285 406, 308 400, 320 410 C 302 420, 280 424, 268 422 Z" />

        {/* Berry clusters */}
        <circle cx="200" cy="165" r="4.5" />
        <circle cx="222" cy="148" r="3.5" />
        <circle cx="182" cy="156" r="3" />
        <circle cx="248" cy="158" r="2.5" />
        <circle cx="268" cy="138" r="2" />
        <circle cx="210" cy="138" r="2" />
      </svg>

      {/* ── Top-right — secondary cluster ── */}
      <svg viewBox="0 0 288 360" className="absolute top-0 right-0 w-52 md:w-68"
        style={{ opacity: 0.09 }} fill="#86efac" xmlns="http://www.w3.org/2000/svg">
        {/* Stems */}
        <path d="M 288 5 Q 262 34, 240 72 Q 218 110, 206 155 Q 192 195, 180 238 Q 168 272, 160 308"
          fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 238 78 Q 262 96, 278 125 Q 285 148, 282 175"
          fill="none" stroke="#86efac" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M 208 158 Q 232 168, 248 188 Q 260 208, 258 232"
          fill="none" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" />

        {/* Upper hanging leaves */}
        <path d="M 288 0 C 302 48, 290 102, 258 140 C 242 110, 256 55, 288 0 Z" />
        <path d="M 288 18 C 262 58, 245 106, 252 152 C 230 124, 230 74, 288 18 Z" />
        <path d="M 265 0 C 240 38, 224 82, 232 128 C 210 102, 212 56, 265 0 Z" />
        <path d="M 242 0 C 218 30, 205 68, 212 108 C 192 84, 195 44, 242 0 Z" />
        <path d="M 218 0 C 196 25, 184 58, 190 96 C 172 74, 175 38, 218 0 Z" />

        {/* Off secondary branch */}
        <path d="M 260 88 C 278 115, 284 150, 268 176 C 248 158, 246 122, 260 88 Z" />
        <path d="M 278 132 C 288 162, 284 198, 265 218 C 246 204, 248 165, 278 132 Z" />
        <path d="M 255 195 C 265 225, 260 258, 242 272 C 226 258, 228 224, 255 195 Z" />

        {/* Lower hanging cluster */}
        <path d="M 228 118 C 204 155, 190 198, 202 238 C 224 212, 235 168, 228 118 Z" />
        <path d="M 208 158 C 184 196, 172 238, 184 276 C 205 250, 216 206, 208 158 Z" />
        <path d="M 190 198 C 166 236, 154 278, 166 314 C 186 288, 196 244, 190 198 Z" />
        <path d="M 172 240 C 150 276, 138 318, 150 350 C 170 325, 178 282, 172 240 Z" />
      </svg>

      {/* ── Top-left — faint accent ── */}
      <svg viewBox="0 0 180 200" className="absolute top-0 left-0 w-32 md:w-44"
        style={{ opacity: 0.05 }} fill="#86efac" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0 0 C 32 22, 58 60, 48 100 C 22 72, 5 36, 0 0 Z" />
        <path d="M 0 12 C 42 32, 72 70, 68 115 C 38 86, 8 50, 0 12 Z" />
        <path d="M 32 0 C 58 28, 78 65, 70 105 C 46 78, 26 42, 32 0 Z" />
        <path d="M 62 0 C 82 32, 96 68, 86 108 C 64 82, 48 46, 62 0 Z" />
        <path d="M 92 0 C 110 35, 122 72, 110 110 C 88 85, 74 48, 92 0 Z" />
        <path d="M 122 0 C 138 35, 148 72, 135 108 C 114 84, 102 48, 122 0 Z" />
        <path d="M 150 0 C 165 38, 172 75, 158 110 C 138 86, 128 50, 150 0 Z" />
      </svg>

      {/* ── Bottom-right — faint accent ── */}
      <svg viewBox="0 0 220 175" className="absolute bottom-0 right-0 w-40 md:w-52"
        style={{ opacity: 0.055 }} fill="#86efac" xmlns="http://www.w3.org/2000/svg">
        <path d="M 220 175 C 182 152, 156 116, 172 80 C 196 108, 214 144, 220 175 Z" />
        <path d="M 220 152 C 180 132, 152 94, 168 58 C 194 86, 214 124, 220 152 Z" />
        <path d="M 220 128 C 185 110, 160 74, 176 40 C 200 66, 218 104, 220 128 Z" />
        <path d="M 220 104 C 188 88, 165 55, 180 22 C 204 48, 220 82, 220 104 Z" />
        <path d="M 196 172 C 162 150, 138 115, 154 80 C 176 106, 192 142, 196 172 Z" />
        <path d="M 172 168 C 140 148, 118 114, 133 78 C 154 104, 168 140, 172 168 Z" />
        <path d="M 148 162 C 118 143, 98 110, 113 75 C 133 100, 146 136, 148 162 Z" />
        {/* Stem */}
        <path d="M 220 175 Q 192 148, 172 118 Q 152 88, 148 58"
          fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" />
      </svg>

    </div>
  )
}
