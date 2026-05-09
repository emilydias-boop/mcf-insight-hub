import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  templateId: string | null;
  templateName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Result = {
  success: boolean;
  messageSid?: string;
  status?: string;
  to?: string;
  error?: string;
  contentVariables?: Record<string, string>;
};

export function TemplateTestSendDialog({ templateId, templateName, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("Cliente Teste");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [role, setRole] = useState<"sdr" | "closer">("sdr");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const handleClose = (next: boolean) => {
    if (!next) {
      setResult(null);
    }
    onOpenChange(next);
  };

  const handleSend = async () => {
    if (!templateId) return;
    if (!phone.replace(/\D/g, "")) {
      toast({ title: "Telefone obrigatório", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("automation-test-send", {
        body: {
          templateId,
          phone,
          name,
          ownerPhone: ownerPhone || phone,
          ownerName: ownerName || "Equipe MCF",
          role,
        },
      });
      if (error) throw error;
      setResult(data as Result);
      if ((data as Result)?.success) {
        toast({ title: "Mensagem enviada", description: `SID ${(data as Result).messageSid}` });
      } else {
        toast({ title: "Falha no envio", description: (data as Result)?.error, variant: "destructive" });
      }
    } catch (e: any) {
      setResult({ success: false, error: e.message });
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Testar envio — {templateName || "template"}</DialogTitle>
          <DialogDescription>
            Dispara este template via Twilio direto pro número informado, com as mesmas variáveis do
            fluxo real (incluindo o token do botão Agendar).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone destino *</Label>
              <Input
                placeholder="11993666464"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Nome do contato</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Telefone do dono (botão)</Label>
              <Input
                placeholder="default = telefone destino"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Nome do dono</Label>
              <Input
                placeholder="Equipe MCF"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Papel (texto do botão)</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sdr">SDR — "quero agendar minha reunião"</SelectItem>
                <SelectItem value="closer">Closer — "quero confirmar minha reunião"</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {result && (
            <div
              className={`rounded-md border p-3 text-sm ${
                result.success ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                {result.success ? "Enviado" : "Falhou"}
              </div>
              {result.success ? (
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div>SID: <code>{result.messageSid}</code></div>
                  <div>Status: {result.status}</div>
                  <div>Para: {result.to}</div>
                </div>
              ) : (
                <div className="mt-2 text-xs text-destructive">{result.error}</div>
              )}
              {result.contentVariables && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">ContentVariables</summary>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2">
                    {JSON.stringify(result.contentVariables, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Fechar
          </Button>
          <Button onClick={handleSend} disabled={loading || !phone}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar teste
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}