import "./HeroArtwork.css";

export function AudioHeroArtwork() {
  return (
    <div className="dashboard-v21-hero-art" aria-hidden="true">
      <svg viewBox="0 0 360 190" role="presentation">
        <defs>
          <linearGradient id="heroFlow" x1="0" x2="1">
            <stop offset="0" stopColor="#4f91ff" stopOpacity=".12" />
            <stop offset=".52" stopColor="#3a78ec" stopOpacity=".34" />
            <stop offset="1" stopColor="#8b77e9" stopOpacity=".08" />
          </linearGradient>
          <linearGradient id="heroBars" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#4f8df5" stopOpacity=".28" />
            <stop offset="1" stopColor="#246bfd" stopOpacity=".72" />
          </linearGradient>
          <radialGradient id="heroRingGlow">
            <stop offset="0" stopColor="#4d8df5" stopOpacity=".16" />
            <stop offset="1" stopColor="#4d8df5" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="hero-waveform-left">
          <path d="M12 82h7M23 72v20M31 78v8M39 65v34M47 73v18M55 60v43M63 70v24M71 78v9M79 69v27M87 82h9" />
        </g>

        <g className="hero-note-pair">
          <path d="M121 45v62c0 11-8 19-19 19-10 0-18-7-18-16 0-9 8-16 18-16 4 0 8 1 11 3V57l52-13v51c0 11-8 19-19 19-10 0-18-7-18-16 0-9 8-16 18-16 4 0 8 1 11 3V31l-36 9Z" />
        </g>

        <g className="hero-radar">
          <circle className="hero-radar-glow" cx="245" cy="62" r="39" />
          <circle cx="245" cy="62" r="10" />
          <circle cx="245" cy="62" r="22" />
          <circle cx="245" cy="62" r="35" />
          <circle className="hero-radar-core" cx="245" cy="62" r="2.5" />
        </g>

        <g className="hero-eq-bars">
          <rect x="151" y="126" width="6" height="30" rx="1.5" />
          <rect x="161" y="116" width="6" height="40" rx="1.5" />
          <rect x="171" y="101" width="6" height="55" rx="1.5" />
          <rect x="181" y="113" width="6" height="43" rx="1.5" />
          <rect x="191" y="91" width="6" height="65" rx="1.5" />
          <rect x="201" y="107" width="6" height="49" rx="1.5" />
          <rect x="211" y="96" width="6" height="60" rx="1.5" />
          <rect x="221" y="119" width="6" height="37" rx="1.5" />
          <rect x="231" y="105" width="6" height="51" rx="1.5" />
          <rect x="241" y="122" width="6" height="34" rx="1.5" />
          <rect x="251" y="111" width="6" height="45" rx="1.5" />
          <rect x="261" y="129" width="6" height="27" rx="1.5" />
        </g>

        <g className="hero-flow-lines">
          <path d="M-10 145 C34 116, 60 147, 92 150 C127 153, 145 123, 181 120 C224 117, 271 137, 370 157" />
          <path d="M-10 152 C35 127, 62 158, 98 160 C134 162, 153 132, 189 129 C231 126, 278 144, 370 165" />
          <path d="M-10 160 C40 138, 68 168, 105 169 C142 170, 163 143, 199 140 C239 137, 286 153, 370 172" />
          <path d="M-10 168 C45 148, 75 176, 112 176 C151 176, 173 152, 209 149 C249 146, 294 161, 370 179" />
        </g>
      </svg>
    </div>
  );
}
