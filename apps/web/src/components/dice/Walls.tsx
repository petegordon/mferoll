'use client';

import { usePlane } from '@react-three/cannon';
import * as THREE from 'three';

function Wall({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const [ref] = usePlane<THREE.Mesh>(() => ({
    position,
    rotation,
    material: { restitution: 0.3, friction: 0.3 },
  }));

  return (
    <mesh ref={ref}>
      <planeGeometry args={[20, 10]} />
      <meshStandardMaterial transparent opacity={0} />
    </mesh>
  );
}

export function Walls() {
  // Tighter walls to keep dice in mobile viewport
  // Camera at y=12, fov=50 shows ~11 units vertically, less horizontally on portrait
  const boundary = 3.5;

  return (
    <group>
      {/* Front wall */}
      <Wall position={[0, 5, -boundary]} rotation={[0, 0, 0]} />
      {/* Back wall */}
      <Wall position={[0, 5, boundary]} rotation={[0, Math.PI, 0]} />
      {/* Left wall */}
      <Wall position={[-boundary, 5, 0]} rotation={[0, Math.PI / 2, 0]} />
      {/* Right wall */}
      <Wall position={[boundary, 5, 0]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}
