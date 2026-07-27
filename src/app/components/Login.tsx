"use client";

import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase"; // inicialização do firebase
import { X } from "lucide-react";

const auth = getAuth(app);

export default function LoginButton() {
    const [showModal, setShowModal] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isRegister, setIsRegister] = useState(false);
    const [message, setMessage] = useState("");

    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);

    // regex senha média
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    // regex email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    useEffect(() => {
        if (showModal) emailRef.current?.focus();
    }, [showModal]);

    const closeModal = () => {
        setShowModal(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
    };

    const handleDialogKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeModal();
            return;
        }
        if (event.key !== "Tab") return;
        const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
                "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
            ) || [],
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email || !emailRegex.test(email)) {
            setMessage("Por favor, informe um email válido.");
            if (emailRef.current) {
                emailRef.current.classList.add("shake");
                setTimeout(() => emailRef.current?.classList.remove("shake"), 500);
            }
            return;
        }

        if (!password) {
            setMessage("Por favor, informe a senha.");
            if (passwordRef.current) {
                passwordRef.current.classList.add("shake");
                setTimeout(() => passwordRef.current?.classList.remove("shake"), 500);
            }
            return;
        }

        if (isRegister && password !== confirmPassword) {
            setMessage("As senhas não coincidem.");
            if (passwordRef.current) {
                passwordRef.current.classList.add("shake");
                setTimeout(() => passwordRef.current?.classList.remove("shake"), 500);
            }
            return;
        }

        if (!passwordRegex.test(password)) {
            setMessage("A senha deve ter ao menos 6 caracteres, incluindo letras e números.");
            if (passwordRef.current) {
                passwordRef.current.classList.add("shake");
                setTimeout(() => passwordRef.current?.classList.remove("shake"), 500);
            }
            return;
        }

        try {
            let userCred;
            if (isRegister) {
                userCred = await createUserWithEmailAndPassword(auth, email, password);
            } else {
                userCred = await signInWithEmailAndPassword(auth, email, password);
            }

            const idToken = await userCred.user.getIdToken();
            const profileResponse = await fetch("/api/user-profile", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            });
            if (!profileResponse.ok) throw new Error("Falha ao sincronizar o perfil autenticado.");

            setMessage("✅ Login realizado com sucesso!");
            closeModal();
        } catch (err: any) {
            console.error(err);

            let friendlyMessage = "❌ Falha ao autenticar. Tente novamente.";
            if (err.code === "auth/wrong-password") {
                friendlyMessage = "❌ Senha incorreta. Verifique e tente novamente.";
            } else if (err.code === "auth/user-not-found") {
                friendlyMessage = "❌ Usuário não encontrado. Cadastre-se primeiro.";
            } else if (err.code === "auth/too-many-requests") {
                friendlyMessage = "❌ Muitas tentativas. Aguarde alguns minutos e tente novamente.";
            } else if (err.code === "auth/email-already-in-use") {
                friendlyMessage = "❌ Email já cadastrado. Faça login.";
            }

            setMessage(friendlyMessage);

            if (passwordRef.current) {
                passwordRef.current.classList.add("shake");
                setTimeout(() => passwordRef.current?.classList.remove("shake"), 500);
            }
        }
    };

    return (
        <div className="relative">
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setShowModal(true)}
                aria-haspopup="dialog"
                aria-expanded={showModal}
                aria-controls="login-dialog"
                className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-xl shadow-md hover:bg-blue-600"
            >
                Login
            </button>

            {showModal && (
                <div
                    className="fixed inset-0 flex items-center justify-center bg-black/40 z-50"
                    onMouseDown={(event) => {
                        if (event.currentTarget === event.target) closeModal();
                    }}
                >
                    <div
                        ref={dialogRef}
                        id="login-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="login-dialog-title"
                        onKeyDown={handleDialogKeyboard}
                        className="bg-gray-900 rounded-xl p-6 w-80 shadow-lg text-white relative"
                    >
                        {/* Botão fechar */}
                        <button
                            type="button"
                            onClick={closeModal}
                            aria-label="Fechar login"
                            className="absolute top-3 right-3 text-gray-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h2 id="login-dialog-title" className="text-lg font-semibold mb-4">
                            {isRegister ? "Criar conta" : "Entrar"}
                        </h2>

                        <form onSubmit={handleAuth}>
                            <label htmlFor="login-email" className="mb-1 block text-sm font-semibold text-gray-200">E-mail</label>
                            <input
                                id="login-email"
                                ref={emailRef}
                                type="email"
                                autoComplete="email"
                                placeholder="seu@email.com"
                                className="w-full border border-gray-700 p-2 mb-2 rounded bg-gray-800 text-white placeholder-gray-400"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />

                            <label htmlFor="login-password" className="mb-1 block text-sm font-semibold text-gray-200">Senha</label>
                            <input
                                id="login-password"
                                ref={passwordRef}
                                type="password"
                                autoComplete={isRegister ? "new-password" : "current-password"}
                                placeholder="Senha"
                                className="w-full border border-gray-700 p-2 mb-2 rounded bg-gray-800 text-white placeholder-gray-400"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />

                            {isRegister && (
                                <>
                                    <label htmlFor="login-password-confirmation" className="mb-1 block text-sm font-semibold text-gray-200">Confirmar senha</label>
                                    <input
                                        id="login-password-confirmation"
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder="Confirmar senha"
                                        className="w-full border border-gray-700 p-2 mb-2 rounded bg-gray-800 text-white placeholder-gray-400"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </>
                            )}

                            {message && <p role="alert" className="text-sm text-red-400 mb-2">{message}</p>}

                            <button
                                type="submit"
                                className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                            >
                                {isRegister ? "Cadastrar" : "Entrar"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsRegister(!isRegister)}
                                className="w-full mt-2 text-sm text-gray-300 hover:text-white"
                            >
                                {isRegister ? "Já tem conta? Entrar" : "Não tem conta? Cadastrar"}
                            </button>
                        </form>

                        {/* CSS para vibração */}
                        <style jsx>{`
                            @keyframes shake {
                                0% { transform: translateX(0); }
                                20% { transform: translateX(-5px); }
                                40% { transform: translateX(5px); }
                                60% { transform: translateX(-5px); }
                                80% { transform: translateX(5px); }
                                100% { transform: translateX(0); }
                            }
                            .shake {
                                animation: shake 0.5s;
                            }
                        `}</style>
                    </div>
                </div>
            )}
        </div>
    );
}
