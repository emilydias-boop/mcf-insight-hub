import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function McfPayCodesCard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closerCode, setCloserCode] = useState("");
  const [sdrCode, setSdrCode] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("mcf_pay_closer_code, mcf_pay_sdr_code")
        .eq("id", userId)
        .maybeSingle();
      setCloserCode((data?.mcf_pay_closer_code as string) ?? "");
      setSdrCode((data?.mcf_pay_sdr_code as string) ?? "");
      setLoading(false);
    })();
  }, [userId]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        mcf_pay_closer_code: closerCode.trim() || null,
        mcf_pay_sdr_code: sdrCode.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);
    if (error) toast.error("Erro: " + error.message);
    else toast.success("Códigos MCF Pay salvos");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Códigos MCF Pay</CardTitle>
        <CardDescription>Vinculam o usuário aos pagamentos do MCF Pay para creditar comissão</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Closer Code</Label>
              <Input value={closerCode} onChange={(e) => setCloserCode(e.target.value)} placeholder="ex: CL-001" />
            </div>
            <div className="space-y-2">
              <Label>SDR Code</Label>
              <Input value={sdrCode} onChange={(e) => setSdrCode(e.target.value)} placeholder="ex: SDR-001" />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar códigos
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}