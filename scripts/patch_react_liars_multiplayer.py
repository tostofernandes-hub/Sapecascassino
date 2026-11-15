#!/usr/bin/env python3
import re

with open('/app/applet/src/games/LiarsBarGame.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
old_imports = """import { 
  subscribeToRooms, 
  createMultiplayerRoom, 
  joinMultiplayerRoom, 
  leaveMultiplayerRoom, 
  updateMultiplayerRoomState, 
  FirebaseGameRoom 
} from '../firebase/multiplayer';"""

new_imports = """import { 
  Copy, 
  Clock, 
  Sparkles, 
  LogOut, 
  DoorOpen 
} from 'lucide-react';
import { 
  escutarSalasDisponiveis, 
  escutarSalaEmTempoReal, 
  criarSalaMultiplayer, 
  entrarNaSalaMultiplayer, 
  sairDaSalaMultiplayer, 
  iniciarPartidaLiarsBarMultiplayer, 
  jogarCartasLiarsBarMultiplayer, 
  duvidarLiarsBarMultiplayer, 
  puxarGatilhoLiarsBarMultiplayer, 
  SalaMultiplayer, 
  EstadoLiarsBar 
} from '../firebase/salasMultiplayer';
import { auth } from '../firebase/config';"""

content = content.replace(old_imports, new_imports)

# 2. Add Firestore state and listeners inside component
state_insertion = """  // ---------------- FIRESTORE REAL-TIME MULTIPLAYER STATE ----------------
  const [salasFirestore, setSalasFirestore] = useState<SalaMultiplayer[]>([]);
  const [salaAtivaFirestore, setSalaAtivaFirestore] = useState<SalaMultiplayer | null>(null);
  const [conviteCopiado, setConviteCopiado] = useState<boolean>(false);
  const [isCriandoSalaFS, setIsCriandoSalaFS] = useState<boolean>(false);

  // Escuta salas disponíveis de Liar's Bar em tempo real no Firestore
  useEffect(() => {
    const unsub = escutarSalasDisponiveis('liars-bar', (salas) => {
      setSalasFirestore(salas);
    });
    return () => unsub();
  }, []);

  // Escuta a sala ativa em tempo real no Firestore
  useEffect(() => {
    if (!salaAtivaFirestore?.id) return;
    const unsub = escutarSalaEmTempoReal(salaAtivaFirestore.id, (atualizada) => {
      if (!atualizada) {
        setSalaAtivaFirestore(null);
        setGameState('ROOMS_LOBBY');
      } else {
        setSalaAtivaFirestore(atualizada);
        // Sincroniza estado de jogo do Liar's Bar a partir do Firestore
        if (atualizada.status === 'em_andamento') {
          setGameState('PLAYING');
        }
      }
    });
    return () => unsub();
  }, [salaAtivaFirestore?.id]);

  const handleCriarSalaLiarsFS = async () => {
    const nome = newRoomName.trim() || `Taverna de ${username}`;
    setIsCriandoSalaFS(true);
    try {
      const novaSala = await criarSalaMultiplayer('liars-bar', nome, username, balance);
      if (novaSala) {
        setSalaAtivaFirestore(novaSala);
        setNewRoomName('');
        setShowCreateModal(false);
        setGameState('WAITING');
        soundManager.playClick();
      }
    } catch (e: any) {
      alert(e.message || 'Erro ao criar sala multiplayer.');
    } finally {
      setIsCriandoSalaFS(false);
    }
  };

  const handleEntrarSalaLiarsFS = async (sala: SalaMultiplayer) => {
    const res = await entrarNaSalaMultiplayer(sala.id, username, balance);
    if (res.success) {
      setSalaAtivaFirestore(sala);
      setGameState('WAITING');
      soundManager.playClick();
    } else {
      alert(res.message);
    }
  };

  const handleSairSalaLiarsFS = async () => {
    if (!salaAtivaFirestore) return;
    await sairDaSalaMultiplayer(salaAtivaFirestore.id);
    setSalaAtivaFirestore(null);
    setGameState('ROOMS_LOBBY');
    soundManager.playClick();
  };

  const handleIniciarPartidaLiarsFS = async () => {
    if (!salaAtivaFirestore) return;
    try {
      await iniciarPartidaLiarsBarMultiplayer(salaAtivaFirestore.id);
      soundManager.playClick();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleJogarCartasLiarsFS = async () => {
    if (!salaAtivaFirestore || selectedCards.length === 0) return;
    try {
      await jogarCartasLiarsBarMultiplayer(salaAtivaFirestore.id, selectedCards);
      setSelectedCards([]);
      soundManager.playCardDeal();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDuvidarLiarsFS = async () => {
    if (!salaAtivaFirestore) return;
    try {
      await duvidarLiarsBarMultiplayer(salaAtivaFirestore.id);
      soundManager.playLoss();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePuxarGatilhoLiarsFS = async () => {
    if (!salaAtivaFirestore) return;
    try {
      await puxarGatilhoLiarsBarMultiplayer(salaAtivaFirestore.id);
      soundManager.playSpin();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCopiarConviteLiarsFS = () => {
    if (!salaAtivaFirestore) return;
    const txt = `Bora blefar no Liar's Bar do Sapecas Cassino! Código da mesa: ${salaAtivaFirestore.codigoConvite} · Acesse ${window.location.origin}`;
    navigator.clipboard?.writeText(txt);
    setConviteCopiado(true);
    setTimeout(() => setConviteCopiado(false), 2500);
  };
"""

target_hook = "  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);"
content = content.replace(target_hook, target_hook + "\n" + state_insertion)

with open('/app/applet/src/games/LiarsBarGame.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected Firestore multiplayer state and handlers into LiarsBarGame.tsx")
