/** Decorative floor-plan mockups for the landing hero backdrop. */

const stroke = "var(--blueprint-ink, #1f3b4d)";
const planSheetClass =
  "blueprint-plan-svg h-56 w-[17rem] shrink-0 sm:h-64 sm:w-[19rem]";

function PlanLabel({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} fill={stroke} fontSize={9} fontWeight={600} opacity={0.4} letterSpacing="0.08em">
      {children}
    </text>
  );
}

function DimLine({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label: string }) {
  const horizontal = y1 === y2;
  const mx = horizontal ? (x1 + x2) / 2 : x1;
  const my = horizontal ? y1 - 8 : (y1 + y2) / 2;
  return (
    <g opacity={0.6}>
      <path
        d={
          horizontal
            ? `M${x1} ${y1} H${x2} M${x1} ${y1 - 4} V${y1 + 4} M${x2} ${y1 - 4} V${y1 + 4}`
            : `M${x1} ${y1} V${y2} M${x1 - 4} ${y1} H${x1 + 4} M${x1 - 4} ${y2} H${x1 + 4}`
        }
        stroke={stroke}
        strokeWidth={0.75}
        strokeLinecap="round"
      />
      <text x={mx} y={my} fill={stroke} fontSize={8} textAnchor="middle" opacity={0.7}>
        {label}
      </text>
    </g>
  );
}

function DoorSwing({ cx, cy, r, startAngle }: { cx: number; cy: number; r: number; startAngle: number }) {
  const rad = (startAngle * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);
  return (
    <path
      d={`M${cx} ${cy} A${r} ${r} 0 0 1 ${x} ${y}`}
      stroke={stroke}
      strokeWidth={0.85}
      fill="none"
      opacity={0.5}
      strokeDasharray="3 4"
    />
  );
}

export function KitchenPlanSheet() {
  return (
    <svg viewBox="0 0 340 260" className={planSheetClass} fill="none" aria-hidden>
      <rect x={8} y={8} width={324} height={244} rx={4} stroke={stroke} strokeWidth={1} opacity={0.22} />
      <PlanLabel x={18} y={24}>A-101 · KITCHEN ROUGH-IN</PlanLabel>
      <PlanLabel x={18} y={238}>{`SCALE 1/4" = 1'-0"`}</PlanLabel>
      <path d="M40 48 H300 V210 H180 V150 H40 Z" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" opacity={0.55} />
      <path d="M180 150 H300" stroke={stroke} strokeWidth={1.1} strokeDasharray="5 6" opacity={0.4} />
      <rect x={48} y={56} width={240} height={18} rx={2} stroke={stroke} strokeWidth={1} opacity={0.38} />
      <rect x={48} y={186} width={118} height={16} rx={2} stroke={stroke} strokeWidth={1} opacity={0.38} />
      <rect x={92} y={82} width={36} height={36} rx={3} stroke={stroke} strokeWidth={1} opacity={0.45} />
      <PlanLabel x={98} y={104}>RANGE</PlanLabel>
      <circle cx={220} cy={100} r={14} stroke={stroke} strokeWidth={1.1} opacity={0.65} />
      <PlanLabel x={206} y={104}>SINK</PlanLabel>
      <rect x={248} y={168} width={40} height={34} rx={2} stroke={stroke} strokeWidth={1} opacity={0.55} />
      <PlanLabel x={258} y={188}>FRG</PlanLabel>
      <DoorSwing cx={180} cy={210} r={28} startAngle={270} />
      <DimLine x1={40} y1={228} x2={300} y2={228} label={`18'-0"`} />
      <DimLine x1={24} y1={48} x2={24} y2={210} label={`13'-6"`} />
    </svg>
  );
}

export function BathroomPlanSheet() {
  return (
    <svg viewBox="0 0 300 240" className="h-52 w-[15rem] shrink-0 sm:h-60 sm:w-[17rem] blueprint-plan-svg" fill="none" aria-hidden>
      <rect x={8} y={8} width={284} height={224} rx={4} stroke={stroke} strokeWidth={1} opacity={0.22} />
      <PlanLabel x={18} y={24}>A-102 · BATH RM</PlanLabel>
      <path d="M36 44 H264 V200 H36 Z" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" opacity={0.55} />
      <rect x={44} y={52} width={88} height={42} rx={3} stroke={stroke} strokeWidth={1.15} opacity={0.65} />
      <PlanLabel x={68} y={78}>VANITY</PlanLabel>
      <rect x={168} y={52} width={84} height={130} rx={4} stroke={stroke} strokeWidth={1.15} opacity={0.65} />
      <PlanLabel x={196} y={118}>TUB</PlanLabel>
      <circle cx={72} cy={168} r={16} stroke={stroke} strokeWidth={1.1} opacity={0.65} />
      <PlanLabel x={58} y={172}>WC</PlanLabel>
      <path d="M120 52 H168 V120 H120 Z" stroke={stroke} strokeWidth={1} strokeDasharray="4 5" opacity={0.45} />
      <DoorSwing cx={120} cy={200} r={24} startAngle={180} />
      <DimLine x1={36} y1={216} x2={264} y2={216} label={`11'-6"`} />
    </svg>
  );
}

export function PanelPlanSheet() {
  return (
    <svg viewBox="0 0 320 250" className="h-56 w-[16rem] shrink-0 sm:h-64 sm:w-[18rem] blueprint-plan-svg" fill="none" aria-hidden>
      <rect x={8} y={8} width={304} height={234} rx={4} stroke={stroke} strokeWidth={1} opacity={0.22} />
      <PlanLabel x={18} y={24}>E-201 · PANEL UPGRADE</PlanLabel>
      <path d="M44 48 H276 V208 H44 Z" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" />
      <rect x={118} y={72} width={84} height={112} rx={2} stroke={stroke} strokeWidth={1.25} opacity={0.7} />
      <PlanLabel x={132} y={132}>200A PNL</PlanLabel>
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1={126}
          y1={88 + i * 18}
          x2={194}
          y2={88 + i * 18}
          stroke={stroke}
          strokeWidth={0.75}
          opacity={0.45}
        />
      ))}
      <circle cx={88} cy={168} r={22} stroke={stroke} strokeWidth={1.1} opacity={0.6} />
      <PlanLabel x={68} y={172}>HWT</PlanLabel>
      <path d="M88 168 H118" stroke={stroke} strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />
      <path d="M202 128 H248" stroke={stroke} strokeWidth={1} opacity={0.55} />
      <PlanLabel x={252} y={132}>SVC</PlanLabel>
      <DoorSwing cx={44} cy={128} r={26} startAngle={90} />
      <DimLine x1={44} y1={224} x2={276} y2={224} label={`14'-0"`} />
    </svg>
  );
}

export function DeckPlanSheet() {
  return (
    <svg viewBox="0 0 360 220" className="h-52 w-[18rem] shrink-0 sm:h-60 sm:w-[20rem] blueprint-plan-svg" fill="none" aria-hidden>
      <rect x={8} y={8} width={344} height={204} rx={4} stroke={stroke} strokeWidth={1} opacity={0.22} />
      <PlanLabel x={18} y={24}>C-301 · DECK & STAIR</PlanLabel>
      <path d="M48 56 H312 V176 H48 Z" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={`h-${i}`}
          x1={48}
          y1={56 + i * 24}
          x2={312}
          y2={56 + i * 24}
          stroke={stroke}
          strokeWidth={0.6}
          opacity={0.35}
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
        <line
          key={`v-${i}`}
          x1={48 + i * 26}
          y1={56}
          x2={48 + i * 26}
          y2={176}
          stroke={stroke}
          strokeWidth={0.6}
          opacity={0.35}
        />
      ))}
      <path d="M48 176 L24 208 H72 L48 176 Z" stroke={stroke} strokeWidth={1.15} opacity={0.65} />
      <PlanLabel x={28} y={200}>STAIR</PlanLabel>
      <DoorSwing cx={180} cy={56} r={22} startAngle={0} />
      <DimLine x1={48} y1={196} x2={312} y2={196} label={`22'-0"`} />
    </svg>
  );
}

export function BlueprintPlansPanorama() {
  const sheets = [
    <KitchenPlanSheet key="kitchen" />,
    <BathroomPlanSheet key="bath" />,
    <PanelPlanSheet key="panel" />,
    <DeckPlanSheet key="deck" />,
  ];
  const loop = [...sheets, ...sheets];

  return (
    <div className="construction-plans-pan absolute inset-0">
      <div className="construction-plans-track">
        {loop.map((sheet, index) => (
          <div key={index} className="construction-plan-sheet">
            {sheet}
          </div>
        ))}
      </div>
    </div>
  );
}
