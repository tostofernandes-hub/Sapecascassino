import React, { useId } from 'react';

interface SlotSymbol3DProps {
  icon: string;
  size?: 'reel' | 'badge';
  title?: string;
}

const TONE_MAP: Record<string, string> = {
  '🐉': 'tone-dragon',
  '🪙': 'tone-coin',
  '💰': 'tone-bag',
  '🧧': 'tone-envelope',
  '🏮': 'tone-lantern',
  '🧨': 'tone-firecracker',
  '7️⃣': 'tone-dragon',
  '💎': 'tone-coin',
  '🔔': 'tone-bag',
  '🍉': 'tone-envelope',
  '🍇': 'tone-lantern',
  '🍒': 'tone-firecracker',
  '👑': 'tone-dragon',
  '👁️': 'tone-coin',
  '🪲': 'tone-bag',
  '🏛️': 'tone-envelope',
  '🐺': 'tone-lantern',
  '🏺': 'tone-firecracker'
};

export const SlotSymbolSVG: React.FC<{
  icon: string;
  className?: string;
  size?: 'reel' | 'badge';
}> = ({
  icon,
  className = 'w-[86%] h-[86%] drop-shadow-[0_4px_5px_rgba(0,0,0,0.78)]',
  size = 'reel'
}) => {
  const uid = useId().replace(/:/g, '');

  switch (icon) {
    case '🐉':
      return (
        <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={`dragGold-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="45%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            <radialGradient id={`dragCore-${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </radialGradient>
          </defs>
          <path
            d="M18 32 Q6 10 34 22 Q50 4 66 22 Q94 10 82 32 L76 48 Q50 40 24 48 Z"
            fill={`url(#dragCore-${uid})`}
            stroke="#fde047"
            strokeWidth="2.5"
          />
          <path
            d="M26 26 Q14 8 38 18 M74 26 Q86 8 62 18"
            stroke="#fef08a"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx="50" cy="52" rx="30" ry="24" fill={`url(#dragGold-${uid})`} stroke="#78350f" strokeWidth="2.5" />
          <path
            d="M24 58 Q10 68 8 82 M76 58 Q90 68 92 82"
            stroke="#fde047"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx="38" cy="45" rx="5.5" ry="7" fill="#ffffff" />
          <circle cx="39" cy="45" r="3.4" fill="#b91c1c" />
          <ellipse cx="62" cy="45" rx="5.5" ry="7" fill="#ffffff" />
          <circle cx="61" cy="45" r="3.4" fill="#b91c1c" />
          <ellipse cx="50" cy="60" rx="13" ry="8" fill="#b91c1c" stroke="#fef08a" strokeWidth="1.5" />
          <circle cx="45" cy="59" r="2.2" fill="#1c0502" />
          <circle cx="55" cy="59" r="2.2" fill="#1c0502" />
          <rect x="25" y="75" width="50" height="16" rx="5" fill="#991b1b" stroke="#fef08a" strokeWidth="1.6" />
          <text
            x="50"
            y="86.5"
            textAnchor="middle"
            fill="#fef08a"
            fontSize="10.5"
            fontWeight="900"
            fontFamily="Georgia, serif"
          >
            100X
          </text>
        </svg>
      );

    case '🪙':
      return (
        <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={`coinRim-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
            <radialGradient id={`coinFace-${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="45%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
          </defs>
          <ellipse cx="52" cy="55" rx="35" ry="35" fill="#78350f" />
          <circle cx="49" cy="50" r="35" fill={`url(#coinRim-${uid})`} stroke="#fef9c3" strokeWidth="2.5" />
          <circle cx="49" cy="50" r="28" fill={`url(#coinFace-${uid})`} stroke="#92400e" strokeWidth="2" />
          <rect x="39" y="40" width="20" height="20" rx="2" fill="#422006" stroke="#fef08a" strokeWidth="2" />
          <circle cx="49" cy="28" r="2.5" fill="#78350f" />
          <circle cx="49" cy="72" r="2.5" fill="#78350f" />
          <circle cx="27" cy="50" r="2.5" fill="#78350f" />
          <circle cx="71" cy="50" r="2.5" fill="#78350f" />
        </svg>
      );

    case '💰':
      return (
        <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <radialGradient id={`bagBody-${uid}`} cx="35%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="55%" stopColor="#b91c1c" />
              <stop offset="100%" stopColor="#450a0a" />
            </radialGradient>
            <linearGradient id={`bagGold-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <path d="M36 16 L64 16 L58 32 L42 32 Z" fill={`url(#bagBody-${uid})`} stroke="#fde047" strokeWidth="2" />
          <path d="M40 32 C18 40 16 84 50 86 C84 84 82 40 60 32 Z" fill={`url(#bagBody-${uid})`} stroke="#fbbf24" strokeWidth="2.5" />
          <rect x="36" y="30" width="28" height="7" rx="3.5" fill={`url(#bagGold-${uid})`} stroke="#78350f" strokeWidth="1.5" />
          <circle cx="50" cy="59" r="14" fill={`url(#bagGold-${uid})`} stroke="#78350f" strokeWidth="2" />
          <text x="50" y="64" textAnchor="middle" fill="#78350f" fontSize="16" fontWeight="900">
            $
          </text>
        </svg>
      );

    case '🧧':
      return (
        <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={`envGrad-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
          </defs>
          <g transform="rotate(-7 50 50)">
            <rect x="24" y="16" width="54" height="72" rx="8" fill="#450a0a" transform="translate(4,4)" />
            <rect x="22" y="14" width="54" height="72" rx="8" fill={`url(#envGrad-${uid})`} stroke="#fde047" strokeWidth="2.5" />
            <path d="M22 22 L49 46 L76 22" fill="#b91c1c" stroke="#fef08a" strokeWidth="2" />
            <circle cx="49" cy="48" r="12" fill="#fbbf24" stroke="#78350f" strokeWidth="2" />
            <rect x="44" y="43" width="10" height="10" transform="rotate(45 49 48)" fill="#991b1b" stroke="#fef08a" strokeWidth="1" />
          </g>
        </svg>
      );

    case '🏮':
      return (
        <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <radialGradient id={`lantGrad-${uid}`} cx="40%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="38%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </radialGradient>
          </defs>
          <line x1="50" y1="6" x2="50" y2="18" stroke="#fde047" strokeWidth="3" />
          <rect x="35" y="17" width="30" height="8" rx="3" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
          <ellipse cx="50" cy="49" rx="28" ry="26" fill={`url(#lantGrad-${uid})`} stroke="#fbbf24" strokeWidth="2.5" />
          <ellipse cx="50" cy="49" rx="14" ry="25" fill="none" stroke="#fde047" strokeWidth="1.4" opacity="0.8" />
          <rect x="35" y="73" width="30" height="8" rx="3" fill="#f59e0b" stroke="#fef08a" strokeWidth="1.5" />
          <path d="M44 81 L42 94 M50 81 L50 96 M56 81 L58 94" stroke="#fbbf24" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );

    case '🧨':
      return (
        <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={`fireGrad-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="55%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
          </defs>
          <g transform="rotate(-14 38 56)">
            <rect x="26" y="28" width="22" height="54" rx="6" fill={`url(#fireGrad-${uid})`} stroke="#fde047" strokeWidth="2.2" />
            <rect x="26" y="42" width="22" height="7" fill="#fbbf24" />
            <rect x="26" y="62" width="22" height="7" fill="#fbbf24" />
          </g>
          <g transform="rotate(14 62 56)">
            <rect x="52" y="28" width="22" height="54" rx="6" fill={`url(#fireGrad-${uid})`} stroke="#fde047" strokeWidth="2.2" />
            <rect x="52" y="42" width="22" height="7" fill="#fbbf24" />
            <rect x="52" y="62" width="22" height="7" fill="#fbbf24" />
          </g>
          <path d="M50 28 Q50 14 60 12" stroke="#fde047" strokeWidth="2.5" fill="none" />
          <polygon points="62,5 65,11 71,11 66,15 68,21 62,17 56,21 58,15 53,11 59,11" fill="#fef08a" />
        </svg>
      );

    default:
      return (
        <span
          className={
            size === 'badge'
              ? 'text-[11px] leading-none inline-flex items-center justify-center'
              : 'slot-token-emoji-3d'
          }
        >
          {icon}
        </span>
      );
  }
};

export const SlotSymbol3D: React.FC<SlotSymbol3DProps> = ({
  icon,
  size = 'reel',
  title
}) => {
  if (size === 'badge') {
    return (
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 overflow-hidden align-middle">
        <SlotSymbolSVG icon={icon} size="badge" className="w-full h-full" />
      </span>
    );
  }

  const toneClass = TONE_MAP[icon] || 'tone-coin';

  return (
    <div className="slot-token-3d" title={title}>
      <div className={`slot-token-face ${toneClass}`}>
        <SlotSymbolSVG icon={icon} />
      </div>
    </div>
  );
};
