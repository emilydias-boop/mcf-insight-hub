import { Award, Crown, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCatalogo, useMeusBadges, useMeuPerfilAcademia } from "@/hooks/useAcademia";
import type { ABadge } from "@/lib/academia";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function BadgeCard({ b, ganho, destaque }: { b: ABadge; ganho?: string; destaque?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4 flex flex-col items-center text-center gap-2 transition-all",
      ganho ? "bg-card" : "opacity-50 grayscale", destaque && ganho && "border-2 border-primary ac-brilho")}>
      <div className={cn("h-14 w-14 rounded-2xl grid place-items-center", ganho ? "ac-conquista" : "bg-muted")}
        style={ganho ? { background: `${b.cor ?? "#C6F53F"}22`, color: b.cor ?? undefined } : undefined}>
        {ganho ? <Award className="h-7 w-7" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="font-bold text-sm">{b.nivel ? `${b.nivel}. ` : ""}{b.nome}</div>
      <div className="text-xs text-muted-foreground">{ganho ? `Conquistado em ${new Date(ganho).toLocaleDateString("pt-BR")}` : `Falta: ${b.descricao}`}</div>
    </div>
  );
}

export default function Estante() {
  const { user } = useAuth();
  const { data: cat } = useCatalogo();
  const { data: meus = [] } = useMeusBadges(user?.id);
  const { data: perfil } = useMeuPerfilAcademia();
  if (!cat) return <div className="text-muted-foreground">Carregando…</div>;
  const ganhos = Object.fromEntries(meus.map((m) => [m.badge_id, m.conquistado_em]));
  const mestre = cat.badges.find((b) => b.tipo === "mestre");
  const frentesOrd = [...cat.frentes].sort((a, b) => (a.id === perfil?.frente_id ? -1 : b.id === perfil?.frente_id ? 1 : a.ordem - b.ordem));
  const especialistas = cat.produtos.filter((p) => cat.badges.some((b) => b.produto_id === p.id && (b.nivel ?? 0) >= 3 && ganhos[b.id])).length;
  const visao = cat.badges.find((b) => b.slug === "visao-cruzada");
  const passos = especialistas + (visao && ganhos[visao.id] ? 1 : 0);

  return (
    <div className="space-y-8 max-w-6xl">
      {mestre && (
        <section className={cn("ac-card p-6 md:p-8 flex flex-wrap items-center gap-6", ganhos[mestre.id] && "border-2 border-primary ac-brilho")}>
          <div className={cn("h-20 w-20 rounded-3xl grid place-items-center", ganhos[mestre.id] ? "bg-primary text-primary-foreground ac-conquista" : "bg-muted")}>
            <Crown className="h-10 w-10" />
          </div>
          <div className="flex-1 min-w-60">
            <div className="ac-eyebrow">Badge máximo</div>
            <h1 className="text-2xl md:text-3xl">{mestre.nome}</h1>
            <p className="text-sm text-muted-foreground">{mestre.descricao}</p>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={(passos / 6) * 100} className="h-2 flex-1" />
              <span className="text-sm font-bold">{especialistas}/5 frentes · Visão Cruzada {visao && ganhos[visao.id] ? "✓" : "—"}</span>
            </div>
          </div>
        </section>
      )}

      {frentesOrd.map((f) => {
        const prod = cat.produtos.find((p) => p.frente_id === f.id);
        const bs = cat.badges.filter((b) => b.produto_id === prod?.id).sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0));
        const principal = f.id === perfil?.frente_id;
        return (
          <section key={f.id} className={cn("ac-card p-5", principal && "border-2 border-primary")}>
            <div className="flex items-center gap-2 mb-4">
              <span className="h-3 w-3 rounded-full" style={{ background: f.cor ?? undefined }} />
              <h2 className="text-lg">{f.nome}</h2>
              {principal ? <span className="ac-eyebrow ml-2">Especialidade da casa</span> : <span className="text-xs text-muted-foreground ml-2">Extensão</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              {bs.map((b, i) => <div key={b.id} style={{ paddingTop: `${(3 - i) * 12}px` }}><BadgeCard b={b} ganho={ganhos[b.id]} destaque={principal} /></div>)}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="text-xl mb-3">Transversais</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {cat.badges.filter((b) => b.tipo === "transversal").map((b) => <BadgeCard key={b.id} b={b} ganho={ganhos[b.id]} />)}
        </div>
      </section>
    </div>
  );
}
