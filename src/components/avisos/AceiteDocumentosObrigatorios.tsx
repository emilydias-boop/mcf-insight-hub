import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { abrirDocumento, db, DocumentoInterno } from "@/lib/documentosInternos";

/** Janela fixa: só some depois do aceite registrado de cada documento obrigatório. */
export function AceiteDocumentosObrigatorios() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [marcado, setMarcado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { data: pendentes = [] } = useQuery({
    queryKey: ["documentos-pendentes-aceite", user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await db.rpc("documentos_pendentes_aceite");
      if (error) throw error;
      return (data ?? []) as DocumentoInterno[];
    },
  });
  const doc = pendentes[0];
  if (!doc) return null;
  const texto = doc.texto_aceite || "Li e entendi o documento";

  const confirmar = async () => {
    setSalvando(true);
    const { error } = await db.rpc("registrar_aceite_documento", {
      _documento_id: doc.id,
      _user_agent: navigator.userAgent,
    });
    setSalvando(false);
    if (error) return toast.error("Não foi possível registrar o aceite. Tente novamente.");
    toast.success("Aceite registrado.");
    setMarcado(false);
    qc.invalidateQueries({ queryKey: ["documentos-pendentes-aceite"] });
  };

  return (
    <Dialog open>
      <DialogContent
        className="max-w-3xl max-h-[95vh] overflow-y-auto [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{doc.titulo}</DialogTitle>
          <DialogDescription>
            Leitura obrigatória. Abra o documento, leia com atenção e confirme abaixo para continuar usando o sistema.
          </DialogDescription>
        </DialogHeader>
        {doc.arquivo_url && (
          <iframe src={doc.arquivo_url} title={doc.titulo} className="h-[50vh] w-full rounded-md border bg-background" />
        )}
        <div>
          <Button variant="outline" onClick={() => abrirDocumento(doc)} className="w-full justify-start">
            <FileText className="mr-2 h-4 w-4" /> Abrir {doc.titulo} em nova aba
          </Button>
        </div>
        <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
          <Checkbox checked={marcado} onCheckedChange={(v) => setMarcado(v === true)} className="mt-0.5" />
          <span className="text-sm font-medium">{texto}</span>
        </label>
        <div>
          <Button disabled={!marcado || salvando} onClick={confirmar} className="w-full">
            {salvando ? "Registrando..." : "Confirmar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
