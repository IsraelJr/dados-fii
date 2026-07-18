# Notificações inteligentes da carteira

O novo processamento não utiliza nem altera o `monitor.js` legado. Ele roda por uma rota protegida do Next.js acionada pelo Vercel Cron.

## Fluxo

1. O cron atualiza dividendos pendentes às 11:00 UTC.
2. Às 11:30 UTC, `/api/admin/process-portfolio-notifications` lê as carteiras salvas no Firestore.
3. O serviço identifica novos dividendos, mudanças de concentração e variações patrimoniais relevantes.
4. Cada evento recebe uma chave determinística e é s