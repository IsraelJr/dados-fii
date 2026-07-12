import admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(
            JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)
        ),
    });
}

const firestore = admin.firestore();
firestore.settings({ ignoreUndefinedProperties: true });

export const adminDb = firestore;
export const adminFieldValue = admin.firestore.FieldValue;
export default admin;
