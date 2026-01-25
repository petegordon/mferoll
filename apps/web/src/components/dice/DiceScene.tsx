'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { DicePair } from './DicePair';

interface DiceSceneProps {
  isRolling: boolean;
  targetFaces: { die1: number; die2: number } | null;
  onDiceSettled: () => void;
  darkMode?: boolean;
}

// Component that uses the offset inside Canvas
function DiceGroup({ isRolling, targetFaces, onSettled, darkMode }: {
  isRolling: boolean;
  targetFaces: { die1: number; die2: number } | null;
  onSettled: () => void;
  darkMode: boolean;
}) {
  const { viewport } = useThree();

  // Calculate offset based on viewport aspect ratio
  // Higher Z = dice appear lower on screen (away from camera looking down)
  // Lower/negative Z = dice appear higher on screen
  // Each unit of Z offset moves dice about 1 dice-height on screen
  const aspectRatio = viewport.width / viewport.height;

  let zOffset = 0.9;
  if (aspectRatio < 0.7) {
    // All portrait phones (iPhone 16 with toolbars ~0.5-0.65)
    // Move dice UP by ~80% of one dice height (dice are ~1 unit tall)
    zOffset = 0.1;
  } else if (aspectRatio < 0.85) {
    // Portrait tablets (iPad Pro at 0.75)
    zOffset = 0.5;
  } else {
    // Landscape / desktop
    zOffset = 1.0;
  }

  return (
    <group position={[0, 0, zOffset]}>
      <DicePair
        isRolling={isRolling}
        targetFaces={targetFaces}
        onSettled={onSettled}
        darkMode={darkMode}
      />
    </group>
  );
}

export default function DiceScene({ isRolling, targetFaces, onDiceSettled, darkMode = false }: DiceSceneProps) {
  return (
    <div className="w-full h-full">
      <Canvas shadows camera={{ position: [0, 8, 0], fov: 50, near: 0.1, far: 100 }} gl={{ alpha: true }} style={{ background: 'transparent' }}>
        {/* Top-down view - camera looks straight down */}

        {/* Environment for reflections */}
        <Environment preset="studio" />

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

        {/* Invisible floor plane - subtle shadows */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial transparent opacity={0.05} />
        </mesh>

        {/* Dice - offset based on viewport aspect ratio */}
        <DiceGroup
          isRolling={isRolling}
          targetFaces={targetFaces}
          onSettled={onDiceSettled}
          darkMode={darkMode}
        />
      </Canvas>
    </div>
  );
}
