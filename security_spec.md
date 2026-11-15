# Security Specification: Sapecas Cassino (Firebase Firestore & Auth)

## 1. Data Invariants
- **Identity & Balance Isolation (`/usuarios/{uid}`)**: A document at `/usuarios/{uid}` contains user PII (`email`) and chip balance (`saldo`). Only the authenticated owner (`request.auth.uid == uid`) may read, create, or update their own document.
- **Room Creation Authority (`/salas/{salaId}`)**: Only authenticated users may read or create rooms. On creation, `criadorId` must match `request.auth.uid`, `jogadores` must start as `[request.auth.uid]`, `status` must be `'aguardando'`, and `maxJogadores` must be between 2 and 4.
- **Room Membership & State Integrity (`/salas/{salaId}`)**:
  - Non-members may only join an `'aguardando'` room if `jogadores.size() < maxJogadores`, and may only touch `jogadores`, `jogadoresInfo`, and `atualizadoEm` (never `estadoJogo`).
  - Only players listed in `existing().jogadores` may update `estadoJogo`, `status`, or game round fields.
  - Leaving a room removes only the caller's UID and may transfer `criadorId` if the creator leaves.
- **Temporal & Schema Integrity**: Server timestamps (`request.time`) are enforced on `criadoEm` and `atualizadoEm`, `criadoEm` and `jogo` are immutable, and strict `keys().hasOnly(...)` blocks shadow fields.

## 2. The "Dirty Dozen" Payloads (Adversarial Tests)
1. **Unauthenticated Room Read/Write**: Unauthenticated client reading or writing `/salas/sala1`. (DENIED)
2. **Unauthenticated User Profile Write**: Unauthenticated client creating `/usuarios/hacker`. (DENIED)
3. **Cross-User Balance Tampering**: Authenticated user `alice` updating `/usuarios/bob`'s `saldo` to `9999999`. (DENIED)
4. **Cross-User PII Read**: Authenticated user `alice` reading `/usuarios/bob` (contains `email`). (DENIED)
5. **Shadow Field Injection on Usuario**: User `alice` writing `/usuarios/alice` with extra ghost field `isAdmin: true`. (DENIED)
6. **Negative Balance Injection**: User `alice` updating `/usuarios/alice` with `saldo: -500`. (DENIED)
7. **Host Impersonation on Room Create**: User `charlie` creating `/salas/s1` with `criadorId: 'david'`. (DENIED)
8. **Non-Member Tampering `estadoJogo`**: User `eve` (not in `jogadores`) attempting to update `estadoJogo.maosJogadores` in `/salas/s1`. (DENIED)
9. **Overcapacity Room Join**: User `frank` attempting to join `/salas/s1` when `jogadores.size() >= 4`. (DENIED)
10. **Invalid Game Type Injection**: Creating `/salas/s1` with `jogo: 'hack_game'`. (DENIED)
11. **Document ID Poisoning**: Creating `/salas/bad$id..!` with illegal characters. (DENIED)
12. **Client Timestamp Forgery**: Creating `/salas/s1` with a forged past/future `criadoEm` instead of `request.time`. (DENIED)

## 3. Verification
All 12 adversarial cases are blocked by `firestore.rules` default-deny, `isValidId`, `isValidUsuario`, `isValidSala`, and action-based `affectedKeys().hasOnly(...)` gates.
