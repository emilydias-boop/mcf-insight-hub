import { useState, useEffect, useMemo } from "react";
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

type LiveStatus = {
  status?: string;
  errorCode?: string | number | null;
  errorMessage?: string | null;
  dateUpdated?: string;
  to?: string;
  from?: string;
};

type Employee = {
  id: string;
  nome_completo: string;
  email_pessoal: string | null;
  telefone: string | null;
};

const DEFAULT_OWNER_EMAIL = "carol.correa@minhacasafinanciada.com";

export function TemplateTestSendDialog({ templateId, templateName, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("Cliente Teste");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ownerId, setOwnerId] = useState<string>("");
  const [role, setRole] = useState<"sdr" | "closer">("sdr");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome_completo, email_pessoal, telefone")
        .not("telefone", "is", null)
        .order("nome_completo");
      if (error) {
        toast({ title: "Erro ao carregar funcionários", description: error.message, variant: "destructive" });
        return;
      }
      const list = (data || []) as Employee[];
      setEmployees(list);
      const carol = list.find((e) => e.email_pessoal?.toLowerCase() === DEFAULT_OWNER_EMAIL);
      setOwnerId(carol?.id || list[0]?.id || "");
    })();
  }, [open, toast]);

  const owner = useMemo(() => employees.find((e) => e.id === ownerId), [employees, ownerId]);

  const handleClose = (next: boolean) => {
    if (!next) {
      setResult(null);
      setLiveStatus(null);
    }
    onOpenChange(next);
  };

  const handleSend = async () => {
    if (!templateId) return;
    if (!phone.replace(/\D/g, "")) {
      toast({ title: "Telefone obrigatório", variant: "destructive" });
      return;
    }
    if (!owner?.telefone) {
      toast({ title: "Selecione um dono com telefone cadastrado", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    setLiveStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke("automation-test-send", {
        body: {
          templateId,
          phone,
          name,
          ownerPhone: owner.telefone,
          ownerName: owner.nome_completo,
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

  const handleCheckStatus = async () => {
    if (!result?.messageSid) return;
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("automation-test-status", {
        body: { sid: result.messageSid },
      });
      if (error) throw error;
      const d: any = data;
      if (!d?.success) throw new Error(d?.error || "Falha ao consultar status");
      setLiveStatus({
        status: d.status,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage,
        dateUpdated: d.dateUpdated,
        to: d.to,
        from: d.from,
      });
      toast({
        title: `Status: ${d.status}`,
        description: d.errorCode ? `Erro ${d.errorCode}: ${d.errorMessage}` : "Sem erro reportado",
        variant: d.errorCode ? "destructive" : "default",
      });
    } catch (e: any) {
      toast({ title: "Erro ao verificar", description: e.message, variant: "destructive" });
    } finally {
      setChecking(false);
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

          <div className="space-y-1">
            <Label>Dono (employee)</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um funcionário" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_completo} — {e.telefone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Token <code>wa_agendar_token</code> será gerado para este dono.
            </p>
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
              {result.success && (
                <div className="mt-3 space-y-2">
                  <Button size="sm" variant="outline" onClick={handleCheckStatus} disabled={checking}>
                    {checking ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : null}
                    Verificar status agora
                  </Button>
                  {liveStatus && (
                    <div className="rounded border bg-muted/40 p-2 text-xs space-y-1">
                      <div><strong>Status Twilio:</strong> {liveStatus.status}</div>
                      {liveStatus.errorCode ? (
                        <div className="text-destructive">
                          <strong>Erro {liveStatus.errorCode}:</strong> {liveStatus.errorMessage}
                        </div>
                      ) : (
                        <div className="text-green-700">Sem erro reportado pelo Twilio.</div>
                      )}
                      <div>Atualizado em: {liveStatus.dateUpdated}</div>
                      <div>De: {liveStatus.from} → {liveStatus.to}</div>
                    </div>
                  )}
                </div>
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