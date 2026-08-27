import { ReactNode, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TVShell, TVMsg } from "@/components/public/TVTeamShared";


const TOKEN = "24151d71-1f8e-44b9-9761-b01f1fca7bec";

const ACCENT = "#bfff00";
const ROXO = "#7c5cff";

interface ContratosBloco {
  cotas: number;
  clientes: number;
  credito: number;
  ticket: number;
  por_closer?: unknown[];
}
interface AgendaBloco {
  agendadas: number;
  realizadas: number;
  no_show: number;
  por_sdr?: unknown[];
}
interface RankingCloser { nome: string; cotas: number; clientes: number; credito: number }
interface RankingSdr { nome: string; agendadas: number; realizadas: number }

interface Payload {
  today: string;
  updated_at: string;
  snapshot_em?: string;
  snapshot_atrasado?: boolean;
  meta_credito_mes?: number | null;
  contratos?: { dia?: ContratosBloco; mes?: ContratosBloco };
  agenda?: { dia?: AgendaBloco; mes?: AgendaBloco };
  ranking_closer?: RankingCloser[];
  ranking_sdr?: RankingSdr[];
  ranking_sdr_dia?: RankingSdr[];
  error?: string;
}

function abreviarBRL(v: number) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000)
    return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mi`;
  if (Math.abs(n) >= 1_000)
    return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function num(v: number) {
  return Number(v || 0).toLocaleString("pt-BR");
}

function pctTexto(parte: number, total: number) {
  if (!total) return "0%";
  return `${((parte / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}

/** Primeiro + último nome ("Andre dos Santos Duarte" → "Andre Duarte"). */
function primeiroEUltimoNome(nome: string) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

/** Fração "realizadas/agendadas" — numerador em destaque, resto discreto. */
function Fracao({ numerador, denominador, cor }: { numerador: number; denominador: number; cor: string }) {
  return (
    <span className="inline-flex items-baseline">
      <span style={{ color: cor }}>{num(numerador)}</span>
      {denominador > 0 ? (
        <span className="text-white/45 text-base xl:text-2xl">/{num(denominador)}</span>
      ) : null}
    </span>
  );
}

/**
 * Cartão de largura total do crédito efetivado: arco largo e raso desenhado em
 * SVG, com todos os textos em HTML sobreposto (texto dentro do SVG escalava
 * junto com o desenho e transbordava).
 */
function CreditoArcoCard({
  creditoMes,
  creditoHoje,
  meta,
  pct,
}: {
  creditoMes: number;
  creditoHoje: number;
  meta: number;
  pct: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [comprimento, setComprimento] = useState(1120);
  useEffect(() => {
    const total = pathRef.current?.getTotalLength();
    if (total && Number.isFinite(total)) setComprimento(total);
  }, []);

  const arco = "M 40 140 Q 500 -30 960 140";
  const progresso = (Math.min(Math.max(pct, 0), 100) / 100) * comprimento;

  return (
    <div
      className="rounded-2xl border p-2 xl:p-3 flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}
    >
      <div className="text-white/60 uppercase tracking-widest text-[10px] xl:text-sm font-bold">
        Crédito efetivado
      </div>

      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-y-0 inset-x-[7%]">
          <svg
            viewBox="0 0 1000 150"
            preserveAspectRatio="none"
            className="w-full h-full"
            role="img"
            aria-label={`Crédito do mês: ${pct.toFixed(0)}% da meta`}
          >
            <path
              d={arco}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={13}
              strokeLinecap="round"
            />
            <path
              ref={pathRef}
              d={arco}
              fill="none"
              stroke={ACCENT}
              strokeWidth={13}
              strokeLinecap="round"
              strokeDasharray={`${progresso} ${comprimento}`}
              style={{ transition: "stroke-dasharray 700ms ease-out" }}
            />
          </svg>
        </div>

        {/* Valor central em HTML: não escala com o desenho. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-[8%] pointer-events-none">
          <div className="text-3xl xl:text-6xl font-black leading-none" style={{ color: ACCENT }}>
            {abreviarBRL(creditoMes)}
          </div>
          <div className="mt-2 text-xs xl:text-lg font-bold text-white/70">
            <span>{pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
            <span className="ml-1.5">da meta</span>
          </div>
        </div>



        <div className="absolute left-1 bottom-0 xl:left-3">
          <div className="text-[9px] xl:text-[11px] tracking-widest text-white/35 font-black uppercase">Hoje</div>
          <div className="text-sm xl:text-2xl font-black text-white/80 leading-none">{abreviarBRL(creditoHoje)}</div>
        </div>
        <div className="absolute right-1 bottom-0 text-right xl:right-3">
          <div className="text-[9px] xl:text-[11px] tracking-widest text-white/35 font-black uppercase">Meta</div>
          <div className="text-sm xl:text-2xl font-black text-white/80 leading-none">{abreviarBRL(meta)}</div>
        </div>
      </div>
    </div>
  );
}

/** Mesmo cartão de largura total, sem arco, quando não há meta configurada. */
function CreditoSemMetaCard({ creditoMes, creditoHoje }: { creditoMes: number; creditoHoje: number }) {
  return (
    <div
      className="rounded-2xl border p-2 xl:p-3 flex flex-col flex-1 min-h-0"

      style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}
    >
      <div className="text-white/60 uppercase tracking-widest text-[10px] xl:text-sm font-bold">
        Crédito efetivado
      </div>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
        <div className="flex items-baseline gap-3 xl:gap-5">
          <span className="text-[10px] xl:text-sm tracking-widest text-white/40 font-black uppercase">Hoje</span>
          <span className="text-2xl xl:text-4xl font-black" style={{ color: ACCENT }}>
            {abreviarBRL(creditoHoje)}
          </span>
          <span className="text-white/20">·</span>
          <span className="text-[10px] xl:text-sm tracking-widest text-white/40 font-black uppercase">Mês</span>
          <span className="text-2xl xl:text-4xl font-black" style={{ color: ACCENT }}>
            {abreviarBRL(creditoMes)}
          </span>
        </div>
        <div className="text-[11px] xl:text-sm text-white/35 font-semibold italic">meta não configurada</div>
      </div>
    </div>
  );
}



/** Cartão com duas colunas internas: HOJE e MÊS, separadas por divisória vertical. */
function DiaMesBlocoCard({
  titulo,
  accent,
  alerta,
  hoje,
  mes,
}: {
  titulo: string;
  accent: string;
  alerta?: boolean;
  hoje: { valor: ReactNode; titleAttr?: string; rodape?: ReactNode; conteudo?: ReactNode };
  mes: { valor: ReactNode; titleAttr?: string; rodape?: ReactNode; conteudo?: ReactNode };
}) {
  const cor = alerta ? "#ef4444" : accent;
  return (
    <div
      className="rounded-2xl border p-2 xl:p-3 flex flex-col min-h-0"
      style={{
        backgroundColor: alerta ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.04)",
        borderColor: alerta ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.10)",
      }}
    >
      <div className="text-white/60 uppercase tracking-widest text-[10px] xl:text-sm font-bold">{titulo}</div>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-2 xl:gap-3 mt-1">
        {([["Hoje", hoje], ["Mês", mes]] as const).map(([label, bloco], i) => (
          <div
            key={label}
            className={`flex flex-col justify-center min-w-0 ${i === 1 ? "pl-2 xl:pl-3 border-l" : ""}`}
            style={i === 1 ? { borderColor: "rgba(255,255,255,0.12)" } : undefined}
          >
            <div className="text-[10px] xl:text-xs font-black tracking-widest text-white/40 uppercase">{label}</div>
            {bloco.conteudo ? (
              <div className="mt-0.5">{bloco.conteudo}</div>
            ) : (
              <>
                <div
                  className="mt-1 text-2xl xl:text-5xl font-black leading-none truncate"
                  style={{ color: cor }}
                  title={bloco.titleAttr}
                >
                  {bloco.valor}
                </div>
                {bloco.rodape ? <div className="mt-1">{bloco.rodape}</div> : null}
              </>
            )}
          </div>

        ))}
      </div>
    </div>
  );
}


function RankingShell({
  titulo,
  extra,
  accent,
  vazio,
  children,
}: {
  titulo: string;
  extra?: string;
  accent: string;
  vazio: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-3xl border p-3 xl:p-5 flex flex-col min-h-0"
      style={{ borderColor: `${accent}4d`, backgroundColor: `${accent}0a` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm xl:text-xl font-black tracking-widest uppercase" style={{ color: accent }}>
          {titulo}
        </h2>
        {extra ? (
          <span className="text-[10px] xl:text-xs font-bold tracking-widest text-white/40 uppercase">{extra}</span>
        ) : null}
      </div>
      <div className="flex-1 min-h-0 mt-2 flex flex-col gap-2 xl:gap-2.5 overflow-hidden">
        {vazio ? <div className="text-white/35 font-semibold italic text-sm mt-2">sem dados no mês</div> : children}
      </div>
    </section>
  );
}

function Posicao({ idx, accent }: { idx: number; accent: string }) {
  const primeiro = idx === 0;
  return (
    <span
      className="h-7 w-7 xl:h-9 xl:w-9 shrink-0 rounded-lg flex items-center justify-center text-sm xl:text-base font-black"
      style={
        primeiro
          ? { color: "#050505", backgroundColor: accent }
          : { color: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.08)" }
      }
    >
      {idx + 1}
    </span>
  );
}

export default function TVConsorcioEquipe() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["tv-consorcio-equipe", TOKEN],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tv_consorcio_public" as any, { _token: TOKEN });
      if (error) throw error;
      return data as unknown as Payload;
    },
    refetchInterval: 45000,
  });

  if (isLoading) return <TVMsg title="Carregando…" msg="Buscando dados ao vivo" accent={ACCENT} />;
  if (error || !data || data.error)
    return <TVMsg title="Acesso negado" msg="Chave inválida ou desativada." accent={ACCENT} />;

  const cDia = data.contratos?.dia ?? { cotas: 0, clientes: 0, credito: 0, ticket: 0 };
  const cMes = data.contratos?.mes ?? { cotas: 0, clientes: 0, credito: 0, ticket: 0 };
  const aDia = data.agenda?.dia ?? { agendadas: 0, realizadas: 0, no_show: 0 };
  const aMes = data.agenda?.mes ?? { agendadas: 0, realizadas: 0, no_show: 0 };

  const meta = data.meta_credito_mes ?? null;
  const pctMeta = meta && meta > 0 ? Math.min((Number(cMes.credito || 0) / meta) * 100, 100) : 0;



  const closers = (data.ranking_closer ?? []).slice(0, 6);
  const sdrs = (data.ranking_sdr ?? []).slice(0, 6);
  const sdrDiaMap = new Map((data.ranking_sdr_dia ?? []).map((r) => [r.nome, r]));

  const warning = data.snapshot_atrasado ? (
    <>
      Dados podem estar atrasados — última atualização às{" "}
      {data.snapshot_em ? new Date(data.snapshot_em).toLocaleTimeString("pt-BR") : "—"}
    </>
  ) : undefined;

  return (
    <TVShell
      title="MCF · Painel de Equipe"
      subtitle="Consórcio · Equipe"
      accent={ACCENT}
      today={data.today}
      updatedAt={data.updated_at}
      warning={warning}
      mainRowsClassName="grid-rows-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,2fr)]"
    >
      {/* Linha 1 — crédito efetivado em largura total */}
      <div className="min-h-0 flex flex-col">
        {meta && meta > 0 ? (
          <CreditoArcoCard
            creditoMes={Number(cMes.credito || 0)}
            creditoHoje={Number(cDia.credito || 0)}
            meta={Number(meta)}
            pct={pctMeta}
          />
        ) : (
          <CreditoSemMetaCard
            creditoMes={Number(cMes.credito || 0)}
            creditoHoje={Number(cDia.credito || 0)}
          />
        )}
      </div>

      {/* Linha 2 */}
      <div className="grid grid-cols-3 gap-4 xl:gap-8 min-h-0">
        <DiaMesBlocoCard
          titulo="R1 agendadas"
          accent={ACCENT}
          hoje={{ valor: num(aDia.agendadas) }}
          mes={{ valor: num(aMes.agendadas) }}
        />
        <DiaMesBlocoCard
          titulo="R1 realizadas"
          accent={ACCENT}
          hoje={{
            valor: (
              <Fracao
                numerador={Number(aDia.realizadas || 0)}
                denominador={Number(aDia.agendadas || 0)}
                cor={ACCENT}
              />
            ),
            titleAttr: `${num(aDia.realizadas)} de ${num(aDia.agendadas)} agendadas`,
          }}
          mes={{
            valor: (
              <Fracao
                numerador={Number(aMes.realizadas || 0)}
                denominador={Number(aMes.agendadas || 0)}
                cor={ACCENT}
              />
            ),
            titleAttr: `${num(aMes.realizadas)} de ${num(aMes.agendadas)} agendadas`,
            rodape: (
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {pctTexto(Number(aMes.realizadas || 0), Number(aMes.agendadas || 0))} dos agendados
              </div>
            ),
          }}
        />
        <DiaMesBlocoCard
          titulo="Vendas"
          accent={ACCENT}
          hoje={{
            valor: num(cDia.cotas),
            rodape: (
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {num(cDia.clientes)} clientes
              </div>
            ),
          }}
          mes={{
            valor: num(cMes.cotas),
            rodape: (
              <div className="text-[11px] xl:text-sm text-white/45 font-semibold">
                {num(cMes.clientes)} clientes · ticket {abreviarBRL(cMes.ticket)}
              </div>
            ),
          }}
        />
      </div>


      {/* Linha 3 */}
      <div className="grid grid-cols-2 gap-4 xl:gap-8 min-h-0">
        <RankingShell titulo="Closers · crédito no mês" accent={ACCENT} vazio={closers.length === 0}>
          {closers.map((c, idx) => (
            <div
              key={`${c.nome}-${idx}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 xl:gap-x-4 rounded-xl border px-2 xl:px-3 py-2 xl:py-3"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.10)",
                opacity: Number(c.credito || 0) === 0 && Number(c.cotas || 0) === 0 ? 0.45 : 1,
              }}
            >
              <Posicao idx={idx} accent={ACCENT} />
              <div className="min-w-0">
                <div className="truncate text-base xl:text-xl font-bold text-white/90">
                  {primeiroEUltimoNome(c.nome)}
                </div>
                <div className="text-[10px] xl:text-xs text-white/40 font-semibold">
                  {num(c.clientes)} clientes · {num(c.cotas)} cotas
                </div>
              </div>
              <span className="text-xl xl:text-3xl font-black leading-none" style={{ color: ACCENT }}>
                {abreviarBRL(c.credito)}
              </span>
            </div>
          ))}
        </RankingShell>

        <RankingShell titulo="SDR · agendamentos" extra="Hoje / Mês" accent={ROXO} vazio={sdrs.length === 0}>
          {sdrs.map((s, idx) => {
            const hoje = Number(sdrDiaMap.get(s.nome)?.agendadas ?? 0);
            return (
              <div
                key={`${s.nome}-${idx}`}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 xl:gap-x-4 rounded-xl border px-2 xl:px-3 py-2 xl:py-3"
                style={{
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderColor: "rgba(255,255,255,0.10)",
                  opacity: Number(s.agendadas || 0) === 0 ? 0.45 : 1,
                }}
              >
                <Posicao idx={idx} accent={ROXO} />
                <span className="truncate text-base xl:text-xl font-bold text-white/90 capitalize">
                  {primeiroEUltimoNome(s.nome)}
                </span>
                <span className="text-right w-10 xl:w-12 text-base xl:text-xl font-black leading-none" style={{ color: ROXO }}>
                  {num(hoje)}
                </span>
                <span className="text-right w-12 xl:w-16 text-2xl xl:text-4xl font-black leading-none text-white/90">
                  {num(s.agendadas)}
                </span>
              </div>
            );
          })}
        </RankingShell>
      </div>
    </TVShell>
  );
}
