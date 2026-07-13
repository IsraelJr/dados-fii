import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicationConfirmation,
  buildRollbackConfirmation,
  hashStablePayload,
  normalizedConfirmation,
  proposalHashPrefix,
} from "./fiiPublicationSafety.ts";

test("publication and rollback confirmations include the approved hash prefix", () => {
  const hash = "8ab2a745c80d042ff3aae23557434c043012a0d6db4e2d02be295d4327bdb3c6";
  assert.equal(proposalHashPrefix(hash), "8ab2a745c80d");
  assert.equal(buildPublicationConfirmation("knca11", hash), "PUBLICAR KNCA11 8ab2a745c80d");
  assert.equal(buildRollbackConfirmation("KNCA11", hash), "REVERTER KNCA11 8ab2a745c80d");
});

test("stable hashes do not depend on object key order", () => {
  assert.equal(
    hashStablePayload({ ticker: "KNCA11", data: { b: 2, a: 1 } }),
    hashStablePayload({ data: { a: 1, b: 2 }, ticker: "KNCA11" })
  );
});

test("confirmation normalization removes accidental whitespace only", () => {
  assert.equal(
    normalizedConfirmation("  publicar   knca11  8ab2a745c80d  "),
    "PUBLICAR KNCA11 8AB2A745C80D"
  );
});
