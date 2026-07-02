import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Trash2, Plus, Upload, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Participant {
  id: string;
  campaign_id: string;
  role: "closer" | "sdr";
  name: string;
  photo_path: string | null;
  sort_order: number;
}

function photoUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("campaign-photos").getPublicUrl(path);
  return data.publicUrl;
}

export function CampaignManagerDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("Campanha do Mês");
  const [closerPrize, setCloserPrize] = useState("R$ 5.000,00");
  const [sdrPrize, setSdrPrize] = useState("R$ 3.000,00");
  const [closerQuestion, setCloserQuestion] = useState("Quem vai levar");
  const [sdrQuestion, setSdrQuestion] = useState("Quem vai levar");

  const { data: campaign } = useQuery({
    queryKey: ["campaign-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["campaign-participants", campaign?.id],
    queryFn: async () => {
      if (!campaign?.id) return [];
      const { data, error } = await supabase
        .from("campaign_participants")
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("role")
        .order("sort_order");
      if (error) throw error;
      return data as Participant[];
    },
    enabled: !!campaign?.id,
  });

  useEffect(() => {
    if (campaign) {
      setTitle(campaign.title ?? "Campanha do Mês");
      setCloserPrize(campaign.closer_prize ?? "");
      setSdrPrize(campaign.sdr_prize ?? "");
      setCloserQuestion(campaign.closer_question ?? "Quem vai levar");
      setSdrQuestion(campaign.sdr_question ?? "Quem vai levar");
    }
  }, [campaign]);

  const saveCampaign = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        closer_prize: closerPrize,
        sdr_prize: sdrPrize,
        closer_question: closerQuestion,
        sdr_question: sdrQuestion,
        active: true,
      };
      if (campaign?.id) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", campaign.id);
        if (error) throw error;
        return campaign.id;
      } else {
        const { data, error } = await supabase.from("campaigns").insert(payload).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => {
      toast.success("Campanha salva");
      qc.invalidateQueries({ queryKey: ["campaign-active"] });
      qc.invalidateQueries({ queryKey: ["campaign-carousel"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addParticipant = useMutation({
    mutationFn: async ({ role, name }: { role: "closer" | "sdr"; name: string }) => {
      if (!campaign?.id) throw new Error("Salve a campanha primeiro");
      const { error } = await supabase.from("campaign_participants").insert({
        campaign_id: campaign.id,
        role,
        name,
        sort_order: participants.filter(p => p.role === role).length,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-participants", campaign?.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeParticipant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaign_participants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-participants", campaign?.id] }),
  });

  const uploadPhoto = async (p: Participant, file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${p.campaign_id}/${p.id}.${ext}`;
    const { error } = await supabase.storage.from("campaign-photos").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { error: e2 } = await supabase.from("campaign_participants").update({ photo_path: path }).eq("id", p.id);
    if (e2) return toast.error(e2.message);
    qc.invalidateQueries({ queryKey: ["campaign-participants", campaign?.id] });
    qc.invalidateQueries({ queryKey: ["campaign-carousel"] });
    toast.success("Foto enviada");
  };

  const renameParticipant = async (id: string, name: string) => {
    await supabase.from("campaign_participants").update({ name }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["campaign-participants", campaign?.id] });
  };

  const closers = participants.filter(p => p.role === "closer");
  const sdrs = participants.filter(p => p.role === "sdr");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-[#bfff00]" /> Gerenciar Campanha</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Card className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div />
              <div>
                <Label>Prêmio Closer</Label>
                <Input value={closerPrize} onChange={e => setCloserPrize(e.target.value)} placeholder="R$ 5.000,00" />
              </div>
              <div>
                <Label>Prêmio SDR</Label>
                <Input value={sdrPrize} onChange={e => setSdrPrize(e.target.value)} placeholder="R$ 3.000,00" />
              </div>
              <div>
                <Label>Pergunta Closer</Label>
                <Input value={closerQuestion} onChange={e => setCloserQuestion(e.target.value)} />
              </div>
              <div>
                <Label>Pergunta SDR</Label>
                <Input value={sdrQuestion} onChange={e => setSdrQuestion(e.target.value)} />
              </div>
            </div>
            <Button onClick={() => saveCampaign.mutate()} disabled={saveCampaign.isPending} className="bg-[#bfff00] text-black hover:bg-[#bfff00]/90 font-bold">
              {saveCampaign.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar campanha
            </Button>
          </Card>

          {campaign?.id && (
            <>
              <ParticipantsSection
                title="Closers"
                role="closer"
                items={closers}
                onAdd={(name) => addParticipant.mutate({ role: "closer", name })}
                onRemove={(id) => removeParticipant.mutate(id)}
                onUpload={uploadPhoto}
                onRename={renameParticipant}
              />
              <ParticipantsSection
                title="SDRs"
                role="sdr"
                items={sdrs}
                onAdd={(name) => addParticipant.mutate({ role: "sdr", name })}
                onRemove={(id) => removeParticipant.mutate(id)}
                onUpload={uploadPhoto}
                onRename={renameParticipant}
              />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantsSection({
  title, role, items, onAdd, onRemove, onUpload, onRename,
}: {
  title: string;
  role: "closer" | "sdr";
  items: Participant[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onUpload: (p: Participant, file: File) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [newName, setNewName] = useState("");
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{title}</h3>
        <div className="flex gap-2">
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={`Nome do ${role}`} className="w-56" />
          <Button size="sm" onClick={() => { if (newName.trim()) { onAdd(newName.trim()); setNewName(""); } }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((p) => {
          const url = photoUrl(p.photo_path);
          return (
            <div key={p.id} className="border rounded-lg p-3 space-y-2">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {url ? <img src={url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-xs text-muted-foreground">Sem foto</span>}
              </div>
              <Input defaultValue={p.name} onBlur={e => { if (e.target.value !== p.name) onRename(p.id, e.target.value); }} className="h-8 text-sm" />
              <div className="flex gap-1">
                <label className="flex-1">
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(p, f); }} />
                  <div className="cursor-pointer text-xs border rounded px-2 py-1 flex items-center justify-center gap-1 hover:bg-muted">
                    <Upload className="h-3 w-3" /> Foto
                  </div>
                </label>
                <Button size="icon" variant="ghost" onClick={() => onRemove(p.id)} className="h-7 w-7">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}