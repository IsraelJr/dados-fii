import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";
import admin from "firebase-admin";
import nodemailer from "nodemailer";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Inicializar Firebase Admin
if (!admin.apps.length) {
    const keyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!keyString) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY não está definido!");
    const serviceAccount = JSON.parse(keyString);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();
const referencePrices = {}; // referência por usuário+FII

// Função para pegar preço direto do Yahoo Finance
async function getPrice(ticker) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1m`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro Yahoo API: ${res.status}`);
        const data = await res.json();
        const lastPrice = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (!lastPrice) throw new Error(`Preço inválido retornado`);
        return lastPrice;
    } catch (err) {
        console.error(`[getPrice] Falha para ${ticker}: ${err.message}`);
        return null;
    }
}
// --- Telegram ---
async function sendTelegram(message) {
    try {
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
        });

        const data = await res.json();
        console.log("[Telegram] enviado:", data.ok);
    } catch (err) {
        console.error("[Telegram] erro:", err.message);
    }
}

// --- Email ---
async function sendEmail(subject, text, emailTo) {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number(process.env.EMAIL_PORT),
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const info = await transporter.sendMail({
            from: `${subject} <${process.env.EMAIL_USER}>`,
            to: emailTo,
            subject,
            text,
        });

        console.log("[Email] enviado:", info.messageId);
    } catch (err) {
        console.error("[Email] erro:", err.message);
    }
}

// --- Função unificada ---
async function sendAlert(message, email) {
    await Promise.all([
        // sendTelegram(message),
        sendEmail(`[Dados FII] Alerta de ${message.includes("subiu") ? "Alta": "Baixa"}`, message, email)
    ]);
}


// Monitorar FIIs de um usuário
async function monitorUser(cookie, monitored, email) {
    if (!monitored || !Array.isArray(monitored.listFiis)) return;

    const { listFiis, percentDown, percentUp } = monitored;

    for (const fii of listFiis) {
        const price = await getPrice(fii);
        if (!price) continue;

        const userKey = `${cookie}-${fii}`;
        if (!referencePrices[userKey]) {
            referencePrices[userKey] = price;
            console.log(`[Init] Usuário ${cookie} monitora ${fii} @ R$${price}`);
            continue;
        }

        const refPrice = referencePrices[userKey];
        const variation = (((price + 4) - refPrice) / refPrice) * 100;

        console.log(`[Check] Usuário ${cookie} ${fii}: R$${price} (${variation.toFixed(2)}%)`);
        if (variation <= percentDown || variation >= percentUp) {
            const msg =
                variation <= percentDown
                    ? `🚨 ${fii} caiu ${variation.toFixed(2)}%!\nPreço atual: R$${price}`
                    : `📈 ${fii} subiu ${variation.toFixed(2)}%!\nPreço atual: R$${price}`;

            await sendAlert(msg, email);

            referencePrices[userKey] = price; // atualiza referência
        }
    }
}

// Monitorar todos os usuários
async function monitor() {
    try {
        const usersSnap = await db
            .collection("User")
            .where("monitored", "!=", null)
            .get();

        for (const userDoc of usersSnap.docs) {
            const cookie = userDoc.id;
            const monitored = userDoc.data()?.monitored;
            const email = userDoc.data()?.email;

            if (!cookie.includes("gmail.com")) {
                // console.log(`[DEBUG] Usuário ${cookie} monitored:`, monitored, `E-mail: ${email}`);
                await monitorUser(cookie, monitored, email);
            }
        }
    } catch (err) {
        console.error(`[monitor] Erro geral: ${err.message}`);
    }
}

// Executa imediatamente e depois a cada 1 minuto
monitor();
setInterval(monitor, 60 * 1000);
