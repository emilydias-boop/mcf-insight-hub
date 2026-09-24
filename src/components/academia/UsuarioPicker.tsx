import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adb } from "@/lib/academia";
import { Input } from "@/components/ui/input";

export interface UsuarioApp { id: string; full_name: string | null; email: string | null }

export function UsuarioPicker({ valor, onChange, placeholder }: { valor: UsuarioApp | null; onChange: (u: UsuarioApp | null) => void; placeholder?: string }) {
  const [busca, setBusca] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["academia", "busca-usuarios", busca], enabled: busca.trim().length >= 2,
    queryFn: async () => ((await adb.rpc("academia_buscar_usuarios", { _busca: busca.trim() })).data ?? []) as UsuarioApp[],
  });
  if (valor) return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span>{valor.full_name} <span className="text-muted-foreground">{valor.email}</span></span>
      <button className="text-xs underline" onClick={() => onChange(null)}>trocar</button>
    </div>
  );
  return (
    <div className="relative">
      <Input placeholder={placeholder ?? "Buscar por nome ou e-mail"} value={busca} onChange={(e) => setBusca(e.target.value)} />
      {data.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow max-h-56 overflow-auto">
          {data.map((u) => (
            <button key={u.id} className="block w-full text-left px-3 py-2 text-sm hover:bg-accent" onClick={() => { onChange(u); setBusca(""); }}>
              {u.full_name} <span className="text-muted-foreground">{u.email}</span>
            </button>))}
        </div>)}
    </div>
  );
}
