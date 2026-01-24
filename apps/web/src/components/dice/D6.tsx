'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface D6Props {
  position: [number, number, number];
  targetFace?: number;
  onSettled?: () => void;
  isRolling: boolean;
  darkMode?: boolean;
}

// Create pip texture for dice face
function createPipTexture(pips: number, darkMode: boolean = false): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (darkMode) {
    // Black background for dark mode
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, size, size);
    // Dark gray pips
    ctx.fillStyle = '#6b7280';
    ctx.shadowColor = '#6b7280';
  } else {
    // Deep casino red background
    ctx.fillStyle = '#520000';
    ctx.fillRect(0, 0, size, size);
    // White pips
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
  }
  ctx.shadowBlur = 6;
  const pipRadius = size * 0.09;
  const margin = size * 0.23;
  const center = size / 2;

  const pipPositions: Record<number, [number, number][]> = {
    1: [[center, center]],
    2: [[margin, margin], [size - margin, size - margin]],
    3: [[margin, margin], [center, center], [size - margin, size - margin]],
    4: [[margin, margin], [size - margin, margin], [margin, size - margin], [size - margin, size - margin]],
    5: [[margin, margin], [size - margin, margin], [center, center], [margin, size - margin], [size - margin, size - margin]],
    6: [[margin, margin], [size - margin, margin], [margin, center], [size - margin, center], [margin, size - margin], [size - margin, size - margin]],
  };

  const positions = pipPositions[pips] || [];
  positions.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, pipRadius, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function D6({ position, targetFace, onSettled, isRolling, darkMode = false }: D6Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false); // Synchronous guard
  const animationTimeRef = useRef(0);
  const hasSettledRef = useRef(false);
  const startQuatRef = useRef(new THREE.Quaternion());
  const targetQuatRef = useRef(new THREE.Quaternion());

  // Track if we've received a target face to transition from shake to throw
  const hasTargetRef = useRef(false);
  const throwPhaseStartTimeRef = useRef(0);

  // Create materials for each face - shiny glassy
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z (indices 0-5)
  // Standard die: opposite faces sum to 7 (1-6, 2-5, 3-4)
  // We'll put: +X=2, -X=5, +Y=3, -Y=4, +Z=1, -Z=6
  const materials = useMemo(() => {
    const faceOrder = [2, 5, 3, 4, 1, 6];
    return faceOrder.map((pips) => {
      const texture = createPipTexture(pips, darkMode);
      if (darkMode) {
        // Solid matte dark material for dark mode
        return new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.4,
          metalness: 0.1,
        });
      } else {
        // Glassy casino dice for light mode
        return new THREE.MeshPhysicalMaterial({
          map: texture,
          roughness: 0.02,
          metalness: 0,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          reflectivity: 1.0,
          transmission: 0.12,
          thickness: 1.0,
          ior: 1.52,
          transparent: true,
          attenuationColor: new THREE.Color('#350000'),
          attenuationDistance: 0.8,
          envMapIntensity: 1.5,
          specularIntensity: 1.0,
        });
      }
    });
  }, [darkMode]);

  // Calculate rotation to show target face on top
  // With our face mapping: +X=2, -X=5, +Y=3, -Y=4, +Z=1, -Z=6
  const getTargetQuaternion = (face: number): THREE.Quaternion => {
    const euler = (() => {
      switch (face) {
        case 1: return new THREE.Euler(-Math.PI / 2, 0, 0); // +Z up
        case 2: return new THREE.Euler(0, 0, Math.PI / 2);  // +X up
        case 3: return new THREE.Euler(0, 0, 0);            // +Y up (default)
        case 4: return new THREE.Euler(Math.PI, 0, 0);      // -Y up
        case 5: return new THREE.Euler(0, 0, -Math.PI / 2); // -X up
        case 6: return new THREE.Euler(Math.PI / 2, 0, 0);  // -Z up
        default: return new THREE.Euler(0, 0, 0);
      }
    })();
    return new THREE.Quaternion().setFromEuler(euler);
  };

  // Random speeds for this dice (set once per roll)
  const spinSpeedsRef = useRef({ x: 0, y: 0, z: 0 });
  const throwStartRotRef = useRef({ x: 0, y: 0, z: 0 });
  const throwEndRotRef = useRef({ x: 0, y: 0, z: 0 });
  const hasStartedThrowRef = useRef(false);
  // Settling phase refs
  const hasStartedSettlingRef = useRef(false);
  const settleStartPosRef = useRef({ x: 0, y: 0, z: 0 });
  const settleStartQuatRef = useRef(new THREE.Quaternion());

  // Start animation when isRolling becomes true
  useEffect(() => {
    // Use ref for synchronous guard to prevent double-firing
    if (isRolling && !isAnimatingRef.current) {
      console.log('D6: Starting shake animation, awaiting target face');
      isAnimatingRef.current = true; // Set immediately (sync)
      setIsAnimating(true);
      hasSettledRef.current = false;
      hasStartedThrowRef.current = false;
      hasStartedSettlingRef.current = false;
      hasTargetRef.current = false;
      throwPhaseStartTimeRef.current = 0;
      animationTimeRef.current = 0;

      // Random spin speeds (different for each axis, like real dice)
      spinSpeedsRef.current = {
        x: (Math.random() - 0.5) * 25,
        y: (Math.random() - 0.5) * 25,
        z: (Math.random() - 0.5) * 25,
      };

      // Only set target if we already have one
      if (targetFace !== undefined) {
        hasTargetRef.current = true;
        targetQuatRef.current = getTargetQuaternion(targetFace);
      }
    }
  }, [isRolling]);

  // Watch for targetFace prop changes - inject result mid-animation
  useEffect(() => {
    if (isAnimating && targetFace !== undefined && !hasTargetRef.current) {
      console.log('D6: Target face received mid-animation:', targetFace);
      hasTargetRef.current = true;
      targetQuatRef.current = getTargetQuaternion(targetFace);
      // Record when we got the target so throw phase starts from now
      throwPhaseStartTimeRef.current = animationTimeRef.current;
    }
  }, [targetFace, isAnimating]);

  // Animate the dice
  useFrame((_, delta) => {
    if (!meshRef.current || !isAnimating) return;

    animationTimeRef.current += delta;
    const throwDuration = 2.3; // Time for throw and land
    const settleDuration = 0.3; // Final settling animation

    const time = animationTimeRef.current;

    // If we don't have a target yet, keep shaking indefinitely
    if (!hasTargetRef.current) {
      // PHASE 1: Shaking in hand - fast chaotic rotation (continues until target arrives)
      hasStartedThrowRef.current = false;

      // Rapid tumbling rotation
      meshRef.current.rotation.x += spinSpeedsRef.current.x * delta;
      meshRef.current.rotation.y += spinSpeedsRef.current.y * delta;
      meshRef.current.rotation.z += spinSpeedsRef.current.z * delta;

      // Shake position around like in a cupped hand
      const shakeIntensity = 0.4;
      meshRef.current.position.x = position[0] + Math.sin(time * 30) * shakeIntensity * (0.5 + Math.random() * 0.5);
      meshRef.current.position.y = position[1] + 0.5 + Math.sin(time * 25) * 0.3;
      meshRef.current.position.z = position[2] + Math.cos(time * 28) * shakeIntensity * (0.5 + Math.random() * 0.5);
      return;
    }

    // Calculate time since we got the target (throw phase start)
    const timeSinceTarget = time - throwPhaseStartTimeRef.current;

    if (timeSinceTarget < throwDuration) {
      // PHASE 2: Thrown - arc through air then land
      const throwProgress = Math.min(timeSinceTarget / throwDuration, 1);

      // Capture starting rotation at beginning of throw phase
      if (!hasStartedThrowRef.current) {
        hasStartedThrowRef.current = true;
        // Capture current rotation
        throwStartRotRef.current = {
          x: meshRef.current.rotation.x,
          y: meshRef.current.rotation.y,
          z: meshRef.current.rotation.z,
        };
        // Calculate target rotation with extra tumbling rotations
        const targetEuler = new THREE.Euler().setFromQuaternion(targetQuatRef.current);
        const extraSpins = 2 + Math.random(); // 2-3 full rotations
        throwEndRotRef.current = {
          x: targetEuler.x + Math.sign(spinSpeedsRef.current.x || 1) * Math.PI * 2 * extraSpins,
          y: targetEuler.y + Math.sign(spinSpeedsRef.current.y || 1) * Math.PI * 2 * extraSpins,
          z: targetEuler.z + Math.sign(spinSpeedsRef.current.z || 1) * Math.PI * 2 * extraSpins,
        };
      }

      // Ease out for settling
      const eased = 1 - Math.pow(1 - throwProgress, 3);

      // Landing phase for position (starts at 70% through throw)
      const landingStart = 0.7;
      const isLanding = throwProgress > landingStart;
      const landingProgress = isLanding ? (throwProgress - landingStart) / (1 - landingStart) : 0;
      const landingEased = landingProgress * landingProgress * (3 - 2 * landingProgress);

      // Interpolate rotation from start to target (with extra spins baked in)
      const rotX = throwStartRotRef.current.x + (throwEndRotRef.current.x - throwStartRotRef.current.x) * eased;
      const rotY = throwStartRotRef.current.y + (throwEndRotRef.current.y - throwStartRotRef.current.y) * eased;
      const rotZ = throwStartRotRef.current.z + (throwEndRotRef.current.z - throwStartRotRef.current.z) * eased;
      meshRef.current.rotation.set(rotX, rotY, rotZ);

      // Bounce trajectory (only before landing)
      let height = 0;
      if (!isLanding) {
        const bounceHeight = 2.0;
        const gravity = 2.5;
        const bounceDecay = 0.35;

        let t = throwProgress / landingStart; // Normalize to pre-landing phase
        let bounceNum = 0;
        let velocity = bounceHeight;

        // Simulate bounces
        while (t > 0 && bounceNum < 3) {
          const bounceDuration = velocity / gravity;
          if (t < bounceDuration * 2) {
            const bounceT = t / (bounceDuration * 2);
            height = velocity * Math.sin(bounceT * Math.PI);
            break;
          }
          t -= bounceDuration * 2;
          velocity *= bounceDecay;
          bounceNum++;
        }
      }

      // Position smoothly to final during landing
      const targetX = position[0];
      const targetY = position[1];
      const targetZ = position[2];

      if (isLanding) {
        // Smooth transition to final position
        const currentX = meshRef.current.position.x;
        const currentY = meshRef.current.position.y;
        const currentZ = meshRef.current.position.z;

        meshRef.current.position.x = currentX + (targetX - currentX) * landingEased;
        meshRef.current.position.y = currentY + (targetY - currentY) * landingEased;
        meshRef.current.position.z = currentZ + (targetZ - currentZ) * landingEased;
      } else {
        meshRef.current.position.x = position[0] + (1 - eased) * (Math.sin(time * 8) * 0.2);
        meshRef.current.position.y = position[1] + height;
        meshRef.current.position.z = position[2] + (1 - eased) * (Math.cos(time * 7) * 0.2);
      }

    } else {
      // PHASE 3: Final settling - smooth 300ms transition to exact final position
      const settleTime = timeSinceTarget - throwDuration;
      const settleProgress = Math.min(settleTime / settleDuration, 1);

      // Capture starting position/rotation at beginning of settle phase
      if (!hasStartedSettlingRef.current) {
        hasStartedSettlingRef.current = true;
        settleStartPosRef.current = {
          x: meshRef.current.position.x,
          y: meshRef.current.position.y,
          z: meshRef.current.position.z,
        };
        settleStartQuatRef.current.copy(meshRef.current.quaternion);
      }

      // Smooth ease out
      const settleEased = 1 - Math.pow(1 - settleProgress, 2);

      // Interpolate position
      meshRef.current.position.x = settleStartPosRef.current.x + (position[0] - settleStartPosRef.current.x) * settleEased;
      meshRef.current.position.y = settleStartPosRef.current.y + (position[1] - settleStartPosRef.current.y) * settleEased;
      meshRef.current.position.z = settleStartPosRef.current.z + (position[2] - settleStartPosRef.current.z) * settleEased;

      // Slerp rotation to exact target
      const currentQuat = settleStartQuatRef.current.clone();
      currentQuat.slerp(targetQuatRef.current, settleEased);
      meshRef.current.quaternion.copy(currentQuat);

      // Done
      if (settleProgress >= 1 && !hasSettledRef.current) {
        hasSettledRef.current = true;
        isAnimatingRef.current = false; // Reset sync guard
        setIsAnimating(false);
        meshRef.current.position.set(position[0], position[1], position[2]);
        meshRef.current.quaternion.copy(targetQuatRef.current);
        console.log('D6: Settled on face', targetFace);
        onSettled?.();
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      castShadow
      receiveShadow
      material={materials}
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
}
