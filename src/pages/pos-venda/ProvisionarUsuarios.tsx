import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Tela pontual (admin): cria/vincula os Gerentes de Relacionamento da BU Pós Venda. */
export default function ProvisionarUsuarios() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-provision-pos-venda", { body: {} });
    setResult(error ? { error: error.message } : data);
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>Usuários da BU Pós Venda</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cria William e Rebeca com senha provisória (troca obrigatória no 1º acesso) e adiciona o perfil
            Gerente de Relacionamento + BU Pós Venda para os 4. Kalyanne e Vitor mantêm a senha e os perfis atuais.
            Pode ser executado mais de uma vez sem duplicar.
          </p>
          <Button onClick={run} disabled={loading}>{loading ? "Executando..." : "Criar / vincular usuários"}</Button>
          {result && (
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
