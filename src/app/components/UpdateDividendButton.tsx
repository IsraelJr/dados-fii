'use client';

interface Props {
    ticker: string;
    onSuccess?: () => void | Promise<void>;
}

export default function UpdateDividendButton({ ticker }: Props) {
    return (
        <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            <p className="font-semibold">O rendimento do mês atual ainda não foi confirmado para {ticker}.</p>
            <p className="mt-2 text-xs text-yellow-50">
                A base será atualizada automaticamente quando um comunicado oficial válido estiver disponível.
            </p>
        </div>
    );
}
