(function initialisePixelSprites(global) {
  'use strict';

  const styles = {
    basic: {primary: '#db3435', secondary: '#245ca7', accent: '#edf7f4', dark: '#151b27'},
    civil: {primary: '#235da7', secondary: '#c83435', accent: '#f1f4ef', dark: '#17243c'},
    mechanical: {primary: '#626c72', secondary: '#a83236', accent: '#e4bc45', dark: '#222b31'},
    electrical: {primary: '#b43234', secondary: '#e0ae3f', accent: '#d9f7ff', dark: '#351d21'}
  };

  const rect = (ctx, colour, x, y, width, height) => {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  };

  function drawGhost(ctx, options) {
    const {x, y, frame = 0, scale = 1, shadow = true} = options;
    const bob = frame % 4 === 1 || frame % 4 === 3 ? -1 : 0;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (shadow) rect(ctx, '#06141955', -10, -2, 20, 4);
    rect(ctx, '#071418', -10, -29 + bob, 20, 25);
    rect(ctx, '#071418', -11, -8 + bob, 5, 9);
    rect(ctx, '#071418', -3, -8 + bob, 6, 10);
    rect(ctx, '#071418', 7, -8 + bob, 4, 9);
    rect(ctx, '#e8fff6', -8, -27 + bob, 16, 20);
    rect(ctx, '#e8fff6', -9, -7 + bob, 3, 6);
    rect(ctx, '#e8fff6', -2, -7 + bob, 5, 7);
    rect(ctx, '#e8fff6', 8, -7 + bob, 2, 6);
    rect(ctx, '#c6eee5', -7, -8 + bob, 14, 3);
    rect(ctx, '#174451', -5, -20 + bob, 3, 4);
    rect(ctx, '#174451', 3, -20 + bob, 3, 4);
    rect(ctx, '#63f5d1', -2, -13 + bob, 4, 2);
    ctx.restore();
  }

  function drawCharacter(ctx, options = {}) {
    if (options.ghost || !styles[options.courseId]) return drawGhost(ctx, options);
    const {
      x, y, courseId, facing = 'down', frame = 0, scale = 1,
      shadow = true, invulnerable = false
    } = options;
    if (invulnerable && frame % 2) return;
    const style = styles[courseId];
    const movingFrame = frame % 4;
    const bob = movingFrame === 1 || movingFrame === 3 ? -1 : 0;
    const leftStep = movingFrame === 1 ? -2 : (movingFrame === 3 ? 1 : 0);
    const rightStep = movingFrame === 3 ? -2 : (movingFrame === 1 ? 1 : 0);
    const side = facing === 'left' ? -1 : 1;
    const skin = '#efb98b';
    const outline = '#081318';

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (shadow) {
      rect(ctx, '#06141955', -11, -2, 22, 4);
      rect(ctx, '#06141933', -7, 1, 14, 2);
    }

    // Course accessories sit behind the body.
    if (courseId === 'mechanical') {
      rect(ctx, outline, 7, -25 + bob, 6, 23);
      rect(ctx, style.secondary, 8, -24 + bob, 4, 21);
    }
    if (courseId === 'civil') {
      rect(ctx, outline, -14, -20 + bob, 9, 17);
      rect(ctx, style.secondary, -13, -19 + bob, 7, 15);
      rect(ctx, style.accent, -12, -16 + bob, 5, 8);
      rect(ctx, style.primary, -11, -14 + bob, 3, 4);
    }

    // Animated legs and boots.
    rect(ctx, outline, -8, -10 + bob + leftStep, 7, 11);
    rect(ctx, outline, 1, -10 + bob + rightStep, 7, 11);
    rect(ctx, style.secondary, -6, -9 + bob + leftStep, 5, 7);
    rect(ctx, style.secondary, 1, -9 + bob + rightStep, 5, 7);
    rect(ctx, style.dark, -7, -3 + bob + leftStep, 7, 4);
    rect(ctx, style.dark, 1, -3 + bob + rightStep, 7, 4);

    // Arms swing opposite to the legs.
    const armSwing = movingFrame === 1 ? 2 : (movingFrame === 3 ? -2 : 0);
    rect(ctx, outline, -13, -21 + bob - armSwing, 6, 14);
    rect(ctx, outline, 7, -21 + bob + armSwing, 6, 14);
    rect(ctx, style.primary, -11, -20 + bob - armSwing, 4, 10);
    rect(ctx, style.primary, 7, -20 + bob + armSwing, 4, 10);
    rect(ctx, style.accent, -11, -11 + bob - armSwing, 4, 3);
    rect(ctx, style.accent, 7, -11 + bob + armSwing, 4, 3);

    // Compact chibi torso.
    rect(ctx, outline, -9, -23 + bob, 18, 15);
    rect(ctx, style.primary, -7, -22 + bob, 14, 13);
    rect(ctx, style.secondary, -6, -13 + bob, 12, 4);

    // Large expressive head / helmet.
    rect(ctx, outline, -11, -37 + bob, 22, 16);
    rect(ctx, outline, -9, -39 + bob, 18, 3);
    rect(ctx, style.primary, -9, -36 + bob, 18, 13);
    rect(ctx, style.dark, -8, -38 + bob, 16, 3);

    if (facing === 'up') {
      rect(ctx, style.secondary, -7, -34 + bob, 14, 9);
      rect(ctx, style.accent, -4, -31 + bob, 8, 3);
    } else if (facing === 'left' || facing === 'right') {
      const eyeX = side > 0 ? 4 : -7;
      rect(ctx, skin, -6, -33 + bob, 12, 7);
      rect(ctx, style.accent, eyeX, -31 + bob, 3, 3);
      rect(ctx, outline, side > 0 ? 7 : -9, -33 + bob, 2, 7);
    } else {
      rect(ctx, skin, -6, -33 + bob, 12, 8);
      rect(ctx, style.accent, -5, -31 + bob, 3, 3);
      rect(ctx, style.accent, 3, -31 + bob, 3, 3);
      rect(ctx, outline, -1, -26 + bob, 3, 2);
    }

    // Programme-specific readable motifs.
    if (courseId === 'electrical') {
      rect(ctx, style.secondary, -6, -36 + bob, 12, 4);
      rect(ctx, style.secondary, -7, -28 + bob, 3, 4);
      rect(ctx, style.secondary, 4, -28 + bob, 3, 4);
      rect(ctx, style.accent, -3, -19 + bob, 6, 6);
      rect(ctx, '#63d9ed', -1, -17 + bob, 2, 2);
    } else if (courseId === 'mechanical') {
      rect(ctx, '#aeb9bd', -8, -37 + bob, 16, 4);
      rect(ctx, '#aeb9bd', -13, -37 + bob, 5, 6);
      rect(ctx, '#aeb9bd', 8, -37 + bob, 5, 6);
      rect(ctx, style.accent, -5, -21 + bob, 4, 4);
      rect(ctx, style.accent, 2, -21 + bob, 4, 4);
      rect(ctx, '#9aa7ac', -17, -17 + bob, 6, 7);
      rect(ctx, '#604839', -15, -10 + bob, 2, 9);
    } else if (courseId === 'basic') {
      rect(ctx, outline, -1, -36 + bob, 2, 12);
      rect(ctx, outline, -7, -30 + bob, 14, 1);
      rect(ctx, style.accent, -6, -33 + bob, 4, 5);
      rect(ctx, style.accent, 2, -33 + bob, 4, 5);
      rect(ctx, outline, -1, -22 + bob, 2, 12);
    } else if (courseId === 'civil') {
      rect(ctx, style.accent, -2, -36 + bob, 4, 6);
      rect(ctx, style.accent, -5, -34 + bob, 10, 2);
      rect(ctx, style.accent, -5, -20 + bob, 10, 5);
      rect(ctx, style.secondary, -5, -17 + bob, 10, 2);
    }
    ctx.restore();
  }

  function drawRobotCompanion(ctx, options = {}) {
    const {x, y, frame = 0, scale = 1, facing = 'down', shadow = true, alert = false} = options;
    const bob = frame % 4 === 1 || frame % 4 === 3 ? -1 : 0;
    const step = frame % 4 === 1 ? -1 : (frame % 4 === 3 ? 1 : 0);
    const outline = '#07131d';
    const blueDark = '#2d58bc';
    const blue = '#4e82f2';
    const blueLight = '#78a7ff';
    const screen = '#162759';
    const glow = '#94f6ff';
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (shadow) {
      rect(ctx, '#06141955', -13, -2, 26, 5);
      rect(ctx, '#06141933', -8, 2, 16, 2);
    }

    // Small trailing legs and rounded arms.
    rect(ctx, outline, -8, -8 + bob + step, 7, 9);
    rect(ctx, outline, 1, -8 + bob - step, 7, 9);
    rect(ctx, blueDark, -6, -7 + bob + step, 5, 6);
    rect(ctx, blueDark, 1, -7 + bob - step, 5, 6);
    rect(ctx, outline, -14, -18 + bob, 6, 12);
    rect(ctx, outline, 8, -18 + bob, 6, 12);
    rect(ctx, blue, -12, -17 + bob, 4, 9);
    rect(ctx, blue, 8, -17 + bob, 4, 9);

    // Compact body and bright chest status display.
    rect(ctx, outline, -10, -20 + bob, 20, 14);
    rect(ctx, blueDark, -8, -19 + bob, 16, 11);
    rect(ctx, blue, -7, -18 + bob, 14, 8);
    rect(ctx, glow, -3, -16 + bob, 3, 2);
    rect(ctx, glow, -1, -14 + bob, 3, 2);
    rect(ctx, glow, 3, -14 + bob, 3, 2);

    // Cloud-shaped blue head copied as pixel geometry from the supplied style.
    rect(ctx, outline, -12, -39 + bob, 24, 4);
    rect(ctx, outline, -16, -35 + bob, 32, 18);
    rect(ctx, outline, -18, -31 + bob, 36, 10);
    rect(ctx, outline, -13, -17 + bob, 26, 3);
    rect(ctx, blueDark, -11, -37 + bob, 22, 2);
    rect(ctx, blue, -14, -34 + bob, 28, 16);
    rect(ctx, blue, -16, -30 + bob, 32, 8);
    rect(ctx, blueDark, -12, -19 + bob, 24, 3);
    rect(ctx, blueLight, -10, -35 + bob, 18, 3);
    rect(ctx, blueLight, -14, -31 + bob, 3, 7);

    // Dark face screen with the same cyan chevron-and-dash expression.
    rect(ctx, outline, -11, -32 + bob, 22, 12);
    rect(ctx, screen, -9, -30 + bob, 18, 8);
    if (facing !== 'up') {
      rect(ctx, glow, -6, -28 + bob, 2, 2);
      rect(ctx, glow, -4, -26 + bob, 2, 2);
      rect(ctx, glow, -6, -24 + bob, 2, 2);
      rect(ctx, glow, 2, -25 + bob, 5, 2);
    } else {
      rect(ctx, blueLight, -6, -27 + bob, 12, 3);
    }

    if (alert) {
      rect(ctx, outline, 13, -46 + bob, 10, 12);
      rect(ctx, '#ffe36e', 15, -44 + bob, 6, 8);
      rect(ctx, outline, 17, -42 + bob, 2, 4);
      rect(ctx, outline, 17, -36 + bob, 2, 2);
    }
    ctx.restore();
  }

  function drawLecturer(ctx, options = {}) {
    const {x, y, frame = 0, scale = 1, shadow = true} = options;
    const bob = frame % 4 === 1 ? -1 : 0;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (shadow) rect(ctx, '#06141955', -10, -2, 20, 4);
    rect(ctx, '#071418', -10, -36 + bob, 20, 16);
    rect(ctx, '#47312e', -8, -38 + bob, 16, 5);
    rect(ctx, '#efb98b', -7, -33 + bob, 14, 10);
    rect(ctx, '#071418', -5, -30 + bob, 3, 2);
    rect(ctx, '#071418', 3, -30 + bob, 3, 2);
    rect(ctx, '#071418', -11, -23 + bob, 22, 15);
    rect(ctx, '#f4f3e8', -9, -22 + bob, 18, 13);
    rect(ctx, '#f4d35e', -3, -21 + bob, 6, 10);
    rect(ctx, '#24424b', -8, -9 + bob, 7, 9);
    rect(ctx, '#24424b', 1, -9 + bob, 7, 9);
    rect(ctx, '#63f5d1', 7, -20 + bob, 4, 7);
    ctx.restore();
  }

  function drawGuard(ctx, options = {}) {
    const {x, y, frame = 0, scale = 1, shadow = true} = options;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (shadow) rect(ctx, '#06141955', -11, -2, 22, 4);
    rect(ctx, '#071418', -10, -36, 20, 15);
    rect(ctx, '#172c4b', -9, -38, 18, 6);
    rect(ctx, '#f1b98c', -7, -32, 14, 9);
    rect(ctx, '#071418', -5, -29, 3, 2);
    rect(ctx, '#071418', 3, -29, 3, 2);
    rect(ctx, '#071418', -11, -23, 22, 15);
    rect(ctx, '#1f4166', -9, -22, 18, 13);
    rect(ctx, '#e6f0ef', -5, -20, 10, 4);
    rect(ctx, '#18222b', -8, -9, 7, 9);
    rect(ctx, '#18222b', 1, -9, 7, 9);
    rect(ctx, '#ff716a', 7, -20 + (frame % 2), 4, 8);
    ctx.restore();
  }

  global.SeventhReactionSprites = Object.freeze({drawCharacter, drawGhost, drawRobotCompanion, drawLecturer, drawGuard, styles});
})(globalThis);
