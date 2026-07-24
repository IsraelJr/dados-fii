import admin from "firebase-admin";
import { resolveFirebaseAdminBootstrapConfig } from "@/lib/firebaseAdminConfig";

if (!admin.apps.length) {
    const bootstrap = resolveFirebaseAdminBootstrapConfig();

    if (bootstrap.mode === "service-account") {
        admin.initializeApp({
            credential: admin.credential.cert(
                bootstrap.serviceAccount as admin.ServiceAccount
            ),
        });
    } else {
        // Inicialização exclusiva para compilação automatizada. Não possui credenciais
        // e não autoriza operações reais no Firestore.
        admin.initializeApp({ projectId: bootstrap.projectId });
    }
}

export const adminDb = admin.firestore();
export const adminFieldValue = admin.firestore.FieldValue;
export default admin;
