import React, { useState, useRef, useEffect } from 'react';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ArrowLeft, Play, HelpCircle, Wand2 } from 'lucide-react';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { ChipSelector } from '../components/ChipSelector';

interface ScratchGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'scratch', betAmount?: number) => void;
  onBackToLobby: () => void;
}

interface TileSymbol {
  symbol: string;
  name: string;
  multiplier: number;
}

const SYMBOLS: TileSymbol[] = [
  { symbol: '👑', name: 'Coroa Imperial', multiplier: 100 },
  { symbol: '💎', name: 'Diamante', multiplier: 50 },
  { symbol: '7️⃣', name: '777 Ouro', multiplier: 25 },
  { symbol: '🪙', name: 'Moedas de Ouro', multiplier: 10 },
  { symbol: '🍒', name: 'Cerejas', multiplier: 5 },
  { symbol: '🍀', name: 'Trevo da Sorte', multiplier: 2 },
];

const MULTIPLIER_BY_SYMBOL: Record<string, number> = Object.fromEntries(
  SYMBOLS.map((s) => [s.symbol, s.multiplier])
);

const getSymbolMultiplier = (sym: string): number => MULTIPLIER_BY_SYMBOL[sym] ?? 2;

const INITIAL_PREVIEW_TILES: TileSymbol[] = Array.from(
  { length: 9 },
  (_, i) => SYMBOLS[i % SYMBOLS.length]
);

export const ScratchGame: React.FC<ScratchGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby,
}) => {
  const [ticketPrice, setTicketPrice] = useState<number>(50);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [tiles, setTiles] = useState<TileSymbol[]>(INITIAL_PREVIEW_TILES);
  const [revealed, setRevealed] = useState<boolean[]>(Array(9).fill(false));
  const [winningIndices, setWinningIndices] = useState<number[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Compre um bilhete e raspe cada um dos 9 quadrados!'
  );
  const [isLossStatus, setIsLossStatus] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Nova Tela de Vitória Cósmica
  const [victoryModal, setVictoryModal] = useState<{
    open: boolean;
    closing: boolean;
    targetAmount: number;
    displayAmount: number;
    matchedSymbol: TileSymbol | null;
    lockedBet: number;
  }>({
    open: false,
    closing: false,
    targetAmount: 0,
    displayAmount: 0,
    matchedSymbol: null,
    lockedBet: 0,
  });

  const gridRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>(Array(9).fill(null));
  const isDownRef = useRef<boolean>(false);
  const lastStrokeRef = useRef<{ idx: number; x: number; y: number } | null>(null);
  const revealedRef = useRef<boolean[]>(Array(9).fill(false));
  const isPlayingRef = useRef<boolean>(false);
  const isEvaluatedRef = useRef<boolean>(false);
  const tilesRef = useRef<TileSymbol[]>(INITIAL_PREVIEW_TILES);
  const lockedBetRef = useRef<number>(50);
  const lastSoundAtRef = useRef<number>(0);
  const pendingCollectRef = useRef<{
    amount: number;
    bet: number;
    sym: TileSymbol | null;
  } | null>(null);
  const victoryRafRef = useRef<number | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdateBalanceRef = useRef(onUpdateBalance);

  useEffect(() => {
    onUpdateBalanceRef.current = onUpdateBalance;
  }, [onUpdateBalance]);

  const drawQuadFoil = (canvas: HTMLCanvasElement, idx: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.globalCompositeOperation = 'source-over';

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.35, '#f59e0b');
    grad.addColorStop(0.75, '#d97706');
    grad.addColorStop(1, '#92400e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    for (let x = 8; x < w; x += 20) {
      for (let y = 8; y < h; y += 20) {
        if (((x + y) / 20) % 2 === 0) {
          ctx.fillRect(x, y, 5, 5);
        }
      }
    }

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    ctx.fillStyle = 'rgba(69, 26, 3, 0.78)';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', w / 2, h / 2 - 4);

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = 'rgba(69, 26, 3, 0.72)';
    ctx.fillText(`#${idx + 1}`, w / 2, h / 2 + 24);
  };

  const resetAllQuadFoils = () => {
    for (let i = 0; i < 9; i++) {
      const cvs = canvasRefs.current[i];
      if (cvs) {
        cvs.style.opacity = '1';
        drawQuadFoil(cvs, i);
      }
    }
  };

  useEffect(() => {
    resetAllQuadFoils();

    const handleGlobalUp = () => {
      isDownRef.current = false;
      lastStrokeRef.current = null;
    };
    window.addEventListener('pointerup', handleGlobalUp);
    window.addEventListener('pointercancel', handleGlobalUp);

    return () => {
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
      if (victoryRafRef.current) cancelAnimationFrame(victoryRafRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (pendingCollectRef.current) {
        const pending = pendingCollectRef.current;
        pendingCollectRef.current = null;
        onUpdateBalanceRef.current(pending.amount, true, 'scratch', pending.bet);
      }
    };
  }, []);

  const revealQuad = (idx: number, currentTiles: TileSymbol[]) => {
    if (revealedRef.current[idx]) return;
    revealedRef.current[idx] = true;

    const cvs = canvasRefs.current[idx];
    if (cvs) {
      const ctx = cvs.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, cvs.width, cvs.height);
    }

    const nextRevealed = [...revealedRef.current];
    setRevealed(nextRevealed);

    const count = nextRevealed.filter(Boolean).length;
    if (count < 9) {
      setStatusMessage(`Continue raspando! Restam ${9 - count} quadrado(s).`);
    } else if (!isEvaluatedRef.current) {
      evaluateRound(currentTiles);
    }
  };

  const evaluateRound = (roundTiles: TileSymbol[]) => {
    if (isEvaluatedRef.current) return;
    isEvaluatedRef.current = true;
    isPlayingRef.current = false;
    setIsPlaying(false);

    const counts: Record<string, { item: TileSymbol; indices: number[] }> = {};
    roundTiles.forEach((t, idx) => {
      if (!counts[t.symbol]) {
        counts[t.symbol] = { item: t, indices: [] };
      }
      counts[t.symbol].indices.push(idx);
    });

    let matched: { item: TileSymbol; indices: number[] } | null = null;
    Object.values(counts).forEach((entry) => {
      if (entry.indices.length >= 3) {
        matched = entry;
      }
    });

    if (matched) {
      const matchedEntry = matched as { item: TileSymbol; indices: number[] };
      const winMult = getSymbolMultiplier(matchedEntry.item.symbol);
      const winSym: TileSymbol = { ...matchedEntry.item, multiplier: winMult };
      const winIndices = matchedEntry.indices.slice(0, 3);
      const winAmount = lockedBetRef.current * winMult;

      setWinningIndices(winIndices);
      setIsLossStatus(false);
      setStatusMessage(`🎉 3x ${winSym.symbol} ${winSym.name} (${winSym.multiplier}x)! Celebrando prêmio...`);
      soundManager.playWin();

      pendingCollectRef.current = {
        amount: winAmount,
        bet: lockedBetRef.current,
        sym: winSym,
      };

      finishTimerRef.current = setTimeout(() => {
        finishTimerRef.current = null;
        startVictoryCelebration(winAmount, winSym, lockedBetRef.current);
      }, 520);
    } else {
      soundManager.playLoss();
      reportRoundLoss('scratch');
      setIsLossStatus(true);
      setStatusMessage('Sem 3 símbolos iguais desta vez. Compre outro bilhete!');
    }
  };

  const startVictoryCelebration = (winAmount: number, winSym: TileSymbol, lockedBet: number) => {
    if (victoryRafRef.current) cancelAnimationFrame(victoryRafRef.current);

    setVictoryModal({
      open: true,
      closing: false,
      targetAmount: winAmount,
      displayAmount: 0,
      matchedSymbol: winSym,
      lockedBet,
    });

    if (winAmount >= 500) soundManager.playJackpot();
    else soundManager.playWin();

    const startTime = performance.now();
    const duration = 3800; // 3 a 5 segundos (3.8s)
    let lastTick = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(eased * winAmount);

      setVictoryModal((prev) =>
        prev.open ? { ...prev, displayAmount: currentVal } : prev
      );

      if (now - lastTick > 160 && progress < 0.98) {
        soundManager.playChip();
        lastTick = now;
      }

      if (progress < 1) {
        victoryRafRef.current = requestAnimationFrame(tick);
      } else {
        setVictoryModal((prev) =>
          prev.open ? { ...prev, displayAmount: winAmount } : prev
        );
        soundManager.playJackpot();
        victoryRafRef.current = null;
      }
    };

    victoryRafRef.current = requestAnimationFrame(tick);
  };

  const handleCollectVictory = () => {
    if (!victoryModal.open || victoryModal.closing) return;

    if (victoryRafRef.current) {
      cancelAnimationFrame(victoryRafRef.current);
      victoryRafRef.current = null;
    }

    if (pendingCollectRef.current) {
      const pending = pendingCollectRef.current;
      pendingCollectRef.current = null;
      onUpdateBalance(pending.amount, true, 'scratch', pending.bet);
      setStatusMessage(
        `✅ Recolhido: +${pending.amount.toLocaleString('pt-BR')} fichas (3x ${
          pending.sym?.symbol ?? ''
        } ${pending.sym?.name ?? ''})!`
      );
      setIsLossStatus(false);
    }

    soundManager.playChip();
    setVictoryModal((prev) => ({
      ...prev,
      displayAmount: prev.targetAmount,
      closing: true,
    }));

    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setVictoryModal({
        open: false,
        closing: false,
        targetAmount: 0,
        displayAmount: 0,
        matchedSymbol: null,
        lockedBet: 0,
      });
    }, 420);
  };

  const handleBuyTicket = () => {
    if (isPlaying || victoryModal.open || ticketPrice > balance || ticketPrice <= 0) return;

    soundManager.playChip();
    lockedBetRef.current = ticketPrice;
    onUpdateBalance(-ticketPrice, false, 'scratch');

    const willWin = Math.random() < 0.17;
    let newTiles: TileSymbol[] = [];

    if (willWin) {
      const r = Math.random();
      let winSym = SYMBOLS[5]; // 2x
      if (r < 0.004) winSym = SYMBOLS[0];       // 100x
      else if (r < 0.015) winSym = SYMBOLS[1];  // 50x
      else if (r < 0.050) winSym = SYMBOLS[2];  // 25x
      else if (r < 0.170) winSym = SYMBOLS[3];  // 10x
      else if (r < 0.450) winSym = SYMBOLS[4];  // 5x
      else winSym = SYMBOLS[5];                 // 2x

      const others = SYMBOLS.filter((s) => s.symbol !== winSym.symbol);
      newTiles = [winSym, winSym, winSym, others[0], others[0], others[1], others[1], others[2], others[3]];
    } else {
      const shuffled = [...SYMBOLS].sort(() => Math.random() - 0.5);
      newTiles = [
        shuffled[0], shuffled[0],
        shuffled[1], shuffled[1],
        shuffled[2], shuffled[2],
        shuffled[3], shuffled[4], shuffled[5],
      ];
    }
    newTiles.sort(() => Math.random() - 0.5);

    const freshRevealed = Array(9).fill(false);
    revealedRef.current = freshRevealed;
    tilesRef.current = newTiles;
    isPlayingRef.current = true;
    isEvaluatedRef.current = false;
    pendingCollectRef.current = null;

    setTiles(newTiles);
    setRevealed(freshRevealed);
    setWinningIndices([]);
    setIsPlaying(true);
    setIsLossStatus(false);
    setStatusMessage('Bilhete ativo! Raspe os 9 quadrados individualmente!');

    requestAnimationFrame(() => {
      resetAllQuadFoils();
    });
  };

  const scratchAtPoint = (clientX: number, clientY: number) => {
    if (!isPlayingRef.current || isEvaluatedRef.current) return;
    const el = document.elementFromPoint(clientX, clientY);
    const quad = el?.closest('[data-quad]');
    if (!quad) {
      lastStrokeRef.current = null;
      return;
    }
    const idx = Number(quad.getAttribute('data-quad'));
    if (!Number.isInteger(idx) || idx < 0 || idx > 8 || revealedRef.current[idx]) {
      lastStrokeRef.current = null;
      return;
    }

    const cvs = canvasRefs.current[idx];
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = ((clientX - rect.left) / rect.width) * cvs.width;
    const y = ((clientY - rect.top) / rect.height) * cvs.height;

    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    if (lastStrokeRef.current && lastStrokeRef.current.idx === idx) {
      ctx.lineWidth = 42;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastStrokeRef.current.x, lastStrokeRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    lastStrokeRef.current = { idx, x, y };

    const now = performance.now();
    if (now - lastSoundAtRef.current > 75) {
      soundManager.playCardDeal();
      lastSoundAtRef.current = now;
    }

    try {
      const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
      let cleared = 0;
      let total = 0;
      for (let p = 3; p < data.length; p += 16) {
        total++;
        if (data[p] < 110) cleared++;
      }
      if (total > 0 && cleared / total >= 0.46) {
        revealQuad(idx, tilesRef.current);
      }
    } catch {
      // Ignore image data security exceptions
    }
  };

  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPlayingRef.current || isEvaluatedRef.current) return;
    isDownRef.current = true;
    lastStrokeRef.current = null;
    scratchAtPoint(e.clientX, e.clientY);
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDownRef.current || !isPlayingRef.current || isEvaluatedRef.current) return;
    scratchAtPoint(e.clientX, e.clientY);
  };

  const handleScratchAll = () => {
    if (!isPlayingRef.current || isEvaluatedRef.current) return;
    soundManager.playShuffle();
    for (let i = 0; i < 9; i++) {
      if (!revealedRef.current[i]) {
        revealQuad(i, tilesRef.current);
      }
    }
  };

  const revealedCount = revealed.filter(Boolean).length;

  return (
    <div className="h-full max-h-full min-h-0 flex flex-col justify-between gap-1 max-w-3xl w-full mx-auto overflow-hidden">
      {/* Cabeçalho */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Lobby</span>
        </button>
        <span className="text-xs sm:text-sm font-cinzel font-bold text-amber-400 uppercase tracking-wider">
          🎫 Raspadinha Sapeca
        </span>
        <span className="text-[11px] font-mono font-bold text-amber-200 tabular-nums">
          {revealedCount} / 9 raspados
        </span>
      </div>

      {/* Tabela de Prêmios no Topo (2x a 100x) */}
      <div
        className="flex-shrink-0 grid grid-cols-6 gap-1 bg-gradient-to-b from-[#240b06] to-[#120503] border border-amber-500/35 rounded-xl px-1.5 py-1"
        aria-label="Tabela de prêmios de 2x a 100x"
      >
        {SYMBOLS.map((s) => (
          <div
            key={s.symbol}
            title={`3x ${s.name} = ${s.multiplier}x`}
            className="flex items-center justify-center gap-1 py-0.5 px-1 rounded-md bg-[#0c0402]/80 border border-orange-500/25 text-[11px] font-extrabold text-amber-200 tabular-nums whitespace-nowrap"
          >
            <span>{s.symbol}</span>
            <span>{s.multiplier}x</span>
          </div>
        ))}
      </div>

      {/* Grade 3x3 de 9 Quadrantes Independentes */}
      <div className="flex-1 min-h-0 w-full casino-felt border border-amber-500/40 rounded-2xl p-2 flex flex-col items-center justify-center gap-1.5 shadow-xl overflow-hidden">
        <div
          className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
          style={{ containerType: 'size' }}
        >
          <div
            ref={gridRef}
            onPointerDown={handleGridPointerDown}
            onPointerMove={handleGridPointerMove}
            className="grid grid-cols-3 grid-rows-3 gap-1.5 touch-none select-none"
            style={{
              width: 'min(100cqw, 100cqh, 340px)',
              height: 'min(100cqw, 100cqh, 340px)',
            }}
          >
            {tiles.map((t, i) => {
              const isWinner = winningIndices.includes(i);
              const isCellRevealed = revealed[i];
              return (
                <div
                  key={i}
                  data-quad={i}
                  className={`relative w-full h-full rounded-xl overflow-hidden border-2 bg-gradient-to-b from-[#2b0f0a] to-[#140503] shadow-inner transition-all duration-200 ${
                    isWinner
                      ? 'border-yellow-300 shadow-[0_0_18px_rgba(251,191,36,0.9)] scale-[1.03] z-10'
                      : isCellRevealed
                      ? 'border-amber-400/85'
                      : 'border-amber-500/50'
                  }`}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-0.5">
                    <span className="text-2xl sm:text-3xl leading-none drop-shadow">{t.symbol}</span>
                    <span className="text-xs sm:text-sm font-mono font-black text-yellow-300 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                      {getSymbolMultiplier(t.symbol)}x
                    </span>
                  </div>

                  <canvas
                    ref={(el) => {
                      canvasRefs.current[i] = el;
                    }}
                    width={160}
                    height={160}
                    className={`absolute inset-0 w-full h-full block cursor-crosshair touch-none transition-opacity duration-200 ${
                      isCellRevealed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div
          className={`flex-shrink-0 text-center text-[11px] font-bold min-h-[16px] ${
            isLossStatus ? 'text-red-300' : 'text-amber-300'
          }`}
        >
          {statusMessage}
        </div>
      </div>

      {/* Painel Inferior de Apostas e Regras */}
      <div className="flex-shrink-0 flex flex-col gap-1">
        <div className="bg-[#180705] border border-orange-500/30 rounded-xl p-1.5 shadow-xl flex flex-col gap-1.5">
          <ChipSelector
            currentBet={ticketPrice}
            balance={balance}
            onBetChange={setTicketPrice}
            disabled={isPlaying || victoryModal.open}
            label="Aposta Atual:"
          />

          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isPlaying || victoryModal.open || ticketPrice > balance || ticketPrice <= 0}
              onClick={handleBuyTicket}
              className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-xs shadow-lg shadow-orange-600/35 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap border border-orange-300/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isPlaying
                  ? 'RASPE OS 9 QUADRANTES 🪙'
                  : `COMPRAR BILHETE (${ticketPrice.toLocaleString('pt-BR')} Fichas) 🎫`}
              </span>
            </button>

            <button
              type="button"
              disabled={!isPlaying}
              onClick={handleScratchAll}
              className="px-3 py-2 rounded-xl bg-[#27100a] hover:bg-[#38170e] text-amber-200 border border-amber-500/35 font-cinzel font-bold text-[11px] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Raspar Tudo</span>
            </button>
          </div>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1 text-[11px] text-orange-300/80 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
          >
            <HelpCircle className="w-3 h-3 text-orange-400" />
            <span>Regras & Tabela de Prêmios</span>
          </button>
        </div>
      </div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
        gameId="scratch"
      />

      {/* Nova Tela de Vitória Cósmica (Raspadinha Sapeca) */}
      {victoryModal.open && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-[1350] flex flex-col items-center justify-between px-5 py-7 sm:py-12 overflow-hidden transition-all duration-400 scratch-victory-backdrop ${
            victoryModal.closing ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
          }`}
          style={{
            background:
              'radial-gradient(circle at 50% 44%, #0f1c3f 0%, #060d20 45%, #02050d 78%, #000000 100%)',
          }}
        >
          {/* Raios giratórios e brilho central em explosão de luz */}
          <div
            className="absolute left-1/2 top-[45%] w-[180vw] max-w-[1150px] h-[180vw] max-h-[1150px] rounded-full pointer-events-none scratch-victory-rays"
          />
          <div
            className="absolute left-1/2 top-[45%] w-[140vw] max-w-[820px] h-[140vw] max-h-[820px] pointer-events-none blur-md scratch-victory-starburst"
          />

          {/* Estrelas cadentes e partículas brilhantes flutuantes */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2]">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={`star-${i}`}
                className="absolute w-32 h-[2.5px] rounded-full opacity-0 scratch-shooting-star"
                style={{
                  top: `${(6 + (i * 11) % 58).toFixed(1)}%`,
                  left: `${(-15 + (i * 17) % 55).toFixed(1)}%`,
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.65) 45%, #fef08a 85%, #ffffff 100%)',
                  boxShadow: '0 0 12px rgba(253, 224, 71, 0.9)',
                  animationDuration: `${(2.1 + (i % 4) * 0.65).toFixed(2)}s`,
                  animationDelay: `${(i * 0.55).toFixed(2)}s`,
                }}
              />
            ))}
            {Array.from({ length: 28 }, (_, p) => {
              const glyph = p % 3 === 0 ? '✦' : p % 3 === 1 ? '★' : '✨';
              const color = p % 4 === 0 ? '#7dd3fc' : '#fde047';
              return (
                <div
                  key={`sp-${p}`}
                  className="absolute opacity-0 scratch-float-sparkle"
                  style={{
                    left: `${(4 + (p * 3.45) % 92).toFixed(1)}%`,
                    top: `${(14 + (p * 13.7) % 78).toFixed(1)}%`,
                    fontSize: `${10 + (p % 4) * 5}px`,
                    color,
                    textShadow: '0 0 10px rgba(251, 191, 36, 0.95)',
                    animationDuration: `${(2.6 + (p % 5) * 0.7).toFixed(2)}s`,
                    animationDelay: `${((p * 0.22) % 2.4).toFixed(2)}s`,
                  }}
                >
                  {glyph}
                </div>
              );
            })}
          </div>

          {/* Centro: Título 3D Dourado + Valor do Prêmio */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center gap-4 max-w-lg w-full">
            <div className="text-xs font-extrabold tracking-[0.2em] uppercase text-blue-300 drop-shadow">
              RASPADINHA SAPECA · {victoryModal.matchedSymbol?.symbol}{' '}
              {victoryModal.matchedSymbol?.name}
            </div>

            <h2 className="font-cinzel font-black text-5xl sm:text-7xl leading-none tracking-[0.12em] uppercase scratch-victory-title-3d">
              VITÓRIA!
            </h2>

            <div
              className="px-7 py-5 rounded-2xl border-2 border-yellow-300/75 shadow-[0_0_42px_rgba(251,191,36,0.35),inset_0_0_22px_rgba(56,189,248,0.18)] min-w-[280px] sm:min-w-[340px]"
              style={{
                background:
                  'radial-gradient(circle at 50% 40%, rgba(30, 58, 138, 0.52) 0%, rgba(6, 12, 30, 0.88) 85%)',
              }}
            >
              <div className="text-[11px] font-extrabold text-amber-200 tracking-[0.18em] uppercase mb-1.5">
                Prêmio Total Conquistado
              </div>
              <div className="font-cinzel font-black text-3xl sm:text-5xl text-amber-50 tabular-nums scratch-victory-amount-3d">
                {victoryModal.displayAmount.toLocaleString('pt-BR')} FICHAS
              </div>
              <div className="mt-1.5 text-xs sm:text-sm font-bold text-sky-200">
                3x {victoryModal.matchedSymbol?.symbol} · Multiplicador{' '}
                {victoryModal.matchedSymbol?.multiplier}x
              </div>
            </div>
          </div>

          {/* Botão RECOLHER na parte inferior da tela */}
          <div className="relative z-10 w-full flex justify-center">
            <button
              type="button"
              onClick={handleCollectVictory}
              className="w-full max-w-[320px] py-3.5 px-7 rounded-2xl border-2 border-yellow-300 text-white font-cinzel font-black text-xl tracking-[0.18em] uppercase cursor-pointer transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0.5 shadow-[0_6px_0_#052e16,0_14px_32px_rgba(22,163,74,0.55),0_0_24px_rgba(253,224,71,0.45)]"
              style={{
                background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 55%, #14532d 100%)',
              }}
            >
              RECOLHER
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
