import "./HeroArtwork.css";

export function AudioHeroArtwork() {
  return (
    <div className="dashboard-v21-hero-art" aria-hidden="true">
      <svg viewBox="0 0 360 190" role="presentation">
        <defs>
          <linearGradient id="heroWave" x1="0" x2="1">
            <stop offset="0" stopColor="#4a8cff" stopOpacity=".08" />
            <stop offset=".52" stopColor="#246bfd" stopOpacity=".32" />
            <stop offset="1" stopColor="#8167e5" stopOpacity=".08" />
          </linearGradient>
        </defs>
        <path className="hero-flow" d="M-8 154 C45 108, 87 184, 144 140 S252 105, 374 150" />
        <path className="hero-flow secondary" d="M-8 166 C52 132, 100 190, 164 151 S270 122, 374 162" />
        <g className="hero-eq">
          <rect x="154" y="118" width="8" height="42" rx="2"/><rect x="168" y="100" width="8" height="60" rx="2"/>
          <rect x="182" y="76" width="8" height="84" rx="2"/><rect x="196" y="110" width="8" height="50" rx="2"/>
          <rect x="210" y="91" width="8" height="69" rx="2"/><rect x="224" y="121" width="8" height="39" rx="2"/>
          <rect x="238" y="107" width="8" height="53" rx="2"/><rect x="252" y="129" width="8" height="31" rx="2"/>
        </g>
        <g className="hero-rings"><circle cx="223" cy="62" r="13"/><circle cx="223" cy="62" r="29"/><circle cx="223" cy="62" r="45"/></g>
        <g className="hero-waveform"><path d="M12 83h10M27 70v26M36 77v12M45 62v42M54 73v20M63 67v32M72 81v6M81 73v20M90 83h11"/></g>
        <path className="hero-note" d="M125 36v79a19 19 0 1 1-9-16V51l58-14v61a19 19 0 1 1-9-16V24l-40 12Z" />
      </svg>
    </div>
  );
}
