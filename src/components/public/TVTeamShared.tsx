import { ReactNode, useEffect } from "react";

export interface Metric {
  atual: number;
  meta: number;
  pct_agendados?: number;
  meta_calculada?: boolean;
}

export function formatDataHoje(iso?: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return iso;
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

export function TVMetricCard({
  titulo, metric, metricB, accent, invertGoal, format,
}: {
  titulo: string;
  metric?: Metric;
  /** Lead B: exibido apenas como número realizado, sem meta/barra/%. */
  metricB?: Metric;
  accent: string;
  invertGoal?: boolean;
  format?: (v: number) => string;
}) {
  const atual = Number(metric?.atual ?? 0);
  const meta = Number(metric?.meta ?? 0);
  const hasMeta = meta > 0;
  const pct = hasMeta ? (atual / meta) * 100 : 0;
  const overGoal = hasMeta && atual > meta;
  const alert = !!invertGoal && overGoal;
  const color = alert ? "#ef4444" : accent;
  const fmt = format ?? ((v: number) => v.toLocaleString("pt-BR"));

  return (
    <div
      className="rounded-2xl border p-4 xl:p-6 flex flex-col justify-between"
      style={{
        backgroundColor: alert ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.04)",
        borderColor: alert ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.10)",
      }}
    >
      <div className="text-white/60 uppercase tracking-widest text-[10px] xl:text-xs font-bold">{titulo}</div>
      {metricB ? (
        <div className="mt-1 text-[10px] xl:text-xs font-black tracking-widest" style={{ color: `${accent}cc` }}>
          LEAD A
        </div>
      ) : null}
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <span className="text-4xl xl:text-6xl font-black leading-none" style={{ color }}>
          {fmt(atual)}
        </span>
        {hasMeta && (
          <span className="text-xl xl:text-2xl font-bold text-white/40">
            / {fmt(meta)}
            {metric?.meta_calculada ? <span className="ml-1 text-white/30">*</span> : null}
          </span>
        )}
      </div>
      {metric?.pct_agendados != null && (
        <div className="mt-1 text-xs xl:text-sm text-white/50 font-semibold">
          {Number(metric.pct_agendados).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos agendados
        </div>
      )}
      {hasMeta ? (
        <div className="mt-3">
          <div className="h-2 xl:h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] xl:text-xs font-bold text-white/50">
            <span>{metric?.meta_calculada ? "* meta diária estimada" : ""}</span>
            <span style={alert ? { color } : undefined}>
              {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 text-[11px] xl:text-sm text-white/35 font-semibold italic">meta não configurada</div>
      )}
      {metricB ? (
        <div className="mt-3 xl:mt-4 pt-3 border-t flex items-baseline gap-2" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <span className="text-[10px] xl:text-xs font-black tracking-widest text-white/45">LEAD B</span>
          <span className="text-2xl xl:text-4xl font-black leading-none text-white/75">
            {fmt(Number(metricB.atual ?? 0))}
          </span>
          <span className="text-[10px] xl:text-xs font-semibold text-white/30">sem meta</span>
        </div>
      ) : null}
    </div>
  );
}

export function TVSection({ label, accent, children }: { label: string; accent: string; children: ReactNode }) {
  return (
    <section
      className="rounded-3xl border p-4 xl:p-7 flex flex-col min-h-0"
      style={{ borderColor: `${accent}4d`, backgroundColor: `${accent}0a` }}
    >
      <h2 className="text-lg xl:text-2xl font-black tracking-widest uppercase" style={{ color: accent }}>
        {label}
      </h2>
      <div className="flex-1 min-h-0 mt-4 xl:mt-6 flex flex-col">{children}</div>
    </section>
  );
}

export function TVShell({
  title, subtitle, accent, today, updatedAt, children, side, mainRowsClassName = "grid-rows-2", warning,
}: {
  title: string; subtitle: string; accent: string; today?: string; updatedAt?: string; children: ReactNode;
  /** Coluna lateral opcional (ex.: ranking de SDRs), ocupa altura cheia à direita. */
  side?: ReactNode;
  /** Override das rows do grid principal quando não há `side`. Default "grid-rows-2". */
  mainRowsClassName?: string;
  /** Aviso destacado no cabeçalho (ex.: dados atrasados). */
  warning?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-[#050505] text-white overflow-hidden flex flex-col p-5 xl:p-9">
      <header className="flex items-center justify-between shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <span className="relative flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-70 animate-ping" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-[#22c55e]" />
          </span>
          <div>
            <h1 className="text-xl xl:text-3xl font-black tracking-tight">
              {title} <span className="text-white/40">ao vivo</span>
            </h1>
            <div className="text-sm xl:text-xl font-black tracking-wide" style={{ color: accent }}>{subtitle}</div>
          </div>
        </div>
        {warning ? (
          <div
            className="rounded-xl border px-3 py-2 text-xs xl:text-sm font-bold"
            style={{ borderColor: "rgba(245,158,11,0.6)", backgroundColor: "rgba(245,158,11,0.12)", color: "#fbbf24" }}
          >
            {warning}
          </div>
        ) : null}
        <div className="text-right">
          <div className="text-base xl:text-2xl font-bold capitalize">{formatDataHoje(today)}</div>
          <div className="text-xs xl:text-sm text-white/40">
            Atualizado {updatedAt ? new Date(updatedAt).toLocaleTimeString("pt-BR") : ""}
          </div>
        </div>
      </header>


      {side ? (
        <main className="flex-1 min-h-0 mt-5 xl:mt-8 grid grid-cols-3 gap-5 xl:gap-8">
          <div className="col-span-2 min-h-0 grid grid-rows-2 gap-5 xl:gap-8">{children}</div>
          <div className="min-h-0 flex flex-col">{side}</div>
        </main>
      ) : (
        <main className={`flex-1 min-h-0 mt-5 xl:mt-8 grid gap-5 xl:gap-8 ${mainRowsClassName}`}>{children}</main>
      )}

      <footer className="shrink-0 mt-3 xl:mt-5 text-center text-[11px] xl:text-sm text-white/30">
        Dados atualizados automaticamente a cada 45 segundos · nenhuma ação necessária
      </footer>
    </div>
  );
}

export function TVMsg({ title, msg, accent }: { title: string; msg: string; accent: string }) {
  return (
    <div className="fixed inset-0 bg-[#050505] text-white flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-4xl font-black" style={{ color: accent }}>{title}</div>
      <div className="text-white/70">{msg}</div>
    </div>
  );
}
