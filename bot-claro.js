const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const ZAPI_INSTANCE = "3F2186F399AB81710E049A29748A502A";
const ZAPI_TOKEN = "27A3C449CCF8185EF3454031";
const ZAPI_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}`;

const ATENDENTES = [
  { nome: "Luiz", whatsapp: "5569993254787" },
];
let proximoAtendente = 0;

const sessoes = {};

const MENSAGENS = {
  boas_vindas: `Olá! 👋 Bem-vindo(a) à *Claro*! 😊

Sou o assistente virtual da Claro e estou aqui para te ajudar a encontrar o plano perfeito.

O que você está procurando?

1️⃣ Internet Fibra
2️⃣ TV por Assinatura  
3️⃣ Telefonia (Fixo/Móvel)
4️⃣ Combos Claro (Internet + TV + Fone)

Digite o número da opção desejada 👆`,

  produtos: {
    "1": `📡 *Internet Fibra Claro*\n\n✅ 200 Mbps — R$ 89,99/mês\n✅ 400 Mbps — R$ 109,99/mês\n✅ 600 Mbps — R$ 129,99/mês\n✅ 1 Giga — R$ 159,99/mês\n\nTodos os planos com Wi-Fi incluso! 🚀\n\nTem interesse em contratar? (sim/não)`,
    "2": `📺 *TV por Assinatura Claro*\n\n✅ Claro TV+ Essential — R$ 79,99/mês\n✅ Claro TV+ Top — R$ 109,99/mês\n✅ Claro TV+ Max — R$ 149,99/mês\n\nCanais premium, filmes e séries! 🎬\n\nTem interesse em contratar? (sim/não)`,
    "3": `📞 *Telefonia Claro*\n\n✅ Plano Controle 15GB — R$ 54,99/mês\n✅ Plano Controle 25GB — R$ 74,99/mês\n✅ Plano Pós 40GB — R$ 99,99/mês\n\nLigações ilimitadas para todo o Brasil! 📲\n\nTem interesse em contratar? (sim/não)`,
    "4": `📦 *Combos Claro*\n\n✅ Internet 200Mb + TV Essential — R$ 149,99/mês\n✅ Internet 400Mb + TV Top — R$ 189,99/mês\n✅ Internet 1Gb + TV Max + Fone — R$ 249,99/mês\n\nEconomize combinando os serviços! 💰\n\nTem interesse em contratar? (sim/não)`,
  },

  pedir_dados: `Ótimo! Fico feliz com seu interesse! 😊\n\nPara um de nossos consultores entrar em contato, me diga:\n\n👤 Qual é o seu *nome completo*?\n📍 E o seu *CEP*?\n\nExemplo: _João Silva 78700-000_`,

  encaminhar: (nomeCliente, atendente) =>
    `Perfeito, *${nomeCliente}*! ✅\n\nVou te conectar com nosso consultor *${atendente.nome}* agora mesmo!\n\nEle vai te ajudar a finalizar a contratação com as melhores condições. 🎉\n\nObrigado por escolher a Claro! ❤️`,

  nao_interesse: `Tudo bem! 😊 Fico à disposição sempre que precisar.\n\nSe mudar de ideia, pode mandar mensagem aqui a qualquer momento!\n\nTenha um ótimo dia! ☀️`,

  nao_entendi: `Desculpe, não entendi sua mensagem. 😅\n\nPor favor, escolha uma das opções:\n\n1️⃣ Internet Fibra\n2️⃣ TV por Assinatura\n3️⃣ Telefonia\n4️⃣ Combos Claro`,
};

async function enviarMensagem(telefone, texto) {
  try {
    await axios.post(`${ZAPI_URL}/send-text`, {
      phone: telefone,
      message: texto,
    });
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err.message);
  }
}

async function notificarAtendente(cliente) {
  const atendente = ATENDENTES[proximoAtendente % ATENDENTES.length];
  proximoAtendente++;

  const msg =
    `🔔 *Novo lead Claro!*\n\n` +
    `👤 Nome: ${cliente.nome}\n` +
    `📍 CEP: ${cliente.cep}\n` +
    `📱 WhatsApp: ${cliente.telefone}\n` +
    `🛒 Interesse: ${cliente.produto}\n\n` +
    `Entre em contato agora! 💪`;

  await enviarMensagem(atendente.whatsapp, msg);
  return atendente;
}

async function processarMensagem(telefone, texto) {
  const msg = texto.trim().toLowerCase();

  if (!sessoes[telefone]) {
    sessoes[telefone] = { etapa: "inicio" };
  }

  const sessao = sessoes[telefone];

  if (sessao.etapa === "inicio") {
    sessao.etapa = "menu";
    await enviarMensagem(telefone, MENSAGENS.boas_vindas);
    return;
  }

  if (sessao.etapa === "menu") {
    if (["1", "2", "3", "4"].includes(msg)) {
      const nomeProdutos = {
        "1": "Internet Fibra",
        "2": "TV por Assinatura",
        "3": "Telefonia",
        "4": "Combos Claro",
      };
      sessao.produto = nomeProdutos[msg];
      sessao.etapa = "interesse";
      await enviarMensagem(telefone, MENSAGENS.produtos[msg]);
    } else {
      await enviarMensagem(telefone, MENSAGENS.nao_entendi);
    }
    return;
  }

  if (sessao.etapa === "interesse") {
    if (msg.includes("sim") || msg === "s") {
      sessao.etapa = "coletar_dados";
      await enviarMensagem(telefone, MENSAGENS.pedir_dados);
    } else if (msg.includes("nao") || msg.includes("não") || msg === "n") {
      delete sessoes[telefone];
      await enviarMensagem(telefone, MENSAGENS.nao_interesse);
    } else {
      await enviarMensagem(telefone, `Por favor, responda *sim* ou *não* 😊`);
    }
    return;
  }

  if (sessao.etapa === "coletar_dados") {
    const cepMatch = msg.match(/\d{5}-?\d{3}/);
    const nome = texto.replace(/\d{5}-?\d{3}/, "").replace(/[^\w\s]/g, "").trim();

    if (!cepMatch || nome.length < 3) {
      await enviarMensagem(
        telefone,
        `Por favor, envie seu *nome* e *CEP* juntos.\nExemplo: _João Silva 78700-000_ 😊`
      );
      return;
    }

    sessao.nome = nome;
    sessao.cep = cepMatch[0];
    sessao.telefone = telefone;

    const atendente = await notificarAtendente(sessao);
    await enviarMensagem(telefone, MENSAGENS.encaminhar(sessao.nome, atendente));
    delete sessoes[telefone];
    return;
  }
}

app.post("/webhook", async (req, res) => {
  const { phone, text } = req.body;
  if (!phone || !text?.message) return res.sendStatus(200);
  if (req.body.fromMe) return res.sendStatus(200);
  await processarMensagem(phone, text.message);
  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log("🤖 Bot Claro rodando na porta 3000!");
});