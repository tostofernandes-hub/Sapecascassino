import React, { useEffect, useRef, useState } from 'react';

interface ThreeDDiceProps {
  values: number[];
  isRolling: boolean;
  variant?: 'craps' | 'sicbo';
}

const PIP_CONFIGS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

// Rotations to bring each face to the TOP (-Y) of the cube before applying viewing tilt:
// Face normals in local cube space (per CSS .dice-face-3d.f-*):
// f-1: rotateY(0)     -> ( 0,  0, +1) front -> rotateX(90)               -> (0, -1, 0) TOP
// f-2: rotateX(-90)   -> ( 0, +1,  0) bottom-> rotateX(180)              -> (0, -1, 0) TOP
// f-3: rotateY(90)    -> (+1,  0,  0) right -> rotateX(90) rotateY(-90)  -> (0, -1, 0) TOP
// f-4: rotateY(-90)   -> (-1,  0,  0) left  -> rotateX(90) rotateY(90)   -> (0, -1, 0) TOP
// f-5: rotateX(90)    -> ( 0, -1,  0) top   -> rotateX(0)                -> (0, -1, 0) TOP
// f-6: rotateY(180)   -> ( 0,  0, -1) back  -> rotateX(-90)              -> (0, -1, 0) TOP
const TOP_ANGLES: Record<number, { x: number; y: number; z: number }> = {
  1: { x: 90, y: 0, z: 0 },
  2: { x: 180, y: 0, z: 0 },
  3: { x: 90, y: -90, z: 0 },
  4: { x: 90, y: 90, z: 0 },
  5: { x: 0, y: 0, z: 0 },
  6: { x: -90, y: 0, z: 0 }
};

// Viewing incline: -54° around X tilts top face prominently towards player; +14° around Y shows 3D depth
const TILT_X = -54;
const TILT_Y = 14;

const buildCubeTransform = (
  val: number,
  idx: number,
  spin: { x: number; y: number; z: number }
): string => {
  const top = TOP_ANGLES[val] || TOP_ANGLES[1];
  const wobble = idx === 0 ? -4 : idx === 1 ? 4 : -1;
  const finalX = spin.x + top.x;
  const finalY = spin.y + top.y;
  const finalZ = spin.z + top.z;
  return `rotateX(${TILT_X}deg) rotateY(${TILT_Y + wobble}deg) rotateX(${finalX}deg) rotateY(${finalY}deg) rotateZ(${finalZ}deg)`;
};

export const ThreeDDice: React.FC<ThreeDDiceProps> = ({
  values,
  isRolling,
  variant = 'craps'
}) => {
  const accumSpinsRef = useRef<Array<{ x: number; y: number; z: number }>>([
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 }
  ]);
  const wasRollingRef = useRef<boolean>(isRolling);

  const [transforms, setTransforms] = useState<string[]>(() =>
    values.map((val, idx) => buildCubeTransform(val, idx, { x: 0, y: 0, z: 0 }))
  );

  useEffect(() => {
    if (isRolling) {
      wasRollingRef.current = true;
      const nextTransforms = values.map((val, idx) => {
        const fullTurnsX = 360 * (3 + Math.floor(Math.random() * 3)) * (Math.random() > 0.5 ? 1 : -1);
        const fullTurnsY = 360 * (3 + Math.floor(Math.random() * 3)) * (Math.random() > 0.5 ? 1 : -1);
        const fullTurnsZ = 360 * (1 + Math.floor(Math.random() * 2)) * (Math.random() > 0.5 ? 1 : -1);

        if (!accumSpinsRef.current[idx]) {
          accumSpinsRef.current[idx] = { x: 0, y: 0, z: 0 };
        }

        accumSpinsRef.current[idx].x += fullTurnsX;
        accumSpinsRef.current[idx].y += fullTurnsY;
        accumSpinsRef.current[idx].z += fullTurnsZ;

        return buildCubeTransform(val, idx, accumSpinsRef.current[idx]);
      });

      setTransforms(nextTransforms);
    } else if (wasRollingRef.current) {
      wasRollingRef.current = false;
    } else {
      setTransforms(
        values.map((val, idx) =>
          buildCubeTransform(val, idx, accumSpinsRef.current[idx] || { x: 0, y: 0, z: 0 })
        )
      );
    }
  }, [isRolling, values]);

  return (
    <div className="dice-arena-3d">
      {values.map((_, idx) => (
        <div
          key={idx}
          className={`dice-platform ${variant === 'sicbo' ? 'sicbo-die' : 'craps-die'} ${
            isRolling ? 'is-rolling' : ''
          }`}
        >
          {/* Realistic drop & contact shadow on the table felt */}
          <div className="dice-shadow-3d" />

          {/* Bouncer wrapper for vertical jumping arc & landing impact */}
          <div className={`dice-bouncer ${isRolling ? 'is-bouncing' : ''}`}>
            {/* The 3D Cube with 6 physical faces */}
            <div
              className="dice-cube-3d"
              style={{
                transform: transforms[idx] || 'rotateX(0deg) rotateY(0deg)'
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((faceNum) => (
                <div key={faceNum} className={`dice-face-3d f-${faceNum}`}>
                  {Array.from({ length: 9 }).map((__, cellIdx) => {
                    const hasPip = PIP_CONFIGS[faceNum].includes(cellIdx);
                    return (
                      <div key={cellIdx} className="pip-cell">
                        {hasPip && <div className="pip-dot" />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
