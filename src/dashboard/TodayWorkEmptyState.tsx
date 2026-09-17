import { DashboardIcon } from "./DashboardIcon";

export function TodayWorkEmptyState() {
  return (
    <div className="dashboard-v21-empty dashboard-v21-work-empty">
      <svg className="dashboard-v21-work-empty-artwork" viewBox="0 0 1200 420" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="today-work-wave-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e9f0ff" stopOpacity=".78" />
            <stop offset="1" stopColor="#f6f8ff" stopOpacity=".28" />
          </linearGradient>
          <linearGradient id="today-work-wave-middle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e0e9fb" stopOpacity=".7" />
            <stop offset="1" stopColor="#f4f7fd" stopOpacity=".22" />
          </linearGradient>
          <linearGradient id="today-work-wave-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d6e2f9" stopOpacity=".62" />
            <stop offset="1" stopColor="#f7f9fd" stopOpacity=".18" />
          </linearGradient>
        </defs>
        <path className="wave-fill wave-back" d="M0 146C85 88 150 263 286 265c145 2 185-105 322-86 127 18 170 121 309 91 130-28 173-153 283-112v262H0Z" />
        <path className="wave-fill wave-middle" d="M0 363c147 7 168-128 313-126 150 2 177 120 321 123 139 3 177-160 327-155 125 4 153 121 239 126v89H0Z" />
        <path className="wave-fill wave-front" d="M0 386c132-1 187-83 322-82 142 1 191 91 329 73 139-18 176-115 325-104 116 9 151 80 224 83v64H0Z" />
        <path className="wave-line wave-line-one" d="M0 258c104-69 166 64 284 60 126-5 159-110 286-77 112 30 158 132 291 86 125-43 178-113 339-61" />
        <path className="wave-line wave-line-two" d="M0 302c128-11 173-82 292-27 119 56 163 122 297 97 134-25 171-112 301-80 118 29 178 100 310 48" />
      </svg>
      <div className="dashboard-v21-work-empty-message">
        <span className="dashboard-v21-empty-icon positive"><DashboardIcon name="check" /></span>
        <strong>You’re all caught up.</strong>
        <p>Nothing needs your attention right now.</p>
      </div>
    </div>
  );
}
