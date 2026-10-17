// Pure validation of the Firebase web config supplied through VITE_FIREBASE_* env vars.
// Real values come from Firebase Console -> Project settings -> Your apps. Never guess them.

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export type FirebaseEnv = Record<string, string | undefined>;

const PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const BUCKET_RE = /^[a-z0-9][a-z0-9._-]*\.(appspot\.com|firebasestorage\.app)$/;
const DOMAIN_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;

export function buildFirebaseConfig(env: FirebaseEnv): { config: FirebaseWebConfig; problems: string[] } {
  const get = (k: string) => (env[`VITE_FIREBASE_${k}`] ?? '').trim();
  const config: FirebaseWebConfig = {
    apiKey: get('API_KEY'),
    authDomain: get('AUTH_DOMAIN'),
    projectId: get('PROJECT_ID'),
    storageBucket: get('STORAGE_BUCKET'),
    messagingSenderId: get('MESSAGING_SENDER_ID'),
    appId: get('APP_ID'),
    measurementId: get('MEASUREMENT_ID') || undefined,
  };
  const problems: string[] = [];
  if (!config.apiKey.startsWith('AIza')) problems.push('VITE_FIREBASE_API_KEY missing or invalid');
  if (!DOMAIN_RE.test(config.authDomain)) problems.push('VITE_FIREBASE_AUTH_DOMAIN missing or invalid');
  if (!PROJECT_ID_RE.test(config.projectId)) problems.push('VITE_FIREBASE_PROJECT_ID missing or invalid');
  if (!BUCKET_RE.test(config.storageBucket)) problems.push('VITE_FIREBASE_STORAGE_BUCKET missing or invalid');
  if (!/^\d+$/.test(config.messagingSenderId)) problems.push('VITE_FIREBASE_MESSAGING_SENDER_ID missing or invalid');
  if (!/^\d+:\d+:web:[0-9a-f]+$/.test(config.appId)) problems.push('VITE_FIREBASE_APP_ID missing or invalid');
  // All values must belong to ONE project, so a staging build can never be half-pointed at production.
  if (PROJECT_ID_RE.test(config.projectId)) {
    if (BUCKET_RE.test(config.storageBucket) && !config.storageBucket.startsWith(`${config.projectId}.`)) {
      problems.push('VITE_FIREBASE_STORAGE_BUCKET does not belong to VITE_FIREBASE_PROJECT_ID');
    }
    if (/\.(firebaseapp\.com|web\.app)$/.test(config.authDomain) && !config.authDomain.startsWith(`${config.projectId}.`)) {
      problems.push('VITE_FIREBASE_AUTH_DOMAIN does not belong to VITE_FIREBASE_PROJECT_ID');
    }
  }
  return { config, problems };
}
