import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
        if (!res.ok) {
            return NextResponse.json({ error: "Erro ao consultar o dólar" }, { status: 500 });
        }

        const data = await res.json();

        // Retorna só o valor de venda (cotação atual)
        const cotacao = parseFloat(data.USDBRL.bid);

        return NextResponse.json({
            currency: "USD",
            brl: cotacao,
            formatted: `R$ ${cotacao.toFixed(2)}`
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
