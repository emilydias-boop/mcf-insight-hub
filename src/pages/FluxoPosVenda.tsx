import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import fluxoHtml from "@/content/fluxo-pos-venda.html?raw";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { agruparMateriais, injetarMateriais, materialIdDaMensagem, PROCESSO_POS_VENDA } from "@/lib/processoMateriais";
import MaterialDocumentoPopup from "@/components/MaterialDocumentoPopup";

/**
 * Tela só de exibição: mostra o HTML do fluxo do Pós-venda dentro de um iframe.
 * Os itens/status vêm da Biblioteca de Materiais; se a consulta falhar, usa os dados embutidos no HTML.
 */
export default function FluxoPosVenda() {
  const { hasAnyRole } = useAuth();
  const podeEditar = hasAnyRole("admin", "gerente_relacionamento");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["fluxo-pos-venda-materiais"],
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_materiais")
        .select("id,titulo,status,ordem,link_url,arquivo_path,conteudo,processo_etapas!inner(chave,ordem),processos!inner(chave)")
        .eq("ativo", true)
        .eq("processos.chave", PROCESSO_POS_VENDA);
      if (error) throw error;
      const rows = (data ?? [])
        .map((r: any) => ({ id: r.id, titulo: r.titulo, status: r.status, link_url: r.link_url, arquivo_path: r.arquivo_path, conteudo: r.conteudo, ordem: r.ordem, etapa_chave: r.processo_etapas.chave, eo: r.processo_etapas.ordem }))
        .sort((a: any, b: any) => a.eo - b.eo || a.ordem - b.ordem);
      return agruparMateriais(rows);
    },
  });

  const html = useMemo(() => (q.data ? injetarMateriais(fluxoHtml, q.data) : fluxoHtml), [q.data]);
  const ids = useMemo(() => new Set(Object.values(q.data ?? {}).flatMap((itens) => itens.map((item) => item[2]))), [q.data]);
  useEffect(() => {
    const ouvir = (event: MessageEvent) => {
      const id = materialIdDaMensagem(event, iframeRef.current?.contentWindow, ids);
      if (id) setMaterialId(id);
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [ids]);

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
        ref={iframeRef}
        title="Fluxo do Pós-venda"
        srcDoc={html}
        sandbox="allow-scripts"
        className="w-full border-0"
        style={{ height: podeEditar ? "calc(100vh - 120px)" : "calc(100vh - 96px)" }}
      />
      <MaterialDocumentoPopup id={materialId} podeEditar={podeEditar} onClose={() => setMaterialId(null)} />
    </div>
  );
}
