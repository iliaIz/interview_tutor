import confetti from 'canvas-confetti';

/**
 * Fires a boutique, pastel-hued celebration confetti burst
 * when an interview answer or quiz is successfully passed (score >= 80).
 */
export const triggerSuccessConfetti = () => {
  const pastelColors = ['#E08E89', '#8B78E6', '#5A9E96', '#FFC6C7', '#E8AEB7', '#B8C0FF'];

  // Left burst
  confetti({
    particleCount: 35,
    spread: 60,
    origin: { x: 0.25, y: 0.7 },
    colors: pastelColors,
    ticks: 200,
    gravity: 0.9,
    scalar: 0.9,
    shapes: ['circle', 'square'],
  });

  // Right burst
  confetti({
    particleCount: 35,
    spread: 60,
    origin: { x: 0.75, y: 0.7 },
    colors: pastelColors,
    ticks: 200,
    gravity: 0.9,
    scalar: 0.9,
    shapes: ['circle', 'square'],
  });
};
