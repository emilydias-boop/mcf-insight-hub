import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Send, RotateCw, ExternalLink } from "lucide-react";

type Log = {
  id: string;
  deal_id: string | null;
  status: string;
  attempt: number;
  http_status: number | null;
  error_message: string | null;
  created_at: string;
  response: any;
  source?: string | null;
};

type InboundLog = Log & {
  event: string | null;
  payload: any;
  signature_preview: string | null;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  pending: "secondary",
  failed: "destructive",
  skipped_no_codes: "outline",
  skipped_inactive: "outline",
};

export default function IntegracaoMcfPay() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [inboundLogs, setInboundLogs] = useState<InboundLog[]>([]);

  const loadConfig = async () => {
    const { data } = await supabase.from("mcf_pay_config").select("*").eq("id", true).maybeSingle();
    if (data) {
      setWebhookUrl(data.webhook_url ?? "");
      setIsActive(data.is_active ?? false);
    }
  };

  const loadLogs = async () => {
    const { data } = await supabase
      .from("mcf_pay_dispatch_logs")
      .select("id, deal_id, status, attempt, http_status, error_message, created_at, response, source")
      .or("direction.eq.outbound,direction.is.null")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs((data ?? []) as Log[]);
  };

  const loadInbound = async () => {
    const { data } = await supabase
      .from("mcf_pay_dispatch_logs")
      .select("id, deal_id, status, attempt, http_status, error_message, created_at, response, event, payload, signature_preview")
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(20);
    setInboundLogs((data ?? []) as InboundLog[]);
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadConfig(), loadLogs(), loadInbound()]);
      setLoading(false);
    })();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("mcf_pay_config")
      .upsert({ id: true, webhook_url: webhookUrl || null, is_active: isActive, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Configuração salva");
  };

  const sendTest = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("notify-mcf-pay", { body: { test: true } });
    setTesting(false);
    if (error) toast.error("Erro: " + error.message);
    else if (data?.ok) toast.success("Teste enviado com sucesso");
    else toast.warning(`Teste retornou: ${data?.status ?? "?"} (${data?.error ?? "sem detalhes"})`);
    await loadLogs();
  };

  const resend = async (log: Log) => {
    if (!log.deal_id) {
      toast.error("Log sem deal_id (provavelmente teste). Não pode ser reenviado.");
      return;
    }
    setResending(log.id);
    const { data, error } = await supabase.functions.invoke("notify-mcf-pay", {
      body: { deal_id: log.deal_id, force: true },
    });
    setResending(null);
    if (error) toast.error("Erro: " + error.message);
    else toast.success(`Reenviado: ${data?.status ?? "?"}`);
    await loadLogs();
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integração MCF Pay</h1>
        <p className="text-muted-foreground">Envia o webhook <code>deal.paid</code> para o MCF Pay quando um deal entra numa etapa de fechado.</p>
      </div>

      <div className="rounded-md border border-primary/40 bg-primary/5 px-4 py-3 text-sm">
        <strong>Disparo automático ativo:</strong> trigger em <code>contract_paid_at</code> + varredura de segurança a cada 15 min para vendas das últimas 72h.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>
            URL do webhook do MCF Pay e ativação. O secret HMAC é armazenado como <code>MCF_PAY_WEBHOOK_SECRET</code> nas Edge Function Secrets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL do webhook</Label>
            <Input id="url" placeholder="https://mcfpay.../webhook/crm" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="active">Integração ativa</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
            <Button variant="secondary" onClick={sendTest} disabled={testing || !webhookUrl || !isActive}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar teste
            </Button>
            <Button variant="outline" asChild>
              <a href="https://supabase.com/dashboard/project/rehcfgqvigfcekiipqkc/settings/functions" target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Gerenciar secret
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="enviados">
        <TabsList>
          <TabsTrigger value="enviados">Enviados (CRM → MCF Pay)</TabsTrigger>
          <TabsTrigger value="recebidos">Recebidos (MCF Pay → CRM)</TabsTrigger>
        </TabsList>
        <TabsContent value="enviados">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Últimos 20 envios</CardTitle>
            <CardDescription>Auditoria e reenvio manual</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadLogs}>
            <RotateCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Tentativa</TableHead>
                <TableHead>Erro / Resposta</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum envio ainda</TableCell></TableRow>
              )}
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="font-mono text-xs">{log.deal_id ? log.deal_id.slice(0, 8) : "—"}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">{log.source ?? "manual"}</Badge>
                  </TableCell>
                  <TableCell><Badge variant={statusVariant[log.status] ?? "outline"}>{log.status}</Badge></TableCell>
                  <TableCell>{log.http_status ?? "—"}</TableCell>
                  <TableCell>{log.attempt}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={log.error_message ?? JSON.stringify(log.response)}>
                    {log.error_message ?? (log.response ? JSON.stringify(log.response).slice(0, 80) : "")}
                  </TableCell>
                  <TableCell>
                    {log.deal_id && (
                      <Button size="sm" variant="ghost" disabled={resending === log.id} onClick={() => resend(log)}>
                        {resending === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="recebidos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Callbacks recebidos do MCF Pay</CardTitle>
                <CardDescription>
                  Eventos de pagamento que chegam em <code>/mcf-pay-callback</code>. Em caso de
                  <code> invalid_signature</code>, compare o <strong>fingerprint do secret</strong> abaixo com o que está no MCF Pay.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={loadInbound}>
                <RotateCw className="mr-2 h-4 w-4" /> Atualizar
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Debug</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboundLogs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum callback recebido</TableCell></TableRow>
                  )}
                  {inboundLogs.map((log) => {
                    const debug = log.response && typeof log.response === "object" ? log.response : null;
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">{log.event ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{log.deal_id ? log.deal_id.slice(0, 8) : "—"}</TableCell>
                        <TableCell><Badge variant={statusVariant[log.status] ?? "outline"}>{log.status}</Badge></TableCell>
                        <TableCell>{log.http_status ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono space-y-0.5">
                          {log.error_message && <div className="text-destructive">{log.error_message}</div>}
                          {debug?.match_strategy && (
                            <div>match: <strong>{debug.match_strategy}</strong></div>
                          )}
                          {debug?.resolved_deal_id && (
                            <div>deal resolvido: {String(debug.resolved_deal_id).slice(0, 8)}…</div>
                          )}
                          {debug?.tried && (
                            <div className="text-muted-foreground">
                              tentou: {Object.entries(debug.tried)
                                .filter(([, v]) => v)
                                .map(([k, v]) => `${k}=${String(v).slice(0, 24)}`)
                                .join(" · ") || "—"}
                            </div>
                          )}
                          {Array.isArray(debug?.candidates) && debug.candidates.length > 0 && (
                            <div className="text-muted-foreground">
                              candidatos: {debug.candidates.length}
                            </div>
                          )}
                          {debug?.crm_secret_fingerprint && (
                            <div>secret-fp CRM: <strong>{debug.crm_secret_fingerprint}</strong></div>
                          )}
                          {debug?.provided_preview && (
                            <div>sig recebida: {debug.provided_preview}…</div>
                          )}
                          {debug?.expected_preview && (
                            <div>sig esperada: {debug.expected_preview}…</div>
                          )}
                          {debug?.body_length != null && (
                            <div>body: {debug.body_length}b · ct: {debug.content_type ?? "?"}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Códigos por usuário</CardTitle>
          <CardDescription>
            Cada Closer/SDR precisa ter <code>mcf_pay_closer_code</code> ou <code>mcf_pay_sdr_code</code> preenchido na tela
            <strong> Administração &rarr; Usuários</strong>. Você também pode sobrescrever por deal usando
            <code> custom_fields.mcf_pay_closer_code</code> / <code>custom_fields.mcf_pay_sdr_code</code>.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}