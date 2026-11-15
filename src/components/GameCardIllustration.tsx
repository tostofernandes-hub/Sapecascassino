import React, { useEffect, useState } from 'react';
import { GameId } from '../types/casino';

type ImageLoader = () => Promise<{ default: string }>;

const GAME_IMAGE_LOADERS: Record<string, ImageLoader | undefined> = {
  slots: () => import('../assets/images/game_slots_dragon_1794067557791.jpg'),
  blackjack: () => import('../assets/images/game_blackjack_royale_1794067574709.jpg'),
  roulette: () => import('../assets/images/game_roulette_crimson_1794067589579.jpg'),
  'texas-holdem': () => import('../assets/images/game_poker_holdem_1794067605149.jpg'),
  baccarat: () => import('../assets/images/game_baccarat_dragon_1794067619580.jpg'),
  limbo: () => import('../assets/images/game_aviao_crash_1794068832280.jpg'),
  'video-poker': () => import('../assets/images/game_videopoker_vip_1794067649198.jpg'),
  lottery: () => import('../assets/images/game_lottery_mega_1794067676859.jpg'),
  craps: () => import('../assets/images/game_craps_vegas_1794185381299.jpg'),
  'roulette-american': () => import('../assets/images/game_roulette_american_1794185381776.jpg'),
  scratch: () => import('../assets/images/game_scratch_gold_1794185394120.jpg'),
  coinflip: () => import('../assets/images/game_coinflip_lion_1794185394498.jpg'),
  sicbo: () => import('../assets/images/game_sicbo_dynasty_1794185395582.jpg'),
  miner: () => import('../assets/images/game_miner_diamond_1794185368545.jpg'),
  plinko: () => import('../assets/images/game_plinko_peneira_1794185368705.jpg'),
  'liars-bar': () => import('../assets/images/game_liarsbar_blefe_1794185368575.jpg'),
  'classic-slots': () => import('../assets/images/classic_slots_card_1794627048548.jpg'),
  'horse-race': () => import('../assets/images/horse_race_card_1794627048493.jpg'),
  archery: () => import('../assets/images/archery_sapeca_card_1794685484126.jpg'),
  'dragon-egg': () => import('../assets/images/dragon_egg_card_1794685484749.jpg'),
};

const resolvedImageCache: Record<string, string> = {};

interface GameCardIllustrationProps {
  gameId: GameId;
  image?: string;
  loadImage?: ImageLoader;
  priority?: boolean;
  className?: string;
  badge?: string;
}

export const GameCardIllustration: React.FC<GameCardIllustrationProps> = ({
  gameId,
  image,
  loadImage,
  priority = false,
  className = '',
  badge
}) => {
  const [imgError, setImgError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(
    () => image || resolvedImageCache[gameId]
  );

  const loader = loadImage || GAME_IMAGE_LOADERS[gameId];

  useEffect(() => {
    setImgError(false);

    if (image) {
      setResolvedSrc(image);
      return;
    }

    if (resolvedImageCache[gameId]) {
      setResolvedSrc(resolvedImageCache[gameId]);
      return;
    }

    if (!loader) {
      setResolvedSrc(undefined);
      return;
    }

    let cancelled = false;
    loader()
      .then((mod) => {
        if (!cancelled && mod?.default) {
          resolvedImageCache[gameId] = mod.default;
          setResolvedSrc(mod.default);
        }
      })
      .catch(() => {
        if (!cancelled) setImgError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [image, loader, gameId]);

  const imgSrc = resolvedSrc;
  const isPendingDynamicImage = Boolean(loader && !image && !resolvedSrc && !imgError);

  // Render SVG illustration for the 6 new games and any fallback
  const renderCustomIllustration = () => {
    switch (gameId) {
      case 'craps':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <linearGradient id="crapsFelt" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0d3822" />
                <stop offset="50%" stopColor="#14532d" />
                <stop offset="100%" stopColor="#052e16" />
              </linearGradient>
              <linearGradient id="diceRed1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#991b1b" />
              </linearGradient>
              <linearGradient id="woodRail" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3d1408" />
                <stop offset="50%" stopColor="#5c1d0c" />
                <stop offset="100%" stopColor="#2b0a03" />
              </linearGradient>
            </defs>
            {/* Table background */}
            <rect width="320" height="180" fill="url(#crapsFelt)" />
            {/* Wooden Table Rail */}
            <rect x="0" y="0" width="320" height="20" fill="url(#woodRail)" />
            <rect x="0" y="165" width="320" height="15" fill="url(#woodRail)" />
            {/* Table Betting Grid Lines */}
            <path d="M 20,40 L 300,40 M 20,80 L 300,80 M 20,120 L 300,120" stroke="#fef08a" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="4 4" />
            <path d="M 70,30 L 70,150 M 160,30 L 160,150 M 250,30 L 250,150" stroke="#fef08a" strokeWidth="1" strokeOpacity="0.4" />
            <text x="45" y="65" fill="#fef08a" fontSize="11" fontWeight="bold" opacity="0.6">PASS LINE</text>
            <text x="180" y="65" fill="#fef08a" fontSize="11" fontWeight="bold" opacity="0.6">FIELD 2·3·4·9·10·11·12</text>
            
            {/* 3D Dice 1 (Front/Top) */}
            <g transform="translate(100, 75) rotate(-15)">
              <rect x="-24" y="-24" width="48" height="48" rx="8" fill="url(#diceRed1)" stroke="#fca5a5" strokeWidth="1.5" filter="drop-shadow(0 8px 12px rgba(0,0,0,0.6))" />
              {/* Pip dots (Face 5) */}
              <circle cx="-12" cy="-12" r="3.5" fill="#ffffff" />
              <circle cx="12" cy="-12" r="3.5" fill="#ffffff" />
              <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
              <circle cx="-12" cy="12" r="3.5" fill="#ffffff" />
              <circle cx="12" cy="12" r="3.5" fill="#ffffff" />
            </g>

            {/* 3D Dice 2 (Front/Right) */}
            <g transform="translate(160, 95) rotate(22)">
              <rect x="-24" y="-24" width="48" height="48" rx="8" fill="url(#diceRed1)" stroke="#fca5a5" strokeWidth="1.5" filter="drop-shadow(0 10px 14px rgba(0,0,0,0.6))" />
              {/* Pip dots (Face 6) */}
              <circle cx="-12" cy="-14" r="3.5" fill="#ffffff" />
              <circle cx="12" cy="-14" r="3.5" fill="#ffffff" />
              <circle cx="-12" cy="0" r="3.5" fill="#ffffff" />
              <circle cx="12" cy="0" r="3.5" fill="#ffffff" />
              <circle cx="-12" cy="14" r="3.5" fill="#ffffff" />
              <circle cx="12" cy="14" r="3.5" fill="#ffffff" />
            </g>

            {/* Casino Chips Stacks */}
            <g transform="translate(260, 110)">
              <ellipse cx="0" cy="20" rx="20" ry="8" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
              <ellipse cx="0" cy="14" rx="20" ry="8" fill="#ea580c" stroke="#fed7aa" strokeWidth="1.5" />
              <ellipse cx="0" cy="8" rx="20" ry="8" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.5" />
              <ellipse cx="0" cy="2" rx="20" ry="8" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
            </g>
          </svg>
        );

      case 'scratch':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#451a03" />
                <stop offset="50%" stopColor="#78350f" />
                <stop offset="100%" stopColor="#290f02" />
              </linearGradient>
              <linearGradient id="foilGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="30%" stopColor="#f59e0b" />
                <stop offset="70%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <rect width="320" height="180" fill="url(#cardBg)" />
            {/* Scratch Ticket Outline */}
            <rect x="40" y="20" width="240" height="140" rx="14" fill="#1e0704" stroke="#f59e0b" strokeWidth="2" filter="drop-shadow(0 8px 16px rgba(0,0,0,0.7))" />
            {/* Ticket Header */}
            <text x="160" y="44" textAnchor="middle" fill="#fef08a" fontSize="13" fontWeight="900" fontFamily="serif" letterSpacing="1">
              RASPADINHA DA SORTE · 100X
            </text>
            {/* 3x3 Grid of Scratch Tiles */}
            {[0, 1, 2].map((r) =>
              [0, 1, 2].map((c) => {
                const isRevealed = (r === 1 && c === 1) || (r === 0 && c === 2);
                return (
                  <g key={`${r}-${c}`} transform={`translate(${85 + c * 52}, ${60 + r * 32})`}>
                    <rect
                      x="0"
                      y="0"
                      width="44"
                      height="26"
                      rx="6"
                      fill={isRevealed ? '#2a0e08' : 'url(#foilGrad)'}
                      stroke={isRevealed ? '#fbbf24' : '#fef08a'}
                      strokeWidth="1.2"
                    />
                    {isRevealed ? (
                      <text x="22" y="18" textAnchor="middle" fontSize="16">
                        {r === 1 ? '👑' : '💎'}
                      </text>
                    ) : (
                      <text x="22" y="17" textAnchor="middle" fill="#78350f" fontSize="10" fontWeight="900">
                        ✦ RASPE ✦
                      </text>
                    )}
                  </g>
                );
              })
            )}
            {/* Coin Scraper Tool */}
            <g transform="translate(235, 125) rotate(35)">
              <circle cx="0" cy="0" r="14" fill="#fbbf24" stroke="#fef08a" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.6))" />
              <text x="0" y="4" textAnchor="middle" fill="#78350f" fontSize="9" fontWeight="black">🪙</text>
            </g>
          </svg>
        );

      case 'roulette-american':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <radialGradient id="amWheel" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#450a0a" />
                <stop offset="40%" stopColor="#220505" />
                <stop offset="70%" stopColor="#0f0202" />
                <stop offset="100%" stopColor="#3d1408" />
              </radialGradient>
              <linearGradient id="woodTrim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5c1d0c" />
                <stop offset="100%" stopColor="#2b0a03" />
              </linearGradient>
            </defs>
            <rect width="320" height="180" fill="#120403" />
            {/* Wooden Rim */}
            <circle cx="160" cy="90" r="82" fill="url(#woodTrim)" stroke="#f59e0b" strokeWidth="2" />
            <circle cx="160" cy="90" r="74" fill="url(#amWheel)" />
            {/* American 0 and 00 Green Pockets Highlight */}
            <path d="M 160,90 L 160,18 A 72 72 0 0 1 174,20 Z" fill="#15803d" stroke="#fef08a" strokeWidth="0.8" />
            <path d="M 160,90 L 160,162 A 72 72 0 0 1 146,160 Z" fill="#15803d" stroke="#fef08a" strokeWidth="0.8" />
            <text x="167" y="32" fill="#fff" fontSize="8" fontWeight="bold">0</text>
            <text x="153" y="152" fill="#fff" fontSize="8" fontWeight="bold">00</text>
            
            {/* Frets Spokes */}
            {Array.from({ length: 18 }).map((_, i) => (
              <line
                key={i}
                x1="160"
                y1="90"
                x2={160 + 72 * Math.cos((i * 20 * Math.PI) / 180)}
                y2={90 + 72 * Math.sin((i * 20 * Math.PI) / 180)}
                stroke="#d97706"
                strokeWidth="0.8"
                opacity="0.7"
              />
            ))}
            {/* Center Turret Cone */}
            <circle cx="160" cy="90" r="28" fill="#f59e0b" stroke="#fef08a" strokeWidth="2" />
            <circle cx="160" cy="90" r="16" fill="#78350f" />
            <circle cx="160" cy="90" r="8" fill="#fef08a" />
            {/* Silver Ball */}
            <circle cx="185" cy="55" r="5" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))" />
          </svg>
        );

      case 'coinflip':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <radialGradient id="coinGrad" cx="40%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="45%" stopColor="#f59e0b" />
                <stop offset="85%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </radialGradient>
              <linearGradient id="bgSky" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1f0906" />
                <stop offset="50%" stopColor="#350f08" />
                <stop offset="100%" stopColor="#120403" />
              </linearGradient>
            </defs>
            <rect width="320" height="180" fill="url(#bgSky)" />
            {/* Dynamic Gold Particles & Speed Rings */}
            <circle cx="160" cy="90" r="68" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.4" />
            <circle cx="160" cy="90" r="54" fill="none" stroke="#fef08a" strokeWidth="1" opacity="0.3" />
            
            {/* Big 3D Coin Center */}
            <g transform="translate(160, 90)">
              {/* Coin Thickness Rim */}
              <ellipse cx="4" cy="5" rx="46" ry="46" fill="#78350f" />
              <ellipse cx="2" cy="3" rx="46" ry="46" fill="#b45309" />
              {/* Main Coin Face */}
              <circle cx="0" cy="0" r="45" fill="url(#coinGrad)" stroke="#fef08a" strokeWidth="2.5" filter="drop-shadow(0 10px 20px rgba(0,0,0,0.7))" />
              {/* Coin Engraving */}
              <circle cx="0" cy="0" r="38" fill="none" stroke="#fef08a" strokeWidth="1.2" strokeDasharray="3 2" />
              <text x="0" y="-8" textAnchor="middle" fill="#78350f" fontSize="24">👑</text>
              <text x="0" y="16" textAnchor="middle" fill="#78350f" fontSize="12" fontWeight="900" fontFamily="serif" letterSpacing="1">CARA</text>
              <text x="0" y="27" textAnchor="middle" fill="#92400e" fontSize="8" fontWeight="bold">50 / 50 JUSTO</text>
            </g>
          </svg>
        );

      case 'sicbo':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <radialGradient id="sicDome" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                <stop offset="60%" stopColor="rgba(254,240,138,0.15)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
              </radialGradient>
              <linearGradient id="lacquer" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7f1d1d" />
                <stop offset="50%" stopColor="#450a0a" />
                <stop offset="100%" stopColor="#1c0505" />
              </linearGradient>
            </defs>
            <rect width="320" height="180" fill="url(#lacquer)" />
            {/* Oriental Tray Rim */}
            <ellipse cx="160" cy="115" rx="90" ry="32" fill="#2d0a0a" stroke="#f59e0b" strokeWidth="2.5" />
            <ellipse cx="160" cy="112" rx="82" ry="26" fill="#180404" stroke="#fef08a" strokeWidth="1" />
            
            {/* Glass Shaker Dome */}
            <path
              d="M 100,110 C 100,45 220,45 220,110 Z"
              fill="url(#sicDome)"
              stroke="#fef08a"
              strokeWidth="1.5"
              filter="drop-shadow(0 6px 14px rgba(0,0,0,0.7))"
            />
            {/* Top Golden Finial on Dome */}
            <circle cx="160" cy="48" r="8" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
            
            {/* 3 Golden Rimmed Dice Inside Shaker */}
            {/* Die 1 */}
            <g transform="translate(135, 96) rotate(-10)">
              <rect x="-14" y="-14" width="28" height="28" rx="5" fill="#fef08a" stroke="#b45309" strokeWidth="1.2" />
              <circle cx="0" cy="0" r="4" fill="#dc2626" />
            </g>
            {/* Die 2 */}
            <g transform="translate(162, 88) rotate(15)">
              <rect x="-14" y="-14" width="28" height="28" rx="5" fill="#fef08a" stroke="#b45309" strokeWidth="1.2" />
              <circle cx="-6" cy="-6" r="2.5" fill="#000" />
              <circle cx="6" cy="6" r="2.5" fill="#000" />
              <circle cx="0" cy="0" r="2.5" fill="#000" />
            </g>
            {/* Die 3 */}
            <g transform="translate(182, 102) rotate(-20)">
              <rect x="-14" y="-14" width="28" height="28" rx="5" fill="#fef08a" stroke="#b45309" strokeWidth="1.2" />
              <circle cx="-6" cy="-6" r="2.5" fill="#dc2626" />
              <circle cx="6" cy="-6" r="2.5" fill="#dc2626" />
              <circle cx="-6" cy="6" r="2.5" fill="#dc2626" />
              <circle cx="6" cy="6" r="2.5" fill="#dc2626" />
            </g>

            {/* Banner Tag */}
            <text x="160" y="162" textAnchor="middle" fill="#fef08a" fontSize="11" fontWeight="bold" fontFamily="serif">
              SIC BO · TRINCA 150X
            </text>
          </svg>
        );

      case 'miner':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <radialGradient id="minerBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#2a0e08" />
                <stop offset="70%" stopColor="#140503" />
                <stop offset="100%" stopColor="#080201" />
              </radialGradient>
            </defs>
            <rect width="320" height="180" fill="url(#minerBg)" />
            <rect x="70" y="20" width="180" height="140" rx="12" fill="#180705" stroke="#f97316" strokeWidth="1.5" />
            <text x="160" y="45" textAnchor="middle" fill="#fef08a" fontSize="11" fontWeight="900" fontFamily="serif">MINER SAPECA</text>
            <g transform="translate(100, 68)">
              <rect x="0" y="0" width="32" height="32" rx="6" fill="#042f2e" stroke="#22d3ee" strokeWidth="1.2" />
              <text x="16" y="22" textAnchor="middle" fontSize="18">💎</text>
            </g>
            <g transform="translate(144, 68)">
              <rect x="0" y="0" width="32" height="32" rx="6" fill="#450a0a" stroke="#ef4444" strokeWidth="1.2" />
              <text x="16" y="22" textAnchor="middle" fontSize="18">💣</text>
            </g>
            <g transform="translate(188, 68)">
              <rect x="0" y="0" width="32" height="32" rx="6" fill="#042f2e" stroke="#22d3ee" strokeWidth="1.2" />
              <text x="16" y="22" textAnchor="middle" fontSize="18">💎</text>
            </g>
            <text x="160" y="135" textAnchor="middle" fill="#38bdf8" fontSize="11" fontWeight="bold">MULTI ATÉ 24X · CASHOUT</text>
          </svg>
        );

      case 'plinko':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <linearGradient id="plinkoBg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1f0906" />
                <stop offset="100%" stopColor="#0c0302" />
              </linearGradient>
            </defs>
            <rect width="320" height="180" fill="url(#plinkoBg)" />
            {[0, 1, 2, 3, 4].map((r) =>
              Array.from({ length: r + 3 }).map((_, c) => (
                <circle
                  key={`${r}-${c}`}
                  cx={160 - ((r + 2) * 16) / 2 + c * 16}
                  cy={30 + r * 20}
                  r="2.5"
                  fill="#fbbf24"
                />
              ))
            )}
            <circle cx="156" cy="45" r="6" fill="#fef08a" stroke="#d97706" strokeWidth="1.2" />
            <circle cx="170" cy="78" r="6" fill="#fef08a" stroke="#d97706" strokeWidth="1.2" />
            <circle cx="140" cy="98" r="6" fill="#fef08a" stroke="#d97706" strokeWidth="1.2" />
            {['10x', '5x', '2x', '0.5x', '2x', '5x', '10x'].map((m, idx) => (
              <g key={idx} transform={`translate(${50 + idx * 32}, 136)`}>
                <rect width="28" height="24" rx="4" fill={idx === 0 || idx === 6 ? '#dc2626' : idx === 1 || idx === 5 ? '#ea580c' : '#f59e0b'} />
                <text x="14" y="16" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900">{m}</text>
              </g>
            ))}
          </svg>
        );

      case 'liars-bar':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <radialGradient id="liarGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#450a0a" />
                <stop offset="60%" stopColor="#1f0503" />
                <stop offset="100%" stopColor="#0a0201" />
              </radialGradient>
            </defs>
            <rect width="320" height="180" fill="url(#liarGlow)" />
            <ellipse cx="160" cy="95" rx="100" ry="50" fill="#2d0a06" stroke="#fbbf24" strokeWidth="2" />
            <text x="160" y="70" textAnchor="middle" fill="#fef08a" fontSize="12" fontWeight="900" fontFamily="serif">LIAR&apos;S BAR</text>
            <g transform="translate(110, 80) rotate(-10)">
              <rect width="26" height="38" rx="4" fill="#ffffff" stroke="#94a3b8" />
              <text x="13" y="24" textAnchor="middle" fill="#000" fontSize="14" fontWeight="bold">K</text>
            </g>
            <g transform="translate(145, 75)">
              <rect width="26" height="38" rx="4" fill="#581c87" stroke="#c084fc" />
              <text x="13" y="24" textAnchor="middle" fill="#fff" fontSize="14">😈</text>
            </g>
            <g transform="translate(180, 80) rotate(10)">
              <rect width="26" height="38" rx="4" fill="#ffffff" stroke="#94a3b8" />
              <text x="13" y="24" textAnchor="middle" fill="#dc2626" fontSize="14" fontWeight="bold">A</text>
            </g>
            <text x="160" y="132" textAnchor="middle" fill="#f87171" fontSize="10" fontWeight="bold">BLEFE &amp; DEDUÇÃO MULTIPLAYER</text>
          </svg>
        );

      case 'classic-slots':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <radialGradient id="csCardBg" cx="50%" cy="40%" r="65%">
                <stop offset="0%" stopColor="#991b1b" />
                <stop offset="65%" stopColor="#450a0a" />
                <stop offset="100%" stopColor="#140303" />
              </radialGradient>
            </defs>
            <rect width="320" height="180" fill="url(#csCardBg)" />
            <rect x="44" y="18" width="232" height="144" rx="16" fill="#450a0a" stroke="#fbbf24" strokeWidth="3" />
            <rect x="64" y="28" width="192" height="22" rx="6" fill="#2b0606" stroke="#f59e0b" strokeWidth="1.2" />
            <text x="160" y="43" textAnchor="middle" fill="#fde047" fontSize="11" fontWeight="900" fontFamily="serif" letterSpacing="1.5">
              LAS VEGAS 777
            </text>
            <rect x="64" y="60" width="56" height="82" rx="8" fill="#fffbeb" stroke="#d97706" strokeWidth="2" />
            <rect x="132" y="60" width="56" height="82" rx="8" fill="#fffbeb" stroke="#d97706" strokeWidth="2" />
            <rect x="200" y="60" width="56" height="82" rx="8" fill="#fffbeb" stroke="#d97706" strokeWidth="2" />
            <line x1="56" y1="101" x2="264" y2="101" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 3" opacity="0.8" />
            <text x="92" y="110" textAnchor="middle" fontSize="30">7️⃣</text>
            <text x="160" y="110" textAnchor="middle" fontSize="30">7️⃣</text>
            <text x="228" y="110" textAnchor="middle" fontSize="30">7️⃣</text>
          </svg>
        );

      case 'horse-race':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover">
            <defs>
              <linearGradient id="hrTurf" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#065f46" />
                <stop offset="50%" stopColor="#047857" />
                <stop offset="100%" stopColor="#022c22" />
              </linearGradient>
            </defs>
            <rect width="320" height="180" fill="url(#hrTurf)" />
            <rect x="0" y="16" width="320" height="6" fill="#e2e8f0" />
            <rect x="0" y="158" width="320" height="6" fill="#e2e8f0" />
            {[46, 74, 102, 130].map((y) => (
              <line key={y} x1="16" y1={y} x2="304" y2={y} stroke="#ffffff" strokeOpacity="0.3" strokeDasharray="6 4" />
            ))}
            <rect x="276" y="22" width="10" height="136" fill="#ffffff" fillOpacity="0.8" />
            <g transform="translate(150, 42) scale(-1, 1)"><text x="0" y="0" textAnchor="middle" fontSize="24">🐎</text></g>
            <g transform="translate(210, 72) scale(-1, 1)"><text x="0" y="0" textAnchor="middle" fontSize="24">🐎</text></g>
            <g transform="translate(178, 102) scale(-1, 1)"><text x="0" y="0" textAnchor="middle" fontSize="24">🐎</text></g>
            <g transform="translate(132, 132) scale(-1, 1)"><text x="0" y="0" textAnchor="middle" fontSize="24">🐎</text></g>
            <g transform="translate(192, 152) scale(-1, 1)"><text x="0" y="0" textAnchor="middle" fontSize="24">🐎</text></g>
          </svg>
        );

      case 'archery':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110">
            <defs>
              <radialGradient id="arReactBg" cx="62%" cy="48%" r="72%">
                <stop offset="0%" stopColor="#2c1810" />
                <stop offset="48%" stopColor="#140c08" />
                <stop offset="100%" stopColor="#070202" />
              </radialGradient>
              <radialGradient id="arReactGold" cx="42%" cy="38%" r="62%">
                <stop offset="0%" stopColor="#fffbeb" />
                <stop offset="45%" stopColor="#fde047" />
                <stop offset="82%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </radialGradient>
              <linearGradient id="arReactBow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="35%" stopColor="#fbbf24" />
                <stop offset="65%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#78350f" />
              </linearGradient>
              <linearGradient id="arReactWoodShaft" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#78350f" />
                <stop offset="45%" stopColor="#d97706" />
                <stop offset="75%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
              <linearGradient id="arReactSteel" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
            </defs>
            <rect width="320" height="180" fill="url(#arReactBg)" />

            {/* Background speed lines */}
            <g opacity="0.55" strokeLinecap="round">
              <line x1="8" y1="26" x2="142" y2="42" stroke="#f59e0b" strokeWidth="1.6" opacity="0.5" />
              <line x1="16" y1="54" x2="164" y2="66" stroke="#fde047" strokeWidth="2.1" opacity="0.65" />
              <line x1="6" y1="88" x2="150" y2="88" stroke="#fb923c" strokeWidth="2.4" opacity="0.7" />
              <line x1="14" y1="118" x2="162" y2="108" stroke="#fde047" strokeWidth="1.8" opacity="0.55" />
              <line x1="22" y1="148" x2="140" y2="128" stroke="#f59e0b" strokeWidth="1.5" opacity="0.45" />
              <line x1="228" y1="22" x2="310" y2="14" stroke="#f59e0b" strokeWidth="1.4" opacity="0.35" />
              <line x1="246" y1="154" x2="314" y2="162" stroke="#fb923c" strokeWidth="1.4" opacity="0.35" />
            </g>

            {/* Target stand legs & ambient shadow */}
            <line x1="184" y1="138" x2="162" y2="178" stroke="#451a03" strokeWidth="8" strokeLinecap="round" />
            <line x1="234" y1="138" x2="256" y2="178" stroke="#451a03" strokeWidth="8" strokeLinecap="round" />
            <ellipse cx="212" cy="92" rx="68" ry="68" fill="rgba(0,0,0,0.58)" />

            {/* Concentric Target: Red, White, Gold */}
            <circle cx="208" cy="88" r="64" fill="#991b1b" stroke="#fbbf24" strokeWidth="3.5" />
            <circle cx="208" cy="88" r="54" fill="#dc2626" />
            <circle cx="208" cy="88" r="42" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="208" cy="88" r="29" fill="#dc2626" />
            <circle cx="208" cy="88" r="17" fill="url(#arReactGold)" stroke="#92400e" strokeWidth="1.6" />
            <circle cx="208" cy="88" r="8" fill="#fef08a" stroke="#b45309" strokeWidth="1.2" />

            {/* Tensioned bow on the left side */}
            <path d="M 42,22 Q 94,88 42,154" fill="none" stroke="url(#arReactBow)" strokeWidth="7" strokeLinecap="round" />
            <path d="M 42,22 Q 48,30 52,36 M 42,154 Q 48,146 52,140" fill="none" stroke="#fde68a" strokeWidth="2.6" strokeLinecap="round" />
            <polyline points="42,22 24,88 42,154" fill="none" stroke="#f1f5f9" strokeWidth="2.2" opacity="0.88" />
            <circle cx="24" cy="88" r="3" fill="#fde047" />

            {/* Arrow embedded in bullseye: wooden shaft + metallic tip + rear feathers */}
            <line x1="74" y1="126" x2="205" y2="88" stroke="rgba(0,0,0,0.55)" strokeWidth="7" strokeLinecap="round" />
            <line x1="72" y1="123" x2="204" y2="87" stroke="url(#arReactWoodShaft)" strokeWidth="5.2" strokeLinecap="round" />
            <line x1="80" y1="120" x2="196" y2="88" stroke="#fef3c7" strokeWidth="1.2" opacity="0.7" />
            {/* Metallic arrowhead embedded in center */}
            <polygon points="210,86 190,82 194,95" fill="url(#arReactSteel)" stroke="#1e293b" strokeWidth="0.9" />
            <circle cx="208" cy="88" r="3.6" fill="#fffbeb" />
            {/* Rear fletching feathers */}
            <polygon points="72,123 94,108 86,119 66,120" fill="#dc2626" stroke="#fca5a5" strokeWidth="0.8" />
            <polygon points="72,123 96,128 84,122 68,128" fill="#fbbf24" stroke="#fef08a" strokeWidth="0.8" />
            <line x1="75" y1="120" x2="88" y2="112" stroke="#fef2f2" strokeWidth="0.9" opacity="0.8" />
          </svg>
        );

      case 'dragon-egg':
        return (
          <svg viewBox="0 0 320 180" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110">
            <defs>
              <radialGradient id="deReactBg" cx="50%" cy="46%" r="72%">
                <stop offset="0%" stopColor="#45150c" />
                <stop offset="48%" stopColor="#1b0711" />
                <stop offset="100%" stopColor="#070205" />
              </radialGradient>
              <radialGradient id="deReactAura" cx="50%" cy="48%" r="52%">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.82" />
                <stop offset="42%" stopColor="#ea580c" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="deReactEgg" cx="38%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="28%" stopColor="#d97706" />
                <stop offset="68%" stopColor="#14532d" />
                <stop offset="100%" stopColor="#052e16" />
              </radialGradient>
              <linearGradient id="deReactFireCrack" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="45%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            <rect width="320" height="180" fill="url(#deReactBg)" />
            <circle cx="160" cy="86" r="84" fill="url(#deReactAura)" />

            {/* Rising smoke wisps from the nest */}
            <g fill="none" strokeLinecap="round" opacity="0.45">
              <path d="M 88,126 Q 74,94 94,68 Q 108,46 90,22" stroke="#cbd5e1" strokeWidth="5" />
              <path d="M 232,126 Q 248,96 226,68 Q 214,48 234,20" stroke="#94a3b8" strokeWidth="4.5" />
              <path d="M 160,36 Q 174,20 156,6" stroke="#fde68a" strokeWidth="4" opacity="0.55" />
            </g>

            {/* Back dark SVG twigs forming the nest */}
            <g strokeLinecap="round" strokeLinejoin="round">
              <path d="M 40,130 L 96,144 L 154,136 L 222,146 L 282,126" fill="none" stroke="#271209" strokeWidth="9" />
              <path d="M 52,122 L 108,138 L 210,138 L 270,120" fill="none" stroke="#3b180b" strokeWidth="6" />
              <path d="M 60,136 L 34,116 M 260,136 L 290,114" fill="none" stroke="#1c0b05" strokeWidth="5.5" />
            </g>

            {/* Central glowing Dragon Egg */}
            <path
              d="M 160,24 C 194,24 210,72 204,108 C 200,132 182,144 160,144 C 138,144 120,132 116,108 C 110,72 126,24 160,24 Z"
              fill="url(#deReactEgg)"
              stroke="#fbbf24"
              strokeWidth="3.2"
            />
            {/* Dragon scale texture */}
            <path d="M 132,62 Q 146,72 160,62 Q 174,72 188,62" fill="none" stroke="#052e16" strokeWidth="2.2" opacity="0.6" />
            <path d="M 124,90 Q 142,102 160,90 Q 178,102 196,90" fill="none" stroke="#052e16" strokeWidth="2.2" opacity="0.6" />
            <path d="M 128,116 Q 144,126 160,116 Q 176,126 192,116" fill="none" stroke="#052e16" strokeWidth="2" opacity="0.55" />

            {/* Fiery glowing cracks radiating from inside */}
            <path d="M 160,36 L 150,58 L 170,74 L 154,96 L 172,116 L 160,134" fill="none" stroke="#f97316" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
            <path d="M 170,74 L 192,84 L 200,96" fill="none" stroke="#ea580c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            <path d="M 154,96 L 130,104 L 122,116" fill="none" stroke="#ea580c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            <path d="M 160,36 L 150,58 L 170,74 L 154,96 L 172,116 L 160,134" fill="none" stroke="url(#deReactFireCrack)" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 170,74 L 192,84 L 200,96" fill="none" stroke="#fef08a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 154,96 L 130,104 L 122,116" fill="none" stroke="#fef08a" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />

            {/* Front interlaced dark SVG sticks & twigs */}
            <g strokeLinecap="round">
              <path d="M 46,142 L 116,154 L 188,146 L 274,136" fill="none" stroke="#1b0a04" strokeWidth="8.5" />
              <path d="M 56,150 L 146,162 L 224,154 L 266,148" fill="none" stroke="#451a03" strokeWidth="5.5" />
              <path d="M 74,136 L 134,158 M 192,158 L 252,134" fill="none" stroke="#2d1106" strokeWidth="4.8" />
              <path d="M 94,146 L 156,150 L 220,142" fill="none" stroke="#78350f" strokeWidth="2.6" opacity="0.7" />
            </g>

            {/* Glowing embers rising from the nest */}
            <circle cx="104" cy="64" r="3" fill="#fde047" opacity="0.9" />
            <circle cx="218" cy="54" r="2.6" fill="#fb923c" opacity="0.88" />
            <circle cx="192" cy="30" r="2.2" fill="#fef08a" opacity="0.9" />
            <circle cx="122" cy="40" r="2" fill="#f97316" opacity="0.85" />
            <circle cx="244" cy="96" r="2.4" fill="#fbbf24" opacity="0.75" />
            <circle cx="78" cy="96" r="2.2" fill="#fb923c" opacity="0.75" />
          </svg>
        );

      default:
        return (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2a0e08] via-[#1a0805] to-[#0e0403]">
            <div className="text-center p-4">
              <span className="text-4xl">🎰</span>
              <p className="text-xs uppercase tracking-widest text-orange-400 font-bold mt-2">
                {gameId.toUpperCase()}
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`relative w-full aspect-[16/9] overflow-hidden rounded-xl bg-[#1c0805] select-none border border-orange-500/20 group-hover:border-orange-500/80 transition-all duration-500 ${className}`}>
      {/* Primary AAA High-Resolution Game Artwork or Rich SVG Illustration */}
      {isPendingDynamicImage ? (
        <div className="relative w-full h-full bg-gradient-to-br from-[#2a0e08] via-[#1c0805] to-[#120403] animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-[#140604] via-transparent to-black/25 pointer-events-none" />
        </div>
      ) : imgSrc && !imgError ? (
        <div className="relative w-full h-full">
          <img
            src={imgSrc}
            alt={gameId}
            referrerPolicy="no-referrer"
            className="block opacity-100 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            onError={() => setImgError(true)}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
          />
          {/* Warm Reddish-Orange Lighting & Vignette Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#140604] via-transparent to-black/30 pointer-events-none" />
          <div className="absolute inset-0 bg-orange-600/0 group-hover:bg-orange-600/15 transition-colors duration-300 pointer-events-none" />
        </div>
      ) : (
        <div className="relative w-full h-full">
          {renderCustomIllustration()}
          <div className="absolute inset-0 bg-gradient-to-t from-[#140604] via-transparent to-black/25 pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,191,36,0.25)_0%,transparent_70%)] pointer-events-none" />
          <div className="absolute inset-0 bg-orange-600/0 group-hover:bg-orange-600/15 transition-colors duration-300 pointer-events-none mix-blend-color-dodge" />
        </div>
      )}

      {/* Floating Badges */}
      {badge && (
        <div className="absolute top-2.5 right-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-lg shadow-orange-900/60 uppercase tracking-wider border border-orange-300/40">
          {badge}
        </div>
      )}

      {/* Fiery corner shine */}
      <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-orange-500/20 to-transparent pointer-events-none" />
    </div>
  );
};
