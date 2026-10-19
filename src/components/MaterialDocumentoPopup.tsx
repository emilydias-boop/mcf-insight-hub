import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { linkMaterial, MATERIAL_TIPOS, statusInfo, temDocumento } from "@/lib/processoMateriais";

type MaterialDocumento = {
  titulo: string; tipo: string; status: string; observacao: string | null; conteudo: string | null;
  assunto: string | null; link_url: string | null; arquivo_path: string | null; arquivo_nome: string | null;
  processo_etapas: { titulo: string } | null;
};

function NovaAba({ href, children = "Abrir em nova aba" }: { href: string; children?: React.ReactNode }) {
  return <Button variant="outline" size="sm" asChild><a href={href} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />{children}</a></Button>;
}

export default function MaterialDocumentoPopup({ id, podeEditar, onClose }: { id: string | null; podeEditar: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const material = useQuery({
    queryKey: ["fluxo-material-documento", id], enabled: !!id, refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!id) throw new Error("Material não informado");
      const { data, error } = await supabase.from("processo_materiais")
        .select("titulo,tipo,status,observacao,conteudo,assunto,link_url,arquivo_path,arquivo_nome,processo_etapas(titulo)")
        .eq("id", id).single();
      if (error) throw error;
      return data as MaterialDocumento;
    },
  });
  const m = material.data;
  const arquivo = useQuery({
    queryKey: ["fluxo-material-arquivo", id, m?.arquivo_path], enabled: !!id && !!m?.arquivo_path,
    staleTime: 9 * 60 * 1000, refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!m?.arquivo_path) throw new Error("Arquivo não informado");
      const { data, error } = await supabase.storage.from("processo-materiais").createSignedUrl(m.arquivo_path, 600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const link = linkMaterial(m?.link_url ?? null);
  const ext = (m?.arquivo_nome || m?.arquivo_path || "").split(".").pop()?.toLowerCase();
  const status = statusInfo(m?.status ?? "falta_anexar");

  return <Dialog open={!!id} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-4xl w-[calc(100%-24px)] max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="pr-6">{m?.titulo ?? "Documento do material"}</DialogTitle>
        <DialogDescription>{m ? `${MATERIAL_TIPOS[m.tipo] ?? m.tipo} · ${m.processo_etapas?.titulo ?? "—"}` : "Biblioteca de Materiais do Processo"}</DialogDescription>
        {m && <div><Badge variant="outline" className={status.cls}>{status.label}</Badge></div>}
      </DialogHeader>
      {material.isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando…</div>}
      {material.error && <p role="alert" className="text-destructive">Não foi possível carregar este material.</p>}
      {m && <div className="space-y-5 min-w-0">
        {m.arquivo_path && <section className="space-y-2">
          {arquivo.isLoading && <p className="text-muted-foreground">Carregando arquivo…</p>}
          {arquivo.error && <p role="alert" className="text-destructive">Não foi possível abrir o arquivo anexado.</p>}
          {arquivo.data && <>
            {ext === "pdf" ? <iframe src={arquivo.data} title={`Arquivo: ${m.arquivo_nome ?? m.titulo}`} className="w-full h-[70vh] border-0" />
              : ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"].includes(ext ?? "") ? <img src={arquivo.data} alt={m.arquivo_nome ?? m.titulo} className="max-h-[70vh] max-w-full object-contain mx-auto" />
              : ["mp4", "webm", "mov", "m4v", "ogv"].includes(ext ?? "") ? <video src={arquivo.data} controls className="max-h-[70vh] w-full" />
              : <Button variant="outline" asChild><a href={arquivo.data} download={m.arquivo_nome ?? undefined} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" />Baixar</a></Button>}
            <div><NovaAba href={arquivo.data} /></div>
          </>}
        </section>}
        {m.conteudo?.trim() && <section className="space-y-2">
          {m.tipo === "email" && m.assunto && <p className="font-medium break-words">Assunto: {m.assunto}</p>}
          <div className="whitespace-pre-wrap break-words rounded-md bg-muted p-4">{m.conteudo}</div>
          <Button variant="outline" size="sm" onClick={async () => {
            try { await navigator.clipboard.writeText(m.conteudo ?? ""); toast.success("Texto copiado"); }
            catch { toast.error("Não foi possível copiar o texto"); }
          }}><Copy className="mr-2 h-4 w-4" />Copiar texto</Button>
        </section>}
        {link && <section className="space-y-2">
          {link.tela ? <Button onClick={() => { onClose(); navigate(link.tela ?? "/"); }}><ExternalLink className="mr-2 h-4 w-4" />Ir para a tela</Button>
            : <>{link.embed && <iframe src={link.embed} title={`Documento: ${m.titulo}`} className="w-full h-[60vh] border-0" allow="autoplay; encrypted-media; fullscreen" allowFullScreen referrerPolicy="no-referrer" />}<div><NovaAba href={link.href} /></div></>}
        </section>}
        {!temDocumento(m) && <p className="text-muted-foreground">Ainda não há documento registrado para este material.</p>}
        {m.observacao && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{m.observacao}</p>}
      </div>}
      {podeEditar && <div className="border-t pt-3"><Link to="/pos-venda/materiais" onClick={onClose} className="text-sm text-muted-foreground underline">Editar na biblioteca</Link></div>}
    </DialogContent>
  </Dialog>;
}