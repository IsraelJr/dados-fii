# Notificações inteligentes da carteira

O novo processamento não utiliza nem altera o `monitor.js` legado. Ele roda por uma rota protegida do Next.js acionada pelo Vercel Cron.

## Fluxo

1. O cron atualiza dividendos pendentes às 11:00 UTC.
2. Às 11:30 UTC, `/api/admin/process-portfolio-notifications` lê as carteiras salvas no Firestore.
3. O serviço identifica novos dividendos, mudanças de concentração e a necessidade de envio do resumo da carteira.
4. Cada evento recebe uma chave determinística e é salvo em `User/{userId}/Notifications`, impedindo duplicidade.
5. Os e-mails são enviados pela Resend e os mesmos eventos aparecem na central de notificações do site.

A primeira execução cria a linha de base dos dividendos e riscos, evitando disparar alertas antigos em massa. O resumo do dia pode ser enviado normalmente nessa primeira execução.

## Plano grátis e VIP

### Grátis

- Alertas de dividendos para os 3 maiores FIIs da carteira por valor financeiro.
- Alerta de concentração por ativo a partir de 40%.
- Resumo completo da carteira enviado toda sexta-feira.
- Central de notificações e toast persistente.

### VIP

- Alertas de dividendos para todos os FIIs da carteira.
- Comparação do dividendo com o pagamento anterior.
- Impacto do pagamento na renda estimada da carteira.
- Concentração por ativo, renda e segmento.
- Aviso quando a concentração volta ao limite configurado.
- Resumo periódico completo.

## Variáveis de ambiente

As variáveis existentes `CRON_SECRET`, `RESEND_API_KEY` e `WALLET_EMAIL_FROM` continuam sendo usadas.

```env
PORTFOLIO_NOTIFICATIONS_ENABLED=true
PORTFOLIO_EMAIL_ALERTS_ENABLED=true
PORTFOLIO_DIGEST_ENABLED=true
PORTFOLIO_DIGEST_SCHEDULE=daily # usado pelo VIP; grátis é fixo em weekly:5
PORTFOLIO_NOTIFICATION_USER_LIMIT=100
PORTFOLIO_NOTIFICATION_CONCURRENCY=5
FREE_PORTFOLIO_ALERT_LIMIT=3
FREE_ASSET_CONCENTRATION_THRESHOLD=40
VIP_ASSET_CONCENTRATION_THRESHOLD=30
VIP_INCOME_CONCENTRATION_THRESHOLD=45
VIP_SEGMENT_CONCENTRATION_THRESHOLD=60
```

Os valores acima já são os padrões do código. Portanto, só precisam ser cadastrados na Vercel quando for necessário substituí-los.

## Frequência do resumo

Para o plano grátis, o resumo é fixo em `weekly:5` (sexta-feira), mesmo que exista outra preferência no documento do usuário. Para o VIP, `PORTFOLIO_DIGEST_SCHEDULE` aceita:

| Valor | Regra |
|---|---|
| `daily` | Todos os dias |
| `every:2` | A cada dois dias desde o último envio |
| `every:3` | A cada três dias desde o último envio |
| `even_days` | Somente nos dias pares do mês |
| `odd_days` | Somente nos dias ímpares do mês |
| `weekly:0` | Aos domingos |
| `weekly:1` | Às segundas-feiras |
| `weekly:5` | Às sextas-feiras |
| `weekdays:1,3,5` | Segunda, quarta e sexta |

A preferência global pode ser substituída individualmente no documento do usuário:

```json
{
  "notificationPreferences": {
    "enabled": true,
    "emailEnabled": true,
    "dividendAlerts": true,
    "riskAlerts": true,
    "digestEnabled": true,
    "digestSchedule": "every:2"
  }
}
```

## Segurança e antirrepetição

- A rota do cron aceita apenas `CRON_SECRET` ou `ADMIN_UPDATE_SECRET`.
- A central de notificações exige e-mail e sessão válida de `WalletSessions`.
- O plano VIP é lido no servidor; não depende de valor enviado pelo navegador.
- O primeiro processamento apenas registra a linha de base dos dividendos e riscos.
- Cada notificação usa um identificador derivado do tipo e da chave do evento.
- O e-mail só é tentado depois de a notificação ser criada com sucesso.
- Alertas de concentração são emitidos quando o limite é cruzado, e não todos os dias.

## Coleções criadas

```text
User/{userId}/Notifications/{notificationId}
User/{userId}/NotificationState/main
PortfolioNotificationRuns/{runId}
```

## Execução manual segura

Para testar sem aguardar o cron:

```bash
curl -X POST https://www.dadosfii.com.br/api/admin/process-portfolio-notifications \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_UPDATE_SECRET" \
  -d '{"limit":10}'
```

A resposta informa usuários processados, notificações criadas, e-mails enviados e eventuais erros por usuário.
