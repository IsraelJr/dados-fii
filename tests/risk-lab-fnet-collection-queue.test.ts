import assert from "node:assert/strict";
import test from "node:test";
import {
  FNET_COLLECTION_QUEUE_LIMIT,
  buildFnetCollectionQueue,
  parseFnetCollectionQueue,
} from "../src/lib/risk-lab/FnetCollectionQueue";

test("aceita separadores, remove duplicidades e preserva a ordem", () => {
  const parsed = parseFnetCollectionQueue("123, 456\n123;789 456");
  assert.deepEqual(parsed.documentIds, ["123", "456", "789"]);
  assert.deepEqual(parsed.rejectedTokens, []);
  assert.equal(parsed.truncated, false);
});

test("rejeita tokens não numéricos e IDs maiores que doze dígitos", () => {
  const parsed = parseFnetCollectionQueue("123 abc 12x 1234567890123 456");
  assert.deepEqual(parsed.documentIds, ["123", "456"]);
  assert.deepEqual(parsed.rejectedTokens, ["abc", "12x", "1234567890123"]);
});

test("limita a fila aos primeiros vinte IDs válidos e únicos", () => {
  const source = Array.from({ length: FNET_COLLECTION_QUEUE_LIMIT + 5 }, (_, index) => String(1000 + index)).join(" ");
  const parsed = parseFnetCollectionQueue(source);
  assert.equal(parsed.documentIds.length, FNET_COLLECTION_QUEUE_LIMIT);
  assert.equal(parsed.documentIds[0], "1000");
  assert.equal(parsed.documentIds.at(-1), "1019");
  assert.equal(parsed.truncated, true);
});

test("fila reconhece documentos já importados sem alterar os IDs", () => {
  const queue = buildFnetCollectionQueue(["100", "200", "300"], ["200", "999"]);
  assert.deepEqual(queue, [
    { documentId: "100", alreadyImported: false },
    { documentId: "200", alreadyImported: true },
    { documentId: "300", alreadyImported: false },
  ]);
});

test("entrada vazia produz fila vazia", () => {
  const parsed = parseFnetCollectionQueue("  \n , ; ");
  assert.deepEqual(parsed.documentIds, []);
  assert.deepEqual(parsed.rejectedTokens, []);
  assert.equal(parsed.truncated, false);
});
