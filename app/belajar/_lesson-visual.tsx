import type { ReactNode } from "react";
import type { VisualKind } from "./_curriculum";

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TREND_DATA: Candle[] = [
  { open: 101, high: 104, low: 99, close: 103, volume: 28 },
  { open: 103, high: 106, low: 102, close: 105, volume: 32 },
  { open: 105, high: 106, low: 101, close: 102, volume: 25 },
  { open: 102, high: 108, low: 101, close: 107, volume: 38 },
  { open: 107, high: 111, low: 105, close: 109, volume: 42 },
  { open: 109, high: 110, low: 105, close: 106, volume: 27 },
  { open: 106, high: 113, low: 105, close: 112, volume: 44 },
  { open: 112, high: 116, low: 110, close: 114, volume: 47 },
  { open: 114, high: 115, low: 110, close: 111, volume: 31 },
  { open: 111, high: 118, low: 110, close: 117, volume: 55 },
  { open: 117, high: 121, low: 115, close: 119, volume: 58 },
  { open: 119, high: 120, low: 115, close: 116, volume: 33 },
  { open: 116, high: 123, low: 115, close: 122, volume: 64 },
  { open: 122, high: 126, low: 120, close: 124, volume: 70 },
  { open: 124, high: 125, low: 121, close: 122, volume: 36 },
  { open: 122, high: 129, low: 121, close: 128, volume: 82 },
];

const RANGE_DATA: Candle[] = [
  { open: 107, high: 111, low: 105, close: 110, volume: 25 },
  { open: 110, high: 112, low: 108, close: 109, volume: 22 },
  { open: 109, high: 110, low: 104, close: 105, volume: 29 },
  { open: 105, high: 108, low: 103, close: 107, volume: 31 },
  { open: 107, high: 112, low: 106, close: 111, volume: 27 },
  { open: 111, high: 113, low: 108, close: 109, volume: 24 },
  { open: 109, high: 110, low: 104, close: 105, volume: 33 },
  { open: 105, high: 107, low: 102, close: 106, volume: 30 },
  { open: 106, high: 111, low: 105, close: 110, volume: 26 },
  { open: 110, high: 112, low: 107, close: 108, volume: 23 },
  { open: 108, high: 109, low: 103, close: 104, volume: 35 },
  { open: 104, high: 108, low: 102, close: 107, volume: 38 },
  { open: 107, high: 112, low: 106, close: 111, volume: 29 },
  { open: 111, high: 113, low: 108, close: 109, volume: 25 },
  { open: 109, high: 110, low: 104, close: 105, volume: 34 },
  { open: 105, high: 109, low: 103, close: 108, volume: 32 },
];

function VisualShell({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-[#09100e] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="text-xs font-semibold tracking-wide text-white/90">{title}</p>
        </div>
        <span className="rounded-full border border-white/8 bg-white/4 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
          contoh visual
        </span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
      <figcaption className="border-t border-white/8 bg-white/[0.025] px-4 py-3 text-[11px] leading-relaxed text-white/55">
        {caption}
      </figcaption>
    </figure>
  );
}

function GridLines() {
  return (
    <g stroke="rgba(255,255,255,0.07)" strokeWidth="1">
      {[48, 98, 148, 198, 248].map((y) => <line key={y} x1="36" x2="724" y1={y} y2={y} />)}
      {[110, 220, 330, 440, 550, 660].map((x) => <line key={x} x1={x} x2={x} y1="24" y2="270" />)}
    </g>
  );
}

function CandleChart({
  data = TREND_DATA,
  variant,
}: {
  data?: Candle[];
  variant: "plain" | "levels" | "structure" | "orders" | "risk" | "volume" | "indicators" | "backtest";
}) {
  const min = Math.min(...data.map((bar) => bar.low)) - 2;
  const max = Math.max(...data.map((bar) => bar.high)) + 2;
  const chartTop = 24;
  const chartBottom = variant === "volume" ? 215 : 270;
  const y = (price: number) => chartBottom - ((price - min) / (max - min)) * (chartBottom - chartTop);
  const step = 650 / data.length;
  const x = (index: number) => 56 + index * step;
  const closePoints = data.map((bar, index) => `${x(index)},${y(bar.close)}`).join(" ");
  const cursorIndex = 10;

  return (
    <svg viewBox="0 0 760 300" role="img" aria-label="Contoh chart candlestick beranotasi" className="h-auto w-full">
      <defs>
        <linearGradient id="risk-profit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#34d399" stopOpacity="0.28" />
          <stop offset="1" stopColor="#34d399" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="risk-loss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb7185" stopOpacity="0.05" />
          <stop offset="1" stopColor="#fb7185" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect width="760" height="300" rx="12" fill="#09100e" />
      <GridLines />

      {variant === "levels" && (
        <>
          <rect x="36" y={y(106.5)} width="688" height={Math.abs(y(102.5) - y(106.5))} fill="#34d399" opacity="0.12" />
          <rect x="36" y={y(125.5)} width="688" height={Math.abs(y(121.5) - y(125.5))} fill="#fb7185" opacity="0.1" />
          <text x="48" y={y(104.5) + 4} fill="#6ee7b7" fontSize="11">AREA SUPPORT</text>
          <text x="48" y={y(123.5) + 4} fill="#fda4af" fontSize="11">AREA RESISTANCE</text>
        </>
      )}

      {variant === "risk" && (
        <>
          <rect x={x(8)} y={y(126)} width="280" height={y(115) - y(126)} fill="url(#risk-profit)" />
          <rect x={x(8)} y={y(115)} width="280" height={y(109.5) - y(115)} fill="url(#risk-loss)" />
          <line x1={x(8)} x2={x(15) + 18} y1={y(115)} y2={y(115)} stroke="#60a5fa" strokeDasharray="5 4" />
          <line x1={x(8)} x2={x(15) + 18} y1={y(126)} y2={y(126)} stroke="#34d399" strokeDasharray="5 4" />
          <line x1={x(8)} x2={x(15) + 18} y1={y(109.5)} y2={y(109.5)} stroke="#fb7185" strokeDasharray="5 4" />
          <text x={x(8) + 8} y={y(126) - 7} fill="#6ee7b7" fontSize="10">TARGET · +2R</text>
          <text x={x(8) + 8} y={y(115) - 7} fill="#93c5fd" fontSize="10">ENTRY</text>
          <text x={x(8) + 8} y={y(109.5) + 14} fill="#fda4af" fontSize="10">STOP · -1R</text>
        </>
      )}

      {variant === "orders" && (
        <>
          <line x1="40" x2="720" y1={y(116)} y2={y(116)} stroke="#60a5fa" strokeDasharray="5 5" />
          <line x1="40" x2="720" y1={y(109)} y2={y(109)} stroke="#fbbf24" strokeDasharray="5 5" />
          <line x1="40" x2="720" y1={y(125)} y2={y(125)} stroke="#a78bfa" strokeDasharray="5 5" />
          <text x="48" y={y(125) - 7} fill="#c4b5fd" fontSize="10">BUY STOP · tunggu breakout</text>
          <text x="48" y={y(116) - 7} fill="#93c5fd" fontSize="10">MARKET · harga sekarang</text>
          <text x="48" y={y(109) - 7} fill="#fde68a" fontSize="10">BUY LIMIT · tunggu pullback</text>
        </>
      )}

      {variant === "backtest" && (
        <>
          <rect x={x(cursorIndex) + step / 2} y="24" width={724 - (x(cursorIndex) + step / 2)} height="246" fill="#07100d" opacity="0.94" />
          <line x1={x(cursorIndex) + step / 2} x2={x(cursorIndex) + step / 2} y1="24" y2="270" stroke="#fbbf24" strokeDasharray="5 5" />
          <text x={x(cursorIndex) + 10} y="43" fill="#fde68a" fontSize="10">MASA DEPAN DISEMBUNYIKAN</text>
        </>
      )}

      {variant === "indicators" && (
        <polyline points={closePoints} fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.85" />
      )}

      {data.map((bar, index) => {
        if (variant === "backtest" && index > cursorIndex) return null;
        const isUp = bar.close >= bar.open;
        const color = isUp ? "#34d399" : "#fb7185";
        const bodyTop = y(Math.max(bar.open, bar.close));
        const bodyHeight = Math.max(3, Math.abs(y(bar.open) - y(bar.close)));
        return (
          <g key={index}>
            <line x1={x(index)} x2={x(index)} y1={y(bar.high)} y2={y(bar.low)} stroke={color} strokeWidth="2" />
            <rect x={x(index) - 9} y={bodyTop} width="18" height={bodyHeight} rx="2" fill={color} opacity="0.92" />
          </g>
        );
      })}

      {variant === "structure" && [
        [1, "HL"], [4, "HH"], [5, "HL"], [7, "HH"], [8, "HL"], [10, "HH"], [11, "HL"], [13, "HH"],
      ].map(([index, label]) => {
        const i = Number(index);
        const above = label === "HH";
        return <text key={`${index}-${label}`} x={x(i) - 8} y={above ? y(data[i].high) - 8 : y(data[i].low) + 17} fill={above ? "#6ee7b7" : "#93c5fd"} fontSize="10" fontWeight="700">{label}</text>;
      })}

      {variant === "volume" && data.map((bar, index) => {
        const height = (bar.volume / 90) * 54;
        return <rect key={`v-${index}`} x={x(index) - 9} y={286 - height} width="18" height={height} rx="2" fill={bar.close >= bar.open ? "#34d399" : "#fb7185"} opacity={index === data.length - 1 ? 0.95 : 0.35} />;
      })}

      {variant === "plain" && <polyline points={closePoints} fill="none" stroke="#34d399" strokeWidth="1" opacity="0.18" />}
    </svg>
  );
}

function MarketVisual() {
  const cards = [
    { label: "SAHAM", note: "Jam bursa", color: "#60a5fa", path: "M8 62 L35 54 L60 57 L86 39 L112 44 L140 20" },
    { label: "CRYPTO", note: "24/7", color: "#34d399", path: "M8 58 L35 38 L60 49 L86 24 L112 55 L140 17" },
    { label: "FOREX", note: "Sen–Jum", color: "#fbbf24", path: "M8 55 L35 49 L60 52 L86 42 L112 36 L140 31" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between text-[10px]"><span className="font-bold tracking-[0.16em] text-white/80">{card.label}</span><span className="text-white/35">{card.note}</span></div>
          <svg viewBox="0 0 148 78" role="img" aria-label={`Ilustrasi pergerakan ${card.label}`} className="mt-3 w-full">
            <path d="M8 67 H140" stroke="rgba(255,255,255,.08)" />
            <path d={card.path} fill="none" stroke={card.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function CandleAnatomy() {
  return (
    <svg viewBox="0 0 760 300" role="img" aria-label="Anatomi candlestick hijau dan merah" className="w-full">
      <rect width="760" height="300" rx="12" fill="#09100e" />
      <g transform="translate(170 22)">
        <line x1="90" x2="90" y1="18" y2="250" stroke="#34d399" strokeWidth="5" />
        <rect x="50" y="82" width="80" height="108" rx="6" fill="#34d399" />
        <text x="145" y="24" fill="#6ee7b7" fontSize="12">HIGH · harga tertinggi</text>
        <line x1="105" x2="140" y1="20" y2="20" stroke="#6ee7b7" />
        <text x="145" y="90" fill="#fff" opacity=".65" fontSize="12">CLOSE · harga tutup</text>
        <line x1="130" x2="140" y1="85" y2="85" stroke="#fff" opacity=".4" />
        <text x="145" y="194" fill="#fff" opacity=".65" fontSize="12">OPEN · harga buka</text>
        <line x1="130" x2="140" y1="188" y2="188" stroke="#fff" opacity=".4" />
        <text x="145" y="254" fill="#6ee7b7" fontSize="12">LOW · harga terendah</text>
        <line x1="105" x2="140" y1="248" y2="248" stroke="#6ee7b7" />
        <text x="63" y="140" fill="#052e25" fontSize="12" fontWeight="800">BODY</text>
      </g>
      <g transform="translate(570 42)">
        <line x1="0" x2="0" y1="20" y2="210" stroke="#fb7185" strokeWidth="4" />
        <rect x="-30" y="70" width="60" height="92" rx="5" fill="#fb7185" />
        <text x="-48" y="240" fill="#fda4af" fontSize="11">candle turun</text>
      </g>
    </svg>
  );
}

function TrendRangeVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.035] p-2"><p className="px-2 pt-1 text-[10px] font-bold tracking-[0.14em] text-emerald-300">TREND NAIK</p><CandleChart data={TREND_DATA.slice(0, 10)} variant="plain" /></div>
      <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.025] p-2"><p className="px-2 pt-1 text-[10px] font-bold tracking-[0.14em] text-amber-200">RANGE</p><CandleChart data={RANGE_DATA.slice(0, 10)} variant="levels" /></div>
    </div>
  );
}

function PositionVisual() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        { title: "STOP 2%", units: "5.000 unit", width: "78%", risk: "Rp100.000" },
        { title: "STOP 5%", units: "2.000 unit", width: "38%", risk: "Rp100.000" },
      ].map((item) => (
        <div key={item.title} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-white/80">{item.title}</span><span className="font-mono text-[10px] text-rose-300">risiko {item.risk}</span></div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-emerald-400" style={{ width: item.width }} /></div>
          <p className="mt-3 font-mono text-lg font-bold text-white">{item.units}</p>
          <p className="text-[10px] text-white/40">ukuran posisi</p>
        </div>
      ))}
    </div>
  );
}

function TimeframeVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        ["DAILY", "Arah utama", "M10 56 L42 42 L72 46 L104 24 L138 16"],
        ["4 JAM", "Area penting", "M10 54 L31 46 L48 50 L68 35 L86 39 L108 22 L138 18"],
        ["1 JAM", "Pemicu entry", "M10 58 L22 49 L35 54 L48 41 L60 48 L75 33 L90 39 L108 24 L124 29 L138 18"],
      ].map(([title, note, path]) => (
        <div key={title} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[10px] font-bold tracking-[0.14em] text-emerald-300">{title}</p>
          <svg viewBox="0 0 148 70" className="mt-2 w-full" role="img" aria-label={`Ilustrasi ${title}`}><path d="M8 62 H140" stroke="rgba(255,255,255,.08)" /><path d={path} fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" /></svg>
          <p className="text-[10px] text-white/45">{note}</p>
        </div>
      ))}
    </div>
  );
}

function BreakoutVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-emerald-400/15 p-2"><p className="px-2 pt-1 text-[10px] font-bold text-emerald-300">DITERIMA DI ATAS LEVEL</p><CandleChart data={TREND_DATA.slice(5)} variant="levels" /></div>
      <div className="rounded-xl border border-rose-400/15 p-2"><p className="px-2 pt-1 text-[10px] font-bold text-rose-300">KEMBALI KE RANGE</p><CandleChart data={RANGE_DATA.slice(3, 13)} variant="levels" /></div>
    </div>
  );
}

function ProcessVisual({ governance = false }: { governance?: boolean }) {
  const items = governance
    ? ["Hipotesis", "Backtest", "Validasi", "Paper", "Produksi", "Monitor"]
    : ["Konteks", "Rencana", "Entry", "Kelola", "Ulas"];
  return (
    <div className="grid gap-2 sm:grid-cols-5">
      {items.map((item, index) => (
        <div key={item} className="relative rounded-xl border border-white/8 bg-white/[0.03] px-3 py-5 text-center">
          <span className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/12 font-mono text-[11px] font-bold text-emerald-300">{index + 1}</span>
          <p className="text-xs font-semibold text-white/75">{item}</p>
          {index < items.length - 1 && <span className="absolute -right-2 top-1/2 z-10 hidden text-emerald-400/50 sm:block">→</span>}
        </div>
      ))}
    </div>
  );
}

function ExpectancyVisual() {
  return (
    <svg viewBox="0 0 760 300" role="img" aria-label="Perbandingan win rate dan expectancy dua sistem" className="w-full">
      <rect width="760" height="300" rx="12" fill="#09100e" />
      <line x1="70" x2="710" y1="230" y2="230" stroke="rgba(255,255,255,.12)" />
      <g transform="translate(120 0)">
        <rect x="0" y="142" width="76" height="88" rx="5" fill="#34d399" /><rect x="92" y="186" width="76" height="44" rx="5" fill="#fb7185" />
        <text x="0" y="126" fill="#6ee7b7" fontSize="12">+2R × 40%</text><text x="92" y="170" fill="#fda4af" fontSize="12">-1R × 60%</text><text x="22" y="262" fill="#fff" opacity=".75" fontSize="13" fontWeight="700">SISTEM A · +0,2R</text>
      </g>
      <g transform="translate(445 0)">
        <rect x="0" y="198" width="76" height="32" rx="5" fill="#34d399" /><rect x="92" y="160" width="76" height="70" rx="5" fill="#fb7185" />
        <text x="0" y="182" fill="#6ee7b7" fontSize="12">+0,4R × 70%</text><text x="92" y="144" fill="#fda4af" fontSize="12">-1R × 30%</text><text x="14" y="262" fill="#fff" opacity=".75" fontSize="13" fontWeight="700">SISTEM B · -0,02R</text>
      </g>
    </svg>
  );
}

function DrawdownVisual({ correlation = false }: { correlation?: boolean }) {
  const lines = correlation
    ? ["M45 75 C130 62 165 88 235 78 S350 64 410 100 S520 170 710 222", "M45 92 C120 82 175 102 240 90 S350 80 415 112 S535 184 710 230", "M45 105 C120 92 180 112 250 98 S360 92 425 122 S535 194 710 238"]
    : ["M45 210 C120 188 155 195 220 160 S330 172 390 125 S490 146 555 88 S640 95 710 52", "M45 210 C120 180 160 226 230 198 S340 244 410 210 S510 232 570 196 S655 210 710 180"];
  const colors = correlation ? ["#34d399", "#60a5fa", "#fbbf24"] : ["#34d399", "#fb7185"];
  return (
    <svg viewBox="0 0 760 290" role="img" aria-label={correlation ? "Tiga aset bergerak serupa" : "Perbandingan dua kurva modal"} className="w-full">
      <rect width="760" height="290" rx="12" fill="#09100e" /><GridLines />
      {lines.map((path, index) => <path key={path} d={path} fill="none" stroke={colors[index]} strokeWidth="4" strokeLinecap="round" />)}
      {!correlation && <><text x="570" y="70" fill="#6ee7b7" fontSize="11">risiko 1%</text><text x="570" y="218" fill="#fda4af" fontSize="11">risiko 5%</text></>}
      {correlation && <><line x1="475" x2="475" y1="35" y2="250" stroke="#fb7185" strokeDasharray="5 4" /><text x="487" y="50" fill="#fda4af" fontSize="11">guncangan pasar</text></>}
    </svg>
  );
}

function CostVisual() {
  const items = [{ label: "Kotor", y: 65, h: 165, c: "#34d399", value: "+0,12%" }, { label: "Fee", y: 175, h: 55, c: "#fbbf24", value: "-0,04%" }, { label: "Spread", y: 195, h: 35, c: "#fb923c", value: "-0,03%" }, { label: "Slippage", y: 175, h: 55, c: "#fb7185", value: "-0,05%" }, { label: "Bersih", y: 230, h: 25, c: "#fb7185", value: "-0,00%" }];
  return <svg viewBox="0 0 760 300" role="img" aria-label="Profit kotor berkurang oleh biaya" className="w-full"><rect width="760" height="300" rx="12" fill="#09100e" /><line x1="45" x2="720" y1="230" y2="230" stroke="rgba(255,255,255,.14)" />{items.map((item, i) => <g key={item.label}><rect x={75 + i * 135} y={item.y} width="82" height={item.h} rx="5" fill={item.c} opacity={i === 0 ? .9 : .7} /><text x={80 + i * 135} y={item.y - 10} fill={item.c} fontSize="12">{item.value}</text><text x={88 + i * 135} y="274" fill="#fff" opacity=".55" fontSize="11">{item.label}</text></g>)}</svg>;
}

function ValidationVisual() {
  return (
    <div className="space-y-3 py-3">
      {[0, 1, 2].map((row) => <div key={row} className="grid grid-cols-12 gap-1"><div style={{ gridColumn: `${1 + row * 2} / span 5` }} className="rounded-lg border border-blue-400/20 bg-blue-400/10 px-3 py-4 text-center text-[10px] font-bold text-blue-200">TRAIN</div><div className="col-span-2 rounded-lg border border-emerald-400/25 bg-emerald-400/12 px-2 py-4 text-center text-[10px] font-bold text-emerald-200">TEST</div></div>)}
      <div className="flex justify-between px-1 font-mono text-[9px] text-white/30"><span>masa lalu</span><span>waktu bergerak maju →</span></div>
    </div>
  );
}

function CalibrationVisual() {
  const points = [[120, 224], [190, 205], [260, 165], [335, 152], [410, 114], [485, 120], [560, 76], [635, 55]];
  return <svg viewBox="0 0 760 300" role="img" aria-label="Grafik kalibrasi prediksi dan hasil" className="w-full"><rect width="760" height="300" rx="12" fill="#09100e" /><line x1="70" x2="700" y1="250" y2="30" stroke="#34d399" strokeDasharray="7 6" opacity=".55" /><text x="540" y="46" fill="#6ee7b7" fontSize="10">kalibrasi sempurna</text>{points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill={i === 5 ? "#fbbf24" : "#60a5fa"} />)}<text x="310" y="285" fill="#fff" opacity=".45" fontSize="11">KEYAKINAN MODEL →</text><text transform="rotate(-90 18 190)" x="18" y="190" fill="#fff" opacity=".45" fontSize="11">HASIL NYATA →</text></svg>;
}

function LiquidityVisual() {
  const bids = [92, 126, 168, 204];
  const asks = [198, 154, 112, 72];
  return <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-emerald-400/15 p-4"><p className="mb-3 text-[10px] font-bold tracking-widest text-emerald-300">ANTREAN BELI</p>{bids.map((w, i) => <div key={i} className="mb-2 flex items-center gap-2"><span className="w-14 font-mono text-[10px] text-white/45">99.{7 - i}0</span><div className="h-5 rounded-r bg-emerald-400/35" style={{ width: w }} /></div>)}</div><div className="rounded-xl border border-rose-400/15 p-4"><p className="mb-3 text-[10px] font-bold tracking-widest text-rose-300">ANTREAN JUAL</p>{asks.map((w, i) => <div key={i} className="mb-2 flex items-center gap-2"><span className="w-14 font-mono text-[10px] text-white/45">100.{i + 1}0</span><div className="h-5 rounded-r bg-rose-400/35" style={{ width: w }} /></div>)}</div></div>;
}

function RegimeVisual() {
  return <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-emerald-400/15 p-3"><p className="text-[10px] font-bold text-emerald-300">STRATEGI TREND · COCOK</p><CandleChart data={TREND_DATA.slice(0, 11)} variant="indicators" /></div><div className="rounded-xl border border-rose-400/15 p-3"><p className="text-[10px] font-bold text-rose-300">STRATEGI TREND · TERSAYAT</p><CandleChart data={RANGE_DATA.slice(0, 11)} variant="indicators" /></div></div>;
}

function LevelVisual({ kind }: { kind: VisualKind }) {
  switch (kind) {
    case "market": return <MarketVisual />;
    case "candles": return <CandleAnatomy />;
    case "trend": return <TrendRangeVisual />;
    case "risk": return <CandleChart variant="risk" />;
    case "levels": return <CandleChart variant="levels" />;
    case "structure": return <CandleChart variant="structure" />;
    case "orders": return <CandleChart variant="orders" />;
    case "position": return <PositionVisual />;
    case "timeframes": return <TimeframeVisual />;
    case "volume": return <CandleChart variant="volume" />;
    case "indicators": return <CandleChart variant="indicators" />;
    case "breakout": return <BreakoutVisual />;
    case "journal": return <ProcessVisual />;
    case "backtest": return <CandleChart variant="backtest" />;
    case "expectancy": return <ExpectancyVisual />;
    case "drawdown": return <DrawdownVisual />;
    case "costs": return <CostVisual />;
    case "correlation": return <DrawdownVisual correlation />;
    case "regime": return <RegimeVisual />;
    case "validation": return <ValidationVisual />;
    case "calibration": return <CalibrationVisual />;
    case "liquidity": return <LiquidityVisual />;
    case "governance": return <ProcessVisual governance />;
  }
}

export default function LessonVisual({ kind, title, caption }: { kind: VisualKind; title: string; caption: string }) {
  return <VisualShell title={title} caption={caption}><LevelVisual kind={kind} /></VisualShell>;
}
