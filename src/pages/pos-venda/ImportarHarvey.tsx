import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { POS_VENDA_ORIGIN_ID } from "@/lib/posVenda";
import {
  Row, HARVEY_ORIGEM, dedupeClientes, buildCustomFields, buildTags, addTag, fillMissing,
  digits, phoneSuffix, normCpf, sameFirstName, atividadeDescricao, encaminhamentoDescricao,
} from "@/lib/harveyImport";

const FIRST_STAGE_ID = "b05a0001-0000-4000-8000-000000000001";
const sb = supabase as any;

type Rel = { gerente: string; esperados: number; criados: number; atualizados: number; ignorados: number; atividades: number; encaminhamentos: number };
type Caso = { cliente: string; gerente: string; motivo: string };

async function readCsv(f: File): Promise<Row[]> {
  const text = (await f.text()).replace(/^\uFEFF/, "");
  const wb = XLSX.read(text, { type: "string", raw: true });
  return XLSX.utils.sheet_to_json<Row>(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
}

/** Tela pontual (admin): importa a carteira Harvey na pipeline Relacionamento - Pós venda. Reexecutar não duplica. */
export default function ImportarHarvey() {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [rel, setRel] = useState<Rel[] | null>(null);
  const [casos, setCasos] = useState<Caso[]>([]);

  const run = async () => {
    setRunning(true); setRel(null); setCasos([]);
    const log: Caso[] = [];
    try {
      const clientes = dedupeClientes(await readCsv(files.clientes));
      const ativ = (await readCsv(files.atividades)).filter((a) => a.tipo !== "encaminhamento");
      const encs = await readCsv(files.encaminhamentos);
      const byHid = <T extends Row>(arr: T[]) => arr.reduce((m, x) => (m.get(x.harvey_cliente_id)?.push(x) ?? m.set(x.harvey_cliente_id, [x]), m), new Map<string, T[]>());
      const ativMap = byHid(ativ), encMap = byHid(encs);

      const emails = [...new Set(clientes.map((c) => c.gerente_email.toLowerCase()))];
      const { data: profs } = await sb.from("profiles").select("id,email").in("email", emails);
      const profByEmail = new Map<string, string>((profs ?? []).map((p: any) => [String(p.email).toLowerCase(), p.id]));

      // Cards já existentes na pipeline Pós Venda
      const existing: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from("crm_deals").select("id,contact_id,tags,custom_fields").eq("origin_id", POS_VENDA_ORIGIN_ID).range(from, from + 999);
        if (error) throw error;
        existing.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      const dealByHid = new Map<string, any>(), dealByContact = new Map<string, any>();
      existing.forEach((d) => {
        if (d.custom_fields?.harvey_cliente_id) dealByHid.set(d.custom_fields.harvey_cliente_id, d);
        if (d.contact_id) dealByContact.set(d.contact_id, d);
      });

      const rel = new Map<string, Rel>();
      const R = (g: string) => rel.get(g) ?? (rel.set(g, { gerente: g, esperados: 0, criados: 0, atualizados: 0, ignorados: 0, atividades: 0, encaminhamentos: 0 }), rel.get(g)!);

      let n = 0;
      for (const c of clientes) {
        n++; setProgress(`${n} de ${clientes.length} — ${c.cliente_nome}`);
        const g = c.gerente_email.toLowerCase(); const r = R(g); r.esperados++;
        try {
          const ownerProfile = profByEmail.get(g);
          if (!ownerProfile) { r.ignorados++; log.push({ cliente: c.cliente_nome, gerente: g, motivo: "gerente sem login" }); continue; }
          const cf = buildCustomFields(c);
          let deal = dealByHid.get(c.harvey_cliente_id);
          let contactId: string | null = deal?.contact_id ?? null;

          if (!deal) {
            // 1) e-mail  2) telefone (só se o nome bater)  3) CPF
            let contact: any = null;
            const email = c.cliente_email.trim().toLowerCase();
            if (email) {
              const { data } = await sb.from("crm_contacts").select("id,name,email,phone,tags,custom_fields").ilike("email", email).limit(5);
              contact = (data ?? []).find((x: any) => String(x.email).trim().toLowerCase() === email) ?? null;
            }
            const suf = phoneSuffix(c.cliente_telefone);
            if (!contact && suf) {
              const { data } = await sb.from("crm_contacts").select("id,name,email,phone,tags,custom_fields").ilike("phone", `%${suf}`).limit(20);
              const list = (data ?? []).filter((x: any) => phoneSuffix(x.phone) === suf);
              contact = list.find((x: any) => sameFirstName(x.name, c.cliente_nome)) ?? null;
              if (!contact && list.length) log.push({ cliente: c.cliente_nome, gerente: g, motivo: `telefone igual ao de "${list[0].name}" mas nome diferente — criado cadastro novo` });
            }
            const cpf = normCpf(c.cliente_cpf);
            if (!contact && cpf) {
              const { data } = await sb.from("crm_contacts").select("id,name,email,phone,tags,custom_fields").eq("custom_fields->>cpf", cpf).limit(1);
              contact = data?.[0] ?? null;
            }

            if (contact) {
              const upd: any = { tags: addTag(contact.tags), custom_fields: fillMissing(contact.custom_fields, cf) };
              if (!contact.email && email) upd.email = email;
              if (!contact.phone && digits(c.cliente_telefone)) upd.phone = `+55${digits(c.cliente_telefone)}`;
              const { error } = await sb.from("crm_contacts").update(upd).eq("id", contact.id);
              if (error) throw error;
              contactId = contact.id;
              deal = dealByContact.get(contact.id);
            } else {
              const { data, error } = await sb.from("crm_contacts").insert({
                clint_id: `harvey-${c.harvey_cliente_id}`, name: c.cliente_nome.trim(), email: email || null,
                phone: digits(c.cliente_telefone) ? `+55${digits(c.cliente_telefone)}` : null,
                tags: ["Migrado do Harvey"], custom_fields: cf,
              }).select("id").single();
              if (error) throw error;
              contactId = data.id;
            }
          }

          if (deal) {
            const { error } = await sb.from("crm_deals").update({ tags: addTag(deal.tags), custom_fields: fillMissing(deal.custom_fields, cf) }).eq("id", deal.id);
            if (error) throw error;
            r.atualizados++;
          } else {
            const { data, error } = await sb.from("crm_deals").insert({
              name: c.cliente_nome.trim(), clint_id: `harvey-${c.harvey_cliente_id}`, contact_id: contactId,
              origin_id: POS_VENDA_ORIGIN_ID, stage_id: FIRST_STAGE_ID, owner_id: g, owner_profile_id: ownerProfile,
              tags: buildTags(c), custom_fields: cf, data_source: "csv", value: 0,
              last_contact_at: c.ultimo_contato_at || null, next_action_date: c.proximo_contato_at || null,
            }).select("id,contact_id,tags,custom_fields").single();
            if (error) throw error;
            deal = data; r.criados++;
          }
          dealByHid.set(c.harvey_cliente_id, deal);
          if (contactId) dealByContact.set(contactId, deal);

          // Linha do tempo sem duplicar (chave metadata.harvey_id)
          const { data: acts } = await sb.from("deal_activities").select("metadata").eq("deal_id", deal.id);
          const seen = new Set((acts ?? []).map((a: any) => a.metadata?.harvey_id).filter(Boolean));
          const ins: any[] = [];
          const base = { deal_id: deal.id, activity_type: "note", user_id: ownerProfile };
          if (c.notas?.trim() && !seen.has(`notas:${c.harvey_cliente_id}`))
            ins.push({ ...base, description: `Notas do Harvey: ${c.notas}`, created_at: c.entrada_carteira || undefined, metadata: { fixa: true, harvey_id: `notas:${c.harvey_cliente_id}`, origem: HARVEY_ORIGEM } });
          for (const a of ativMap.get(c.harvey_cliente_id) ?? []) if (!seen.has(a.atividade_id)) {
            ins.push({ ...base, description: atividadeDescricao(a), created_at: a.created_at || undefined, metadata: { harvey_id: a.atividade_id, harvey_tipo: a.tipo, origem: HARVEY_ORIGEM, concluida: a.concluida || null, data_prevista: a.data_prevista || null } });
            r.atividades++;
          }
          for (const e of encMap.get(c.harvey_cliente_id) ?? []) if (!seen.has(e.encaminhamento_id)) {
            ins.push({ ...base, description: encaminhamentoDescricao(e), created_at: e.created_at || undefined, metadata: { harvey_id: e.encaminhamento_id, harvey_tipo: "encaminhamento", origem: HARVEY_ORIGEM, area_destino: e.area_destino || null, status: e.status || null, status_externo: e.status_externo || null } });
            r.encaminhamentos++;
          }
          if (ins.length) { const { error } = await sb.from("deal_activities").insert(ins); if (error) throw error; }
        } catch (err: any) {
          r.ignorados++; log.push({ cliente: c.cliente_nome, gerente: g, motivo: `erro: ${err?.message ?? err}` });
        }
      }
      setRel([...rel.values()]); setCasos(log); setProgress("Concluído");
    } catch (err: any) {
      setProgress(`Falhou: ${err?.message ?? err}`);
    }
    setRunning(false);
  };

  const pick = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && setFiles((f) => ({ ...f, [k]: e.target.files![0] }));
  const ready = files.clientes && files.atividades && files.encaminhamentos;

  return (
    <div className="p-6 max-w-4xl">
      <Card>
        <CardHeader><CardTitle>Importar carteira do Harvey</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">Todos entram em "Reunião de Viabilidade 1" com a coluna original do Harvey guardada no card. Clientes que já têm card não são duplicados. Pode rodar de novo sem duplicar.</p>
          <label className="block">de-para-clientes.csv <Input type="file" accept=".csv" onChange={pick("clientes")} /></label>
          <label className="block">historico-atividades.csv <Input type="file" accept=".csv" onChange={pick("atividades")} /></label>
          <label className="block">historico-encaminhamentos.csv <Input type="file" accept=".csv" onChange={pick("encaminhamentos")} /></label>
          <Button onClick={run} disabled={!ready || running}>{running ? "Importando..." : "Importar"}</Button>
          {progress && <p>{progress}</p>}
          {rel && (
            <table className="w-full text-xs border">
              <thead><tr className="bg-muted">{["Gerente", "Esperados", "Criados", "Atualizados", "Ignorados", "Atividades", "Encaminhamentos"].map((h) => <th key={h} className="p-1 text-left">{h}</th>)}</tr></thead>
              <tbody>{rel.map((r) => <tr key={r.gerente} className="border-t"><td className="p-1">{r.gerente}</td><td>{r.esperados}</td><td>{r.criados}</td><td>{r.atualizados}</td><td>{r.ignorados}</td><td>{r.atividades}</td><td>{r.encaminhamentos}</td></tr>)}</tbody>
            </table>
          )}
          {casos.length > 0 && (
            <div><p className="font-medium">Casos para conferir ({casos.length})</p>
              <ul className="text-xs list-disc pl-5">{casos.map((c, i) => <li key={i}>{c.cliente} ({c.gerente}): {c.motivo}</li>)}</ul></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
