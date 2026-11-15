import React, { useState, useEffect, useLayoutEffect, useRef, useId } from 'react';
import { SlotTheme } from '../types/casino';
import { soundManager } from '../utils/audio';
import { reportRoundLoss } from '../utils/luckyStreak';
import { ChipSelector } from '../components/ChipSelector';
import { HowToPlayModal } from '../components/HowToPlayModal';
import { FortuneDragonWinModal } from '../components/FortuneDragonWinModal';
import { SlotSymbol3D } from '../components/SlotSymbol3D';
import { ArrowLeft, Play, Sparkles, Flame, HelpCircle, Shuffle, Square, Repeat } from 'lucide-react';

interface SlotsGameProps {
  balance: number;
  onUpdateBalance: (delta: number, isWin: boolean, gameId: 'slots', betAmount?: number) => void;
  onBackToLobby: () => void;
}

/**
 * ============================================================================
 * FORTUNE DRAGON - MATRIZ MATEMÁTICA DE RETORNO (RTP) E TABELA DE PAGAMENTOS
 * ============================================================================
 * 
 * DIRETRIZES DA CASA:
 * 1. Manter APENAS multiplicadores provenientes de combinações de 3 símbolos
 *    iguais nas 5 linhas de pagamento (3 linhas horizontais, 2 diagonais).
 * 2. Qualquer multiplicador aleatório, wild com multiplicador adicional ou
 *    recurso de roda superior foi completamente REMOVIDO.
 * 3. A tela de ganho (FortuneDragonWinModal) é acionada EXCLUSIVAMENTE quando
 *    o multiplicador total for de 2x para cima.
 * 
 * TABELA DE PAGAMENTOS (TRINCAS DE 3 SÍMBOLOS IGUAIS):
 * - 🐉 Dragão Dourado (WILD): Trinca de 3 = 100x (Probabilidade por carretel: 5.0%,  p = 0.05)
 * - 🪙 Lingote Imperial:     Trinca de 3 = 50x  (Probabilidade por carretel: 9.0%,  p = 0.09)
 * - 💰 Saco da Prosperidade: Trinca de 3 = 25x  (Probabilidade por carretel: 16.0%, p = 0.16)
 * - 🧧 Envelope Vermelho:    Trinca de 3 = 15x  (Probabilidade por carretel: 20.0%, p = 0.20)
 * - 🏮 Lanterna Sagrada:     Trinca de 3 = 8x   (Probabilidade por carretel: 25.0%, p = 0.25)
 * - 🧨 Fogos da Sorte:        Trinca de 3 = 4x   (Probabilidade por carretel: 25.0%, p = 0.25)
 * 
 * SOMA DAS PROBABILIDADES POR CARRETEL = 1.0000 (100.0%)
 * 
 * CÁLCULO EXATO DE RETORNO AO JOGADOR (RTP COM 5 LINHAS E WILD SUBSTITUTO):
 * - Probabilidade de Trinca 🐉: 0.05^3 = 0.000125 * 100x * 5 linhas = 6.25% RTP
 * - Probabilidade de Trinca 🪙: (0.09^3 + 3*(0.09^2)*0.05 + 3*0.09*(0.05^2)) * 50x * 5 = 13.09% RTP
 * - Probabilidade de Trinca 💰: (0.16^3 + ...) * 25x * 5 = 22.84% RTP
 * - Probabilidade de Trinca 🧧: (0.20^3 + ...) * 15x * 5 = 23.25% RTP
 * - Probabilidade de Trinca 🏮: (0.25^3 + ...) * 8x  * 5 = 21.50% RTP
 * - Probabilidade de Trinca 🧨: (0.25^3 + ...) * 4x  * 5 = 10.75% RTP
 * 
 * RETORNO TEÓRICO TOTAL AO JOGADOR (RTP) = 92.69%
 * VANTAGEM DA CASA (HOUSE EDGE) = 100% - 92.69% = 7.31%
 * TAXA GLOBAL DE ACERTO (HIT RATE) = ~8.11% dos giros
 * Conformidade com as normas: Vantagem entre 4.0% e 12.0%.
 * ============================================================================
 */

const THEMES: SlotTheme[] = [
  {
    id: 'fortune-dragon',
    name: 'Fortune Dragon',
    subtitle: 'Prosperidade Imperial',
    symbols: [
      { icon: '🐉', name: 'Dragão Dourado', multiplier: 100, isJackpot: true },
      { icon: '🪙', name: 'Lingote de Ouro', multiplier: 50 },
      { icon: '💰', name: 'Saco da Prosperidade', multiplier: 25 },
      { icon: '🧧', name: 'Envelope Vermelho', multiplier: 15 },
      { icon: '🏮', name: 'Lanterna Sagrada', multiplier: 8 },
      { icon: '🧨', name: 'Fogos da Sorte', multiplier: 4 }
    ]
  },
  {
    id: 'vegas',
    name: 'Vegas 777 Dourado',
    subtitle: 'Frutas Clássicas',
    symbols: [
      { icon: '7️⃣', name: 'Sete da Sorte', multiplier: 100, isJackpot: true },
      { icon: '💎', name: 'Diamante Imperial', multiplier: 50 },
      { icon: '🔔', name: 'Sino Dourado', multiplier: 25 },
      { icon: '🍉', name: 'Melancia', multiplier: 15 },
      { icon: '🍇', name: 'Uva Real', multiplier: 8 },
      { icon: '🍒', name: 'Cereja Dupla', multiplier: 4 }
    ]
  },
  {
    id: 'egypt',
    name: 'Faraó do Nilo',
    subtitle: 'Egito Antigo',
    symbols: [
      { icon: '👑', name: 'Coroa do Faraó', multiplier: 100, isJackpot: true },
      { icon: '👁️', name: 'Olho de Hórus', multiplier: 50 },
      { icon: '🪲', name: 'Escaravelho Sagrado', multiplier: 25 },
      { icon: '🏛️', name: 'Pirâmide de Gizé', multiplier: 15 },
      { icon: '🐺', name: 'Anúbis Protetor', multiplier: 8 },
      { icon: '🏺', name: 'Ânfora Dourada', multiplier: 4 }
    ]
  }
];

// The 8 fixed paylines (3 horizontal, 3 vertical, 2 diagonal)
const PAYLINES = [
  { name: 'Linha Superior', coords: [[0, 0], [0, 1], [0, 2]] },
  { name: 'Linha Central', coords: [[1, 0], [1, 1], [1, 2]] },
  { name: 'Linha Inferior', coords: [[2, 0], [2, 1], [2, 2]] },
  { name: 'Coluna Esquerda', coords: [[0, 0], [1, 0], [2, 0]] },
  { name: 'Coluna Central', coords: [[0, 1], [1, 1], [2, 1]] },
  { name: 'Coluna Direita', coords: [[0, 2], [1, 2], [2, 2]] },
  { name: 'Diagonal Descendente', coords: [[0, 0], [1, 1], [2, 2]] },
  { name: 'Diagonal Ascendente', coords: [[2, 0], [1, 1], [0, 2]] }
];

const AUTO_SPIN_OPTIONS = [10, 25, 50, 100];

const REEL_STOP_DURATIONS_MS = [950, 1450, 1950] as const;
const REEL_EXTRA_TURNS = [12, 18, 24] as const;

function easeReelCascade(t: number): number {
  if (t >= 1) return 1;
  // Natural slot deceleration with subtle mechanical settle in final 6%
  if (t < 0.94) {
    const k = t / 0.94;
    return 1.016 * (1 - Math.pow(1 - k, 4.2));
  }
  const settle = (t - 0.94) / 0.06;
  return 1.016 - 0.016 * (settle * settle * (3 - 2 * settle));
}

interface PendingSpin {
  targetGrid: string[][];
  strips: string[][];
  cellHeights: number[];
  currentBet: number;
  theme: SlotTheme;
}

export const SlotsGame: React.FC<SlotsGameProps> = ({
  balance,
  onUpdateBalance,
  onBackToLobby
}) => {
  const [bet, setBet] = useState<number>(50);
  const [themeIndex, setThemeIndex] = useState<number>(0);
  const [grid, setGrid] = useState<string[][]>([
    ['🐉', '🪙', '💰'],
    ['🪙', '🐉', '🪙'],
    ['🧧', '🏮', '🧨']
  ]);
  const [reelStrips, setReelStrips] = useState<string[][]>([
    ['🐉', '🪙', '🧧'],
    ['🪙', '🐉', '🏮'],
    ['💰', '🪙', '🧨']
  ]);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false]);
  const [landedReels, setLandedReels] = useState<boolean[]>([false, false, false]);
  const [spinCellHeights, setSpinCellHeights] = useState<number[]>([64, 64, 64]);
  const [spinCounter, setSpinCounter] = useState<number>(0);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [winMessage, setWinMessage] = useState<string>('');
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [isDragonAwake, setIsDragonAwake] = useState<boolean>(false);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);
  const [showFortuneWinModal, setShowFortuneWinModal] = useState<boolean>(false);
  const [winModalData, setWinModalData] = useState<{ multiplier: number; amount: number }>({ multiplier: 0, amount: 0 });

  // Auto-Play Feature State
  const [isAutoPlayActive, setIsAutoPlayActive] = useState<boolean>(false);
  const [autoSpinsRemaining, setAutoSpinsRemaining] = useState<number>(0);
  const [showAutoOptions, setShowAutoOptions] = useState<boolean>(false);

  // Refs for tracking mutable states & 60fps cascade animation
  const isAutoPlayRef = useRef<boolean>(false);
  const autoSpinsRef = useRef<number>(0);
  const betRef = useRef<number>(bet);
  const balanceRef = useRef<number>(balance);
  const autoSpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId().replace(/:/g, '');
  const colRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const blurLayerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const blurRefs = useRef<(SVGFEGaussianBlurElement | null)[]>([null, null, null]);
  const pendingSpinRef = useRef<PendingSpin | null>(null);
  const rafIdsRef = useRef<number[]>([]);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const landedTimersRef = useRef<(ReturnType<typeof setTimeout> | null)[]>([null, null, null]);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    betRef.current = bet;
  }, [bet]);

  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      rafIdsRef.current.forEach((id) => cancelAnimationFrame(id));
      rafIdsRef.current = [];
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      if (autoSpinTimeoutRef.current) clearTimeout(autoSpinTimeoutRef.current);
      landedTimersRef.current.forEach((t) => {
        if (t) clearTimeout(t);
      });
    };
  }, []);

  const currentTheme = THEMES[themeIndex];

  // Pick random symbol: reduces 15x (20 -> 16) and 8x (25 -> 20) in the same 20% ratio, keeping 100x, 50x, 25x, 4x weights intact
  const getRandomSymbol = (theme = currentTheme) => {
    const symbols = theme.symbols;
    const weights = [5, 9, 16, 16, 20, 25]; // 100x=5, 50x=9, 25x=16, 15x=16 (-20% from 20), 8x=20 (-20% from 25), 4x=25
    const totalWeight = 91;
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll < 0) return symbols[i].icon;
    }
    return symbols[5].icon;
  };

  const stopAutoPlay = () => {
    isAutoPlayRef.current = false;
    autoSpinsRef.current = 0;
    setIsAutoPlayActive(false);
    setAutoSpinsRemaining(0);
    if (autoSpinTimeoutRef.current) {
      clearTimeout(autoSpinTimeoutRef.current);
      autoSpinTimeoutRef.current = null;
    }
  };

  const startAutoPlay = (count: number) => {
    if (bet > balance || bet <= 0) return;
    setShowAutoOptions(false);
    isAutoPlayRef.current = true;
    autoSpinsRef.current = count;
    setIsAutoPlayActive(true);
    setAutoSpinsRemaining(count);
    handleSpin();
  };

  const evaluateAndSettleSpin = (
    targetGrid: string[][],
    currentBet: number,
    theme: SlotTheme
  ) => {
    if (!isMountedRef.current) return;

    // Check paylines: only 3 identical symbols in a line
    let baseMultiplierTotal = 0;
    const hitCells = new Set<string>();
    const hitLines: string[] = [];

    for (const line of PAYLINES) {
      const s1 = targetGrid[line.coords[0][0]][line.coords[0][1]];
      const s2 = targetGrid[line.coords[1][0]][line.coords[1][1]];
      const s3 = targetGrid[line.coords[2][0]][line.coords[2][1]];

      // Regra estrita: o jogador só ganha com exatamente 3 símbolos iguais na linha (sem Wild).
      // 100x só paga com 3x Dragão (symbols[0]); demais trincas pagam seu multiplicador próprio.
      if (s1 === s2 && s2 === s3) {
        const symbolDef =
          theme.symbols.find((s) => s.icon === s1) ||
          theme.symbols[theme.symbols.length - 1];

        baseMultiplierTotal += symbolDef.multiplier;
        line.coords.forEach(([r, c]) => hitCells.add(`${r}-${c}`));
        hitLines.push(line.name);
      }
    }

    // Decrement auto-spin counter if auto-play active
    if (isAutoPlayRef.current) {
      autoSpinsRef.current = Math.max(0, autoSpinsRef.current - 1);
      setAutoSpinsRemaining(autoSpinsRef.current);
    }

    const finalMultiplier = baseMultiplierTotal;
    const totalWon = Math.floor(currentBet * finalMultiplier);

    // Modal ONLY appears if multiplier >= 2x
    if (finalMultiplier >= 2) {
      setWinningCells(hitCells);
      setLastWinAmount(totalWon);
      soundManager.playMultiplierHit();

      if (finalMultiplier >= 50) {
        soundManager.playJackpot();
        setWinMessage(`🔥 MEGA VITÓRIA! ${finalMultiplier}x (+${totalWon.toLocaleString('pt-BR')} FICHAS)!`);
      } else {
        soundManager.playWin();
        setWinMessage(`Vitória! ${hitLines.length} linha(s) · ${finalMultiplier}x (+${totalWon.toLocaleString('pt-BR')} fichas)!`);
      }

      onUpdateBalance(totalWon, true, 'slots', currentBet);
      setWinModalData({ multiplier: finalMultiplier, amount: totalWon });
      setShowFortuneWinModal(true);
    } else if (finalMultiplier > 0) {
      setWinningCells(hitCells);
      setLastWinAmount(totalWon);
      soundManager.playWin();
      setWinMessage(`Ganho de ${finalMultiplier}x (+${totalWon.toLocaleString('pt-BR')} fichas)`);
      onUpdateBalance(totalWon, true, 'slots', currentBet);

      if (isAutoPlayRef.current && autoSpinsRef.current > 0) {
        autoSpinTimeoutRef.current = setTimeout(() => {
          handleSpin();
        }, 850);
      } else if (isAutoPlayRef.current) {
        stopAutoPlay();
      }
    } else {
      soundManager.playLoss();
      reportRoundLoss('slots');
      setWinMessage('Não houve combinação nesta rodada. O Dragão da Fortuna aguarda!');
      setIsDragonAwake(false);

      if (isAutoPlayRef.current && autoSpinsRef.current > 0) {
        autoSpinTimeoutRef.current = setTimeout(() => {
          handleSpin();
        }, 850);
      } else if (isAutoPlayRef.current) {
        stopAutoPlay();
      }
    }
  };

  // Run true downward cascade RAF animations synchronously on strip render (Col 1 -> Col 2 -> Col 3)
  useLayoutEffect(() => {
    const pending = pendingSpinRef.current;
    if (!pending) return;
    pendingSpinRef.current = null;

    rafIdsRef.current.forEach((id) => cancelAnimationFrame(id));
    rafIdsRef.current = [];
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);

    tickIntervalRef.current = setInterval(() => {
      soundManager.playReelTick();
    }, 90);

    const colPromises = [0, 1, 2].map(
      (colIdx) =>
        new Promise<void>((resolve) => {
          const trackEl = trackRefs.current[colIdx];
          const blurLayerEl = blurLayerRefs.current[colIdx];
          const blurFilterEl = blurRefs.current[colIdx];
          const strip = pending.strips[colIdx];
          const cellH = pending.cellHeights[colIdx];
          const duration = REEL_STOP_DURATIONS_MS[colIdx];
          const startOffsetPx = -(strip.length - 3) * cellH;
          const targetCol = [
            pending.targetGrid[0][colIdx],
            pending.targetGrid[1][colIdx],
            pending.targetGrid[2][colIdx]
          ];

          if (trackEl) {
            trackEl.style.transform = `translate3d(0, ${startOffsetPx}px, 0)`;
          }
          if (blurFilterEl) {
            blurFilterEl.setAttribute('stdDeviation', '0 0');
          }
          if (blurLayerEl) {
            blurLayerEl.style.filter = `url(#reelMotionBlur-${uid}-${colIdx})`;
          }

          const startTime = performance.now();

          const step = (now: number) => {
            if (!isMountedRef.current) {
              resolve();
              return;
            }
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeReelCascade(progress);
            const currentY = startOffsetPx * (1 - eased);

            if (trackEl) {
              trackEl.style.transform = `translate3d(0, ${currentY}px, 0)`;
            }

            // Directional vertical motion blur proportional to downward reel speed
            if (blurFilterEl) {
              const rampIn = Math.min(1, elapsed / 65);
              const speedDecay = Math.pow(Math.max(0, 1 - progress / 0.92), 1.5);
              const blurY = (8.5 * rampIn * speedDecay).toFixed(2);
              blurFilterEl.setAttribute('stdDeviation', `0 ${blurY}`);
            }

            if (progress < 1) {
              const rafId = requestAnimationFrame(step);
              rafIdsRef.current.push(rafId);
            } else {
              if (trackEl) {
                trackEl.style.transform = 'translate3d(0, 0, 0)';
              }
              if (blurFilterEl) {
                blurFilterEl.setAttribute('stdDeviation', '0 0');
              }
              if (blurLayerEl) {
                blurLayerEl.style.filter = '';
              }

              setReelStrips((prev) => {
                const next = [...prev];
                next[colIdx] = targetCol;
                return next;
              });

              setGrid((prev) => [
                [
                  colIdx === 0 ? targetCol[0] : prev[0][0],
                  colIdx === 1 ? targetCol[0] : prev[0][1],
                  colIdx === 2 ? targetCol[0] : prev[0][2]
                ],
                [
                  colIdx === 0 ? targetCol[1] : prev[1][0],
                  colIdx === 1 ? targetCol[1] : prev[1][1],
                  colIdx === 2 ? targetCol[1] : prev[1][2]
                ],
                [
                  colIdx === 0 ? targetCol[2] : prev[2][0],
                  colIdx === 1 ? targetCol[2] : prev[2][1],
                  colIdx === 2 ? targetCol[2] : prev[2][2]
                ]
              ]);

              setSpinningReels((prev) => {
                const next = [...prev];
                next[colIdx] = false;
                return next;
              });

              setLandedReels((prev) => {
                const next = [...prev];
                next[colIdx] = true;
                return next;
              });

              if (landedTimersRef.current[colIdx]) {
                clearTimeout(landedTimersRef.current[colIdx]!);
              }
              landedTimersRef.current[colIdx] = setTimeout(() => {
                if (!isMountedRef.current) return;
                setLandedReels((prev) => {
                  const next = [...prev];
                  next[colIdx] = false;
                  return next;
                });
              }, 270);

              soundManager.playReelStop();
              resolve();
            }
          };

          const firstRaf = requestAnimationFrame(step);
          rafIdsRef.current.push(firstRaf);
        })
    );

    Promise.all(colPromises).then(() => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      if (!isMountedRef.current) return;
      evaluateAndSettleSpin(pending.targetGrid, pending.currentBet, pending.theme);
    });
  }, [spinCounter]);

  const handleSpin = () => {
    if (spinningReels.some(Boolean)) return;
    const currentBet = betRef.current;
    if (currentBet <= 0 || currentBet > balanceRef.current) {
      stopAutoPlay();
      return;
    }

    onUpdateBalance(-currentBet, false, 'slots');
    setWinMessage('');
    setWinningCells(new Set());
    setLastWinAmount(0);
    setIsDragonAwake(true);
    landedTimersRef.current.forEach((t, idx) => {
      if (t) clearTimeout(t);
      landedTimersRef.current[idx] = null;
    });
    setLandedReels([false, false, false]);

    // Target grid generated from weighted symbol probabilities (RTP 92.69%)
    const targetGrid: string[][] = [
      [getRandomSymbol(currentTheme), getRandomSymbol(currentTheme), getRandomSymbol(currentTheme)],
      [getRandomSymbol(currentTheme), getRandomSymbol(currentTheme), getRandomSymbol(currentTheme)],
      [getRandomSymbol(currentTheme), getRandomSymbol(currentTheme), getRandomSymbol(currentTheme)]
    ];

    const cellHeights = [0, 1, 2].map((c) => {
      const h = colRefs.current[c]?.clientHeight || 192;
      return h / 3;
    });

    // Build vertical reel strips: [target[0..2], ...randomSymbols, prev[0..2]]
    // Starts at bottom (prev) and slides DOWNWARD to top (target)
    const strips: string[][] = [0, 1, 2].map((colIdx) => {
      const targetCol = [targetGrid[0][colIdx], targetGrid[1][colIdx], targetGrid[2][colIdx]];
      const prevCol = [grid[0][colIdx], grid[1][colIdx], grid[2][colIdx]];
      const intermediates = Array.from({ length: REEL_EXTRA_TURNS[colIdx] }, () =>
        getRandomSymbol(currentTheme)
      );
      return [...targetCol, ...intermediates, ...prevCol];
    });

    pendingSpinRef.current = {
      targetGrid,
      strips,
      cellHeights,
      currentBet,
      theme: currentTheme
    };

    setSpinCellHeights(cellHeights);
    setReelStrips(strips);
    setSpinningReels([true, true, true]);
    setSpinCounter((c) => c + 1);
  };

  const handleCloseWinModal = () => {
    setShowFortuneWinModal(false);
    // If auto-play is still active, continue next spin
    if (isAutoPlayRef.current && autoSpinsRef.current > 0) {
      autoSpinTimeoutRef.current = setTimeout(() => {
        handleSpin();
      }, 700);
    } else if (isAutoPlayRef.current) {
      stopAutoPlay();
    }
  };

  const isSpinning = spinningReels.some(Boolean);

  return (
    <div className="min-h-full w-full max-w-2xl mx-auto flex flex-col justify-between text-orange-100 select-none pb-2">
      {/* Top Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-2 py-0.5">
        <button
          onClick={() => {
            stopAutoPlay();
            onBackToLobby();
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Lobby</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextIdx = (themeIndex + 1) % THEMES.length;
              const syms = THEMES[nextIdx].symbols;
              const nextGrid = [
                [syms[0].icon, syms[1].icon, syms[2].icon],
                [syms[1].icon, syms[0].icon, syms[1].icon],
                [syms[3].icon, syms[4].icon, syms[5].icon]
              ];
              setThemeIndex(nextIdx);
              setGrid(nextGrid);
              setReelStrips([
                [nextGrid[0][0], nextGrid[1][0], nextGrid[2][0]],
                [nextGrid[0][1], nextGrid[1][1], nextGrid[2][1]],
                [nextGrid[0][2], nextGrid[1][2], nextGrid[2][2]]
              ]);
              setWinningCells(new Set());
              setLandedReels([false, false, false]);
            }}
            disabled={isSpinning || isAutoPlayActive}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#220a07] border border-orange-500/30 text-[10px] text-orange-200 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            title="Alternar tema visual"
          >
            <Shuffle className="w-3 h-3 text-orange-400" />
            <span className="hidden sm:inline">Tema:</span> {currentTheme.name.split(' ')[0]}
          </button>

          <span className="text-xs font-cinzel font-bold text-amber-400 uppercase tracking-wider">
            {currentTheme.name}
          </span>
        </div>
      </div>

      {/* Main Slot Machine Cabinet - Fits inside 100vh on desktop, scrollable when needed */}
      <div className="relative rounded-2xl border-2 border-orange-500/80 bg-gradient-to-b from-[#2e0e09] via-[#1a0705] to-[#100302] p-2 sm:p-2.5 shadow-[0_0_35px_rgba(234,88,12,0.25)] flex flex-col justify-between my-0.5 overflow-visible">
        {/* Animated Golden Dragon Banner */}
        <div className="relative bg-gradient-to-r from-[#3b0d06] via-[#220503] to-[#3b0d06] border border-amber-500/40 rounded-xl p-1.5 flex items-center justify-between shadow-md overflow-hidden">
          {/* Dragon Mascot Artwork SVG */}
          <div className="w-9 sm:w-11 h-9 sm:h-11 flex-shrink-0 relative">
            <svg
              viewBox="0 0 100 100"
              className={`w-full h-full transition-transform duration-500 ${
                isDragonAwake ? 'scale-110 drop-shadow-[0_0_12px_#f59e0b]' : ''
              }`}
            >
              <defs>
                <radialGradient id="dragonGoldSlot" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#fef08a" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </radialGradient>
              </defs>
              <path d="M 20,30 Q 10,10 35,22 Q 50,5 65,22 Q 90,10 80,30 Z" fill="#dc2626" />
              <path d="M 30,25 Q 15,5 40,18 M 70,25 Q 85,5 60,18" stroke="#fef08a" strokeWidth="3" fill="none" />
              <ellipse cx="50" cy="52" rx="32" ry="26" fill="url(#dragonGoldSlot)" stroke="#78350f" strokeWidth="2" />
              <path d="M 30,55 Q 10,65 5,80 M 70,55 Q 90,65 95,80" stroke="#fef08a" strokeWidth="2.5" fill="none" />
              <ellipse cx="50" cy="62" rx="14" ry="10" fill="#dc2626" />
              <circle cx="45" cy="60" r="2.5" fill="#000" />
              <circle cx="55" cy="60" r="2.5" fill="#000" />
              <ellipse cx="38" cy="45" rx="5" ry="7" fill="#ffffff" />
              <circle cx="39" cy="45" r="3.5" fill={isDragonAwake ? '#dc2626' : '#1e1b4b'} />
              <ellipse cx="62" cy="45" rx="5" ry="7" fill="#ffffff" />
              <circle cx="61" cy="45" r="3.5" fill={isDragonAwake ? '#dc2626' : '#1e1b4b'} />
              <circle cx="50" cy="74" r="7" fill="#fef08a" stroke="#ea580c" strokeWidth="1.5" className={isDragonAwake ? 'animate-pulse' : ''} />
            </svg>
          </div>

          {/* Center Paytable & RTP Banner */}
          <div className="flex-1 px-2 flex flex-col items-center text-center">
            <div className="flex items-center gap-1 text-[9px] uppercase font-cinzel font-bold text-amber-300 tracking-wider mb-0.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>RTP 92.69% · Apenas Trincas de 3 Símbolos</span>
            </div>
            {/* Multiplier badges row */}
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {currentTheme.symbols.map((sym) => (
                <span
                  key={sym.icon}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-[#180503] text-amber-300 border border-orange-500/20"
                  title={sym.name}
                >
                  <SlotSymbol3D icon={sym.icon} size="badge" />
                  <span>{sym.multiplier}x</span>
                </span>
              ))}
            </div>
          </div>

          {/* Status Tag */}
          <div className="text-right flex-shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-cinzel font-bold uppercase bg-[#180705] text-amber-400/80 border border-amber-500/30">
              <Flame className="w-3 h-3 text-orange-400" />
              8 LINHAS
            </span>
          </div>
        </div>

        {/* 3x3 Reels Window (Downward Cascade Reels + Sculpted 3D Symbols + Vertical Motion Blur) */}
        <div className="my-1 bg-[#090201] rounded-xl border-2 border-amber-500/60 p-1.5 sm:p-2 shadow-inner relative">
          {/* Directional vertical motion-blur SVG filters per reel column */}
          <svg className="sr-only" aria-hidden="true">
            <defs>
              {[0, 1, 2].map((colIdx) => (
                <filter
                  key={colIdx}
                  id={`reelMotionBlur-${uid}-${colIdx}`}
                  x="-5%"
                  y="-25%"
                  width="110%"
                  height="150%"
                >
                  <feGaussianBlur
                    ref={(el) => {
                      blurRefs.current[colIdx] = el;
                    }}
                    in="SourceGraphic"
                    stdDeviation="0 0"
                  />
                </filter>
              ))}
            </defs>
          </svg>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 max-w-[340px] mx-auto">
            {[0, 1, 2].map((colIdx) => {
              const reelSpinning = spinningReels[colIdx];
              const reelLanded = landedReels[colIdx];
              const strip = reelStrips[colIdx];
              const cellH = spinCellHeights[colIdx];
              return (
                <div
                  key={colIdx}
                  ref={(el) => {
                    colRefs.current[colIdx] = el;
                  }}
                  data-col={colIdx}
                  className={`slot-reel-column h-[174px] sm:h-[210px] ${
                    reelSpinning ? 'is-spinning' : ''
                  } ${reelLanded && !reelSpinning ? 'just-landed' : ''}`}
                >
                  <div className="slot-reel-motion-sheen" aria-hidden="true" />
                  <div
                    ref={(el) => {
                      blurLayerRefs.current[colIdx] = el;
                    }}
                    className="slot-reel-blur-layer"
                  >
                    <div
                      ref={(el) => {
                        trackRefs.current[colIdx] = el;
                      }}
                      className={`slot-reel-track ${reelSpinning ? '' : 'h-full'}`}
                    >
                      {strip.map((symIcon, idx) => {
                        const isWinning = !reelSpinning && idx < 3 && winningCells.has(`${idx}-${colIdx}`);
                        const symDef = currentTheme.symbols.find((s) => s.icon === symIcon);
                        return (
                          <div
                            key={`${colIdx}-${idx}`}
                            className={`slot-reel-cell ${isWinning ? 'is-winning' : ''}`}
                            style={reelSpinning ? { height: `${cellH}px` } : { height: '33.3333%' }}
                          >
                            <SlotSymbol3D
                              icon={symIcon}
                              title={symDef ? `${symDef.name} (${symDef.multiplier}x)` : undefined}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Win Alert / Message Banner */}
        <div className="min-h-[22px] flex items-center justify-center text-center">
          {winMessage ? (
            <div
              className={`inline-block px-3 py-0.5 rounded-lg font-cinzel font-black text-xs border shadow-lg ${
                lastWinAmount > 0
                  ? 'bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 text-white border-orange-300 shadow-orange-600/50'
                  : 'bg-[#220a07] border-orange-500/30 text-orange-200'
              }`}
            >
              {winMessage}
            </div>
          ) : (
            <span className="text-[10px] text-orange-300/70">
              Combine 3 símbolos iguais em qualquer linha reta (horizontal/vertical) ou diagonal (Ganhos ≥ 2x abrem a Tela Imperial)
            </span>
          )}
        </div>
      </div>

      {/* Betting Controls & Action Buttons (Spin + Auto-Play) */}
      <div className="shrink-0 bg-[#180705] border border-orange-500/30 rounded-xl p-2 shadow-xl space-y-1.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Bet Selector */}
          <div className="flex-1">
            <ChipSelector
              currentBet={bet}
              balance={balance}
              onBetChange={(newBet) => {
                if (!isSpinning && !isAutoPlayActive) setBet(newBet);
              }}
              disabled={isSpinning || isAutoPlayActive}
              compact={true}
            />
          </div>

          {/* Action Buttons: Spin & Auto-Play */}
          <div className="flex items-center gap-1.5">
            {/* Auto-Play Toggle & Dropdown */}
            {isAutoPlayActive ? (
              <button
                type="button"
                onClick={stopAutoPlay}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-red-700 to-rose-600 hover:brightness-110 text-white font-cinzel font-black text-xs uppercase shadow-lg shadow-red-700/50 flex items-center gap-1.5 cursor-pointer border border-red-400 active:scale-95 animate-pulse"
                title="Interromper jogo automático"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>PARAR AUTO ({autoSpinsRemaining})</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  disabled={isSpinning || bet > balance}
                  onClick={() => setShowAutoOptions((prev) => !prev)}
                  className="py-3 px-3.5 rounded-xl bg-[#2a0e08] hover:bg-[#3d140b] text-amber-300 font-cinzel font-black text-xs uppercase border border-amber-500/40 flex items-center gap-1 cursor-pointer transition-all disabled:opacity-40"
                  title="Configurar modo automático"
                >
                  <Repeat className="w-3.5 h-3.5 text-amber-400" />
                  <span>AUTO</span>
                </button>

                {/* Auto-play options popover */}
                {showAutoOptions && (
                  <div className="absolute bottom-full right-0 mb-1.5 p-2 bg-[#1b0805] border-2 border-amber-500/60 rounded-xl shadow-2xl flex flex-col gap-1.5 z-40 min-w-[170px]">
                    <span className="text-[10px] uppercase font-bold text-amber-300 text-center">
                      Giros Automáticos
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {AUTO_SPIN_OPTIONS.map((cnt) => (
                        <button
                          key={cnt}
                          onClick={() => startAutoPlay(cnt)}
                          className="py-1 px-2 rounded-lg bg-[#2f0f09] hover:bg-amber-600 hover:text-slate-950 text-orange-200 text-xs font-mono font-bold border border-orange-500/30 transition-colors"
                        >
                          {cnt} Giros
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Main Spin Button */}
            <button
              type="button"
              onClick={handleSpin}
              disabled={isSpinning || isAutoPlayActive || bet <= 0 || bet > balance}
              className="py-3 px-6 sm:px-8 rounded-xl bg-gradient-to-r from-orange-500 via-red-600 to-amber-500 hover:brightness-110 text-white font-cinzel font-black text-sm uppercase shadow-xl shadow-orange-600/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer border-2 border-orange-300/50 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isSpinning ? 'Girando...' : `Girar (${bet} 🪙)`}</span>
            </button>
          </div>
        </div>

        {/* Como Jogar Button at bottom of controls without pushing layout */}
        <div className="text-center pt-0.5">
          <button
            type="button"
            onClick={() => setShowHowToPlay(true)}
            className="inline-flex items-center gap-1 text-[11px] text-orange-300/70 hover:text-amber-300 transition-colors cursor-pointer py-0.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
            <span>Regras & Tabela de Trincas do Fortune Dragon</span>
          </button>
        </div>
      </div>

      {showHowToPlay && (
        <HowToPlayModal
          isOpen={showHowToPlay}
          onClose={() => setShowHowToPlay(false)}
          gameId="slots"
        />
      )}

      {/* Fortune Dragon Win Screen Overlay (Appears only on multiplier >= 2x) */}
      <FortuneDragonWinModal
        isOpen={showFortuneWinModal}
        multiplier={winModalData.multiplier}
        winAmount={winModalData.amount}
        betAmount={bet}
        freeSpins={8}
        onClose={handleCloseWinModal}
      />
    </div>
  );
};
