import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Employee } from "@/types/hr";
import { db, fmtSP } from "@/lib/documentosInternos";

/** Log de aceites de documentos internos (assinatura eletrônica simples) do colaborador. */
export default function EmployeeAceitesTab({ employee }: { employee: Employee }) {
  const { data, isLoading } = useQuery({
    queryKey: ["employee-aceites", employee.id, employee.user_id],
    queryFn: async () => {
      const [{ data: docs }, aceitesRes] = await Promise.all([
        db.from("documentos_internos").select("id,titulo,versao,exige_aceite").eq("ativo", true).eq("exige_aceite", true),
        employee.user_id
          ? db.from("documentos_internos_aceites").select("*").or(`employee_id.eq.${employee.id},user_id.eq.${employee.user_id}`).order("aceito_em", { ascending: false })
          : db.from("documentos_internos_aceites").select("*").eq("employee_id", employee.id).order("aceito_em", { ascending: false }),
      ]);
      return { docs: docs ?? [], aceites: aceitesRes.data ?? [] };
    },
  });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  const docs = data?.docs ?? [];
  const aceites = data?.aceites ?? [];
  return (
    <div className="space-y-4">
      {!employee.user_id && (
        <p className="text-sm text-muted-foreground">Colaborador sem login vinculado; aceites aparecem quando o cadastro for ligado ao usuário.</p>
      )}
      <div className="space-y-2">
        {docs.map((d: any) => {
          const a = aceites.find((x: any) => x.documento_id === d.id && x.versao === d.versao);
          return (
            <div key={d.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{d.titulo} (v{d.versao})</span>
                <Badge variant={a ? "default" : "destructive"}>{a ? "Aceito" : "Pendente"}</Badge>
              </div>
              {a && (
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  <div>Data/hora (São Paulo): {fmtSP(a.aceito_em)}</div>
                  <div>Usuário: {a.user_email ?? a.user_id}</div>
                  <div>Declaração: "{a.texto_confirmado}"</div>
                  <div className="break-all">Dispositivo: {a.user_agent ?? "—"}</div>
                  <div className="break-all">Registro: {a.id}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
