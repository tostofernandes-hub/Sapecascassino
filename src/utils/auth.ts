import { UserAccount, GameId } from '../types/casino';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

const ACCOUNTS_STORAGE_KEY = 'sapecas_accounts_v2';
const CURRENT_USER_KEY = 'sapecas_current_user_v2';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function getStoredAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      const legacyRaw = localStorage.getItem('sapecas_accounts_v1');
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed)) {
          const filtered = legacyParsed.filter(
            (a: UserAccount) =>
              a.username !== 'ImperadorDasApostas' &&
              a.username !== 'DamaDeCopas' &&
              a.username !== 'MestreDosDados'
          );
          if (filtered.length > 0) {
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered));
            return filtered;
          }
        }
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a: UserAccount) =>
        a.username !== 'ImperadorDasApostas' &&
        a.username !== 'DamaDeCopas' &&
        a.username !== 'MestreDosDados'
    );
  } catch {
    return [];
  }
}

export function saveStoredAccounts(accounts: UserAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts to localStorage', e);
  }
}

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const username = JSON.parse(raw);
    const accounts = getStoredAccounts();
    return accounts.find((a) => a.username.toLowerCase() === String(username).toLowerCase()) || null;
  } catch {
    return null;
  }
}

export function setCurrentUser(username: string | null): void {
  try {
    if (username) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(username));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (e) {
    console.error('Failed to set current user in localStorage', e);
  }
}

function upsertLocalAccount(account: UserAccount): UserAccount {
  const accounts = getStoredAccounts();
  const idx = accounts.findIndex(
    (a) =>
      (account.uid && a.uid === account.uid) ||
      a.username.toLowerCase() === account.username.toLowerCase()
  );
  if (idx >= 0) {
    accounts[idx] = { ...accounts[idx], ...account };
  } else {
    accounts.push(account);
  }
  saveStoredAccounts(accounts);
  setCurrentUser(account.username);
  return idx >= 0 ? accounts[idx] : account;
}

function translateFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'O login com E-mail/Senha ainda não está ativado no Console do Firebase (Authentication > Sign-in method > E-mail/senha).';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está em uso. Tente entrar na aba Entrar.';
    case 'auth/invalid-email':
      return 'Informe um endereço de e-mail válido.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
    case 'auth/network-request-failed':
      return 'Sem conexão com o Firebase. Verifique sua internet.';
    default:
      return err instanceof Error ? err.message : 'Erro ao autenticar no Firebase.';
  }
}

const ALLOWED_USUARIO_KEYS = new Set([
  'uid',
  'nome',
  'avatar',
  'saldo',
  'maiorVitoria',
  'totalVitorias',
  'totalDerrotas',
  'criadoEm',
  'atualizadoEm'
]);

const userSyncQueue = new Map<string, Promise<unknown>>();

function runSerializedForUser<T>(uid: string, task: () => Promise<T>): Promise<T> {
  const prev = userSyncQueue.get(uid) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  userSyncQueue.set(uid, next);
  next.finally(() => {
    if (userSyncQueue.get(uid) === next) {
      userSyncQueue.delete(uid);
    }
  });
  return next;
}

function safeNonNegativeInt(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return Math.min(1000000000, Math.floor(val));
  }
  return fallback;
}

export async function syncUserToFirestore(account: UserAccount): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser) return;

  const uid = fbUser.uid;
  return runSerializedForUser(uid, async () => {
    const userPath = `usuarios/${uid}`;
    const userRef = doc(db, 'usuarios', uid);
    const rawName =
      account.nickname ||
      account.username ||
      fbUser.displayName ||
      fbUser.email?.split('@')[0] ||
      'Jogador';
    const nome = rawName.trim().slice(0, 32) || 'Jogador';
    const email = (fbUser.email || account.email || '').slice(0, 120);
    const avatar = (account.avatar || '🦁').slice(0, 16);
    const saldo = safeNonNegativeInt(account.balance, 10000);
    const maiorVitoria = safeNonNegativeInt(account.biggestWin, 0);
    const totalVitorias = safeNonNegativeInt(account.totalWins, 0);
    const totalDerrotas = safeNonNegativeInt(account.totalLosses, 0);

    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid,
          nome,
          avatar,
          saldo,
          maiorVitoria,
          totalVitorias,
          totalDerrotas,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });
      } else {
        const existingData = snap.data() || {};
        const hasExtraKeys = Object.keys(existingData).some((k) => !ALLOWED_USUARIO_KEYS.has(k));
        const hasValidCreated = existingData.criadoEm instanceof Timestamp;
        const hasValidUid = existingData.uid === uid;

        if (hasExtraKeys || !hasValidCreated || !hasValidUid) {
          await setDoc(userRef, {
            uid,
            nome,
            avatar,
            saldo,
            maiorVitoria,
            totalVitorias,
            totalDerrotas,
            criadoEm: hasValidCreated ? existingData.criadoEm : serverTimestamp(),
            atualizadoEm: serverTimestamp(),
          });
        } else {
          await updateDoc(userRef, {
            nome,
            avatar,
            saldo,
            maiorVitoria,
            totalVitorias,
            totalDerrotas,
            atualizadoEm: serverTimestamp(),
          });
        }
      }

      if (email) {
        const privateRef = doc(db, 'usuarios', uid, 'privado', 'info');
        await setDoc(privateRef, {
          email,
          atualizadoEm: serverTimestamp(),
        }).catch(() => {});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.WRITE, userPath);
      }
      console.warn('Erro ao sincronizar usuário no Firestore:', error);
    }
  });
}

export async function loadFirestoreUser(
  uid: string,
  fallbackEmail?: string | null,
  fallbackName?: string | null
): Promise<UserAccount> {
  return runSerializedForUser(uid, async () => {
    const userPath = `usuarios/${uid}`;
    const userRef = doc(db, 'usuarios', uid);
    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }

    const localExisting = getStoredAccounts().find(
      (a) => a.uid === uid || (fallbackName && a.username.toLowerCase() === fallbackName.toLowerCase())
    );

    if (snap.exists()) {
      const data = snap.data();
      // If legacy document still contains PII email or missing fields, strip & migrate cleanly
      if ('email' in data || !(data.criadoEm instanceof Timestamp) || data.uid !== uid) {
        await setDoc(userRef, {
          uid,
          nome: String(data.nome || fallbackName || fallbackEmail?.split('@')[0] || 'Jogador').slice(0, 32),
          avatar: String(data.avatar || localExisting?.avatar || '🦁').slice(0, 16),
          saldo: safeNonNegativeInt(data.saldo, localExisting?.balance ?? 10000),
          maiorVitoria: safeNonNegativeInt(data.maiorVitoria, localExisting?.biggestWin ?? 0),
          totalVitorias: safeNonNegativeInt(data.totalVitorias, localExisting?.totalWins ?? 0),
          totalDerrotas: safeNonNegativeInt(data.totalDerrotas, localExisting?.totalLosses ?? 0),
          criadoEm: data.criadoEm instanceof Timestamp ? data.criadoEm : serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        }).catch(() => {});
        const resolvedEmail = (fallbackEmail || (typeof data.email === 'string' ? data.email : '') || '').slice(0, 120);
        if (resolvedEmail) {
          await setDoc(doc(db, 'usuarios', uid, 'privado', 'info'), {
            email: resolvedEmail,
            atualizadoEm: serverTimestamp(),
          }).catch(() => {});
        }
      }

      const merged: UserAccount = {
        uid,
        email: fallbackEmail || (typeof data.email === 'string' ? data.email : '') || localExisting?.email || '',
        username: data.nome || fallbackName || localExisting?.username || 'Jogador',
        avatar: data.avatar || localExisting?.avatar || '🦁',
        balance: typeof data.saldo === 'number' ? data.saldo : localExisting?.balance ?? 10000,
        createdAt: localExisting?.createdAt || Date.now(),
        lastLogin: Date.now(),
        lastDailyBonus: localExisting?.lastDailyBonus || Date.now(),
        lastDailyWheel: localExisting?.lastDailyWheel ?? 0,
        totalWins: typeof data.totalVitorias === 'number' ? data.totalVitorias : localExisting?.totalWins || 0,
        totalLosses: typeof data.totalDerrotas === 'number' ? data.totalDerrotas : localExisting?.totalLosses || 0,
        biggestWin: typeof data.maiorVitoria === 'number' ? data.maiorVitoria : localExisting?.biggestWin || 0,
        history: localExisting?.history || [],
      };
      return upsertLocalAccount(merged);
    }

    const cleanName = (fallbackName || fallbackEmail?.split('@')[0] || 'Jogador').trim().slice(0, 20) || 'Jogador';
    const newAccount: UserAccount = {
      uid,
      email: fallbackEmail || '',
      username: cleanName,
      avatar: '🦁',
      balance: localExisting?.balance ?? 10000,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      lastDailyBonus: Date.now(),
      lastDailyWheel: 0,
      totalWins: localExisting?.totalWins || 0,
      totalLosses: localExisting?.totalLosses || 0,
      biggestWin: localExisting?.biggestWin || 0,
      history: localExisting?.history || [
        {
          id: `reg-${Date.now()}`,
          timestamp: Date.now(),
          type: 'REGISTRATION',
          gameName: 'Bônus de Boas-Vindas',
          amount: 10000,
          balanceAfter: 10000,
          details: 'Criação de conta com 10.000 fichas iniciais',
        },
      ],
    };

    const saved = upsertLocalAccount(newAccount);
    await setDoc(userRef, {
      uid,
      nome: saved.username.slice(0, 32),
      avatar: (saved.avatar || '🦁').slice(0, 16),
      saldo: safeNonNegativeInt(saved.balance, 10000),
      maiorVitoria: safeNonNegativeInt(saved.biggestWin, 0),
      totalVitorias: safeNonNegativeInt(saved.totalWins, 0),
      totalDerrotas: safeNonNegativeInt(saved.totalLosses, 0),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    }).catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
        handleFirestoreError(error, OperationType.CREATE, userPath);
      }
      console.warn('Erro ao criar usuário no Firestore:', error);
    });
    if (saved.email) {
      await setDoc(doc(db, 'usuarios', uid, 'privado', 'info'), {
        email: saved.email.slice(0, 120),
        atualizadoEm: serverTimestamp(),
      }).catch(() => {});
    }
    return saved;
  });
}

export async function registerWithFirebaseEmail(
  username: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; account?: UserAccount }> {
  const cleanName = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'O nome de usuário deve ter pelo menos 2 caracteres.' };
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Informe um e-mail válido.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});

    const newAccount: UserAccount = {
      uid: cred.user.uid,
      email: cleanEmail,
      username: cleanName,
      avatar: '🦁',
      balance: 10000,
      createdAt: Date.now(),
      lastLogin: Date.now(),
      lastDailyBonus: Date.now(),
      lastDailyWheel: 0,
      totalWins: 0,
      totalLosses: 0,
      biggestWin: 0,
      history: [
        {
          id: `reg-${Date.now()}`,
          timestamp: Date.now(),
          type: 'REGISTRATION',
          gameName: 'Bônus de Boas-Vindas',
          amount: 10000,
          balanceAfter: 10000,
          details: 'Criação de conta Firebase com 10.000 fichas iniciais',
        },
      ],
    };

    const saved = upsertLocalAccount(newAccount);
    await syncUserToFirestore(saved);
    return { success: true, account: saved };
  } catch (err) {
    return { success: false, error: translateFirebaseAuthError(err) };
  }
}

export async function loginWithFirebaseEmail(
  emailOrUsername: string,
  password: string
): Promise<{ success: boolean; error?: string; account?: UserAccount }> {
  const cleanInput = emailOrUsername.trim();
  if (!cleanInput) {
    return { success: false, error: 'Informe seu e-mail.' };
  }
  if (!password) {
    return { success: false, error: 'Informe sua senha.' };
  }

  // Fallback for legacy local-only usernames without @
  if (!cleanInput.includes('@')) {
    const localResult = loginUser(cleanInput, password);
    if (localResult.success && localResult.account) {
      return localResult;
    }
    return { success: false, error: 'Informe um e-mail válido (ou nome de usuário local existente).' };
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, cleanInput.toLowerCase(), password);
    const account = await loadFirestoreUser(
      cred.user.uid,
      cred.user.email,
      cred.user.displayName
    );
    return { success: true, account };
  } catch (err) {
    return { success: false, error: translateFirebaseAuthError(err) };
  }
}

export function registerUser(username: string, password = ''): { success: boolean; error?: string; account?: UserAccount } {
  const cleanName = username.trim();
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'O nome de usuário deve ter pelo menos 2 caracteres.' };
  }
  if (cleanName.length > 20) {
    return { success: false, error: 'O nome de usuário não pode ultrapassar 20 caracteres.' };
  }

  const accounts = getStoredAccounts();
  const existing = accounts.find((a) => a.username.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return { success: false, error: 'Este nome de usuário já está em uso.' };
  }

  const newAccount: UserAccount = {
    username: cleanName,
    password: password || '123456',
    balance: 10000,
    createdAt: Date.now(),
    lastLogin: Date.now(),
    lastDailyBonus: Date.now(),
    lastDailyWheel: 0,
    totalWins: 0,
    totalLosses: 0,
    biggestWin: 0,
    history: [
      {
        id: `reg-${Date.now()}`,
        timestamp: Date.now(),
        type: 'REGISTRATION',
        gameName: 'Bônus de Boas-Vindas',
        amount: 10000,
        balanceAfter: 10000,
        details: 'Criação de conta com 10.000 fichas iniciais'
      }
    ]
  };

  accounts.push(newAccount);
  saveStoredAccounts(accounts);
  setCurrentUser(newAccount.username);
  return { success: true, account: newAccount };
}

export function loginUser(username: string, password = ''): { success: boolean; error?: string; account?: UserAccount } {
  const cleanName = username.trim();
  if (!cleanName) {
    return { success: false, error: 'Informe seu nome de usuário.' };
  }

  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.username.toLowerCase() === cleanName.toLowerCase());
  if (!account) {
    return { success: false, error: 'Usuário não encontrado. Crie uma conta para começar.' };
  }

  if (account.password && password && account.password !== password) {
    return { success: false, error: 'Senha incorreta.' };
  }

  account.lastLogin = Date.now();
  saveStoredAccounts(accounts);
  setCurrentUser(account.username);
  return { success: true, account };
}

export function logoutUser(): void {
  setCurrentUser(null);
  signOut(auth).catch(() => {});
}

export function canClaimDailyBonus(account: UserAccount): boolean {
  if (!account.lastDailyBonus) return true;
  return Date.now() - account.lastDailyBonus >= TWENTY_FOUR_HOURS_MS;
}

export function getDailyBonusRemainingMs(account: UserAccount): number {
  if (!account.lastDailyBonus) return 0;
  const elapsed = Date.now() - account.lastDailyBonus;
  return Math.max(0, TWENTY_FOUR_HOURS_MS - elapsed);
}

export function claimDailyBonus(username: string): { success: boolean; error?: string; newBalance?: number } {
  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase());
  if (!account) return { success: false, error: 'Usuário não encontrado.' };

  if (!canClaimDailyBonus(account)) {
    return { success: false, error: 'Bônus diário ainda em contagem regressiva.' };
  }

  account.balance += 10000;
  account.lastDailyBonus = Date.now();
  account.history.unshift({
    id: `bonus-${Date.now()}`,
    timestamp: Date.now(),
    type: 'DAILY_BONUS',
    gameName: 'Bônus Diário 24h',
    amount: 10000,
    balanceAfter: account.balance,
    details: 'Resgate de 10.000 fichas diárias'
  });

  saveStoredAccounts(accounts);
  void syncUserToFirestore(account);
  return { success: true, newBalance: account.balance };
}

export function canSpinDailyWheel(account: UserAccount): boolean {
  if (!account.lastDailyWheel) return true;
  return Date.now() - account.lastDailyWheel >= TWENTY_FOUR_HOURS_MS;
}

export function getDailyWheelRemainingMs(account: UserAccount): number {
  if (!account.lastDailyWheel) return 0;
  const elapsed = Date.now() - account.lastDailyWheel;
  return Math.max(0, TWENTY_FOUR_HOURS_MS - elapsed);
}

export function recordDailyWheelSpin(
  username: string,
  prizeAmount: number,
  prizeLabel: string
): { success: boolean; newBalance?: number } {
  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase());
  if (!account) return { success: false };

  account.balance += prizeAmount;
  account.lastDailyWheel = Date.now();
  account.history.unshift({
    id: `wheel-${Date.now()}`,
    timestamp: Date.now(),
    type: 'DAILY_WHEEL',
    gameName: 'Roleta Diária da Sorte',
    amount: prizeAmount,
    balanceAfter: account.balance,
    details: `Prêmio sorteado: ${prizeLabel} (+${prizeAmount.toLocaleString('pt-BR')} fichas)`
  });

  if (prizeAmount > account.biggestWin) {
    account.biggestWin = prizeAmount;
  }

  saveStoredAccounts(accounts);
  void syncUserToFirestore(account);
  return { success: true, newBalance: account.balance };
}

export function logGameAction(
  username: string,
  delta: number,
  isWin: boolean,
  gameId: GameId,
  gameName: string,
  details?: string
): { newBalance: number } {
  const accounts = getStoredAccounts();
  const account = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase());

  if (!account) return { newBalance: 0 };

  account.balance += delta;
  if (account.balance < 0) account.balance = 0;

  if (isWin && delta > 0) {
    account.totalWins += 1;
    if (delta > account.biggestWin) {
      account.biggestWin = delta;
    }
  } else if (!isWin && delta < 0) {
    account.totalLosses += 1;
  }

  account.history.unshift({
    id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    timestamp: Date.now(),
    type: isWin ? 'WIN' : 'LOSS',
    gameId,
    gameName,
    amount: delta,
    balanceAfter: account.balance,
    details
  });

  if (account.history.length > 100) {
    account.history = account.history.slice(0, 100);
  }

  saveStoredAccounts(accounts);
  void syncUserToFirestore(account);
  return { newBalance: account.balance };
}

export interface CommunityBetItem {
  id: string;
  username: string;
  gameName: string;
  amount: number;
  isWin: boolean;
  timestamp: number;
  details?: string;
}

export function getRealCommunityFeed(): CommunityBetItem[] {
  const accounts = getStoredAccounts();
  const feed: CommunityBetItem[] = [];

  accounts.forEach((acc) => {
    (acc.history || []).forEach((h) => {
      feed.push({
        id: h.id,
        username: acc.username,
        gameName: h.gameName,
        amount: Math.abs(h.amount),
        isWin: h.type === 'WIN' || h.type === 'DAILY_BONUS' || h.type === 'DAILY_WHEEL',
        timestamp: h.timestamp,
        details: h.details
      });
    });
  });

  feed.sort((a, b) => b.timestamp - a.timestamp);
  return feed.slice(0, 30);
}

export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return 'Disponível Agora!';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function updateUserProfile(
  username: string,
  updates: { avatar?: string; nickname?: string }
): { success: boolean; account?: UserAccount } {
  const accounts = getStoredAccounts();
  const acc = accounts.find((a) => a.username.toLowerCase() === username.toLowerCase());
  if (!acc) return { success: false };

  if (updates.avatar !== undefined) acc.avatar = updates.avatar;
  if (updates.nickname !== undefined) acc.nickname = updates.nickname.trim();

  saveStoredAccounts(accounts);
  void syncUserToFirestore(acc);

  window.dispatchEvent(new CustomEvent('sapecas_profile_updated', { detail: acc }));
  return { success: true, account: acc };
}
