import { nivelPorMedia } from "./clima";

/** Sem dependência de runner: roda com `bun src/lib/clima.test.ts`. */
const casos: [number, string][] = [[7, "feliz"], [10, "feliz"], [6.9, "entediado"], [4, "entediado"], [3.9, "triste"], [0, "triste"]];
for (const [m, esperado] of casos) {
  const r = nivelPorMedia(m);
  if (r !== esperado) throw new Error(`média ${m}: esperado ${esperado}, veio ${r}`);
}
console.log("clima: ok");
