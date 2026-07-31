"use client";

import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    type User,
} from "firebase/auth";
import { usePathname } from "next/navigation";
import { app } from "@/lib/firebase";
import {
    clearWalletSession,
    ensureWalletSession,
    installWalletUnauthorizedObserver,
    markWalletLogout,
    WALLET_EMAIL_KEY,
    WALLET_SESSION_EXPIRES_AT_KEY,
    WALLET_SESSION_INVALID_EVENT,
    WALLET_SESSION_KEY,
    WALLET_SESSION_LOGOUT_KEY,
    WALLET_SESSION_UPDATED_EVENT,
} from "@/lib/users/WalletSessionClient";
import { X } from "lucide-react";

const auth = getAuth(app);

export default function LoginButton() {
    const pathname = usePathname();
    const [showModal, setShowModal] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isRegister, setIsRegister] = useState(false);
    const [message, setMessage] = useState("");

    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const userRef = useRef<User | null>(null);

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    useEffect(() => {
        if (showModal) emailRef.current?.focus();
    }, [showModal]);

    useEffect(() => {
        let active = true;

        const recover = async (nextUser: User, rejectedToken = "") => {
            try {
                await ensureWalletSession(nextUser, {
                    force: Boolean(rejectedToken),
                    rejectedToken,
                });
            } catch {
                clearWalletSession();
                await signOut(auth).catch(() => undefined);
                if (!active) return;
                userRef.current = null;
                setUser(null);
                setMessage("Sua sessão expirou. Entre novamente para continuar.");
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
            userRef.current = nextUser;
            setUser(nextUser);
            if (nextUser) void recover(nextUser);
        });

        const onInvalidSession = (event: Event) => {
            const rejectedToken = (event as CustomEvent<{ rejectedToken?: string }>).detail?.rejectedToken || "";
            if (userRef.current) void recover(userRef.current, rejectedToken);
        };
        const removeFetchObserver = installWalletUnauthorizedObserver((rejectedToken) => {
            window.dispatchEvent(new CustomEvent(WALLET_SESSION_INVALID_EVENT, {
                detail: { rejectedToken },
            }));
        });
        const onStorage = (event: StorageEvent) => {
            if (![WALLET_EMAIL_KEY, WALLET_SESSION_KEY, WALLET_SESSION_EXPIRES_AT_KEY, WALLET_SESSION_LOGOUT_KEY].includes(event.key || "")) return;
            if (event.key === WALLET_SESSION_LOGOUT_KEY) {
                clearWalletSession();
                window.dispatchEvent(new Event(WALLET_SESSION_UPDATED_EVENT));
                window.dispatchEvent(new Event("wallet-session-updated"));
                return;
            }
            window.dispatchEvent(new Event(WALLET_SESSION_UPDATED_EVENT));
            window.dispatchEvent(new Event("wallet-session-updated"));
            if (userRef.current) void recover(userRef.current);
        };

        window.addEventListener(WALLET_SESSION_INVALID_EVENT, onInvalidSession);
        window.addEventListener("storage", onStorage);
        return () => {
            active = false;
            unsubscribe();
            removeFetchObserver();
            window.removeEventListener(WALLET_SESSION_INVALID_EVENT, onInvalidSession);
            window.removeEventListener("storage", onStorage);
        };
    }, []);

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

            await ensureWalletSession(userCred.user, { force: true });

            setMessage("✅ Login realizado com sucesso!");
            closeModal();
        } catch (err: any) {
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

    const handleLogout = async () => {
        const walletEmail = window.localStorage.getItem(WALLET_EMAIL_KEY) || "";
        const walletToken = window.localStorage.getItem(WALLET_SESSION_KEY) || "";
        markWalletLogout();
        window.dispatchEvent(new Event(WALLET_SESSION_UPDATED_EVENT));
        window.dispatchEvent(new Event("wallet-session-updated"));
        if (walletEmail && walletToken) {
            await fetch("/api/wallet/session/firebase", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: walletEmail, token: walletToken }),
            }).catch(() => undefined);
        }
        await signOut(auth).catch(() => undefined);
        setUser(null);
        setMessage("");
    };

    if (pathname === "/") return null;

    return (
        <div className="relative">
            {user ? (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={handleLogout}
                    aria-label="Sair da conta"
                    className="absolute top-4 right-4 bg-blue-700 text-white px-4 py-2 rounded-xl shadow-md hover:bg-blue-800"
                >
                    Sair
                </button>
            ) : (
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={() => setShowModal(true)}
                    aria-haspopup="dialog"
                    aria-expanded={showModal}
                    aria-controls="login-dialog"
                    className="absolute top-4 right-4 bg-blue-700 text-white px-4 py-2 rounded-xl shadow-md hover:bg-blue-800"
                >
                    Login
                </button>
            )}

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
                                className="w-full bg-blue-700 text-white py-2 rounded-lg hover:bg-blue-800"
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
