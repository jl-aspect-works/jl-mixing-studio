import { DashboardIcon } from "./DashboardIcon";

export function TodayWorkEmptyState() {
  return (
    <div className="dashboard-v21-empty dashboard-v21-work-empty">
      <svg className="dashboard-v21-work-empty-artwork" viewBox="0 0 1200 260" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="today-work-wave-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dce9ff" stopOpacity=".72" />
            <stop offset="1" stopColor="#edf4ff" stopOpacity=".2" />
          </linearGradient>
          <linearGradient id="today-work-wave-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bed3ff" stopOpacity=".55" />
            <stop offset="1" stopColor="#e8f0ff" stopOpacity=".18" />
          </linearGradient>
        </defs>
        <path className="wave-fill wave-back" d="M0 84C72 24 126 190 236 151S385 61 492 145s178 27 258-32 145-21 210 31 133 9 240-47v163H0Z" />
        <path className="wave-fill wave-middle" d="M0 209c104 4 135-122 245-118s144 120 257 122 142-112 254-119 153 91 244 80 106-111 200-99v185H0Z" />
        <path className="wave-fill wave-front" d="M0 221c126 11 166-77 273-91s154 97 260 89 147-142 259-124 147 109 244 101 99-86 164-65v129H0Z" />
        <path className="wave-line wave-line-one" d="M0 142c91-73 157 90 253 45s127-118 227-53 154 116 253 60 142-96 242-30 136-87 225-76" />
        <path className="wave-line wave-line-two" d="M0 172c94-61 158-18 245 54s157-44 245-5 149-85 249-65 139 86 232 23 140-62 229-19" />
      </svg>
      <div className="dashboard-v21-work-empty-message">
        <span className="dashboard-v21-empty-icon positive"><DashboardIcon name="check" /></span>
        <strong>Nothing needs your attention right now.</strong>
        <p>Refresh anytime to check for new work.</p>
      </div>
    </div>
  );
}
