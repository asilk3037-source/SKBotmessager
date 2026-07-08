# SKBotmessager

Programa para disparo em massa de mensagens **SMS**, **WhatsApp** e **Email** a partir de uma planilha de
contatos — substitui o envio manual, um por um. Suba a planilha, escolha (ou crie) uma mensagem padrão,
dispare para todo mundo de uma vez e acompanhe tudo pelo relatório.

## O que o programa faz

- **Importar planilha**: sobe um `.xlsx` ou `.csv`, mostra uma prévia e deixa você indicar qual coluna é o
  nome, qual é o telefone e/ou qual é o email (precisa de pelo menos uma das duas).
- **Contatos**: lista tudo que já foi importado, com busca e organização por lote (cada planilha importada
  vira um lote).
- **Mensagens padrão**: modelos de mensagem reutilizáveis com variáveis, ex: `Olá {{nome}}, tudo bem?`.
  Qualquer coluna extra da planilha também vira variável (ex: `{{cidade}}`). Templates de email podem ter
  um assunto próprio (também aceita variáveis).
- **Disparo em massa**: escolhe o lote, os contatos, o canal (WhatsApp, SMS ou Email) e o template; mostra
  uma prévia de como a mensagem fica para os primeiros contatos antes de confirmar o envio.
- **Relatórios**: histórico completo de cada mensagem enviada (contato, destinatário, canal, status, erro se
  houver) com filtros e exportação em CSV.
- **Configurações**: conectar o WhatsApp (via QR code), configurar o provedor de SMS e a conta de email.

## Como funciona por baixo dos panos

- **Backend**: Node.js + Express, guardando os dados em um arquivo JSON local (`server/data/db.json`) — sem
  necessidade de instalar banco de dados.
- **Frontend**: React (Vite).
- **WhatsApp**: usa a biblioteca `whatsapp-web.js`, que conecta no seu WhatsApp normal via QR code (como o
  WhatsApp Web no navegador). **Não é a API oficial da Meta** — é gratuita, mas por não ser oficial, envios
  muito grandes ou muito rápidos aumentam o risco do número ser temporariamente bloqueado. Use com
  moderação e prefira um intervalo maior entre mensagens em disparos grandes.
- **SMS**: camada plugável, com três opções hoje:
  - **Twilio** (provedor real, pago, mas com crédito de teste gratuito ao criar conta);
  - **Celular Android** (grátis, usa o chip/plano do seu próprio celular via o app
    [SMS Gateway for Android](https://sms-gate.app/) — veja
    [docs/sms-via-celular-android.md](docs/sms-via-celular-android.md) para o passo a passo);
  - **Simulado** (não envia nada de verdade, só para testar o fluxo completo sem gastar nada).

  Se quiser usar outro provedor, dá para adicionar um novo arquivo em
  `server/src/services/sms-providers/` seguindo o mesmo formato do `twilioProvider.js`.
- **Email**: usa sua conta do Gmail via SMTP com "senha de app" (gratuito, limite de uso diário do Gmail).
  Gere a senha de app em `myaccount.google.com/apppasswords`.

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 18 ou mais recente instalado.

```bash
# instala as dependências do backend e do frontend
npm run install-all

# roda backend (porta 3001) e frontend (porta 5173) juntos, em modo desenvolvimento
npm run dev
```

Abra `http://localhost:5173` no navegador.

### Primeiro uso

1. Vá em **Importar planilha** e suba seu arquivo.
2. Vá em **Mensagens padrão** e crie ao menos um template.
3. Vá em **Configurações**:
   - Para WhatsApp: clique em "Conectar WhatsApp" e escaneie o QR code pelo celular (WhatsApp → Aparelhos
     conectados → Conectar um aparelho).
   - Para SMS: escolha "Simulado" para testar sem custo, configure suas credenciais da Twilio, ou conecte
     seu próprio celular Android (veja [docs/sms-via-celular-android.md](docs/sms-via-celular-android.md)).
   - Para Email: informe seu Gmail e uma senha de app (não é a senha normal da sua conta Google).
4. Vá em **Disparo em massa**, selecione os contatos, o canal e o template, confira a prévia e dispare.
5. Acompanhe tudo em **Relatórios**, com opção de exportar CSV.

### Rodando em produção (um único processo)

```bash
npm run build   # gera o build do frontend
npm start       # backend serve o frontend já buildado, tudo na porta 3001
```

## Rodando os testes

Backend e frontend têm suítes de teste separadas (Vitest), com testes unitários e de integração e relatório
de cobertura. Rodam automaticamente em todo push/PR via GitHub Actions (`.github/workflows/tests.yml`).

```bash
cd server && npm test            # testes unitários + integração das rotas (Supertest)
cd server && npm run test:coverage

cd web && npm test                # testes de componente (Testing Library)
cd web && npm run test:coverage
```

## Estrutura do projeto

```
server/   # API Node.js/Express + integrações WhatsApp/SMS + banco em JSON
web/      # Interface React (Vite)
```
