'use client';

import { useState, useEffect, useRef } from 'react';

interface CoinParticle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  scale: number;
  opacity: number;
}

interface GoldCoinExplosionProps {
  active: boolean;
  onComplete: () => void;
  /** Scale multiplier for larger elements (default 1) */
  sizeMultiplier?: number;
}

export function GoldCoinExplosion({ active, onComplete, sizeMultiplier = 1 }: GoldCoinExplosionProps) {
  const [particles, setParticles] = useState<CoinParticle[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (active) {
      // Create particles - 20% bigger than original
      const newParticles: CoinParticle[] = [];
      const particleCount = 14; // More particles

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        newParticles.push({
          id: i,
          x: 0,
          y: 0,
          angle,
          // 20% faster/farther travel
          speed: (48 + Math.random() * 36) * sizeMultiplier,
          // 20% larger particles
          scale: (0.6 + Math.random() * 0.6) * sizeMultiplier,
          opacity: 1,
        });
      }

      setParticles(newParticles);
      startTimeRef.current = Date.now();

      // Animate particles
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const duration = 700; // Slightly longer
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          setParticles(prev => prev.map(p => ({
            ...p,
            x: Math.cos(p.angle) * p.speed * progress,
            // 20% higher arc
            y: Math.sin(p.angle) * p.speed * progress - 24 * progress * progress * sizeMultiplier,
            opacity: 1 - progress,
            scale: p.scale * (1 - progress * 0.5),
          })));
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setParticles([]);
          onComplete();
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [active, onComplete, sizeMultiplier]);

  if (!active || particles.length === 0) return null;

  // Base particle size 20% larger (3.6px -> 4px, round up)
  const particleSize = Math.round(4 * sizeMultiplier);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(${p.x - particleSize / 2}px, ${p.y - particleSize / 2}px) scale(${p.scale})`,
            opacity: p.opacity,
          }}
        >
          <div
            style={{
              width: `${particleSize}px`,
              height: `${particleSize}px`,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)',
              boxShadow: '0 0 6px #FFD700, inset 0 -1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </div>
      ))}
    </div>
  );
}
