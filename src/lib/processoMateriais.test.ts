import { agruparMateriais, linkMaterial, materialIdDaMensagem, temDocumento } from "./processoMateriais";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
equal(temDocumento({ link_url: "/pos-venda/crm" }), true);
equal(temDocumento({ arquivo_path: "material.pdf" }), true);
equal(temDocumento({ conteudo: "Texto" }), true);
equal(temDocumento({ conteudo: " \n " }), false);
equal(agruparMateriais([{ id: "m1", titulo: "Painel", status: "pronto", etapa_chave: "geral", link_url: "/pos-venda/crm", arquivo_path: null, conteudo: null }]), { geral: [["Painel", "pronto", "m1", true]] });
const source = {};
const ids = new Set(["m1"]);
equal(materialIdDaMensagem({ source, data: { tipo: "mcf-abrir-material", id: "m1" } }, source, ids), "m1");
equal(materialIdDaMensagem({ source: {}, data: { tipo: "mcf-abrir-material", id: "m1" } }, source, ids), null);
equal(materialIdDaMensagem({ source, data: { tipo: "mcf-abrir-material", id: "outro" } }, source, ids), null);
equal(materialIdDaMensagem({ source, data: { tipo: "outro", id: "m1" } }, source, ids), null);
equal(linkMaterial("https://mcfgestao.com/pos-venda/crm")?.tela, "/pos-venda/crm");
equal(linkMaterial("/pos-venda/crm")?.tela, "/pos-venda/crm");
equal(linkMaterial("https://mcfgestao.com.evil.com/pos-venda/crm")?.tela, undefined);
equal(linkMaterial("javascript:alert(1)"), null);
equal(linkMaterial("//evil.com") , null);
equal(linkMaterial("https://youtu.be/abc-123")?.embed, "https://www.youtube.com/embed/abc-123");
equal(linkMaterial("https://youtube.com/watch?v=abc-123")?.embed, "https://www.youtube.com/embed/abc-123");
equal(linkMaterial("https://vimeo.com/123")?.embed, "https://player.vimeo.com/video/123");
equal(linkMaterial("https://loom.com/share/abc")?.embed, "https://www.loom.com/embed/abc");
equal(linkMaterial("https://drive.google.com/file/d/abc/view")?.embed, "https://drive.google.com/file/d/abc/preview");
equal(linkMaterial("https://docs.google.com/presentation/d/abc/edit")?.embed, "https://docs.google.com/presentation/d/abc/preview");
equal(new URL(linkMaterial("https://canva.com/design/abc/view")?.embed ?? "https://invalid.com").searchParams.has("embed"), true);
console.log("processoMateriais: 21 testes passaram");