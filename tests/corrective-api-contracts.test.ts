import assert from "node:assert/strict";
import test from "node:test";
import { encodeFiiCursor, parseFiiQuery } from "../src/lib/http/FiiQueryContract";
import { publicError } from "../src/lib/http/PublicError";

test("[REG-DEF-02] ticker inválido, vazio ou repetido recebe contrato 400", () => {
  for (const query of ["?ticker=ABC", "?ticker=", "?ticker=TGAR11&ticker=MXRF11"]) {
    const result = parseFiiQuery(new URL(`https://dadosfii.com.br/api/fii${query}`));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  }
});

test("ticker é normalizado e separado da listagem", () => {
  const detail = parseFiiQuery(new URL("https://dadosfii.com.br/api/fii?ticker=%20tgar11%20"));
  assert.deepEqual(detail, { ok: true, mode: "detail", ticker: "TGAR11" });

  const list = parseFiiQuery(new URL("https://dadosfii.com.br/api/fii?limit=50"));
  assert.deepEqual(list, { ok: true, mode: "list", limit: 50, offset: 0 });
});

test("paginação rejeita limite e cursor inválidos", () => {
  for (const query of ["?limit=0", "?limit=501", "?limit=1.5", "?cursor=segredo"]) {
    assert.equal(parseFiiQuery(new URL(`https://dadosfii.com.br/api/fii${query}`)).ok, false);
  }
  const cursor = encodeFiiCursor(100);
  assert.deepEqual(
    parseFiiQuery(new URL(`https://dadosfii.com.br/api/fii?limit=100&cursor=${cursor}`)),
    { ok: true, mode: "list", limit: 100, offset: 100 },
  );
});

test("mensagem de domínio 4xx é preservada e exceção 5xx é ocultada", () => {
  const businessError = Object.assign(new Error("Limite do plano excedido."), {
    status: 422,
    code: "monitoring_limit_reached",
  });
  assert.deepEqual(publicError(businessError, "Falha interna."), {
    status: 422,
    message: "Limite do plano excedido.",
    code: "monitoring_limit_reached",
  });

  const internal = Object.assign(
    new Error("connect ECONNREFUSED token=segredo"),
    { status: 503, code: "PROVIDER_SECRET_FAILURE" },
  );
  assert.deepEqual(publicError(internal, "Serviço temporariamente indisponível."), {
    status: 503,
    message: "Serviço temporariamente indisponível.",
    code: "internal_error",
  });
});

test("status e código arbitrários nunca escapam no contrato público", () => {
  const malformed = Object.assign(new Error("detalhe interno"), {
    status: 799,
    code: "<script>",
  });
  assert.deepEqual(publicError(malformed, "Falha interna."), {
    status: 500,
    message: "Falha interna.",
    code: "internal_error",
  });
});
