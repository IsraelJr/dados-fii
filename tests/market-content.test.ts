import assert from "node:assert/strict";
import test from "node:test";
import {
  getMarketArticle,
  MARKET_ARTICLES,
  validateMarketArticle,
} from "../src/lib/editorial/marketContent";
import {
  createEditorialEvent,
  EditorialEventValidationError,
} from "../src/lib/editorial/EditorialEvent";

const EXPECTED_SLUGS = [
  "mercado-de-fiis",
  "fiagro-agronegocio",
  "galpoes-logistica",
  "shoppings",
  "escritorios-lajes-corporativas",
  "recebiveis-papel",
  "renda-urbana",
] as const;

test("registro editorial publica sete cenários específicos e válidos", () => {
  assert.deepEqual(MARKET_ARTICLES.map((article) => article.slug), EXPECTED_SLUGS);
  for (const article of MARKET_ARTICLES) {
    assert.deepEqual(validateMarketArticle(article), [], article.slug);
    assert.equal(article.indexable, true);
    assert.ok(article.sections.length >= 4);
    assert.ok(article.sources.length >= 3);
    assert.ok(article.signals.length >= 3);
  }
});

test("conteúdo não é intercambiável entre segmentos", () => {
  const agro = getMarketArticle("fiagro-agronegocio");
  const logistics = getMarketArticle("galpoes-logistica");
  const shopping = getMarketArticle("shoppings");
  const offices = getMarketArticle("escritorios-lajes-corporativas");
  const paper = getMarketArticle("recebiveis-papel");
  const urban = getMarketArticle("renda-urbana");
  assert.ok(agro?.title.toLowerCase().includes("safra"));
  assert.ok(logistics?.title.toLowerCase().includes("localização"));
  assert.ok(shopping?.title.toLowerCase().includes("vendas"));
  assert.ok(offices?.title.toLowerCase().includes("escritórios"));
  assert.ok(paper?.title.toLowerCase().includes("recebíveis"));
  assert.ok(urban?.title.toLowerCase().includes("renda urbana"));
  assert.equal(new Set(MARKET_ARTICLES.map((article) => article.summary)).size, MARKET_ARTICLES.length);
});

test("fontes possuem HTTPS, data-base e editor responsável", () => {
  for (const article of MARKET_ARTICLES) {
    assert.match(article.asOf, /^2026-\d{2}-\d{2}$/);
    assert.ok(article.reviewPolicy.length > 30);
    for (const source of article.sources) {
      assert.match(source.url, /^https:\/\//);
      assert.match(source.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(source.accessedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(source.publisher.length > 1);
    }
  }
});

test("evento editorial é sanitizado e expira em noventa dias", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");
  const event = createEditorialEvent(
    { name: "market_article_viewed", page: "galpoes-logistica", entryClass: "search" },
    "123e4567-e89b-12d3-a456-426614174000",
    now,
  );
  assert.deepEqual(event, {
    name: "market_article_viewed",
    page: "galpoes-logistica",
    entryClass: "search",
    origin: "market-content",
    schemaVersion: 1,
    correlationId: "123e4567-e89b-12d3-a456-426614174000",
    occurredAt: "2026-08-04T12:00:00.000Z",
    expiresAt: "2026-11-02T12:00:00.000Z",
  });
  assert.equal("email" in event, false);
  assert.equal("ownerId" in event, false);
  assert.equal("portfolio" in event, false);
});

test("clique de continuidade exige destino allowlistado", () => {
  assert.throws(
    () => createEditorialEvent(
      { name: "market_continuation_clicked", page: "hub", entryClass: "internal" },
      "123e4567-e89b-12d3-a456-426614174000",
    ),
    EditorialEventValidationError,
  );
  assert.throws(
    () => createEditorialEvent(
      { name: "market_article_viewed", page: "mercado-de-fiis", entryClass: "direct", destination: "portfolio" },
      "123e4567-e89b-12d3-a456-426614174000",
    ),
    EditorialEventValidationError,
  );
  const event = createEditorialEvent(
    { name: "market_continuation_clicked", page: "hub", entryClass: "internal", destination: "portfolio" },
    "123e4567-e89b-12d3-a456-426614174000",
  );
  assert.equal(event.destination, "portfolio");
});
