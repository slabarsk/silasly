import admin from "firebase-admin";
import dotenv from "dotenv";

const [, , uid, role, envPath = "services/api-gateway/.env"] = process.argv;
const allowedRoles = new Set(["admin", "company", "user"]);

if (!uid || !role || !allowedRoles.has(role)) {
  console.error("Usage: node scripts/set-firebase-role.mjs <firebase-uid> <admin|company|user> [env-file]");
  process.exit(1);
}

dotenv.config({ path: envPath });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(`Firebase admin credentials are missing in ${envPath}`);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

const user = await admin.auth().getUser(uid);
const existingClaims = user.customClaims || {};
const nextClaims =
  role === "user"
    ? Object.fromEntries(Object.entries(existingClaims).filter(([key]) => !["role", "roles", "admin", "company"].includes(key)))
    : {
        ...existingClaims,
        role
      };

await admin.auth().setCustomUserClaims(uid, nextClaims);

console.log(`Updated ${uid} with custom claims: ${JSON.stringify(nextClaims)}`);
