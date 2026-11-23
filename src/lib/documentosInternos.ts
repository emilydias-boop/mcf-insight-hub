import { supabase } from "@/integrations/supabase/client";

// Tabelas novas ainda podem não estar no arquivo de tipos gerado.
export const db = supabase as any;

export interface DocumentoInterno {
  id: string;
  titulo: string;
  descricao: string | null;
  arquivo_path: string | null;
  arquivo_url: string | null;
  versao: number;
  exige_aceite: boolean;
  texto_aceite: string | null;
  ativo: boolean;
  created_at: string;
}

export async function abrirDocumento(d: Pick<DocumentoInterno, "arquivo_url" | "arquivo_path">) {
  if (d.arquivo_url) {
    window.open(d.arquivo_url, "_blank", "noopener");
    return;
  }
  if (d.arquivo_path) {
    // Abre a aba já no clique: o navegador bloqueia abas abertas depois de uma espera.
    const aba = window.open("", "_blank");
    const { data } = await supabase.storage.from("documentos-internos").createSignedUrl(d.arquivo_path, 600);
    if (data?.signedUrl && aba) aba.location.href = data.signedUrl;
    else aba?.close();
  }
}

export const fmtSP = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
