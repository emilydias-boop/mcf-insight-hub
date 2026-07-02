import { Trophy, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtM = (v: number) => `R$ ${(v / 1_000_000).toFixed(2)}M`;

export interface WeekDatum {
  index: number;
  metaSemana: number;
  realizado: number;
  isCurrent: boolean;
}

interface Props {
  meta: number;
  realizado: number;
  semanas: WeekDatum[];
}

export function BIProgressGauge({ meta, realizado, semanas }: Props) {
  const pct = meta > 0 ? realizado / meta : 0;
  const pctClamped = Math.min(pct, 1);
  const pctDisplay = Math.round(pct * 100);
  const diff = realizado - meta;
  const bateu = realizado >= meta && meta > 0;

  // Semi-circle geometry
  const W = 520;
  const H = 260;
  const cx = W / 2;
  const cy = H - 20;
  const r = 200;
  const stroke = 22;

  const polar = (percent: number) => {
    // percent 0 => left (180deg), 1 => right (0deg)
    const angle = Math.PI * (1 - percent);
    return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  };

  const arcPath = (from: number, to: number) => {
    const s = polar(from);
    const e = polar(to);
    const large = to - from > 0.5 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const bgArc = arcPath(0, 1);
  const fgArc = arcPath(0, Math.max(0.001, pctClamped));

  // Cumulative points per week (meta esperada vs realizado acumulado)
  const totalMeta = semanas.reduce((a, s) => a + s.metaSemana, 0) || meta || 1;
  let cumMeta = 0;
  let cumReal = 0;
  const points = semanas.map((s) => {
    cumMeta += s.metaSemana;
    cumReal += s.realizado;
    const p = Math.min(cumMeta / totalMeta, 1);
    const pr = Math.min(cumReal / totalMeta, 1);
    const inner = r - stroke - 18;
    const polarInner = (percent: number, radius: number) => {
      const angle = Math.PI * (1 - percent);
      return { x: cx + radius * Math.cos(angle), y: cy - radius * Math.sin(angle) };
    };
    return {
      idx: s.index,
      isCurrent: s.isCurrent,
      meta: polarInner(p, inner),
      real: polarInner(pr, inner - 20),
      pctReal: cumMeta > 0 ? Math.round((cumReal / cumMeta) * 100) : 0,
    };
  });

  const status = bateu ? "success" : pct >= 0.7 ? "primary" : "danger";
  const trackClass =
    status === "success"
      ? "stroke-emerald-500"
      : status === "primary"
        ? "stroke-primary"
        : "stroke-destructive";

  return (
    <div className="rounded-2xl border bg-card p-6 md:p-8 relative overflow-hidden">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Progresso da Meta <Trophy className="h-5 w-5 text-primary" />
          </h3>
          <p className="text-sm text-muted-foreground">
            Realizado acumulado vs meta mensal
          </p>
        </div>
        <div className="text-right">
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-4 py-2",
              bateu
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                : pct >= 0.7
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            <span className="text-3xl font-bold leading-none">{pctDisplay}%</span>
          </div>
          <div className="text-xs mt-2 flex items-center justify-end gap-1">
            {diff >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            )}
            <span
              className={cn(
                "font-semibold",
                diff >= 0 ? "text-emerald-500" : "text-destructive",
              )}
            >
              {diff >= 0 ? "+" : ""}
              {fmtM(diff)} {diff >= 0 ? "acima" : "abaixo"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {fmtM(realizado)} / {fmtM(meta)}
          </div>
        </div>
      </div>

      {/* Gauge */}
      <div className="relative w-full flex items-center justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl">
          <path
            d={bgArc}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            strokeLinecap="round"
            opacity={0.35}
          />
          <path
            d={fgArc}
            fill="none"
            className={trackClass}
            strokeWidth={stroke}
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 0 10px hsl(var(--primary) / 0.55))",
              transition: "all .8s ease",
            }}
          />

          {/* Meta esperada (linha roxa) */}
          <polyline
            points={points.map((p) => `${p.meta.x},${p.meta.y}`).join(" ")}
            fill="none"
            stroke="hsl(270 70% 65%)"
            strokeWidth={2}
            strokeDasharray="4 4"
            opacity={0.9}
          />
          {/* Realizado (linha verde) */}
          <polyline
            points={points.map((p) => `${p.real.x},${p.real.y}`).join(" ")}
            fill="none"
            stroke="hsl(142 70% 50%)"
            strokeWidth={2.5}
            opacity={0.95}
          />

          {points.map((p) => (
            <g key={`m-${p.idx}`}>
              <circle
                cx={p.meta.x}
                cy={p.meta.y}
                r={5}
                fill="hsl(270 70% 65%)"
                stroke="hsl(var(--card))"
                strokeWidth={1.5}
              />
              <text
                x={p.meta.x}
                y={p.meta.y - 10}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={10}
              >
                S{p.idx}
              </text>
            </g>
          ))}
          {points.map((p) => (
            <g key={`r-${p.idx}`}>
              <circle
                cx={p.real.x}
                cy={p.real.y}
                r={p.isCurrent ? 7 : 5}
                fill="hsl(142 70% 50%)"
                stroke="hsl(var(--card))"
                strokeWidth={1.5}
              />
              <text
                x={p.real.x}
                y={p.real.y + 16}
                textAnchor="middle"
                fill="hsl(142 70% 50%)"
                fontSize={10}
                fontWeight={600}
              >
                {p.pctReal}%
              </text>
            </g>
          ))}

          {/* Center label */}
          <text
            x={cx}
            y={cy - 40}
            textAnchor="middle"
            className={cn(
              "font-bold",
              bateu ? "fill-emerald-500" : pct >= 0.7 ? "fill-primary" : "fill-destructive",
            )}
            fontSize={44}
          >
            {pctDisplay}%
          </text>
          <text
            x={cx}
            y={cy - 14}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={12}
            fontWeight={600}
          >
            {bateu ? "★ META SUPERADA" : pct >= 0.7 ? "NO RITMO" : "ATENÇÃO"}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground mt-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: "hsl(270 70% 65%)" }} />
          Meta esperada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ background: "hsl(142 70% 50%)" }} />
          Realizado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-primary" />
          Semana atual
        </span>
      </div>

      {/* Banner */}
      <div
        className={cn(
          "mt-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-center gap-2",
          bateu
            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30"
            : pct >= 0.7
              ? "bg-primary/10 text-primary border border-primary/30"
              : "bg-destructive/10 text-destructive border border-destructive/30",
        )}
      >
        {bateu ? (
          <>
            <Sparkles className="h-4 w-4" />
            Meta superada em {(pct * 100 - 100).toFixed(1)}% — {fmtM(diff)} acima do objetivo!
            <Sparkles className="h-4 w-4" />
          </>
        ) : pct >= 0.7 ? (
          <>Faltam {fmtM(Math.max(0, meta - realizado))} para bater a meta.</>
        ) : (
          <>Atenção: {fmtM(Math.max(0, meta - realizado))} restantes para a meta mensal.</>
        )}
      </div>

      {/* Week bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
        {semanas.map((s) => {
          const p = s.metaSemana > 0 ? (s.realizado / s.metaSemana) * 100 : 0;
          const okBar = p >= 100;
          const warnBar = p >= 70 && p < 100;
          return (
            <div
              key={s.index}
              className={cn(
                "rounded-xl border px-3 py-3",
                s.isCurrent
                  ? "border-primary/50 bg-primary/5 shadow-[0_0_16px_-6px_hsl(var(--primary)/0.5)]"
                  : "border-border/60 bg-background/40",
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  Sem {s.index}
                  {s.isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                </span>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    okBar ? "text-emerald-500" : warnBar ? "text-primary" : "text-destructive",
                  )}
                >
                  {Math.round(p)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    okBar ? "bg-emerald-500" : warnBar ? "bg-primary" : "bg-destructive",
                  )}
                  style={{ width: `${Math.min(100, p)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                <span>{fmtM(s.realizado)}</span>
                <span>{fmtM(s.metaSemana)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}