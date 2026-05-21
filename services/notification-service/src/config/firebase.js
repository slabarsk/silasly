import admin from "firebase-admin";

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const options = { projectId };

  if (clientEmail && privateKey) {
    options.credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    });
  }

  admin.initializeApp(options);
}

export async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Token is required" });
  }

  try {
    req.user = await admin.auth().verifyIdToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function isAdmin(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
  return roles.includes("admin") || user?.admin === true;
}
