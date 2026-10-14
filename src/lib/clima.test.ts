import { describe, it, expect } from "vitest";
import { nivelPorMedia } from "./clima";

describe("nivelPorMedia", () => {
  it("média 7 ou mais é feliz", () => expect(nivelPorMedia(7)).toBe("feliz"));
  it("média entre 4 e 6,9 é entediado", () => { expect(nivelPorMedia(4)).toBe("entediado"); expect(nivelPorMedia(6.9)).toBe("entediado"); });
  it("média abaixo de 4 é triste", () => expect(nivelPorMedia(3.9)).toBe("triste"));
});
