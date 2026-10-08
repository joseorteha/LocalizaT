export function ObjectArt({
  category = "bag",
  className = "",
}: {
  category?: string;
  className?: string;
}) {
  return (
    <svg
      className={`object-art ${className}`}
      viewBox="0 0 240 240"
      aria-hidden="true"
    >
      <ellipse
        cx="124"
        cy="208"
        rx="65"
        ry="11"
        fill="currentColor"
        opacity=".07"
      />
      {category === "bag" ? (
        <>
          <path
            d="M80 95V67q0-32 40-32t40 32v28"
            fill="none"
            stroke="#12343C"
            strokeWidth="14"
          />
          <path
            d="M71 89q0-35 49-35t49 35l13 93q2 20-19 20H77q-21 0-19-20Z"
            fill="#D6E65A"
            stroke="#12343C"
            strokeWidth="3"
          />
          <path d="M72 104h97" stroke="#EEF6B8" strokeWidth="4" />
          <rect
            x="77"
            y="132"
            width="87"
            height="56"
            rx="15"
            fill="#B5CB33"
            stroke="#12343C"
            strokeWidth="3"
          />
          <path
            d="M86 146h68M125 147v12"
            stroke="#12343C"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M88 77h64"
            stroke="#EEF6B8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect x="111" y="109" width="20" height="11" rx="3" fill="#F6FADC" />
        </>
      ) : category === "book" ? (
        <>
          <path
            d="M66 40h109q11 0 11 12v135q0 17-17 17H66Z"
            fill="#BCDDE1"
            stroke="#12343C"
            strokeWidth="3"
          />
          <path
            d="M66 190h108q12 0 12 14H66q-17 0-17-14V55q0-15 17-15"
            fill="#FBFDFC"
            stroke="#12343C"
            strokeWidth="3"
          />
          <path
            d="M66 40v151M88 79h72M88 91h52M88 135h54"
            fill="none"
            stroke="#12343C"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M142 40v53l13-10 13 10V40" fill="#D6E65A" />
        </>
      ) : category === "clothing" ? (
        <>
          <path
            d="m92 48-46 30 23 43 19-10v83h65v-83l20 10 23-43-46-30q-28 22-58 0Z"
            fill="#CFC8EC"
            stroke="#12343C"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M93 49q25 45 56 0M89 180h64"
            fill="none"
            stroke="#12343C"
            strokeWidth="3"
          />
          <path d="m118 108 11 13-11 13-11-13Z" fill="#FFFFFF" />
        </>
      ) : category === "accessory" ? (
        <>
          <path
            d="m42 134 18-57 34-17M198 134l-18-57-34-17"
            fill="none"
            stroke="#12343C"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M101 141q19-20 38 0"
            fill="none"
            stroke="#12343C"
            strokeWidth="7"
          />
          <rect
            x="38"
            y="122"
            width="67"
            height="46"
            rx="17"
            fill="#D6E65A"
            stroke="#12343C"
            strokeWidth="7"
          />
          <rect
            x="135"
            y="122"
            width="67"
            height="46"
            rx="17"
            fill="#D6E65A"
            stroke="#12343C"
            strokeWidth="7"
          />
          <path
            d="m55 131 21 27m77-27 21 27"
            stroke="#EEF6B8"
            strokeWidth="5"
          />
        </>
      ) : (
        <>
          <path
            d="m57 90 65-33 65 33v87l-65 32-65-32Z"
            fill="#D8B98E"
            stroke="#12343C"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="m57 90 65 33 65-33m-65 33v86M94 74l65 34v29"
            fill="none"
            stroke="#12343C"
            strokeWidth="3"
          />
          <path d="m94 74 24-12 64 33-23 13v29l-24 11v-29Z" fill="#F0DDC0" />
        </>
      )}
    </svg>
  );
}

export function RouteScene() {
  return (
    <div className="route-scene" aria-hidden="true">
      <svg className="terrain" viewBox="0 0 600 560" fill="none">
        <defs>
          <pattern
            id="dots"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill="#FFFFFF" opacity=".14" />
          </pattern>
        </defs>
        <rect width="600" height="560" fill="url(#dots)" />
        <g stroke="#7FB3BA" strokeWidth="1" opacity=".35">
          <path d="M-40 300c120-180 200 210 390 40s250-70 320 10" />
          <path d="M-40 330c120-180 200 210 390 40s250-70 320 10" />
          <path d="M-40 360c120-180 200 210 390 40s250-70 320 10" />
          <path d="M-40 390c120-180 200 210 390 40s250-70 320 10" />
          <path d="M-40 420c120-180 200 210 390 40s250-70 320 10" />
          <path d="M130-40c-120 200 350 80 330 270s-300 190-200 360" />
          <path d="M160-40c-120 200 350 80 330 270s-300 190-200 360" />
          <path d="M190-40c-120 200 350 80 330 270s-300 190-200 360" />
        </g>
        <path
          className="return-path"
          d="M100 400c-50-30-10-130 75-110s85 125 185 55 110-210 5-215-70 95 15 70 115-105 150-90"
          stroke="#D6E65A"
          strokeWidth="3"
          strokeDasharray="5 9"
          strokeLinecap="round"
        />
        <circle
          cx="100"
          cy="400"
          r="11"
          fill="#D6E65A"
          stroke="#06252B"
          strokeWidth="3"
        />
        <circle cx="530" cy="110" r="11" fill="#FFFFFF" />
      </svg>
      <div className="scene-ticket">
        <span>DE VUELTA A TI</span>
        <strong>
          Un pequeño objeto.
          <br />
          Una gran historia.
        </strong>
        <div className="ticket-line" />
        <small>SIERRA DE ZONGOLICA</small>
      </div>
      <div className="scene-object">
        <ObjectArt />
        <div className="object-label">
          <span className="status-dot" /> Un regreso empieza aquí
        </div>
      </div>
      <div className="scene-note">
        <ObjectArt category="book" />
      </div>
      <div className="scene-stamp">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span>
          Encontrar.
          <br />
          Conectar.
          <br />
          Devolver.
        </span>
      </div>
      <span className="scene-coordinate">HECHO PARA NUESTRA SIERRA</span>
    </div>
  );
}
