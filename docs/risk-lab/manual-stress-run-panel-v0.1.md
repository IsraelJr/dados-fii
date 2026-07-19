# Painel de execução manual de estresse — v0.1

## Rota

`/admin/risk-lab/stress-runs`

A página é administrativa e isolada do fluxo atual do Risk Lab. Abrir a rota executa somente uma leitura de status por `GET`.

## Condições para habilitar o botão

O botão de um fundo permanece desabilitado até que todas as condições sejam verdadeiras:

- `ENABLE_RISK_LAB_STRESS_RUN=true`;
- ticker suportado: `MCCI11` ou `RBRY11`;
- pelo menos nove competências consecutivas aprovadas;
- confirmação explícita do administrador;
- nenhuma execução do mesmo fundo em andamento na tela.

## Ação manual

A interface envia ao endpoint administrativo:

```json
{
  "action": "execute",
  "ticker": "MCCI11",
  "confirmed": true
}
```

Nenhum `POST` é realizado no carregamento da página.

## Informações exibidas

Para cada fundo, o painel mostra:

- quantidade de competências aprovadas;
- maior sequência contínua e mínimo necessário;
- primeira e última competência;
- meses ausentes;
- última execução persistida;
- versão do ruleset;
- hash do snapshot;
- responsável e data;
- resultado técnico do motor.

## Limitação prudencial

Todos os resultados exibidos permanecem preliminares enquanto os eventos materiais de crédito não forem revisados. A tela não apresenta o resultado como classificação final.

## Efeitos proibidos

O painel não pode:

- criar alertas;
- enviar notificações;
- alterar o Relatório Premium;
- acessar o Firestore diretamente;
- importar avisos FNET;
- executar o detector automaticamente;
- liberar o backtest da coorte.

## Ativação

A funcionalidade permanece desligada por padrão. Para habilitá-la conscientemente no ambiente administrativo:

```text
ENABLE_RISK_LAB_STRESS_RUN=true
```

Mesmo com a flag ativa, o backend e a interface bloqueiam fundos sem nove competências consecutivas aprovadas.
