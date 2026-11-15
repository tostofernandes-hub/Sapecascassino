#!/usr/bin/env python3
import re
import os

def patch_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add Firebase scripts in <head> if not present
    fb_scripts = """  <!-- Firebase App & Services -->
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
"""
    if "firebase-app-compat.js" not in content:
        content = content.replace(
            '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
            '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n' + fb_scripts
        )

    # 2. Add Firebase initialization code
    fb_init_code = """
    // ==========================================
    // FIREBASE INITIALIZATION & FIRESTORE REALTIME
    // Target Project: sapecascassino
    // ==========================================
    const FIREBASE_CONFIG = {
      projectId: "sapecascassino",
      appId: "1:467625653853:web:756ee3de7307f8c1debfb4",
      apiKey: "AIzaSyCP_TNss6yRRl4kj1A8jn1C2wg-XdtPsug",
      authDomain: "sapecascassino.firebaseapp.com",
      firestoreDatabaseId: "ai-studio-sapecascassino-e7507944-40a0-4bd0-9cde-d111662cd4f5",
      storageBucket: "sapecascassino.firebasestorage.app",
      messagingSenderId: "467625653853"
    };

    let firebaseApp = null;
    let firebaseAuth = null;
    let firebaseDb = null;
    let isFirebaseConnected = false;

    function initFirebase() {
      try {
        if (window.firebase && !window.firebase.apps.length) {
          firebaseApp = window.firebase.initializeApp(FIREBASE_CONFIG);
          firebaseAuth = window.firebase.auth();
          firebaseDb = window.firebase.firestore();
          isFirebaseConnected = true;
          console.log('🔥 Firebase Sapecas Cassino (sapecascassino) conectado com sucesso!');
          listenFirebaseRooms();
        }
      } catch (err) {
        console.warn('Firebase init warning:', err);
      }
    }

    function listenFirebaseRooms() {
      if (!firebaseDb) return;
      try {
        firebaseDb.collection('rooms').onSnapshot((snapshot) => {
          let updated = false;
          const currentSalas = DB.salas.getAll();
          snapshot.forEach((doc) => {
            const data = doc.data();
            const existingIdx = currentSalas.findIndex(s => s.id === doc.id);
            const salaObj = {
              id: doc.id,
              nomeSala: data.name || doc.id,
              jogo: data.game || 'poker',
              criadorId: data.hostId || 'firebase',
              jogadoresIds: data.playerIds || [],
              status: data.status || 'aberta',
              dataCriacao: data.createdAt || new Date().toISOString()
            };
            if (existingIdx >= 0) {
              currentSalas[existingIdx] = { ...currentSalas[existingIdx], ...salaObj };
              updated = true;
            } else {
              currentSalas.unshift(salaObj);
              updated = true;
            }
          });
          if (updated) {
            localStorage.setItem(DB_KEYS.SALAS, JSON.stringify(currentSalas));
            refreshActiveMultiplayerView();
          }
        }, (err) => {
          console.warn('Firebase rooms snapshot warning:', err);
        });
      } catch (e) {}
    }

    async function pushSalaToFirebase(sala) {
      if (!firebaseDb) return;
      try {
        const uNames = sala.jogadoresIds.map(id => {
          const u = DB.usuarios.getById(id);
          return u ? u.nomeUsuario : id;
        });
        await firebaseDb.collection('rooms').doc(sala.id).set({
          id: sala.id,
          name: sala.nomeSala,
          game: sala.jogo,
          hostId: sala.criadorId,
          hostName: currentUser ? (currentUser.nomeUsuario || currentUser.username) : 'Jogador',
          status: sala.status,
          maxPlayers: 5,
          playerIds: sala.jogadoresIds,
          playerNames: uNames,
          createdAt: sala.dataCriacao || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Erro ao sincronizar sala com Firebase Firestore:', e);
      }
    }

    async function pushEstadoToFirebase(salaId, estadoJogo) {
      if (!firebaseDb) return;
      try {
        await firebaseDb.collection('rooms').doc(salaId).set({
          gameState: estadoJogo,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Erro ao sincronizar estado com Firebase:', e);
      }
    }
"""

    if "FIREBASE INITIALIZATION & FIRESTORE REALTIME" not in content:
        content = content.replace(
            'async function pushSalaToSupabase(sala) {',
            fb_init_code + '\n    async function pushSalaToSupabase(sala) {'
        )

    # 3. Hook pushSalaToFirebase inside DB.salas.create and join
    if "try { pushSalaToFirebase(newSala); } catch(e) {}" not in content:
        content = content.replace(
            "try { pushSalaToSupabase(newSala); } catch(e) {}",
            "try { pushSalaToSupabase(newSala); } catch(e) {}\n          try { pushSalaToFirebase(newSala); } catch(e) {}"
        )
    if "try { pushSalaToFirebase(sala); } catch(e) {}" not in content:
        content = content.replace(
            "try { pushSalaToSupabase(sala); } catch(e) {}",
            "try { pushSalaToSupabase(sala); } catch(e) {}\n          try { pushSalaToFirebase(sala); } catch(e) {}"
        )

    # 4. In window.onload or DOMContentLoaded, ensure initFirebase is called
    if "initFirebase();" not in content:
        content = content.replace(
            "window.addEventListener('DOMContentLoaded', () => {",
            "window.addEventListener('DOMContentLoaded', () => {\n      initFirebase();"
        )

    # 5. Hook handleAuthSubmit for Firebase Auth registration and login
    fb_auth_hook = """      // Sync with Firebase Auth and Firestore
      if (firebaseAuth) {
        const cleanU = u.trim();
        const fbEmail = (cleanU.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jogador') + '@sapecascassino.app';
        if (authMode === 'login') {
          firebaseAuth.signInWithEmailAndPassword(fbEmail, p).catch((err) => {
            console.log('Firebase login fallback attempt:', err.code);
            if (err.code === 'auth/user-not-found') {
              firebaseAuth.createUserWithEmailAndPassword(fbEmail, p).catch(console.warn);
            }
          });
        } else {
          firebaseAuth.createUserWithEmailAndPassword(fbEmail, p).then((uc) => {
            uc.user.updateProfile({ displayName: cleanU }).catch(() => {});
            if (firebaseDb) {
              firebaseDb.collection('users').doc(uc.user.uid).set({
                uid: uc.user.uid,
                username: cleanU,
                email: fbEmail,
                balance: 10000,
                biggestWin: 0,
                createdAt: new Date().toISOString()
              }, { merge: true }).catch(console.warn);
            }
          }).catch(console.warn);
        }
      }
"""
    if "Sync with Firebase Auth and Firestore" not in content:
        content = content.replace(
            "if (authMode === 'login') {\n        const res = DB.usuarios.authenticate(u, p);",
            fb_auth_hook + "\n      if (authMode === 'login') {\n        const res = DB.usuarios.authenticate(u, p);"
        )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched Firebase integration into: {filepath}")

patch_file('/app/applet/sapecas-cassino.html')
patch_file('/app/applet/public/sapecas-cassino.html')
print("Finished patching Firebase.")
