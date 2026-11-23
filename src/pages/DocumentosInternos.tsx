import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { abrirDocumento, db, DocumentoInterno, fmtSP } from "@/lib/documentosInternos";

export default function DocumentosInternos() {
  const { allRoles, user } = useAuth();
  const roles = (allRoles as string[] | undefined) ?? [];
  const podePublicar = roles.includes("admin") || roles.includes("rh");
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documentos-internos"],
    queryFn: async () => {
      const { data, error } = await db.from("documentos_internos").select("*").eq("ativo", true).order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentoInterno[];
    },
  });

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [exige, setExige] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const publicar = async () => {
    if (!titulo.trim() || !arquivo) return toast.error("Informe título e arquivo.");
    setEnviando(true);
    const path = `${Date.now()}-${arquivo.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("documentos-internos").upload(path, arquivo);
    if (up.error) { setEnviando(false); return toast.error("Falha no envio do arquivo."); }
    const { error } = await db.from("documentos_internos").insert({
      titulo: titulo.trim(), descricao: descricao.trim() || null, arquivo_path: path,
      exige_aceite: exige, texto_aceite: exige ? `Li e entendi o documento "${titulo.trim()}"` : null,
      publicado_por: user?.id,
    });
    setEnviando(false);
    if (error) return toast.error("Falha ao publicar.");
    toast.success("Documento publicado.");
    setTitulo(""); setDescricao(""); setArquivo(null); setExige(false);
    qc.invalidateQueries({ queryKey: ["documentos-internos"] });
    qc.invalidateQueries({ queryKey: ["documentos-pendentes-aceite"] });
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Documentos Internos</h1>
        <p className="text-muted-foreground">Normas e documentos oficiais da MCF Capital disponíveis para todos.</p>
      </div>

      {podePublicar && (
        <Card>
          <CardHeader><CardTitle className="text-base">Publicar documento</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            <Input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={exige} onCheckedChange={(v) => setExige(v === true)} />
              Exigir aceite de todos os usuários
            </label>
            <Button onClick={publicar} disabled={enviando}><Upload className="mr-2 h-4 w-4" />{enviando ? "Enviando..." : "Publicar"}</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {!isLoading && docs.length === 0 && <p className="text-muted-foreground">Nenhum documento publicado.</p>}
        {docs.map((d) => (
          <Card key={d.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {d.titulo}
                    {d.exige_aceite && <Badge variant="secondary">Aceite obrigatório</Badge>}
                  </div>
                  {d.descricao && <p className="text-sm text-muted-foreground">{d.descricao}</p>}
                  <p className="text-xs text-muted-foreground">Versão {d.versao} · publicado em {fmtSP(d.created_at)}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => abrirDocumento(d)}>Abrir</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
