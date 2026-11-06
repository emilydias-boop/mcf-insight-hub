import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, LineChart, Cell, Legend,
} from "recharts";

type Row = { event_type: string; route: string | null; duration_ms: number | null; user_id: string; created_at: string };
type Nivel = "bom" | "atencao" | "ruim" | "sem";

const COR: Record<Nivel, string> = {
  bom: "hsl(var(--success))",
  atencao: "hsl(var(--warning))",
  ruim: "hsl(var(--destructive))",
  sem: "hsl(var(--muted-foreground))",
};
const ROTULO: Record<Nivel, string> = { bom: "Bom", atencao: "Atenção", ruim: "Crítico", sem: "Sem dados" };
const ORDEM: Nivel[] = ["sem", "bom", "atencao", "ruim"];

const mediana = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const fmtMs = (v: number | null) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);
export const nivelTempo = (ms: number | null): Nivel => (ms == null ? "sem" : ms <= 1000 ? "bom" : ms <= 3000 ? "atencao" : "ruim");
export const nivelErro = (taxa: number | null): Nivel => (taxa == null ? "sem" : taxa === 0 ? "bom" : taxa <= 2 ? "atencao" : "ruim");
const pior = (a: Nivel, b: Nivel) => (ORDEM.indexOf(a) >= ORDEM.indexOf(b) ? a : b);
const curto = (r: string) => (r.length > 22 ? "…" + r.slice(-21) : r);

const diaSP = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function Gauge({ ms, nivel }: { ms: number | null; nivel: Nivel }) {
  // escala 0–5 s; faixas: 0–1 verde, 1–3 amarelo, 3–5 vermelho
  const MAX = 5000;
  const cx = 100, cy = 100, r = 80;
  const pt = (frac: number) => {
    const a = Math.PI * (1 - frac);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arco = (f1: number, f2: number) => {
    const [x1, y1] = pt(f1), [x2, y2] = pt(f2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };
  const frac = ms == null ? 0 : Math.min(ms, MAX) / MAX;
  const a = Math.PI * (1 - frac);
  const nx = cx + (r - 18) * Math.cos(a), ny = cy - (r - 18) * Math.sin(a);
  return (
    <svg viewBox="0 0 200 120" className="w-full max-w-[220px]">
      <path d={arco(0, 0.2)} stroke={COR.bom} strokeWidth={16} fill="none" />
      <path d={arco(0.2, 0.6)} stroke={COR.atencao} strokeWidth={16} fill="none" />
      <path d={arco(0.6, 1)} stroke={COR.ruim} strokeWidth={16} fill="none" />
      {ms != null && (
        <>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="hsl(var(--foreground))" strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={6} fill="hsl(var(--foreground))" />
        </>
      )}
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={16} fontWeight={700} fill={COR[nivel]}>{fmtMs(ms)}</text>
    </svg>
  );
}

export default function TelemetriaTop5({ data }: { data: Row[] }) {
  const telas = useMemo(() => {
    const m = new Map<string, { ab: number; users: Set<string>; tempos: number[]; erros: number; dias: Map<string, number> }>();
    const get = (k: string) => {
      let x = m.get(k);
      if (!x) { x = { ab: 0, users: new Set(), tempos: [], erros: 0, dias: new Map() }; m.set(k, x); }
      return x;
    };
    for (const r of data) {
      const k = r.route ?? "(desconhecida)";
      if (r.event_type === "page_view") {
        const x = get(k); x.ab++; x.users.add(r.user_id);
        const d = diaSP(r.created_at); x.dias.set(d, (x.dias.get(d) ?? 0) + 1);
      } else if (r.event_type === "page_load" && r.duration_ms != null) get(k).tempos.push(r.duration_ms);
      else if (r.event_type === "error") get(k).erros++;
    }
    return [...m.entries()]
      .filter(([, x]) => x.ab > 0)
      .sort((a, b) => b[1].ab - a[1].ab)
      .slice(0, 5)
      .map(([route, x]) => {
        const tempo = mediana(x.tempos);
        const taxa = x.ab > 0 ? (x.erros / x.ab) * 100 : null;
        const nt = nivelTempo(tempo), ne = nivelErro(taxa);
        return {
          route, nome: curto(route), aberturas: x.ab, pessoas: x.users.size, tempo, erros: x.erros, taxa,
          nt, ne, geral: pior(nt, ne),
          serie: [...x.dias.entries()].sort().map(([d, v]) => ({ d, v })),
        };
      });
  }, [data]);

  if (!telas.length) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">As 5 telas mais usadas</h2>
        <p className="text-sm text-muted-foreground">
          Tempo típico = metade das aberturas foi mais rápida que isso. Verde até 1 s, amarelo 1–3 s, vermelho acima de 3 s.
          Erros: verde sem erro, amarelo até 2 a cada 100 aberturas, vermelho acima.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
        {telas.map((t) => (
          <Card key={t.route} className="border-t-4" style={{ borderTopColor: COR[t.geral] }}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-mono break-all" title={t.route}>{t.route}</CardTitle>
                <Badge variant="outline" style={{ color: COR[t.geral], borderColor: COR[t.geral] }}>{ROTULO[t.geral]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-center"><Gauge ms={t.tempo} nivel={t.nt} /></div>
              <div className="grid grid-cols-3 text-center text-xs">
                <div><div className="text-lg font-semibold">{t.aberturas}</div><div className="text-muted-foreground">aberturas</div></div>
                <div><div className="text-lg font-semibold">{t.pessoas}</div><div className="text-muted-foreground">pessoas</div></div>
                <div>
                  <div className="text-lg font-semibold" style={{ color: COR[t.ne] }}>{t.erros}</div>
                  <div className="text-muted-foreground">erros{t.taxa != null && ` · ${t.taxa.toFixed(1)}/100`}</div>
                </div>
              </div>
              <div className="h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={t.serie}>
                    <Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Aberturas x Tempo de abertura</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={telas.map((t) => ({ nome: t.nome, aberturas: t.aberturas, tempo: t.tempo }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="nome" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="a" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="t" orientation="right" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMs(v)} />
                <Tooltip formatter={(v: any, n: string) => (n === "Tempo típico" ? fmtMs(v) : v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar yAxisId="a" dataKey="aberturas" name="Aberturas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="t" dataKey="tempo" name="Tempo típico" stroke="hsl(var(--warning))" strokeWidth={3} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ocorrências de erro</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={[...telas].sort((a, b) => b.erros - a.erros).map((t) => ({ nome: t.nome, erros: t.erros, ne: t.ne, taxa: t.taxa }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={140} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: any, _n, p: any) => [`${v} (${p.payload.taxa?.toFixed(1) ?? "—"} a cada 100)`, "Erros"]}
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="erros" radius={[0, 4, 4, 0]}>
                  {telas.map((t) => null)}
                  {[...telas].sort((a, b) => b.erros - a.erros).map((t) => <Cell key={t.route} fill={COR[t.ne]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
