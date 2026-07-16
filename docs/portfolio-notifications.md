# Notificações inteligentes da carteira

O novo processamento não utiliza nem altera o `monitor.js` legado. Ele roda por uma rota protegida do Next.js acionada pelo Vercel Cron.

## Fluxo

1. O cron atualiza dividendos pendentes às 11:00 UTC.
2. Às 11:30 UTC, `/api/admin/process-portfolio-notifications` lê as carteiras salvas no Firestore.
3. O serviço identifica novos dividendos, mudanças de concentração e variações patrimoniais relevantes.
4. Cada evento recebe uma chave determinística e é salvo em `User/{userId}/Notifications`, impedindo duplicidade.
5. Os eventos da mesma execução continuam separados na central de notificações, mas são consolidados em um único e-mail por usuário.
6. O e-mail é enviado pela Resend com as atualizações elegíveis consolidadas naquela execução; o alerta patrimonial é exibido somente no site.

A primeira execução cria as linhas de base de dividendos, riscos e patrimônio, evitando disparar alertas antigos ou oscilações anteriores em massa.

## Plano grátis e VIP

### Grátis

- Alertas de dividendos para os 3 maiores FIIs da carteira por valor financeiro.
- Alerta de concentração por ativo a partir de 40%.
- Alerta patrimonial quando a carteira acumular alta ou queda de 3% desde a última referência relevante.
- Central de notificações e toast persistente.

### VIP

- Alertas de dividendos para todos os FIIs da carteira.
- Comparação do dividendo com o pagamento anterior.
- Impacto do pagamento na renda estimada da carteira.
- Concentração por ativo, renda e segmento.
- Aviso quando a concentração volta ao limite configurado.
- Limite patrimonial configurável entre 0,5% e 20%.
- Resumo somente quando houver mudança real nos rendimentos.

## Variáveis de ambiente

As variáveis existentes `CRON_SECRET`, `RESEND_API_KEY` e `WALLET_EMAIL_FROM` continuam sendo usadas.

```env
PORTFOLIO_NOTIFICATIONS_ENABLED=true
PORTFOLIO_EMAIL_ALERTS_ENABLED=true
PORTFOLIO_DIGEST_ENABLED=true
PORTFOLIO_NOTIFICATION_USER_LIMIT=100
PORTFOLIO_NOTIFICATION_CONCURRENCY=5
FREE_PORTFOLIO_ALERT_LIMIT=3
FREE_ASSET_CONCENTRATION_THRESHOLD=40
VIP_ASSET_CONCENTRATION_THRESHOLD=30
VIP_INCOME_CONCENTRATION_THRESHOLD=45
VIP_SEGMENT_CONCENTRATION_THRESHOLD=60
```

Os valores acima já são os padrões do código. Portanto, só precisam ser cadastrados na Vercel quando for necessário substituí-los.

## Política anti-ruído

Uma execução diária não cria mais uma notificação apenas por causa da data. A ordem é:

1. comparar os hashes dos rendimentos anunciados/pagos com a leitura anterior;
2. quando houver alteração, criar os alertas de rendimento aplicáveis e reiniciar a referência patrimonial;
3. quando não houver alteração de rendimento, comparar o patrimônio atual com a última referência significativa;
4. criar um único alerta no site somente se a alta ou queda acumulada atingir o limite;
5. manter a referência anterior quando a oscilação ficar abaixo do limite, permitindo que movimentos pequenos se acumulem;
6. recriar a linha de base, sem alerta, quando a carteira, o plano ou o limite forem alterados;
7. não comparar patrimônio enquanto houver cotação ausente ou posição não carregada.

O plano Grátis usa sempre 3%. Premium e Super Premium podem salvar um valor entre 0,5% e 20% na própria página da carteira. O servidor resolve o plano e ignora qualquer tentativa do navegador de se declarar Premium.

A preferência individual fica no documento do usuário:

```json
{
  "notificationPreferences": {
    "enabled": true,
    "emailEnabled": true,
    "dividendAlerts": true,
    "riskAlerts": true,
    "digestEnabled": true,
    "patrimonyAlerts": true,
    "patrimonyChangeThresholdPercent": 2.5
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
- O estado de concentração usa uma identidade estável por tipo e ativo/segmento; o limite não faz parte dessa identidade.
- Cada execução guarda o percentual calculado. O e-mail informa o percentual anterior, o atual e o limite comparado.
- A primeira execução da versão atual, mudanças de plano/limites e dados incompletos apenas recriam a linha de base, sem avisos contraditórios.
- O patrimônio é comparado com a última referência significativa, e não simplesmente com o dia anterior.
- A alteração das quantidades de cotas muda a identidade da carteira e recria a referência sem atribuir o movimento ao mercado.
- O alerta patrimonial é exclusivo da central do site e não gera e-mail adicional.
- A ativação e a resolução usam margem de 1 ponto percentual para reduzir alertas causados por oscilação próxima ao limite.
- A quantidade de cotas pode permanecer igual e o peso mudar com as cotações; essa origem é explicitada no alerta.
- Uma execução envia no máximo um e-mail por usuário, ainda que gere resumo, dividendos e vários alertas.

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
