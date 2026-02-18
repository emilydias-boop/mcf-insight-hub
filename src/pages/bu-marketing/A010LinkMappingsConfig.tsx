import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useA010LinkMappings, useCreateA010LinkMapping, useUpdateA010LinkMapping, useDeleteA010LinkMapping, A010LinkMapping, A010LinkMappingInsert } from "@/hooks/useA010LinkMappings";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const OFFER_OPTIONS = ["Principal", "VSL", "Página B", "Instagram Story", "Social Seller", "Outros"];
const ORIGIN_OPTIONS = ["Tráfego Pago", "Manychat", "Social Seller", "YouTube Orgânico", "Google Ads", "Instagram Ads", "Instagram Orgânico", "Hubla Direto", "Orgânico"];
const CHANNEL_OPTIONS = ["Facebook", "Instagram", "Google", "Orgânico", "ManyChat", "Hubla", "YouTube"];

const emptyForm: A010LinkMappingInsert = {
  name: "", offer: "", origin: "", channel: "",
  match_utm_source: null, match_utm_campaign: null, match_utm_medium: null, match_source: null,
  priority: 10, is_active: true,
};

export default function A010LinkMappingsConfig() {
  const navigate = useNavigate();
  const { data: mappings, isLoading } = useA010LinkMappings();
  const createMutation = useCreateA010LinkMapping();
  const updateMutation = useUpdateA010LinkMapping();
  const deleteMutation = useDeleteA010LinkMapping();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<A010LinkMappingInsert>(emptyForm);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (m: A010LinkMapping) => {
    setEditingId(m.id);
    setForm({ name: m.name, offer: m.offer, origin: m.origin, channel: m.channel, match_utm_source: m.match_utm_source, match_utm_campaign: m.match_utm_campaign, match_utm_medium: m.match_utm_medium, match_source: m.match_source, priority: m.priority, is_active: m.is_active });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.offer || !form.origin || !form.channel) return;
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, ...form });
    } else {
      await createMutation.mutateAsync(form);
    }
    setOpen(false);
  };

  const setField = (key: keyof A010LinkMappingInsert, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value || null }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/bu-marketing")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Configuração de Links A010</h1>
          <p className="text-muted-foreground text-sm">Mapeie UTMs e fontes para Oferta, Origem e Canal</p>
        </div>
        <div className="ml-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Adicionar Mapeamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar" : "Novo"} Mapeamento</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ex: Facebook Ads Principal" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label>Oferta</Label>
                    <Select value={form.offer} onValueChange={(v) => setField("offer", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {OFFER_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Origem</Label>
                    <Select value={form.origin} onValueChange={(v) => setField("origin", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {ORIGIN_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Canal</Label>
                    <Select value={form.channel} onValueChange={(v) => setField("channel", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {CHANNEL_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Regras de Match (preencha pelo menos uma)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-xs">utm_source contém</Label>
                      <Input value={form.match_utm_source || ""} onChange={(e) => setField("match_utm_source", e.target.value)} placeholder="Ex: FB" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">utm_campaign contém</Label>
                      <Input value={form.match_utm_campaign || ""} onChange={(e) => setField("match_utm_campaign", e.target.value)} placeholder="Ex: vsl" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">utm_medium contém</Label>
                      <Input value={form.match_utm_medium || ""} onChange={(e) => setField("match_utm_medium", e.target.value)} placeholder="Ex: cpc" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">source =</Label>
                      <Input value={form.match_source || ""} onChange={(e) => setField("match_source", e.target.value)} placeholder="Ex: hubla" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="grid gap-2 flex-1">
                    <Label className="text-xs">Prioridade (menor = mais prioritário)</Label>
                    <Input type="number" value={form.priority} onChange={(e) => setField("priority", parseInt(e.target.value) || 10)} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setField("is_active", v)} />
                    <Label className="text-xs">Ativo</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridade</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Oferta</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Regras</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : (mappings || []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum mapeamento configurado</TableCell></TableRow>
              ) : (
                (mappings || []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm">{m.priority}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.offer}</TableCell>
                    <TableCell>{m.origin}</TableCell>
                    <TableCell>{m.channel}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                      {[
                        m.match_utm_source && `src: ${m.match_utm_source}`,
                        m.match_utm_campaign && `camp: ${m.match_utm_campaign}`,
                        m.match_utm_medium && `med: ${m.match_utm_medium}`,
                        m.match_source && `source: ${m.match_source}`,
                      ].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell>{m.is_active ? "✅" : "❌"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
