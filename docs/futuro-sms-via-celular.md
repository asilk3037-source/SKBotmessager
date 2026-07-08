# Ideia futura: enviar SMS pelo seu próprio celular/plano

Anotação para retomar quando fizer sentido construir um app de celular. Não implementado ainda.

## Por que Google Apps Script não resolve

O Apps Script roda nos servidores do Google, não no seu celular. Ele não tem acesso ao chip, ao modem
ou à linha telefônica do seu aparelho — então não existe uma forma de um script do Apps Script "disparar
SMS pelo seu plano". Ele consegue mandar e-mail (via Gmail) e interagir com Planilhas/Drive, só isso.

Existe um truque conhecido de **e-mail para SMS**: cada operadora tem um domínio de e-mail que, ao receber
uma mensagem, entrega como SMS pro número (ex.: nos EUA, `numero@vtext.com` é da Verizon). Dá pra automatizar
isso com Apps Script (`MailApp`) ou até com nosso backend atual (bastaria mandar um e-mail para esse
endereço). Mas isso **não usa o seu plano** — usa o gateway da operadora de quem recebe — e as operadoras
brasileiras (Vivo, Claro, TIM, Oi) não documentam publicamente esse tipo de gateway, então na prática
não funciona bem por aqui. Por isso não foi implementado.

## O jeito que realmente usa seu chip/plano: SMS Gateway no Android

Pra um SMS sair de verdade pela sua linha, alguma coisa precisa rodar **no próprio celular**, usando a
permissão de enviar SMS do Android. Existem apps prontos pra isso — o mais conhecido e open-source é o
**[SMS Gateway for Android](https://sms-gate.app/)** (repositório `capcom6/android-sms-gateway`):

- Instala um app no celular Android que vai ficar como "servidor" de SMS.
- Ele expõe uma API REST (rodando localmente na rede Wi-Fi, ou via um relay na nuvem deles, que também tem
  camada gratuita) para enviar/consultar status de mensagens.
- Quando nosso backend chama essa API, o SMS sai pelo chip físico daquele celular — ou seja, usa o seu
  plano de verdade.
- Precisa manter o celular ligado, com bateria e conectado à internet (Wi-Fi ou dados) para funcionar.
- Tem limite prático: o número de SMS que a operadora permite mandar por minuto/hora antes de considerar
  spam varia por operadora.

## Como isso se encaixaria no SKBotmessager

O serviço de SMS já foi construído de forma plugável (`server/src/services/sms-providers/`), seguindo o
mesmo formato do `twilioProvider.js` (um `send(phone, text, config)` que devolve o ID da mensagem). Quando
formos implementar:

1. Criar `androidGatewayProvider.js` nesse mesmo padrão, chamando a API REST do app instalado no celular
   (endpoint configurável + token de autenticação).
2. Adicionar esse provider na lista em `smsService.js` e no formulário de Configurações (mesma tela que já
   tem Twilio/Simulado).
3. Guardar endpoint/token nas configurações (`settings.sms`), igual já fazemos com as credenciais da
   Twilio.

Ou seja, a integração em si é pequena — o trabalho maior é decidir/instalar o app no celular dedicado a
isso e manter esse aparelho sempre online.
