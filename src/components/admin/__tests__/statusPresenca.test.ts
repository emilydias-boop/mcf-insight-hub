import { statusPresenca } from "../TelemetriaPresenca";

/** Sem dependência de runner: roda com `bun src/components/admin/__tests__/statusPresenca.test.ts`. */
const agora = Date.parse("2026-11-13T15:00:00Z");
const ago = (min: number) => new Date(agora - min * 60_000).toISOString();
const casos: [string, Parameters<typeof statusPresenca>[0], string][] = [
  ["ativo com interação há menos de 2 min", { last_heartbeat: ago(0.5), last_interaction_at: ago(1), tab_visible: true }, "ativo"],
  ["ocioso sem interação há mais de 5 min", { last_heartbeat: ago(0.5), last_interaction_at: ago(6), tab_visible: true }, "ocioso"],
  ["segundo plano com aba oculta", { last_heartbeat: ago(0.5), last_interaction_at: ago(1), tab_visible: false }, "segundo_plano"],
  ["offline sem heartbeat há mais de 2 min", { last_heartbeat: ago(3), last_interaction_at: ago(3), tab_visible: true }, "offline"],
];
let falhas = 0;
for (const [nome, r, esperado] of casos) {
  const obtido = statusPresenca(r, 5, agora);
  if (obtido !== esperado) { falhas++; console.error(`FALHOU: ${nome} — esperado ${esperado}, obtido ${obtido}`); }
  else console.log(`ok: ${nome}`);
}
if (falhas) throw new Error(`${falhas} caso(s) falharam`);
