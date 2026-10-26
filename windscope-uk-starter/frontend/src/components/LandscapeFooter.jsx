import React from 'react';

export default function LandscapeFooter({ onNavigate }) {
  return (
    <footer className="editorial-footer">
      {/* Top Sky & Navigation Area */}
      <div className="footer-sky-content">
        <div className="footer-brand-column">
          <div className="footer-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
              <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
              <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
            </svg>
            <span className="footer-brand-name">WindScope UK</span>
          </div>
          <p className="footer-tagline">
            WindScope UK transforms complex Elexon balancing mechanism data into clear, auditable forecast intelligence for the Great Britain energy market.
          </p>
        </div>

        <div className="footer-links-grid">
          <div className="footer-col">
            <h4 className="footer-col-title">Product</h4>
            <ul>
              <li><button type="button" onClick={() => onNavigate('analysis')}>Accuracy Overview</button></li>
              <li><button type="button" onClick={() => onNavigate('analysis')}>Daily Breakdown</button></li>
              <li><button type="button" onClick={() => onNavigate('analysis')}>Settlement Periods</button></li>
              <li><button type="button" onClick={() => onNavigate('analysis')}>Live Elexon Ingestion</button></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-col-title">Resources</h4>
            <ul>
              <li><button type="button" onClick={() => onNavigate('methodology')}>Methodology</button></li>
              <li><a href="https://data.elexon.co.uk" target="_blank" rel="noreferrer">Elexon BMRS API</a></li>
              <li><button type="button" onClick={() => onNavigate('methodology')}>Cutoff Policy (D-1)</button></li>
              <li><button type="button" onClick={() => onNavigate('methodology')}>Metric Formulas</button></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-col-title">Company</h4>
            <ul>
              <li><button type="button" onClick={() => onNavigate('hero')}>About WindScope</button></li>
              <li><a href="https://www.nationalgrideso.com" target="_blank" rel="noreferrer">National Grid ESO</a></li>
              <li><a href="https://www.elexon.co.uk" target="_blank" rel="noreferrer">Elexon Insights</a></li>
              <li><a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer">OGL v3.0 License</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Illustrated Landscape Banner */}
      <div className="landscape-illustration-wrap" aria-hidden="true">
        <svg
          viewBox="0 0 1440 380"
          className="landscape-svg"
          preserveAspectRatio="xMidYMax slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Contours pattern for fields */}
            <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6ba0db" />
              <stop offset="60%" stopColor="#78a8df" />
              <stop offset="100%" stopColor="#86b2e3" />
            </linearGradient>

            <linearGradient id="hillBack" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#769866" />
              <stop offset="50%" stopColor="#80a270" />
              <stop offset="100%" stopColor="#719361" />
            </linearGradient>

            <linearGradient id="hillMid" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#84a674" />
              <stop offset="50%" stopColor="#8eb07e" />
              <stop offset="100%" stopColor="#7d9f6d" />
            </linearGradient>

            <linearGradient id="hillFront" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8fae7e" />
              <stop offset="60%" stopColor="#97b686" />
              <stop offset="100%" stopColor="#89a778" />
            </linearGradient>
          </defs>

          {/* Sky background layer inside SVG */}
          <rect width="1440" height="380" fill="url(#skyGrad)" />

          {/* Distant Clouds (Warm cream cumulus) */}
          <g className="clouds-layer" fill="#f4ece0">
            {/* Left cloud bank */}
            <path d="M-60 260 C -40 210, 10 200, 35 225 C 55 190, 120 185, 150 220 C 180 180, 260 180, 290 225 C 320 200, 380 215, 395 255 C 410 270, 430 275, 450 280 L 450 340 L -60 340 Z" />
            {/* Right cloud bank */}
            <path d="M720 270 C 740 230, 800 220, 830 245 C 860 200, 950 195, 990 235 C 1030 190, 1140 185, 1180 230 C 1220 205, 1310 215, 1350 250 C 1390 245, 1450 260, 1480 285 L 1480 340 L 720 340 Z" />
          </g>

          {/* Foreground Clouds (Pillowy bright warm cream) */}
          <g className="clouds-foreground" fill="#fcf9f2">
            {/* Massive left cloud pillow */}
            <path d="M-40 270 C -30 220, 25 210, 55 235 C 80 195, 150 185, 195 220 C 235 185, 310 185, 350 225 C 385 205, 440 215, 465 250 C 490 255, 520 270, 535 295 L 535 360 L -40 360 Z" />
            {/* Subtle floating cloud puffs in middle sky */}
            <ellipse cx="610" cy="190" rx="36" ry="11" fill="#fcf9f2" opacity="0.85" />
            <ellipse cx="632" cy="186" rx="22" ry="8" fill="#fcf9f2" opacity="0.85" />
            <ellipse cx="880" cy="210" rx="55" ry="14" fill="#fcf9f2" opacity="0.9" />
            <ellipse cx="905" cy="204" rx="34" ry="10" fill="#fcf9f2" opacity="0.9" />

            {/* Right cloud pillow */}
            <path d="M850 275 C 870 235, 930 225, 965 250 C 1000 205, 1090 195, 1140 235 C 1185 195, 1280 190, 1325 230 C 1370 215, 1440 235, 1470 270 L 1470 360 L 850 360 Z" />
          </g>

          {/* Far Green Hill (Left slope) */}
          <path
            d="M-40 330 Q 350 290, 750 325 T 1480 320 L 1480 380 L -40 380 Z"
            fill="url(#hillBack)"
          />

          {/* Coral / Orange Tree Ridge on the Right */}
          <g className="coral-grove" fill="#eb5d38">
            {/* Clustered rounded vegetation line imitating the screenshot */}
            <ellipse cx="890" cy="326" rx="20" ry="12" fill="#d94f2b" />
            <ellipse cx="915" cy="322" rx="26" ry="14" fill="#eb5d38" />
            <ellipse cx="945" cy="320" rx="24" ry="13" fill="#f06a44" />
            <ellipse cx="975" cy="316" rx="28" ry="16" fill="#eb5d38" />
            <ellipse cx="1010" cy="312" rx="32" ry="17" fill="#f06a44" />
            <ellipse cx="1045" cy="310" rx="26" ry="15" fill="#d94f2b" />
            <ellipse cx="1080" cy="305" rx="34" ry="18" fill="#eb5d38" />
            <ellipse cx="1120" cy="300" rx="30" ry="17" fill="#f2724e" />
            <ellipse cx="1160" cy="296" rx="38" ry="20" fill="#eb5d38" />
            <ellipse cx="1205" cy="292" rx="32" ry="18" fill="#f06a44" />
            <ellipse cx="1245" cy="290" rx="36" ry="19" fill="#d94f2b" />
            <ellipse cx="1290" cy="286" rx="42" ry="21" fill="#eb5d38" />
            <ellipse cx="1340" cy="285" rx="38" ry="20" fill="#f06a44" />
            <ellipse cx="1385" cy="287" rx="34" ry="18" fill="#d94f2b" />
            <ellipse cx="1425" cy="290" rx="30" ry="16" fill="#eb5d38" />
            <ellipse cx="1455" cy="292" rx="24" ry="14" fill="#f06a44" />
          </g>

          {/* Middle Green Hill */}
          <path
            d="M-20 345 Q 400 310, 850 330 T 1460 315 L 1460 380 L -20 380 Z"
            fill="url(#hillMid)"
          />

          {/* Front Sweeping Hill with contours */}
          <path
            d="M-20 340 Q 320 315, 680 338 T 1460 330 L 1460 380 L -20 380 Z"
            fill="url(#hillFront)"
          />

          {/* Agricultural Field Furrows / Contours in Cream & Sage */}
          <g stroke="#eef4ea" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" fill="none">
            {/* Left field lines */}
            <path d="M-10 355 Q 160 345, 340 352" />
            <path d="M10 365 Q 200 354, 420 364" />
            <path d="M30 375 Q 240 365, 480 375" />

            {/* Central rolling contours radiating across the ridge */}
            <path d="M410 342 Q 580 348, 790 355" />
            <path d="M470 355 Q 670 358, 920 364" />
            <path d="M520 368 Q 740 368, 1040 372" />

            {/* Right field contours angling towards the horizon */}
            <path d="M820 348 Q 1020 346, 1280 342" />
            <path d="M890 358 Q 1120 355, 1370 350" />
            <path d="M960 368 Q 1200 365, 1440 360" />

            {/* Fine texture strokes */}
            <path d="M600 346 L 680 349" strokeWidth="1.5" />
            <path d="M720 352 L 800 356" strokeWidth="1.5" />
            <path d="M840 356 L 930 359" strokeWidth="1.5" />
            <path d="M980 358 L 1080 360" strokeWidth="1.5" />
            <path d="M1130 355 L 1220 353" strokeWidth="1.5" />
          </g>

          {/* The Linocut Blue Tree on the Left Hill (Iconic visual from screenshot) */}
          <g className="blue-tree" transform="translate(145, 230)">
            {/* Trunk and primary branches in rich deep cerulean blue */}
            <path
              d="M 52 115 L 56 75 L 44 55 L 48 53 L 58 70 L 64 50 L 68 52 L 62 72 L 72 60 L 75 63 L 64 78 L 68 115 Z"
              fill="#1e4e94"
            />
            {/* Dense, organic linocut foliage in vibrant royal blue */}
            <path
              d="M 25 72 C 10 65, 5 45, 18 35 C 10 25, 20 8, 38 12 C 45 -2, 70 -4, 82 8 C 96 2, 112 16, 108 32 C 122 40, 118 62, 104 68 C 110 82, 92 95, 78 88 C 65 96, 45 94, 38 85 C 28 88, 20 80, 25 72 Z"
              fill="#2f6ecb"
            />
            {/* Lighter blue dappled foliage layer */}
            <path
              d="M 32 60 C 24 54, 25 40, 36 36 C 36 28, 48 18, 62 22 C 70 12, 88 12, 95 24 C 104 28, 102 44, 94 50 C 98 60, 86 72, 74 68 C 65 74, 48 72, 42 64 C 36 66, 32 62, 32 60 Z"
              fill="#4285e6"
            />
            {/* Linocut leaf cutouts in cream/white for authentic woodcut texture */}
            <g fill="#fcf9f2" opacity="0.9">
              <path d="M 38 42 Q 42 38, 46 44 Q 40 46, 38 42 Z" />
              <path d="M 54 28 Q 60 22, 64 30 Q 56 32, 54 28 Z" />
              <path d="M 76 24 Q 82 18, 86 26 Q 78 28, 76 24 Z" />
              <path d="M 88 40 Q 94 36, 96 44 Q 90 46, 88 40 Z" />
              <path d="M 48 64 Q 54 58, 58 66 Q 50 68, 48 64 Z" />
              <path d="M 72 58 Q 78 52, 82 60 Q 74 62, 72 58 Z" />
              <path d="M 34 52 Q 38 48, 42 54 Q 36 56, 34 52 Z" />
              <path d="M 64 45 Q 70 40, 74 48 Q 66 50, 64 45 Z" />
            </g>
          </g>
        </svg>
      </div>

      {/* Footer Bottom Bar directly on the landscape */}
      <div className="footer-bottom-bar">
        <div className="footer-copyright">
          &copy; 2026 WINDSCOPE UK. All rights reserved.
        </div>
        <div className="footer-legal-links">
          <a href="#terms" onClick={(e) => { e.preventDefault(); alert('WindScope UK is an open evaluation prototype for day-ahead wind forecast analysis.'); }}>
            Terms of Service
          </a>
          <a href="#privacy" onClick={(e) => { e.preventDefault(); alert('WindScope UK does not collect personal data or store browser tracking cookies.'); }}>
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
