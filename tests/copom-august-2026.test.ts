import assert from "node:assert/strict";
import test from "node:test";
import {
  getPublishedMarketArticle,
  PUBLISHED_MARKET_ARTICLES,
} from "../src/lib/editorial/copomAugust2026";
import type { MarketArticle } from "../src/lib/editorial/marketContent";

const DIRECT_RECOMMENDATION = /\b(?:compre|venda|recomendamos|é hora de comprar|é hora de vender|preço-alvo)\b/i;

function publishedText(article: MarketArticle): string {
  return [
    article.title,
    article.description,
    article.summary,
    ...article.signals.flatMap((signal) => [signal.label, signal.value, signal.interpretation]),
    ...article.sections.flatMap((section) => [section.title, ...section.paragraphs, ...(section.watch ?? [])]),
  ].join("\n");
}

test("conteúdo final publicado usa a fonte permanente da 280ª reunião", () => {
  const article = getPublishedMarketArticle("mercado-de-fiis");
  assert.ok(article);
  assert.equal(article.asOf, "2026-08-05");
  assert.equal(article.datePublished, "2026-08-05");
  assert.equal(article.dateModified, "2026-08-17");
  assert.equal(article.signals.find((signal) => signal.label === "Meta Selic")?.value, "14,00% ao ano");
  assert.ok(article.sources.some((source) => source.url === "https://www.bcb.gov.br/api/servico/sitebcb/copom/comunicados_detalhes?nro_reuniao=280"));
  assert.ok(article.sources.some((source) => source.url.endsWith("/Copom280-not20260805280.pdf")));
});

test("transformação final mantém os sete artigos e altera somente o cenário geral", () => {
  assert.equal(PUBLISHED_MARKET_ARTICLES.length, 7);
  assert.equal(PUBLISHED_MARKET_ARTICLES.filter((article) => article.dateModified === "2026-08-17").length, 1);
  assert.equal(getPublishedMarketArticle("galpoes-logistica")?.dateModified, "2026-08-04");
});

test("conteúdo efetivamente publicado separa fato e interpretação sem recomendação direta", () => {
  const article = getPublishedMarketArticle("mercado-de-fiis");
  assert.ok(article);
  const text = publishedText(article);
  assert.match(text, /Fato:/);
  assert.match(text, /Interpretação editorial:/);
  assert.match(text, /Inferência/);
  assert.match(text, /mantém a trajetória de flexibilização iniciada em março de 2026/i);
  assert.doesNotMatch(text, /altera a direção da política monetária/i);
  assert.doesNotMatch(text, DIRECT_RECOMMENDATION);
});
