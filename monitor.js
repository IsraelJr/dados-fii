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
        sendEmail(`[Dados FII] Alerta de ${message.includes("subiu") ? "Alta" : "Baixa"}`, message, email),
    ]);
}

// Monitorar FIIs de um usuário
// Monitorar FIIs de um usuário
async function monitorUser(cookie, monitoredList, email, isPremium) {
    if (!monitoredList || !Array.isArray(monitoredList)) return;

    // Free: só pega o primeiro
    const listToCheck = isPremium ? monitoredList : [monitoredList[0]];

    for (const item of listToCheck) {
        if (!item) continue;

        const { fiiCode, percentUp, percentDown } = item;
        if (!fiiCode) continue;

        // Busca Yahoo e Brapi em paralelo
        const [fiiYahoo, fiiBrapi] = await Promise.all([
            getPriceYahoo(fiiCode),
            getPriceBrapi(fiiCode),
        ]);

        if (!fiiYahoo && !fiiBrapi) continue; // nada retornou

        // Decide qual usar para validar alerta
        const candidates = [fiiYahoo, fiiBrapi].filter(Boolean);
        const variationYahoo = fiiYahoo?.variation ?? null;
        const variationBrapi = fiiBrapi?.variation ?? null;

        // Se for subida, pega a MAIOR variação; se for queda, pega a MENOR
        let finalData = null;
        if (candidates.length === 2) {
            if ((variationYahoo >= 0 && variationBrapi >= 0)) {
                finalData = variationYahoo > variationBrapi ? fiiYahoo : fiiBrapi;
            } else if ((variationYahoo <= 0 && variationBrapi <= 0)) {
                finalData = variationYahoo < variationBrapi ? fiiYahoo : fiiBrapi;
            } else {
                // Se sinais diferentes, pega o Yahoo como preferencial (mas dá pra trocar)
                finalData = fiiYahoo;
            }
        } else {
            finalData = candidates[0];
        }

        if (!finalData) continue;

        const { price, variation } = finalData;
        const variationNum = variation;

        console.log(
            `[Check] Usuário ${cookie} ${fiiCode}: ${price} (${variationNum.toFixed(2)}%)`
        );

        // Disparo do alerta
        if (variationNum <= percentDown || variationNum >= percentUp) {
            const msg =
                variationNum <= percentDown
                    ? `🚨 ${fiiCode} caiu ${variationNum.toFixed(2)}%!\nPreço atual: ${price}`
                    : `📈 ${fiiCode} subiu ${variationNum.toFixed(2)}%!\nPreço atual: ${price}`;

            await sendAlert(msg, email);
        }
    }
}


async function getFiiData(ticker) {
    try {
        const url = `${process.env.NEXT_PUBLIC_BASE_URL}/api/fii?ticker=${ticker}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro rota /api/fii: ${res.status}`);
        const data = await res.json();

        return {
            code: data.code,
            price: data.price,
            opening: data.opening,
            variation: data.variation,
        };
    } catch (err) {
        console.error(`[getFiiData] Falha para ${ticker}: ${err.message}`);
        return null;
    }
}

// --- Yahoo Finance ---
async function getPriceYahoo(ticker) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA?interval=1d&range=1d`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro Yahoo API: ${res.status}`);
        const data = await res.json();

        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) throw new Error(`Dados inválidos para ${ticker}`);

        const price = meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || meta.previousClose;
        const variation = ((price - previousClose) / previousClose) * 100;

        if (ticker.toUpperCase() === "TGAR11") {
            console.log(`[Yahoo] ${ticker} preço: ${price}, variação: ${variation.toFixed(2)}%`);
        }

        return { price, previousClose, variation };
    } catch (err) {
        console.error(`[getPriceYahoo] Falha para ${ticker}: ${err.message}`);
        return null;
    }
}

// --- BRAPI ---
async function getPriceBrapi(ticker) {
    try {
        const url = `https://brapi.dev/api/quote/${ticker}?token=dqH9rMGGeyq2t9QDaMc8ia`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro BRAPI: ${res.status}`);
        const data = await res.json();

        const result = data?.results?.[0];
        if (!result) throw new Error(`Dados inválidos para ${ticker}`);

        const price = result.regularMarketPrice;
        const previousClose = result.regularMarketPreviousClose;
        const variation = ((price - previousClose) / previousClose) * 100;

        if (ticker.toUpperCase() === "TGAR11") {
            console.log(`[Brapi] ${ticker} preço: ${price}, variação: ${variation.toFixed(2)}%`);
        }

        return { price, previousClose, variation };
    } catch (err) {
        console.error(`[getPriceBrapi] Falha para ${ticker}: ${err.message}`);
        return null;
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
            const data = userDoc.data();
            const monitoredList = data?.monitored;
            const email = data?.email;
            const isPremium = data?.isPremium || false;

            if (!cookie.includes("gmail.com")) {
                await monitorUser(cookie, monitoredList, email, isPremium);
            }
        }
    } catch (err) {
        console.error(`[monitor] Erro geral: ${err.message}`);
    }
}

// Executa imediatamente e depois a cada 1 minuto
monitor();
setInterval(monitor, 60 * 1000);
