'use client';

import { motion, useReducedMotion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface RevealProps {
  children: ReactNode;
  /** Cuánto se desplaza el elemento mientras se revela. Default: 32px */
  distance?: number;
  /** Dirección del desplazamiento de entrada. Default: 'up' */
  direction?: Direction;
  /** Retardo (s) para escalonar revelados. Default: 0 */
  delay?: number;
  /** Duración (s) de la animación. Default: 0.8 */
  duration?: number;
  /** Solo se anima la primera vez que entra en viewport. Default: true */
  once?: boolean;
  /** Margen del viewport para disparar antes/después. Default: '-10% 0px' */
  margin?: string;
  /** Clase extra opcional sobre el wrapper motion.div */
  className?: string;
  /** Renderizar como bloque inline (span) en lugar de div */
  as?: 'div' | 'span' | 'li' | 'section';
}

/**
 * Reveal — wrapper para animar children al entrar en el viewport.
 * Respeta prefers-reduced-motion automáticamente.
 *
 * Uso típico:
 *   <Reveal delay={0.1}><h2>Título</h2></Reveal>
 *   <Reveal direction="left" delay={0.2}>...</Reveal>
 */
export default function Reveal({
  children,
  distance = 32,
  direction = 'up',
  delay = 0,
  duration = 0.8,
  once = true,
  margin = '-10% 0px',
  className,
  as = 'div',
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion();

  const offset = (() => {
    if (prefersReducedMotion || direction === 'none') return { x: 0, y: 0 };
    switch (direction) {
      case 'up':
        return { x: 0, y: distance };
      case 'down':
        return { x: 0, y: -distance };
      case 'left':
        return { x: distance, y: 0 };
      case 'right':
        return { x: -distance, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  })();

  const variants: Variants = {
    hidden: { opacity: 0, ...offset },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : duration,
        delay: prefersReducedMotion ? 0 : delay,
        ease: [0.16, 1, 0.3, 1], // cubic-bezier "expo-out": cinematic
      },
    },
  };

  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: margin as `${number}% 0px` }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}
