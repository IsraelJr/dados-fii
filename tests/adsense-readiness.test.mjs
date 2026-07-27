import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("AdSense carrega apenas no host de produção e em páginas públicas elegíveis", () => {
  const layout = read("src/app/layout.tsx");
  const loader = read("src/app/components/AdSenseLoader.tsx");
  assert.match(layout, /<AdSenseLoader \/>/);
  assert.doesNotMatch(layout, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  assert.match(loader, /window\.location\.hostname === "www\.dadosfii\.com\.br"/);
  for (const prefix of ["/admin", "/api", "/carteira", "/fii", "/login", "/configuracoes"]) assert.ok(loader.includes(`"${prefix}"`), `rota bloqueada ausente: ${prefix}`);
  assert.match(loader, /ELIGIBLE_EXACT_PATHS/);
  assert.match(loader, /ELIGIBLE_PREFIXES/);
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

test("sitemap contém conteúdo editorial forte e exclui tickers sem gate", () => {
  const sitemap = read("src/app/sitemap.ts");
  for (const route of ["/sobre", "/politica-editorial", "/politica-de-correcoes", "/como-usamos-ia", "/autores/israel-alves", "/guias/fundos-imobiliarios", "/guias/dividendos-de-fiis", "/guias/risco-em-fiis", "/guias/carteira-de-fiis"]) assert.ok(sitemap.includes(route), `rota editorial ausente: ${route}`);
  assert.doesNotMatch(sitemap, /tickers\.map|\/fii\//);
});

test("quatro pilares possuem conteúdo próprio, autoria e schema Article", () => {
  const guides = read("src/lib/editorial/guides.ts");
  const article = read("src/app/components/GuideArticle.tsx");
  for (const slug of ["fundos-imobiliarios", "dividendos-de-fiis", "risco-em-fiis", "carteira-de-fiis"]) assert.ok(guides.includes(`slug: "${slug}"`), `guia ausente: ${slug}`);
  assert.match(article, /"@type": "Article"/);
  assert.match(article, /"@type": "BreadcrumbList"/);
  assert.match(article, /Israel Alves/);
  assert.match(article, /Revisado em/);
});

test("páginas institucionais e ads.txt obrigatórios existem", () => {
  for (const path of ["src/app/sobre/page.tsx", "src/app/politica-editorial/page.tsx", "src/app/politica-de-correcoes/page.tsx", "src/app/como-usamos-ia/page.tsx", "src/app/autores/israel-alves/page.tsx", "public/ads.txt"]) assert.equal(existsSync(path), true, `arquivo ausente: ${path}`);
  assert.match(read("public/ads.txt"), /^google\.com, pub-3245357129779122, DIRECT, f08c47fec0942fa0\s*$/);
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
