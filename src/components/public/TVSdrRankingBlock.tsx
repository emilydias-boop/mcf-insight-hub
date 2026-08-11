export interface TVSdrRankingRow {
  sdr_name: string;
  mes: number;
  dia: number;
}

const MEDALS = ["#ffd24a", "#cbd5e1", "#e08d4a"];

function posStyle(idx: number) {
  const medal = MEDALS[idx];
  return medal
    ? { color: "#050505", backgroundColor: medal }
    : { color: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.08)" };
}

export function TVSdrRankingBlock({
  rows,
  accent,
}: {
  rows?: TVSdrRankingRow[];
  accent: string;
}) {
  const list = rows ?? [];
  // Zona de rebaixamento: os 2 últimos do mês (só faz sentido com 4+ SDRs)
  const relegationFrom = list.length >= 4 ? list.length - 2 : -1;

  return (
    <section
      className="rounded-3xl border p-4 xl:p-7 flex flex-col min-h-0"
      style={{ borderColor: `${accent}4d`, backgroundColor: `${accent}0a` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg xl:text-2xl font-black tracking-widest uppercase" style={{ color: accent }}>
          Ranking SDR
        </h2>
        <span className="text-[10px] xl:text-xs font-bold tracking-widest text-white/40 uppercase">
          R1 agendada
        </span>
      </div>

      <div className="mt-3 xl:mt-5 grid grid-cols-[2rem_1fr_auto_auto] gap-x-2 xl:gap-x-4 text-[10px] xl:text-xs font-black tracking-widest text-white/35 uppercase">
        <span>#</span>
        <span>SDR</span>
        <span className="text-right w-12 xl:w-16">Mês</span>
        <span className="text-right w-10 xl:w-14">Hoje</span>
      </div>

      <div className="flex-1 min-h-0 mt-2 flex flex-col gap-1.5 xl:gap-2 overflow-hidden">
        {list.length === 0 ? (
          <div className="text-white/35 font-semibold italic text-sm mt-4">sem agendamentos no mês</div>
        ) : (
          list.map((r, idx) => {
            const danger = relegationFrom >= 0 && idx >= relegationFrom;
            const isFirstDanger = danger && idx === relegationFrom;
            return (
              <div key={`${r.sdr_name}-${idx}`}>
                {isFirstDanger && (
                  <div className="flex items-center gap-2 my-1.5 xl:my-2">
                    <div className="h-[2px] flex-1" style={{ backgroundColor: "rgba(239,68,68,0.55)" }} />
                    <span className="text-[9px] xl:text-[11px] font-black tracking-widest uppercase text-[#ef4444]">
                      Zona de rebaixamento
                    </span>
                    <div className="h-[2px] flex-1" style={{ backgroundColor: "rgba(239,68,68,0.55)" }} />
                  </div>
                )}
                <div
                  className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-x-2 xl:gap-x-4 rounded-xl border px-2 xl:px-3 py-2 xl:py-3"
                  style={{
                    backgroundColor: danger ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                    borderColor: danger ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.10)",
                  }}
                >
                  <span
                    className="h-6 w-6 xl:h-8 xl:w-8 rounded-lg flex items-center justify-center text-xs xl:text-base font-black"
                    style={posStyle(idx)}
                  >
                    {idx + 1}
                  </span>
                  <span className="truncate text-sm xl:text-lg font-bold text-white/90">{r.sdr_name}</span>
                  <span
                    className="text-right w-12 xl:w-16 text-2xl xl:text-4xl font-black leading-none"
                    style={{ color: danger ? "#ef4444" : accent }}
                  >
                    {r.mes}
                  </span>
                  <span className="text-right w-10 xl:w-14 text-base xl:text-2xl font-black leading-none text-white/55">
                    {r.dia}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 xl:mt-3 text-[10px] xl:text-xs text-white/30 font-semibold">
        Ordenado pelo total do mês · inclui realizada, no-show e cancelada
      </div>
    </section>
  );
}
