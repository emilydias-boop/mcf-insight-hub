import { disponibilidadeTrilha, type TemplateAtribuicao } from "./academiaAtribuicao";

const tpl: TemplateAtribuicao = { id: "solar", nome: "Solar", frente_id: "solar-bu", descricao: null };
function igual(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Esperado ${expected}, recebido ${actual}`);
}
// Uma pessoa pode receber mais de uma trilha de frentes diferentes.
const tracks = [{ track_template_id: "credito", frente_id: "credito-bu", tipo: "extensao" }];
igual(disponibilidadeTrilha(tpl, tracks, ["solar-task"], new Set(["credito-task"])), "disponivel");
// Mesma trilha não pode ser atribuída novamente.
igual(disponibilidadeTrilha(tpl, [{ track_template_id: "solar", frente_id: "solar-bu", tipo: "extensao" }], ["solar-task"], new Set()), "ja_atribuida");
// Tarefas existentes não são reiniciadas nem duplicadas.
igual(disponibilidadeTrilha(tpl, [], ["solar-task"], new Set(["solar-task"])), "ja_contemplada");
// Uma trilha parcialmente contemplada permanece disponível para as tarefas novas.
igual(disponibilidadeTrilha(tpl, [], ["task-1", "task-2"], new Set(["task-1"])), "disponivel");
console.log("academiaAtribuicao: 4 testes passaram");