# Enviando SMS pelo seu próprio celular/plano

## Por que não dá pelo Google Apps Script

O Apps Script roda nos servidores do Google, não no seu celular. Ele não tem acesso ao chip, ao modem
ou à linha telefônica do seu aparelho — então não existe uma forma de um script do Apps Script "disparar
SMS pelo seu plano". Ele consegue mandar e-mail (via Gmail) e interagir com Planilhas/Drive, só isso.

Existe um truque conhecido de **e-mail para SMS** (mandar e-mail pro gateway da operadora, ex.:
`numero@vtext.com` nos EUA), mas isso não usa o seu plano — usa o gateway da operadora de quem recebe — e
as operadoras brasileiras (Vivo, Claro, TIM, Oi) não documentam publicamente esse tipo de gateway. Por isso
não foi usado.

## O jeito que funciona: SMS Gateway for Android

Pra um SMS sair de verdade pela sua linha, alguma coisa precisa rodar **no próprio celular**, usando a
permissão de enviar SMS do Android. O SKBotmessager integra com o
**[SMS Gateway for Android](https://sms-gate.app/)** (open-source, gratuito) pra isso: você instala o app no
celular com o chip que quer usar, e ele expõe uma API que o SKBotmessager chama pra disparar — o SMS sai
pelo chip físico daquele aparelho.

### Como configurar

1. Instale o app **SMS Gateway for Android** no celular com o chip desejado.
2. Abra o app. Ele mostra na tela: uma **URL**, um **usuário** e uma **senha**.
3. No SKBotmessager, vá em **Configurações → SMS**, escolha o provedor **"Celular Android (SMS Gateway)"**
   e preencha esses três dados.
4. Mantenha o celular ligado, com o app aberto e conectado à internet enquanto os disparos acontecem.

Duas formas de conectar:
- **Rede local**: se o celular estiver na mesma rede Wi-Fi do computador que roda o SKBotmessager, use o
  endereço local mostrado no app (ex.: `http://192.168.0.10:8080`) — mais rápido, não depende de internet
  externa pra esse trecho.
- **Relay em nuvem do próprio app**: se o celular não estiver na mesma rede, o app oferece um endereço via
  `api.sms-gate.app` que funciona de qualquer lugar.

### Limitações

- O celular precisa ficar disponível (ligado, com o app aberto, conectado) durante todo o disparo.
- Operadoras têm limites práticos de quantos SMS aceitam por minuto/hora antes de considerar spam — evite
  intervalos muito curtos entre mensagens (ajustável em Configurações → Ritmo de envio).
- Implementação em `server/src/services/sms-providers/androidGatewayProvider.js`, seguindo o mesmo formato
  plugável do `twilioProvider.js`.
