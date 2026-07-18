# Notificações inteligentes da carteira

O processamento não utiliza nem altera o `monitor.js` legado. Ele roda por uma rota protegida do Next.js acionada pelo Vercel Cron.

## Fluxo

1. O cron atualiza os dados necessários da carteira.
2. `/api/admin/process-portfolio-notifications` lê as carteiras salvas no Firestore.
3. O serviço compara rendimentos anunciados ou pagos, riscos de concentração e patrimônio estimado.
4. Cada evento recebe uma chave determinística e é salvo em `User/{userId}/Notifications`, impedindo duplicidade.
5. Os eventos elegíveis da mesma execução são consolidados em um único e-mail por usuário.
6. Alertas exclusivamente patrimoniais aparecem somente no site.

A primeira execução de uma versão da política cria as linhas de base sem disparar alertas antigos em massa.

## Política anti-ruído

Uma execução diária não cria notificação apenas porque a data mudou. A ordem de decisão é:

1. comparar os hashes dos rendimentos anunciados ou pagos com a leitura anterior;
2. quando houver alteração real, criar os alertas de rendimento aplicáveis e atualizar a referência patrimonial;
3. quando não houver alteração de rendimento, comparar o patrimônio atual com a última referência significativa;
4. criar um alerta no site apenas se a alta ou queda acumulada atingir o limite do usuário;
5. manter a referência anterior enquanto a oscilação ficar abaixo do limite, permitindo acumular movimentos pequenos;
6. recriar a linha de base, sem alerta, quando a carteira, o plano ou o limite forem alterados;
7. não comparar o patrimônio quando houver cotação ausente ou posição não carregada.

O objetivo é evitar notificações repetitivas quando os rendimentos permanecem iguais e o patrimônio oscila pouco.

## Planos e limites

### Grátis

- Limite patrimonial fixo de 3%.
- Alertas de dividendos para os três maiores FIIs da carteira por valor financeiro.
- Alerta de concentração por ativo a partir do limite definido para o plano.
- Central de notificações no site.

### Premium e Super Premium

- Limite patrimonial configurável entre 0,5% e 20% na página da carteira.
- Alertas de dividendos para todos os FIIs da carteira.
- Comparação do dividendo com o pagamento anterior.
- Impacto do pagamento na renda estimada da carteira.
- Alertas de concentração por ativo, renda e segmento.
- Aviso quando uma concentração volta ao limite configurado.

O plano é resolvido no servidor. Valores enviados pelo navegador não concedem acesso a recursos pagos.

## Referência patrimonial

O patrimônio é comparado com a última referência significativa, e não simplesmente com o dia anterior. Assim, movimentos diários pequenos podem acumular até atingir o limite.

Exemplo no plano Grátis:

- referência de R$ 10.000;
- leituras de R$ 10.100 e R$ 10.200 não geram alerta nem substituem a referência;
- ao chegar a R$ 10.300, a alta acumulada de 3% gera um alerta no site;
- R$ 10.300 passa a ser a nova referência.

A alteração das quantidades de cotas muda a identidade da carteira e cria uma nova referência sem atribuir esse movimento ao mercado.

## Preferência individual

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

No plano Grátis, qualquer valor salvo anteriormente é ignorado e o limite permanece em 3%.

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

Os valores acima são os padrões do código e só precisam ser cadastrados na Vercel quando for necessário substituí-los.

## Segurança e antirrepetição

- A rota do cron aceita apenas o segredo administrativo configurado.
- A central e as preferências exigem e-mail e sessão válida de `WalletSessions`.
- O plano comercial é lido no servidor e é independente do papel de administrador.
- Cada notificação usa um identificador derivado do tipo e da chave do evento.
- O e-mail só é tentado depois de a notificação ser criada com sucesso.
- Alertas de concentração são emitidos quando o limite é cruzado, e não todos os dias.
- A ativação e a resolução usam margem para reduzir alertas causados por oscilações próximas ao limite.
- Uma execução envia no máximo um e-mail por usuário, ainda que gere vários eventos elegíveis.
- Uma retomada após falha não cria resumo duplicado quando o alerta detalhado já existe.

## Entrega por canal

| Evento | Site | E-mail |
|---|---:|---:|
| Mudança real de rendimento | Sim | Sim, consolidado |
| Concentração cruzou ou voltou ao limite | Sim | Sim, consolidado |
| Patrimônio atingiu o limite de variação | Sim | Não |
| Rendimento igual e patrimônio abaixo do limite | Não | Não |

O alerta patrimonial é exclusivo do site para não recriar o excesso de e-mails que esta política pretende eliminar.
