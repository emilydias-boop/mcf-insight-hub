export interface TVLigacaoRankingPeriod {
  total: number;
  nao_atendidas: number;
  efetivas: number;
}

export interface TVLigacaoRankingRow {
  sdr_name: string;
  dia: TVLigacaoRankingPeriod;
  mes: TVLigacaoRankingPeriod;
}

const MEDALS = ["#ffd24a", "#cbd5e1", "#e08d4a"];

function posStyle(idx: number) {
  const medal = MEDALS[idx];
  return medal
    ? { color: "#050505", backgroundColor: medal }
    : { color: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.08)" };
}

function PeriodStats({ p, accent }: { p: TVLigacaoRankingPeriod; accent: string }) {
  return (
    <span className="text-xl xl:text-3xl font-black leading-none" style={{ color: accent }}>
      {p.total}
    </span>
  );
}

export function TVLigacaoRankingBlock({
  rows,
  accent,
}: {
  rows?: TVLigacaoRankingRow[];
  accent: string;
}) {
  const list = rows ?? [];

  return (
    <section
      className="rounded-3xl border p-3 xl:p-5 flex flex-col min-h-0"
      style={{ borderColor: `${accent}4d`, backgroundColor: `${accent}0a` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base xl:text-2xl font-black tracking-widest uppercase" style={{ color: accent }}>
          Ranking Ligações
        </h2>
        <span className="text-[10px] xl:text-xs font-bold tracking-widest text-white/40 uppercase">
          Total · Não atend. · Efetivas
        </span>
      </div>

      <div className="mt-2 xl:mt-3 flex items-center gap-2 text-[10px] xl:text-xs font-black tracking-widest text-white/35 uppercase">
        <span className="w-8">#</span>
        <span className="flex-1">SDR</span>
        <span className="w-[7.5rem] xl:w-[9.5rem] text-center">Mês</span>
        <span className="w-[7.5rem] xl:w-[9.5rem] text-center">Hoje</span>
      </div>

      <div className="flex-1 min-h-0 mt-2 flex flex-col gap-1 xl:gap-1.5 overflow-hidden">
        {list.length === 0 ? (
          <div className="text-white/35 font-semibold italic text-sm mt-3">sem ligações no mês</div>
        ) : (
          list.map((r, idx) => (
            <div
              key={`${r.sdr_name}-${idx}`}
              className="flex items-center gap-2 rounded-xl border px-2 xl:px-3 py-1.5 xl:py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}
            >
              <span
                className="h-6 w-6 xl:h-7 xl:w-7 rounded-lg flex items-center justify-center text-xs xl:text-sm font-black shrink-0"
                style={posStyle(idx)}
              >
                {idx + 1}
              </span>
              <span className="flex-1 truncate text-sm xl:text-base font-bold text-white/90">{r.sdr_name}</span>
              <div className="w-[7.5rem] xl:w-[9.5rem] flex justify-center">
                <PeriodStats p={r.mes} accent={accent} />
              </div>
              <div className="w-[7.5rem] xl:w-[9.5rem] flex justify-center">
                <PeriodStats p={r.dia} accent={accent} />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-2 text-[10px] xl:text-xs text-white/30 font-semibold">
        Ordenado pelo total de ligações do mês
      </div>
    </section>
  );
}
