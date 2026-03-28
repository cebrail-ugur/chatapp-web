/**
 * ChatApp Ultra - X3DH Modülü (x3dh.ts)
 * ──────────────────────────────────────────────
 * GÜVENLİK SERTLEŞTİRME v2:
 * - localStorage KALDIRILDI → IndexedDB (secureStore.ts)
 * - Debug logları üretim ortamında devre dışı
 * - Anahtar substring logları KALDIRILDI
 * 
 * X3DH ANAHTAR AKIŞI:
 * 1. Bob → PreKey Bundle yayınlar: IK_B + SPK_B + Sig(IK_B, SPK_B) + OPK_B
 * 2. Alice → Bundle'dan 3-4 DH hesaplar
 * 3. SK = KDF(DH1 || DH2 || DH3 [|| DH4])
 * 4. SK ile Double Ratchet başlatılır
 * 
 * Standartlar: X25519 (RFC 7748), XEdDSA (Signal), HKDF (RFC 5869)
 * 
 * REPLAY PROTECTION:
 * - Ephemeral key nonce tracking ile aynı initial message'ın tekrar işlenmesi engellenir
 * - Kullanılmış ephemeral key'ler IndexedDB'de saklanır ve reddedilir
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

import {
  cryptoAPI,
  x25519SharedSecret,
  generateX25519EphemeralKeyPair,
  concatUint8Arrays,
  hkdfDerive,
  X3DH_SPK_PREFIX,
  X3DH_OPK_PREFIX,
  X3DH_BUNDLE_PREFIX,
  X3DH_SESSION_PREFIX,
} from './keyManager';

import {
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedData,
  deleteEncryptedDataByPrefix,
} from './secureStore';

import type { RatchetState } from './ratchet';

// ============================================================
// TİP TANIMLARI
// ============================================================

export interface SignedPreKey {
  id: string;
  publicKey: string;
  secretKey: string;
  signature: string;
  timestamp: number;
}

export interface OneTimePreKey {
  id: string;
  publicKey: string;
  secretKey: string;
  isUsed: boolean;
}

export interface PreKeyBundle {
  identityKey: string;
  signingVerifyKey: string;
  signedPreKey: {
    id: string;
    publicKey: string;
    signature: string;
  };
  oneTimePreKey?: {
    id: string;
    publicKey: string;
  };
}

export interface X3DHSession {
  sharedKey: string;
  associatedData: string;
  ephemeralPublicKey: string;
  usedOneTimePreKeyId?: string;
  established: boolean;
  timestamp: number;
}

// ============================================================
// PREKEY ID ÜRETİMİ
// ============================================================

function generatePreKeyId(): string {
  const bytes = cryptoAPI.getRandomValues(new Uint8Array(8));
  return encodeBase64(bytes);
}

// ============================================================
// SIGNED PREKEY (SPK) - Ed25519 İmza
// ============================================================

export function generateSignedPreKey(identitySecretKey: string): SignedPreKey {
  const keyPair = nacl.box.keyPair();
  const publicKeyBase64 = encodeBase64(keyPair.publicKey);
  const secretKeyBase64 = encodeBase64(keyPair.secretKey);

  const ikSecret = decodeBase64(identitySecretKey);
  const signingKeyPair = nacl.sign.keyPair.fromSeed(ikSecret);
  const signature = nacl.sign.detached(keyPair.publicKey, signingKeyPair.secretKey);

  return {
    id: generatePreKeyId(),
    publicKey: publicKeyBase64,
    secretKey: secretKeyBase64,
    signature: encodeBase64(signature),
    timestamp: Date.now()
  };
}

export function verifySignedPreKey(
  signingVerifyKey: string,
  spkPublicKey: string,
  signature: string
): boolean {
  try {
    const spkPub = decodeBase64(spkPublicKey);
    const sig = decodeBase64(signature);
    const verifyKey = decodeBase64(signingVerifyKey);
    return nacl.sign.detached.verify(spkPub, sig, verifyKey);
  } catch {
    return false;
  }
}

export function getSigningVerifyKey(identitySecretKey: string): string {
  const ikSecret = decodeBase64(identitySecretKey);
  const signingKeyPair = nacl.sign.keyPair.fromSeed(ikSecret);
  return encodeBase64(signingKeyPair.publicKey);
}

// ============================================================
// ONE-TIME PREKEY (OPK) HAVUZU
// ============================================================

export function generateOneTimePreKeys(count: number = 10): OneTimePreKey[] {
  const keys: OneTimePreKey[] = [];
  for (let i = 0; i < count; i++) {
    const keyPair = nacl.box.keyPair();
    keys.push({
      id: generatePreKeyId(),
      publicKey: encodeBase64(keyPair.publicKey),
      secretKey: encodeBase64(keyPair.secretKey),
      isUsed: false
    });
  }
  return keys;
}

// ============================================================
// PREKEY BUNDLE
// ============================================================

export function createPreKeyBundle(
  identityPublicKey: string,
  identitySecretKey: string,
  signedPreKey: SignedPreKey,
  oneTimePreKeys: OneTimePreKey[]
): PreKeyBundle {
  const availableOPK = oneTimePreKeys.find(k => !k.isUsed);
  const svk = getSigningVerifyKey(identitySecretKey);

  return {
    identityKey: identityPublicKey,
    signingVerifyKey: svk,
    signedPreKey: {
      id: signedPreKey.id,
      publicKey: signedPreKey.publicKey,
      signature: signedPreKey.signature
    },
    ...(availableOPK ? {
      oneTimePreKey: {
        id: availableOPK.id,
        publicKey: availableOPK.publicKey
      }
    } : {})
  };
}

// ============================================================
// X3DH HANDSHAKE - Alice (Başlatan) Tarafı
// ============================================================

export async function x3dhInitiatorHandshake(
  myIdentityKey: { publicKey: string; secretKey: string },
  theirBundle: PreKeyBundle
): Promise<{
  session: X3DHSession;
  initialMessage: {
    identityKey: string;
    ephemeralKey: string;
    usedOneTimePreKeyId?: string;
  };
}> {
  const ephemeralKeyPair = nacl.box.keyPair();
  const ekPublic = encodeBase64(ephemeralKeyPair.publicKey);
  const ekSecret = encodeBase64(ephemeralKeyPair.secretKey);

  const dh1 = x25519SharedSecret(myIdentityKey.secretKey, theirBundle.signedPreKey.publicKey);
  const dh2 = x25519SharedSecret(ekSecret, theirBundle.identityKey);
  const dh3 = x25519SharedSecret(ekSecret, theirBundle.signedPreKey.publicKey);

  let dh4: Uint8Array | null = null;
  if (theirBundle.oneTimePreKey) {
    dh4 = x25519SharedSecret(ekSecret, theirBundle.oneTimePreKey.publicKey);
  }

  const F = new Uint8Array(32).fill(0xFF);
  const dhConcat = dh4
    ? concatUint8Arrays([F, dh1, dh2, dh3, dh4])
    : concatUint8Arrays([F, dh1, dh2, dh3]);

  const sk = await hkdfDerive(
    dhConcat,
    new Uint8Array(32),
    'SentinelUltra_X3DH_v1',
    32
  );

  const ikA = decodeBase64(myIdentityKey.publicKey);
  const ikB = decodeBase64(theirBundle.identityKey);
  const ad = concatUint8Arrays([ikA, ikB]);

  // Ephemeral secret key'i bellekten sil
  ephemeralKeyPair.secretKey.fill(0);

  const session: X3DHSession = {
    sharedKey: encodeBase64(sk),
    associatedData: encodeBase64(ad),
    ephemeralPublicKey: ekPublic,
    usedOneTimePreKeyId: theirBundle.oneTimePreKey?.id,
    established: true,
    timestamp: Date.now()
  };

  return {
    session,
    initialMessage: {
      identityKey: myIdentityKey.publicKey,
      ephemeralKey: ekPublic,
      usedOneTimePreKeyId: theirBundle.oneTimePreKey?.id
    }
  };
}

// ============================================================
// X3DH HANDSHAKE - Bob (Alıcı) Tarafı
// ============================================================

export async function x3dhResponderHandshake(
  myIdentityKey: { publicKey: string; secretKey: string },
  mySignedPreKey: SignedPreKey,
  myOneTimePreKeys: OneTimePreKey[],
  theirInitialMessage: {
    identityKey: string;
    ephemeralKey: string;
    usedOneTimePreKeyId?: string;
  }
): Promise<X3DHSession | null> {
  try {
    // REPLAY PROTECTION: Aynı ephemeral key ile tekrar handshake engellenir
    const seenNoncesKey = 'sentinel_x3dh_seen_ek';
    const seenNonces: Record<string, number> = (await getEncryptedData(seenNoncesKey)) || {};
    
    if (seenNonces[theirInitialMessage.ephemeralKey]) {
      // Bu ephemeral key daha önce kullanılmış - REPLAY ATTACK
      return null;
    }
    
    // Ephemeral key'i kaydet
    seenNonces[theirInitialMessage.ephemeralKey] = Date.now();
    
    // Eski nonce'ları temizle (24 saatten eski)
    const oneDayAgo = Date.now() - 86400000;
    for (const [k, ts] of Object.entries(seenNonces)) {
      if (ts < oneDayAgo) delete seenNonces[k];
    }
    await storeEncryptedData(seenNoncesKey, seenNonces);
    
    const dh1 = x25519SharedSecret(mySignedPreKey.secretKey, theirInitialMessage.identityKey);
    const dh2 = x25519SharedSecret(myIdentityKey.secretKey, theirInitialMessage.ephemeralKey);
    const dh3 = x25519SharedSecret(mySignedPreKey.secretKey, theirInitialMessage.ephemeralKey);

    let dh4: Uint8Array | null = null;
    if (theirInitialMessage.usedOneTimePreKeyId) {
      const usedOPK = myOneTimePreKeys.find(k => k.id === theirInitialMessage.usedOneTimePreKeyId);
      if (usedOPK) {
        dh4 = x25519SharedSecret(usedOPK.secretKey, theirInitialMessage.ephemeralKey);
        usedOPK.isUsed = true;
      }
    }

    const F = new Uint8Array(32).fill(0xFF);
    const dhConcat = dh4
      ? concatUint8Arrays([F, dh1, dh2, dh3, dh4])
      : concatUint8Arrays([F, dh1, dh2, dh3]);

    const sk = await hkdfDerive(
      dhConcat,
      new Uint8Array(32),
      'SentinelUltra_X3DH_v1',
      32
    );

    const ikA = decodeBase64(theirInitialMessage.identityKey);
    const ikB = decodeBase64(myIdentityKey.publicKey);
    const ad = concatUint8Arrays([ikA, ikB]);

    // DH çıktılarını bellekten temizle (forward secrecy)
    dh1.fill(0);
    dh2.fill(0);
    dh3.fill(0);
    if (dh4) dh4.fill(0);
    dhConcat.fill(0);

    return {
      sharedKey: encodeBase64(sk),
      associatedData: encodeBase64(ad),
      ephemeralPublicKey: theirInitialMessage.ephemeralKey,
      usedOneTimePreKeyId: theirInitialMessage.usedOneTimePreKeyId,
      established: true,
      timestamp: Date.now()
    };
  } catch {
    return null;
  }
}

// ============================================================
// X3DH → DOUBLE RATCHET GEÇİŞİ
// ============================================================

export async function initRatchetFromX3DH(x3dhSession: X3DHSession): Promise<RatchetState> {
  const sk = decodeBase64(x3dhSession.sharedKey);

  const rootKey = await hkdfDerive(
    sk,
    new TextEncoder().encode('sentinel-x3dh-to-ratchet-v5'),
    'sentinel-x3dh-root-key',
    32
  );

  const sendChain = await hkdfDerive(
    rootKey,
    new TextEncoder().encode('sentinel-x3dh-send-chain'),
    'sentinel-x3dh-chain-send',
    32
  );

  const recvChain = await hkdfDerive(
    rootKey,
    new TextEncoder().encode('sentinel-x3dh-recv-chain'),
    'sentinel-x3dh-chain-recv',
    32
  );

  const dhKeyPair = generateX25519EphemeralKeyPair();

  return {
    rootKey: encodeBase64(rootKey),
    chainKeySend: encodeBase64(sendChain),
    chainKeyRecv: encodeBase64(recvChain),
    dhKeyPair: dhKeyPair,
    remoteDhPub: '',
    sendCount: 0,
    recvCount: 0,
    previousChainLength: 0,
    lastRotationTime: Date.now(),
    epochMessageCount: 0,
    rotationEpoch: 0,
  };
}

// ============================================================
// TAM X3DH ANAHTAR SETİ ÜRETİMİ
// ============================================================

export function generateFullX3DHKeySet(identityKey: { publicKey: string; secretKey: string }): {
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OneTimePreKey[];
  preKeyBundle: PreKeyBundle;
} {
  const spk = generateSignedPreKey(identityKey.secretKey);
  const opks = generateOneTimePreKeys(10);
  const bundle = createPreKeyBundle(identityKey.publicKey, identityKey.secretKey, spk, opks);

  return { signedPreKey: spk, oneTimePreKeys: opks, preKeyBundle: bundle };
}

// ============================================================
// X3DH ANAHTAR DEPOLAMA (IndexedDB - secureStore)
// ============================================================

export async function storeSignedPreKey(workspaceId: string, spk: SignedPreKey): Promise<void> {
  await storeEncryptedData(X3DH_SPK_PREFIX + workspaceId, spk);
}

export async function getSignedPreKey(workspaceId: string): Promise<SignedPreKey | null> {
  return getEncryptedData<SignedPreKey>(X3DH_SPK_PREFIX + workspaceId);
}

export async function storeOneTimePreKeys(workspaceId: string, opks: OneTimePreKey[]): Promise<void> {
  await storeEncryptedData(X3DH_OPK_PREFIX + workspaceId, opks);
}

export async function getOneTimePreKeys(workspaceId: string): Promise<OneTimePreKey[]> {
  const opks = await getEncryptedData<OneTimePreKey[]>(X3DH_OPK_PREFIX + workspaceId);
  return opks ?? [];
}

export async function consumeOneTimePreKey(workspaceId: string, opkId: string): Promise<void> {
  const opks = await getOneTimePreKeys(workspaceId);
  const updated = opks.filter(k => k.id !== opkId);
  await storeOneTimePreKeys(workspaceId, updated);
}

export async function storePreKeyBundle(workspaceId: string, bundle: PreKeyBundle): Promise<void> {
  await storeEncryptedData(X3DH_BUNDLE_PREFIX + workspaceId, bundle);
}

export async function getPreKeyBundle(workspaceId: string): Promise<PreKeyBundle | null> {
  return getEncryptedData<PreKeyBundle>(X3DH_BUNDLE_PREFIX + workspaceId);
}

export async function storeX3DHSession(workspaceId: string, peerId: string, session: X3DHSession): Promise<void> {
  await storeEncryptedData(X3DH_SESSION_PREFIX + workspaceId + '_' + peerId, session);
}

export async function getX3DHSession(workspaceId: string, peerId: string): Promise<X3DHSession | null> {
  return getEncryptedData<X3DHSession>(X3DH_SESSION_PREFIX + workspaceId + '_' + peerId);
}

export async function storeFullX3DHKeySet(
  workspaceId: string,
  spk: SignedPreKey,
  opks: OneTimePreKey[],
  bundle: PreKeyBundle
): Promise<void> {
  await storeSignedPreKey(workspaceId, spk);
  await storeOneTimePreKeys(workspaceId, opks);
  await storePreKeyBundle(workspaceId, bundle);
}

export async function clearX3DHData(workspaceId: string): Promise<void> {
  await deleteEncryptedDataByPrefix(X3DH_SPK_PREFIX + workspaceId);
  await deleteEncryptedDataByPrefix(X3DH_OPK_PREFIX + workspaceId);
  await deleteEncryptedDataByPrefix(X3DH_BUNDLE_PREFIX + workspaceId);
  await deleteEncryptedDataByPrefix(X3DH_SESSION_PREFIX + workspaceId);
}
