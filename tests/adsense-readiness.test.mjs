import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

function listSourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listSourceFiles(path) : [path];
  });
}

function publicSourceOccurrences(pattern) {
  return listSourceFiles("src")
    .filter((path) => /\.(?:ts|tsx|js|jsx|json)$/.test(path))
    .filter((path) => pattern.test(read(path)));
}

test("AdSense carrega apenas no host de produção e em páginas públicas elegíveis", () => {
  const layout = read("src/app/layout.tsx");
  const loader = read("src/app/components/AdSenseLoader.tsx");
  assert.match(layout, /<AdSenseLoader \/>/);
  assert.doesNotMatch(layout, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  assert.match(loader, /window\.location\.hostname === "www\.dadosfii\.com\.br"/);
  for (const prefix of ["/admin", "/api", "/carteira", "/fii", "/login", "/configuracoes"]) assert.ok(loader.includes(`"${prefix}"`), `rota bloqueada ausente: ${prefix}`);
  assert.match(loader, /ELIGIBLE_EXACT_PATHS/);
  assert.match(loader, /ELIGIBLE_PREFIXES/);
  assert.doesNotMatch(loader, /\/autores\/|\/politica-editorial/);
});

test("consentimento oferece aceitar, recusar e reabrir preferências", () => {
  const banner = read("src/app/components/CookieBanner.tsx");
  const settings = read("src/app/components/CookieSettingsButton.tsx");
  const privacy = read("src/app/politica-de-privacidade/page.tsx");
  assert.match(banner, /Aceitar opcionais/);
  assert.match(banner, /Recusar opcionais/);
  assert.match(banner, /Recusar não bloqueia o acesso/);
  assert.match(settings, /dados-fii:open-consent/);
  assert.match(privacy, /Google AdSense/);
  assert.match(privacy, /cookies, web beacons, endereço IP e outros identificadores/);
  assert.match(privacy, /adssettings\.google\.com/);
});

test("sitemap contém conteúdo público forte e exclui páginas indevidas", () => {
  const sitemap = read("src/app/sitemap.ts");
  for (const route of ["/sobre", "/politica-de-correcoes", "/como-usamos-ia", "/guias/fundos-imobiliarios", "/guias/dividendos-de-fiis", "/guias/risco-em-fiis", "/guias/carteira-de-fiis"]) assert.ok(sitemap.includes(route), `rota pública ausente: ${route}`);
  assert.doesNotMatch(sitemap, /tickers\.map|\/fii\/|\/autores\/|\/politica-editorial/);
});

test("quatro pilares possuem conteúdo próprio, identidade Dados FII e schema Article", () => {
  const guides = read("src/lib/editorial/guides.ts");
  const article = read("src/app/components/GuideArticle.tsx");
  for (const slug of ["fundos-imobiliarios", "dividendos-de-fiis", "risco-em-fiis", "carteira-de-fiis"]) assert.ok(guides.includes(`slug: "${slug}"`), `guia ausente: ${slug}`);
  assert.match(article, /"@type": "Article"/);
  assert.match(article, /"@type": "BreadcrumbList"/);
  assert.match(article, /"@type": "Organization"/);
  assert.match(article, /Por Dados FII/);
  assert.match(article, /Revisado em/);
});

test("páginas institucionais necessárias e ads.txt existem sem páginas pessoais ou estratégicas", () => {
  for (const path of ["src/app/sobre/page.tsx", "src/app/politica-de-correcoes/page.tsx", "src/app/como-usamos-ia/page.tsx", "public/ads.txt"]) assert.equal(existsSync(path), true, `arquivo ausente: ${path}`);
  assert.equal(existsSync("src/app/autores/israel-alves/page.tsx"), false);
  assert.equal(existsSync("src/app/politica-editorial/page.tsx"), false);
  assert.match(read("public/ads.txt"), /^google\.com, pub-3245357129779122, DIRECT, f08c47fec0942fa0\s*$/);
});

test("código público não menciona identidade pessoal", () => {
  assert.deepEqual(publicSourceOccurrences(/Israel Alves|israel-alves/), []);
});

test("código público não expõe regras internas de publicação, indexação ou monetização", () => {
  const forbidden = /\/politica-editorial|score interno|gate de qualidade|gate de monetização|pontos para publicar|para indexar e|para monetizar/i;
  assert.deepEqual(publicSourceOccurrences(forbidden), []);
});

test("headers impedem indexação acidental em áreas fracas", () => {
  const config = read("next.config.ts");
  assert.match(config, /\/admin\/:path\*/);
  assert.match(config, /\/carteira\/:path\*/);
  assert.match(config, /\/fii\/:path\*/);
  assert.match(config, /X-Robots-Tag/);
  assert.match(config, /noindex, nofollow, noarchive/);
  assert.match(config, /noindex, follow, noarchive/);
});
