"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import Cookies from "js-cookie";
import { app } from "@/lib/firebase"; // inicialização do firebase
import { X } from "lucide-react";

const auth = getAuth(app);
const db = getFirestore(app);

export default function LoginButton() {
    const [showModal, setShowModal] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isRegister, setIsRegister] = useState(false);
    const [message, setMessage] = useState("");

    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    // regex senha média
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    // regex email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // pega ou cria anonId
    useEffect(() => {
        if (!Cookies.get("anonId")) {
            Cookies.set("anonId", uuidv4(), { expires: 365 });
        }
    }, []);

    const handleAuth = async () => {
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

            const anonId = Cookies.get("anonId") || uuidv4();
            Cookies.set("anonId", anonId, { expires: 365 });

            await setDoc(
                doc(db, "User", anonId),
                {
                    email,
                    createdAt: new Date(),
                },
                { merge: true }
            );

            setMessage("✅ Login realizado com sucesso!");
            setShowModal(false);
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
                onClick={() => setShowModal(true)}
                className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-xl shadow-md hover:bg-blue-600"
            >
                Login
            </button>

            {showModal && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
                    <div className="bg-gray-900 rounded-xl p-6 w-80 shadow-lg text-white relative">
                        {/* Botão fechar */}
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-3 right-3 text-gray-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-lg font-semibold mb-4">
                            {isRegister ? "Criar conta" : "Entrar"}
                        </h2>

                        <input
                            ref={emailRef}
                            type="email"
                            placeholder="Email"
                            className="w-full border border-gray-700 p-2 mb-2 rounded bg-gray-800 text-white placeholder-gray-400"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <input
                            ref={passwordRef}
                            type="password"
                            placeholder="Senha"
                            className="w-full border border-gray-700 p-2 mb-2 rounded bg-gray-800 text-white placeholder-gray-400"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        {isRegister && (
                            <input
                                type="password"
                                placeholder="Confirmar senha"
                                className="w-full border border-gray-700 p-2 mb-2 rounded bg-gray-800 text-white placeholder-gray-400"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        )}

                        {message && <p className="text-sm text-red-500 mb-2">{message}</p>}

                        <button
                            onClick={handleAuth}
                            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                        >
                            {isRegister ? "Cadastrar" : "Entrar"}
                        </button>

                        <button
                            onClick={() => setIsRegister(!isRegister)}
                            className="w-full mt-2 text-sm text-gray-400 hover:text-white"
                        >
                            {isRegister ? "Já tem conta? Entrar" : "Não tem conta? Cadastrar"}
                        </button>

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
