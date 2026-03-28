import assert from "node:assert/strict";
import test from "node:test";
import { converterParaISO, formatarCelular, formatarData } from "./format.ts";

test("formatarData converte corretamente", () => {
  assert.equal(formatarData("07032026"), "07/03/2026");
  assert.equal(formatarData("0703"), "07/03");
  assert.equal(formatarData("07"), "07");
  assert.equal(formatarData(""), "");
});

test("converterParaISO retorna null para dados invalidos", () => {
  assert.equal(converterParaISO("07/03/2026"), "2026-03-07");
  assert.equal(converterParaISO("07032026"), null);
  assert.equal(converterParaISO("07/03/26"), null);
});

test("formatarCelular mantem apenas digitos e insere mascara", () => {
  assert.equal(formatarCelular("11987654321"), "(11) 98765-4321");
  assert.equal(formatarCelular("112345"), "(11) 2345");
  assert.equal(formatarCelular("1"), "(1");
  assert.equal(formatarCelular(""), "");
});
