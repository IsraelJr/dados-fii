# Presentes VIP temporários

A funcionalidade permite conceder a um usuário um período gratuito e parametrizável de VIP. O benefício só começa depois que o usuário aceita o presente.

## Experiência do usuário

1. O administrador cria o presente pelo painel `/admin`.
2. Se o usuário já existir, uma notificação é criada imediatamente.
3. Ao entrar no site com uma sessão válida da carteira, o usuário vê um pop-up informando a duração e os benefícios.
4. O usuário escolhe **Ativar meu VIP** ou **Ignorar presente**.
5. Após aceitar, a tela apresenta os principais recursos VIP e a data de expiração.
6. O evento `vip-status-updated` é disparado no navegador para componentes que precisem atualizar o plano imediatamente.

Se o presente for criado antes do cadastro do usuário, ele permanece vinculado ao e-mail. Na primeira consulta autenticada, o sistema associa o convite ao documento correto e cria a notificação.

## Estrutura do Firestore

```text
VipGifts/{giftId}
User/{userId}/VipBenefits/{giftId}
User/{userId}/Notifications/{notificationId}
```

No documento do usuário, durante a vigência:

```json
{
  "isVip": true,
  "vipUntil": "Timestamp",
  "vip": {
    "active": true,
    "source": "gift",
    "giftId": "...",
    "durationDays": 5,
    "startsAt": "Timestamp",
    "expiresAt": "Timestamp"
  }
}
```

## Regras

- Duração permitida: 1 a 90 dias.
- Prazo para aceitar: 1 a 90 dias.
- O período começa quando o usuário aceita.
- Um novo presente estende um VIP temporário ainda vigente.
- Um VIP permanente não é reduzido nem substituído.
- O mesmo convite não pode ser aceito duas vezes.
- Presentes pendentes não vencidos para o mesmo e-mail são reaproveitados, evitando duplicidade acidental.
- As permissões principais verificam `vipUntil`, portanto o acesso termina na data configurada mesmo antes da limpeza física do documento.
- O cron diário compatível com o plano atual faz a limpeza de `isVip` e atualiza o histórico de presentes expirados.

## Criar pelo painel

O card **Presentear com VIP** aceita:

- e-mail;
- quantidade de dias VIP;
- prazo para aceitar;
- mensagem personalizada.

## Criar pela API

```bash
curl -X POST https://www.dadosfii.com.br/api/admin/vip-gifts \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_UPDATE_SECRET" \
  -d '{
    "email": "usuario@email.com",
    "durationDays": 5,
    "claimWindowDays": 30,
    "message": "Você ganhou cinco dias para experimentar os recursos VIP."
  }'
```

## API do usuário

Todas as ações exigem e-mail e token válidos de `WalletSessions`.

```json
{ "action": "list", "email": "...", "sessionToken": "..." }
{ "action": "accept", "giftId": "...", "email": "...", "sessionToken": "..." }
{ "action": "ignore", "giftId": "...", "email": "...", "sessionToken": "..." }
```

## Expiração

O cron diário chama:

```text
/api/admin/expire-vip-gifts?limit=300
```

Quando o VIP temporário termina, o sistema:

- desativa `isVip`;
- marca `vip.active` como falso;
- registra `expiredAt`;
- altera o presente para `expired`.

A expiração só remove acessos cuja origem é `gift`, preservando assinaturas e VIPs permanentes.
