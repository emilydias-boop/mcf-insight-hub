import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import fluxoHtml from "@/content/fluxo-pos-venda.html?raw";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { agruparMateriais, injetarMateriais, PROCESSO_POS_VENDA } from "@/lib/processoMateriais";

/**
 * Tela só de exibição: mostra o HTML do fluxo do Pós-venda dentro de um iframe.
 * Os itens/status vêm da Biblioteca de Materiais; se a consulta falhar, usa os dados embutidos no HTML.
 */
export default function FluxoPosVenda() {
  const { hasAnyRole } = useAuth();
  const podeEditar = hasAnyRole("admin", "gerente_relacionamento");

  const q = useQuery({
    queryKey: ["fluxo-pos-venda-materiais"],
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_materiais")
        .select("titulo,status,ordem,processo_etapas!inner(chave,ordem),processos!inner(chave)")
        .eq("ativo", true)
        .eq("processos.chave", PROCESSO_POS_VENDA);
      if (error) throw error;
      const rows = (data ?? [])
        .map((r: any) => ({ titulo: r.titulo, status: r.status, ordem: r.ordem, etapa_chave: r.processo_etapas.chave, eo: r.processo_etapas.ordem }))
        .sort((a: any, b: any) => a.eo - b.eo || a.ordem - b.ordem);
      return agruparMateriais(rows);
    },
  });

  const html = useMemo(() => (q.data ? injetarMateriais(fluxoHtml, q.data) : fluxoHtml), [q.data]);

  if (q.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div>
      {podeEditar && (
        <div className="flex justify-end pb-1">
          <Link to="/pos-venda/materiais" className="text-xs text-muted-foreground hover:text-foreground underline">
            Editar materiais
          </Link>
        </div>
      )}
      <iframe
        title="Fluxo do Pós-venda"
        srcDoc={html}
        sandbox="allow-scripts"
        className="w-full border-0"
        style={{ height: podeEditar ? "calc(100vh - 120px)" : "calc(100vh - 96px)" }}
      />
    </div>
  );
}
