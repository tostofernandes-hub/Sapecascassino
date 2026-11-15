#!/usr/bin/env python3
import re

with open('/app/applet/src/games/TexasHoldemGame.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables for Firestore multiplayer
state_addition = """  // ---------------- FIRESTORE REAL-TIME MULTIPLAYER STATE ----------------
  const [salasFirestore, setSalasFirestore] = useState<SalaMultiplayer[]>([]);
  const [salaAtivaFirestore, setSalaAtivaFirestore] = useState<SalaMultiplayer | null>(null);
  const [conviteCopiado, setConviteCopiado] = useState<boolean>(false);
  const [isCriandoSala, setIsCriandoSala] = useState<boolean>(false);

  // Escuta todas as salas disponíveis de Pôquer em tempo real via Firestore onSnapshot
  useEffect(() => {
    const unsub = escutarSalasDisponiveis('poker', (salas) => {
      setSalasFirestore(salas);
    });
    return () => unsub();
  }, []);

  // Escuta a sala ativa em tempo real via Firestore onSnapshot
  useEffect(() => {
    if (!salaAtivaFirestore?.id) return;
    const unsub = escutarSalaEmTempoReal(salaAtivaFirestore.id, (atualizada) => {
      if (!atualizada) {
        setSalaAtivaFirestore(null);
      } else {
        setSalaAtivaFirestore(atualizada);
      }
    });
    return () => unsub();
  }, [salaAtivaFirestore?.id]);

  const handleCriarSalaPokerFS = async () => {
    const nome = newRoomName.trim() || `Mesa VIP #${Math.floor(100 + Math.random() * 900)}`;
    const accounts = getStoredAccounts();
    const myName = accounts[0]?.username || auth.currentUser?.displayName || 'Jogador';
    setIsCriandoSala(true);
    try {
      const novaSala = await criarSalaMultiplayer('poker', nome, myName, balance);
      if (novaSala) {
        setSalaAtivaFirestore(novaSala);
        setNewRoomName('');
        soundManager.playClick();
      }
    } catch (e: any) {
      alert(e.message || 'Erro ao criar sala multiplayer.');
    } finally {
      setIsCriandoSala(false);
    }
  };

  const handleEntrarSalaPokerFS = async (sala: SalaMultiplayer) => {
    const accounts = getStoredAccounts();
    const myName = accounts[0]?.username || auth.currentUser?.displayName || 'Jogador';
    const res = await entrarNaSalaMultiplayer(sala.id, myName, balance);
    if (res.success) {
      setSalaAtivaFirestore(sala);
      soundManager.playClick();
    } else {
      alert(res.message);
    }
  };

  const handleSairSalaPokerFS = async () => {
    if (!salaAtivaFirestore) return;
    await sairDaSalaMultiplayer(salaAtivaFirestore.id);
    setSalaAtivaFirestore(null);
    soundManager.playClick();
  };

  const handleIniciarMaoPokerFS = async () => {
    if (!salaAtivaFirestore) return;
    try {
      await iniciarPartidaPokerMultiplayer(salaAtivaFirestore.id, 50);
      soundManager.playShuffle();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAcaoPokerMultiFS = async (acao: 'check' | 'call' | 'raise' | 'fold', extra = 0) => {
    if (!salaAtivaFirestore) return;
    try {
      await realizarAcaoPokerMultiplayer(salaAtivaFirestore.id, acao, extra);
      soundManager.playChip();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCopiarConviteFS = () => {
    if (!salaAtivaFirestore) return;
    const txt = `Bora jogar Pôquer no Sapecas Cassino comigo! Código da mesa: ${salaAtivaFirestore.codigoConvite} · Acesse ${window.location.origin}`;
    navigator.clipboard?.writeText(txt);
    setConviteCopiado(true);
    setTimeout(() => setConviteCopiado(false), 2500);
  };
"""

target_loc = "  // ---------------- MULTIPLAYER ROOMS STATE ----------------"
content = content.replace(target_loc, state_addition + "\n" + target_loc)

with open('/app/applet/src/games/TexasHoldemGame.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added Firestore real-time state and handlers to TexasHoldemGame.tsx")
