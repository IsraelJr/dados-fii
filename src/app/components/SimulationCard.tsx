import { DollarSign, Sparkles } from "lucide-react";

interface ComparisonCardProps {
    lastDividend: number | null;
    price: number | null;
    basicSalary: number;
}

export function SimulationCard({ lastDividend, price, basicSalary }: ComparisonCardProps) {
    if (!lastDividend || !price) {
        return (
            <div className="bg-gray-800 p-4 rounded-xl text-center text-gray-400">
                Dados insuficientes para calcular a comparação.
            </div>
        );
    }

    // 1️⃣ Ações necessárias para atingir o salário mínimo
    const sharesForSalary = Math.ceil(basicSalary / lastDividend);
    const investmentForSalary = sharesForSalary * price;

    // 2️⃣ Magic Number
    const magicNumber = Math.ceil(price / lastDividend);
    const investmentMagic = magicNumber * price;

    return (
        <div className="grid gap-4 mt-6 md:grid-cols-2">
            {/* Card 1 - Salário mínimo */}
            <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                <DollarSign className="text-yellow-500" size={80}/>
                <span>
                    Para receber um salário mínimo
                    (<strong>R$ {basicSalary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>)
                    em dividendos, considerando o último pagamento, seriam necessárias
                    <strong> {sharesForSalary.toLocaleString("pt-BR")} </strong> cotas.
                    <br />
                    O investimento total seria de
                    <strong> R$ {investmentForSalary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>.
                </span>
            </div>

            {/* Card 2 - Magic Number */}
            <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-2">
                <Sparkles className="text-purple-400" size={70}/>
                <span>
                    Para que os dividendos de suas próprias cotas comprem
                    <strong> 1 nova cota</strong>, seriam necessárias
                    <strong> {magicNumber.toLocaleString("pt-BR")} </strong> cotas.
                    <br />
                    O investimento total seria de
                    <strong> R$ {investmentMagic.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>.
                </span>
            </div>

        </div>
    );
}
