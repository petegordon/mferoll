'use client';

import { Canvas } from '@react-three/fiber';
import { DicePair } from './DicePair';

interface DiceSceneProps {
  isRolling: boolean;
  targetFaces: { die1: number; die2: number } | null;
  onDiceSettled: () => void;
}

export default function DiceScene({ isRolling, targetFaces, onDiceSettled }: DiceSceneProps) {
  return (
    <div className="w-full h-full">
      <Canvas shadows camera={{ position: [0, 8, 0], fov: 50, near: 0.1, far: 100 }}>
        {/* Top-down view - camera looks straight down */}

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 15, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={30}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <pointLight position={[-5, 10, -5]} intensity={0.4} />

        {/* Simple floor plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>

        {/* Dice */}
        <DicePair
          isRolling={isRolling}
          targetFaces={targetFaces}
          onSettled={onDiceSettled}
        />
      </Canvas>
    </div>
  );
}
