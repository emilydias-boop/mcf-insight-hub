import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Trophy, Flame, Target, TrendingUp, Zap, Rocket, Sparkles, Users } from "lucide-react";
import { CampaignCarousel } from "./CampaignCarousel";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtBRLShort = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return fmtBRL(v);
};

interface WeekData {
  index: number;
  metaSemana: number;
  realizado: number;
  isCurrent: boolean;
  diasUteis: number;
  start: Date;
  end: Date;
}

export interface TVCloserData {
  id: string;
  name: string;
  color?: string | null;
  metaIndividual: number;
  realizado: number;
}

interface Props {
  meta: number;
  realizado: number;
  realizadoHoje: number;
  metaDia: number;
  diasUteis: number;
  semanas: WeekData[];
  monthStart: Date;
  onClose: () => void;
  accent?: "lime" | "orange";
  title?: string;
  subtitle?: string;
  showCampaign?: boolean;
  closers?: TVCloserData[];
}

export function BITVMode({
  meta, realizado, realizadoHoje, metaDia, diasUteis, semanas, monthStart, onClose,
  accent = "lime", title = "MCF · BI Consórcio ao vivo", subtitle,
  showCampaign: enableCampaign = true, closers,
}: Props) {
  const ACC = accent === "orange" ? "#ff7a00" : "#bfff00";
  const ACC_GLOW = accent === "orange" ? "rgba(255,122,0,0.6)" : "rgba(191,255,0,0.6)";
  const ACC_SHADOW = accent === "orange" ? "rgba(255,122,0,0.5)" : "rgba(191,255,0,0.5)";
  const ACC_STOP2 = accent === "orange" ? "#f43f5e" : "#10b981";
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Carrossel: primeira aparição em 15s; depois, sempre 5 min após fechar.
  const [showCampaign, setShowCampaign] = useState(false);
  const [hasShownOnce, setHasShownOnce] = useState(false);
  useEffect(() => {
    if (!enableCampaign) return;
    if (showCampaign) return;
    const delay = hasShownOnce ? 5 * 60 * 1000 : 15 * 1000;
    const t = setTimeout(() => {
      setShowCampaign(true);
      setHasShownOnce(true);
    }, delay);
    return () => clearTimeout(t);
  }, [showCampaign, hasShownOnce, enableCampaign]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const pct = meta > 0 ? Math.min(100, (realizado / meta) * 100) : 0;
  const falta = Math.max(0, meta - realizado);
  const bateu = pct >= 100;

  // gauge
  const radius = 200;
  const circ = 2 * Math.PI * radius;
  const dash = (Math.min(pct, 100) / 100) * circ;

  const semAtual = semanas.find(s => s.isCurrent);
  const pctHoje = metaDia > 0 ? Math.min(200, (realizadoHoje / metaDia) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#050505] text-white">
      {enableCampaign && showCampaign && <CampaignCarousel onClose={() => setShowCampaign(false)} />}
      {/* animated background */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[180px] animate-pulse" style={{ backgroundColor: ACC }} />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full blur-[200px] animate-pulse" style={{ animationDelay: "1s", backgroundColor: ACC_STOP2 }} />
        <div className="absolute top-1/3 left-1/2 w-[500px] h-[500px] rounded-full bg-fuchsia-600 blur-[220px] opacity-40" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* close */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-20 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full p-3 transition"
        aria-label="Fechar modo TV"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="relative z-10 h-full w-full p-8 xl:p-12 flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="text-black rounded-2xl p-3" style={{ backgroundColor: ACC, boxShadow: `0 0 40px ${ACC_GLOW}` }}>
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color: ACC }}>{title}</div>
              <div className="text-4xl xl:text-5xl font-black tracking-tight capitalize">
                {subtitle ?? format(monthStart, "MMMM 'de' yyyy", { locale: ptBR })}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-6xl xl:text-7xl font-black tabular-nums tracking-tight">
              {format(now, "HH:mm")}
              <span className="animate-pulse" style={{ color: ACC }}>:</span>
              <span className="text-3xl align-top">{format(now, "ss")}</span>
            </div>
            <div className="text-sm uppercase tracking-widest text-white/60 mt-1 capitalize">
              {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </div>
          </div>
        </div>

        {/* main grid */}
        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
          {/* Gauge central */}
          <div className="col-span-12 lg:col-span-5 relative rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-sm p-8 flex flex-col items-center justify-center overflow-hidden">
            {bateu && (
              <div className="absolute inset-0 animate-pulse" style={{ background: `linear-gradient(135deg, ${ACC}33, ${ACC_STOP2}33)` }} />
            )}
            <div className="text-xs uppercase tracking-[0.4em] text-white/60 font-bold mb-2">Meta do mês</div>
            <div className="relative">
              <svg width="460" height="460" viewBox="0 0 460 460" className="-rotate-90 max-w-full h-auto">
                <defs>
                  <linearGradient id="tvGrad" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor={ACC} />
                    <stop offset="100%" stopColor={ACC_STOP2} />
                  </linearGradient>
                </defs>
                <circle cx="230" cy="230" r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="28" fill="none" />
                <circle
                  cx="230" cy="230" r={radius}
                  stroke="url(#tvGrad)"
                  strokeWidth="28"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  style={{ filter: `drop-shadow(0 0 20px ${ACC_GLOW})`, transition: "stroke-dasharray 1s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-7xl xl:text-8xl font-black tabular-nums" style={{ color: ACC, textShadow: `0 0 30px ${ACC_SHADOW}` }}>
                  {pct.toFixed(1)}
                  <span className="text-3xl">%</span>
                </div>
                <div className="text-xl xl:text-2xl font-bold mt-2 tabular-nums">
                  {fmtBRLShort(realizado)}
                </div>
                <div className="text-sm text-white/60 tabular-nums">de {fmtBRLShort(meta)}</div>
                {bateu ? (
                  <div className="mt-4 flex items-center gap-2 text-black px-4 py-2 rounded-full font-black text-sm uppercase tracking-widest" style={{ backgroundColor: ACC }}>
                    <Trophy className="h-5 w-5" /> Meta batida!
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-white/70">
                    faltam <span className="font-bold text-white tabular-nums">{fmtBRLShort(falta)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-6 min-h-0">
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-4">
              <TVStat
                icon={<Zap className="h-6 w-6" />}
                label="Hoje"
                value={fmtBRLShort(realizadoHoje)}
                hint={`meta/dia ${fmtBRLShort(metaDia)}`}
                intensity={pctHoje}
                accent={accent === "orange" ? "orange" : "lime"}
              />
              <TVStat
                icon={<Target className="h-6 w-6" />}
                label="Dias úteis"
                value={String(diasUteis)}
                hint="no mês"
                accent="cyan"
              />
              <TVStat
                icon={<TrendingUp className="h-6 w-6" />}
                label="Semana atual"
                value={semAtual ? fmtBRLShort(semAtual.realizado) : "-"}
                hint={semAtual ? `de ${fmtBRLShort(semAtual.metaSemana)}` : ""}
                intensity={semAtual && semAtual.metaSemana > 0 ? (semAtual.realizado / semAtual.metaSemana) * 100 : 0}
                accent="fuchsia"
              />
            </div>

            {/* Weekly leaderboard */}
            <div className="flex-1 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-sm p-6 min-h-0 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" style={{ color: ACC }} />
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60 font-bold">Ranking Semanal</div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  AO VIVO
                </div>
              </div>
              <div className="grid gap-3 overflow-hidden">
                {semanas.map((s) => {
                  const p = s.metaSemana > 0 ? Math.min(120, (s.realizado / s.metaSemana) * 100) : 0;
                  const done = s.realizado >= s.metaSemana && s.metaSemana > 0;
                  return (
                    <div
                      key={s.index}
                      className={
                        "relative rounded-2xl border p-4 transition-all " +
                        (s.isCurrent
                          ? "shadow-[0_0_30px_-10px_rgba(255,255,255,0.3)]"
                          : "border-white/10 bg-white/[0.02]")
                      }
                      style={s.isCurrent ? { borderColor: `${ACC}99`, backgroundColor: `${ACC}0d` } : undefined}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={
                              "h-10 w-10 rounded-xl flex items-center justify-center font-black text-lg " +
                              (done
                                ? "text-black"
                                : s.isCurrent
                                  ? "bg-white/10 border"
                                  : "bg-white/5 text-white/60")
                            }
                            style={done
                              ? { backgroundColor: ACC }
                              : s.isCurrent
                                ? { color: ACC, borderColor: `${ACC}66` }
                                : undefined}
                          >
                            {done ? <Trophy className="h-5 w-5" /> : s.index}
                          </div>
                          <div>
                            <div className="font-bold text-base flex items-center gap-2">
                              Semana {s.index}
                              {s.isCurrent && (
                                <span className="text-[10px] font-black uppercase tracking-widest text-black px-2 py-0.5 rounded" style={{ backgroundColor: ACC }}>
                                  Agora
                                </span>
                              )}
                              {done && !s.isCurrent && <Flame className="h-4 w-4 text-orange-400" />}
                            </div>
                            <div className="text-xs text-white/50 tabular-nums">
                              {format(s.start, "dd/MM")} → {format(s.end, "dd/MM")} · {s.diasUteis}d
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black tabular-nums" style={{ color: ACC }}>
                            {fmtBRLShort(s.realizado)}
                          </div>
                          <div className="text-xs text-white/50 tabular-nums">
                            de {fmtBRLShort(s.metaSemana)}
                          </div>
                        </div>
                      </div>
                      <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(100, p)}%`,
                            boxShadow: `0 0 12px ${ACC_GLOW}`,
                            background: done
                              ? `linear-gradient(90deg, ${ACC}, ${ACC_STOP2})`
                              : `linear-gradient(90deg, #d946ef, ${ACC}, ${ACC_STOP2})`,
                          }}
                        />
                      </div>
                      <div className="mt-1 text-right text-xs font-bold tabular-nums text-white/70">
                        {p.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-white/40 uppercase tracking-[0.3em]">
          Atualizado automaticamente · ESC para sair
        </div>
      </div>
    </div>
  );
}

function TVStat({
  icon, label, value, hint, intensity = 0, accent = "lime",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  intensity?: number;
  accent?: "lime" | "cyan" | "fuchsia" | "orange";
}) {
  const colors = {
    lime: { text: "text-[#bfff00]", bg: "bg-[#bfff00]/10", border: "border-[#bfff00]/30", glow: "rgba(191,255,0,0.4)" },
    orange: { text: "text-[#ff7a00]", bg: "bg-[#ff7a00]/10", border: "border-[#ff7a00]/30", glow: "rgba(255,122,0,0.4)" },
    cyan: { text: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/30", glow: "rgba(34,211,238,0.4)" },
    fuchsia: { text: "text-fuchsia-400", bg: "bg-fuchsia-400/10", border: "border-fuchsia-400/30", glow: "rgba(232,121,249,0.4)" },
  }[accent];
  return (
    <div className={`relative rounded-2xl border ${colors.border} ${colors.bg} backdrop-blur-sm p-5 overflow-hidden`}>
      <div className="flex items-center gap-2 text-white/70">
        <span className={colors.text}>{icon}</span>
        <span className="text-[10px] uppercase tracking-[0.25em] font-bold">{label}</span>
      </div>
      <div className={`text-3xl xl:text-4xl font-black tabular-nums mt-2 ${colors.text}`} style={{ textShadow: `0 0 20px ${colors.glow}` }}>
        {value}
      </div>
      {hint && <div className="text-xs text-white/50 mt-1 tabular-nums">{hint}</div>}
      {intensity > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-[#bfff00]`}
            style={{ width: `${Math.min(100, intensity)}%` }}
          />
        </div>
      )}
    </div>
  );
}