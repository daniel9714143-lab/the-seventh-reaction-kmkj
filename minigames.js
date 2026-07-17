(function initialiseChampionChemistryGames(global) {
  'use strict';

  const overlay = document.getElementById('mini-game-screen');
  const canvas = document.getElementById('mini-game-canvas');
  const ctx = canvas.getContext('2d');
  const sprites = global.SeventhReactionSprites;
  const byId = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, amount) => from + (to - from) * amount;
  const laneX = lane => 200 + lane * 120;
  const rhythmLaneX = lane => 131 + lane * 126;
  const rect = (colour, x, y, width, height) => {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  };
  const text = (value, x, y, colour = '#e9fff4', size = 10, align = 'left') => {
    ctx.fillStyle = colour;
    ctx.font = `bold ${size}px monospace`;
    ctx.textAlign = align;
    ctx.fillText(String(value), Math.round(x), Math.round(y));
  };

  const games = {
    'lab-calibration': {
      mode: 'rally', title: 'REACTION RALLY', kicker: 'CHAPTER 1 · MAKMAL CHEMISTRY', duration: 55,
      instructions: 'Move the calibration paddle and return 18 accelerating reagent orbs. Time ACTION near the paddle for a powered return.',
      accent: '#63f5d1', target: 18, action: 'POWER RETURN · SPACE', status: 'RALLY'
    },
    'spectrum-lock': {
      mode: 'archery', title: 'SPECTRUM ARCHERY', kicker: 'CHAPTER 2 · DEWAN TEKNOKRAT', duration: 48,
      instructions: 'Aim with the arrow keys and fire photons through moving spectral targets. Hit 12 targets before focus is lost.',
      accent: '#a98aff', target: 12, action: 'FIRE PHOTON · SPACE', status: 'TARGETS'
    },
    'periodic-compass': {
      mode: 'climb', title: 'PERIODIC ASCENT', kicker: 'CHAPTER 3 · DEWAN KULIAH 5', duration: 50,
      instructions: 'Choose the correct periodic platform and leap only when it reaches the gold timing zone. Complete 11 precise climbs.',
      accent: '#82ef91', target: 1100, action: 'LEAP · SPACE', status: 'HEIGHT'
    },
    'treasure-hunt': {
      mode: 'skate', title: 'BONDED SKATE QUEST', kicker: 'CHAPTER 4 · PERPUSTAKAAN', duration: 58,
      instructions: 'Skate through the archive, jump obstacles, perform aerial turns, and recover five molecular keys.',
      accent: '#ffe36e', target: 5, action: 'JUMP · SPACE', status: 'MOLECULAR KEYS'
    },
    'boss-key-challenge': {
      mode: 'rugby', title: 'SNOWBALL KEY RUSH', kicker: 'CHAPTER 5 · BILIK PENSYARAH', duration: 46,
      instructions: 'Dart between three lanes, dodge the Office Boss team, collect seven key fragments, and use ACTION to charge through danger.',
      accent: '#dff7ff', target: 7, action: 'CHARGE · SPACE', status: 'KEY FRAGMENTS'
    },
    'course-workshop': {
      mode: 'rhythm', title: 'EQUILIBRIUM PIANO TILES', kicker: 'CHAPTER 6 · BENGKEL KEJURUTERAAN', duration: 45,
      instructions: 'Tap 20 falling reaction tiles. Use D F J K, tap a lane, or select a lane and press SPACE. The large sensitive zone accepts early and late taps, and misses never remove a shield.',
      accent: '#63f5d1', target: 20, action: 'TAP SELECTED TILE · SPACE', status: 'REACTION TILES'
    },
    'escape-runner': {
      mode: 'subway', title: 'KMKJ ESCAPE RUNNER', kicker: 'CHAPTER 7 · PONDOK SECURITY', duration: 50,
      instructions: 'The chase starts at full speed. Switch lanes, jump barriers, slide under gates, collect reaction cells, and outrun Security.',
      accent: '#ff716a', target: 18000, action: 'JUMP SPACE · SLIDE ↓', status: 'ESCAPE'
    }
  };

  const courseThemes = {
    basic: {name: 'BASIC LOGIC ARRAY', primary: '#df3438', accent: '#2d66b1', symbol: 'B'},
    civil: {name: 'CIVIL LOAD GRID', primary: '#245fa9', accent: '#d43a3b', symbol: 'C'},
    mechanical: {name: 'MECHANICAL TURBINE', primary: '#727c82', accent: '#e5bc42', symbol: 'M'},
    electrical: {name: 'E&E CIRCUIT', primary: '#b73538', accent: '#f0bf43', symbol: 'E'}
  };

  class MiniGameController extends EventTarget {
    constructor() {
      super();
      this.type = null;
      this.definition = null;
      this.options = {};
      this.active = false;
      this.elapsed = 0;
      this.lastTime = 0;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.lives = 3;
      this.maxLives = 3;
      this.invulnerable = 0;
      this.flash = 0;
      this.shake = 0;
      this.particles = [];
      this.keys = new Set();
      this.raf = 0;
      this.frame = this.frame.bind(this);
      this.bind();
      this.drawIdle();
    }

    bind() {
      byId('mini-start').addEventListener('click', () => this.active ? this.primaryAction() : this.begin());
      byId('mini-left').addEventListener('click', () => this.moveHorizontal(-1));
      byId('mini-right').addEventListener('click', () => this.moveHorizontal(1));
      for (let lane = 0; lane < 4; lane += 1) {
        byId(`rhythm-lane-${lane}`).addEventListener('click', () => this.hitRhythmLane(lane));
      }

      const typing = target => Boolean(target?.matches?.('input, textarea, select, [contenteditable="true"]'));
      window.addEventListener('keydown', event => {
        if (overlay.classList.contains('hidden') || typing(event.target)) return;
        const key = event.key.toLowerCase();
        if (this.active && this.definition?.mode === 'rhythm') {
          const rhythmKeys = {d: 0, f: 1, j: 2, k: 3, '1': 0, '2': 1, '3': 2, '4': 3};
          if (Object.hasOwn(rhythmKeys, key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!event.repeat) this.hitRhythmLane(rhythmKeys[key]);
            return;
          }
        }
        const handled = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', ' ', 'e', 'enter'].includes(key);
        if (!handled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === 'arrowleft' || key === 'a') {
          this.keys.add('left');
          if (!event.repeat) this.moveHorizontal(-1);
        } else if (key === 'arrowright' || key === 'd') {
          this.keys.add('right');
          if (!event.repeat) this.moveHorizontal(1);
        } else if (key === 'arrowup' || key === 'w') {
          this.keys.add('up');
          if (!event.repeat) this.verticalAction(-1);
        } else if (key === 'arrowdown' || key === 's') {
          this.keys.add('down');
          if (!event.repeat) this.verticalAction(1);
        } else if (!event.repeat) this.primaryAction();
      }, true);
      window.addEventListener('keyup', event => {
        const key = event.key.toLowerCase();
        if (key === 'arrowleft' || key === 'a') this.keys.delete('left');
        if (key === 'arrowright' || key === 'd') this.keys.delete('right');
        if (key === 'arrowup' || key === 'w') this.keys.delete('up');
        if (key === 'arrowdown' || key === 's') this.keys.delete('down');
      }, true);
      window.addEventListener('blur', () => this.keys.clear());
      canvas.addEventListener('pointerdown', event => this.handleCanvasPointer(event));
    }

    start(type, options = {}) {
      if (!games[type]) throw new Error(`Unknown mini-game: ${type}`);
      this.type = type;
      this.options = options;
      this.definition = {...games[type]};
      if (type === 'course-workshop') {
        const course = courseThemes[options.course] || courseThemes.basic;
        this.definition.title = `${course.name} PIANO TILES`;
        this.definition.instructions = `Tap 20 ${course.name.toLowerCase()} reaction tiles. Use D F J K, tap a lane, or select a lane and press SPACE. The sensitive zone accepts early and late taps; misses never remove a shield.`;
      }
      this.reset();
      byId('mini-game-kicker').textContent = this.definition.kicker;
      byId('mini-game-title').textContent = this.definition.title;
      byId('mini-game-instructions').textContent = this.definition.instructions;
      byId('mini-start').textContent = 'START CHALLENGE';
      byId('mini-start').disabled = false;
      byId('mini-left').disabled = false;
      byId('mini-right').disabled = false;
      byId('rhythm-controls').classList.toggle('hidden', this.definition.mode !== 'rhythm');
      this.setRhythmControls(false);
      byId('mini-countdown').textContent = 'READY';
      byId('mini-countdown').classList.remove('hidden');
      byId('mini-time').textContent = String(this.definition.duration);
      overlay.classList.remove('hidden');
      this.renderProgress();
      this.draw();
    }

    reset() {
      this.active = false;
      this.elapsed = 0;
      this.lastTime = 0;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.maxLives = 3;
      this.lives = this.maxLives;
      this.invulnerable = 0;
      this.flash = 0;
      this.shake = 0;
      this.particles = [];
      this.keys.clear();
      this.setupMode();
    }

    setupMode() {
      if (this.definition.mode === 'rally') {
        this.paddleX = 320;
        this.opponentX = 320;
        this.rallyHits = 0;
        this.powerWindow = 0;
        this.ball = {x: 320, y: 175, vx: 125, vy: 205};
      } else if (this.definition.mode === 'archery') {
        this.aim = {x: 500, y: 170};
        this.arrows = [];
        this.targets = [];
        this.targetHits = 0;
        this.archerySpawn = 0;
        this.fireCooldown = 0;
        this.archeryMisses = 0;
      } else if (this.definition.mode === 'climb') {
        this.lane = 1;
        this.climbHeight = 0;
        this.climbStep = 0;
        this.climbPhase = 0;
        this.climbCooldown = 0;
        this.climbSequence = [1, 2, 0, 2, 1, 0, 1, 2, 0, 0, 2, 1, 0, 2];
      } else if (this.definition.mode === 'skate') {
        this.skateDistance = 0;
        this.skateSpeed = 215;
        this.skateJump = 0;
        this.skateVelocity = 0;
        this.skateRotation = 0;
        this.skateObjects = [];
        this.skateSpawn = .25;
        this.skateSpawnIndex = 0;
        this.found = 0;
      } else if (this.definition.mode === 'rugby') {
        this.lane = 1;
        this.rugbyDistance = 0;
        this.rugbyObjects = [];
        this.rugbySpawn = .25;
        this.rugbyIndex = 0;
        this.fragments = 0;
        this.dash = 0;
        this.dashCooldown = 0;
      } else if (this.definition.mode === 'rhythm') {
        this.lane = 1;
        this.rhythmNotes = [];
        this.rhythmSpawn = .55;
        this.rhythmIndex = 0;
        this.rhythmHits = 0;
        this.rhythmResolved = 0;
        this.rhythmMissChain = 0;
        this.rhythmJudgement = '';
        this.rhythmJudgementTime = 0;
        this.rhythmLaneFlash = [0, 0, 0, 0];
      } else if (this.definition.mode === 'subway') {
        this.lane = 1;
        this.escapeDistance = 0;
        this.runnerObjects = [];
        this.runnerSpawn = .12;
        this.runnerIndex = 0;
        this.runnerJump = 0;
        this.runnerVelocity = 0;
        this.slide = 0;
        this.energyCells = 0;
        this.guardPressure = .25;
      }
    }

    begin() {
      if (this.active || !this.definition) return;
      if (this.elapsed >= this.definition.duration || this.lives <= 0) this.reset();
      this.active = true;
      this.lastTime = 0;
      byId('mini-start').disabled = false;
      byId('mini-start').textContent = this.definition.action;
      byId('mini-countdown').classList.add('hidden');
      this.setRhythmControls(this.definition.mode === 'rhythm');
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.frame);
    }

    close() {
      this.active = false;
      this.keys.clear();
      this.setRhythmControls(false);
      cancelAnimationFrame(this.raf);
      overlay.classList.add('hidden');
    }

    frame(timestamp) {
      if (!this.active) return;
      const delta = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, .045) : 0;
      this.lastTime = timestamp;
      this.elapsed += delta;
      this.invulnerable = Math.max(0, this.invulnerable - delta);
      this.flash = Math.max(0, this.flash - delta);
      this.shake = Math.max(0, this.shake - delta);
      this.updateParticles(delta);
      this.updateMode(delta);
      byId('mini-time').textContent = String(Math.max(0, Math.ceil(this.definition.duration - this.elapsed)));
      this.renderProgress();
      this.draw();

      if (this.modeComplete()) return this.succeed();
      if (this.lives <= 0) return this.fail('ALL SHIELDS LOST');
      if (this.elapsed >= this.definition.duration) {
        if (this.definition.mode === 'rhythm' && this.rhythmPassed()) return this.succeed();
        return this.fail('TIME EXPIRED');
      }
      this.raf = requestAnimationFrame(this.frame);
    }

    updateMode(delta) {
      if (this.definition.mode === 'rally') this.updateRally(delta);
      else if (this.definition.mode === 'archery') this.updateArchery(delta);
      else if (this.definition.mode === 'climb') this.updateClimb(delta);
      else if (this.definition.mode === 'skate') this.updateSkate(delta);
      else if (this.definition.mode === 'rugby') this.updateRugby(delta);
      else if (this.definition.mode === 'rhythm') this.updateRhythm(delta);
      else this.updateSubway(delta);
    }

    updateRally(delta) {
      const movement = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
      this.paddleX = clamp(this.paddleX + movement * 310 * delta, 90, 550);
      this.powerWindow = Math.max(0, this.powerWindow - delta);
      this.opponentX += clamp(this.ball.x - this.opponentX, -190 * delta, 190 * delta);
      this.ball.x += this.ball.vx * delta;
      this.ball.y += this.ball.vy * delta;
      if (this.ball.x < 25 || this.ball.x > 615) {
        this.ball.x = clamp(this.ball.x, 25, 615);
        this.ball.vx *= -1;
        this.burst(this.ball.x, this.ball.y, '#e9fff4', 4);
      }
      if (this.ball.vy < 0 && this.ball.y < 63) {
        if (Math.abs(this.ball.x - this.opponentX) < 72) {
          this.ball.y = 63;
          this.ball.vy = Math.abs(this.ball.vy) * 1.015;
          this.ball.vx += (this.ball.x - this.opponentX) * .9;
          this.burst(this.ball.x, 65, '#ff716a', 5);
        } else {
          this.score += 250;
          this.resetRallyBall(true);
        }
      }
      if (this.ball.vy > 0 && this.ball.y > 292) {
        if (Math.abs(this.ball.x - this.paddleX) < (this.powerWindow > 0 ? 93 : 69)) {
          const powered = this.powerWindow > 0;
          this.ball.y = 292;
          this.ball.vy = -Math.abs(this.ball.vy) * (powered ? 1.12 : 1.045);
          this.ball.vx += (this.ball.x - this.paddleX) * 1.25;
          this.rallyHits += 1;
          this.combo += 1;
          this.bestCombo = Math.max(this.bestCombo, this.combo);
          this.score += powered ? 260 + this.combo * 25 : 150 + this.combo * 15;
          this.powerWindow = 0;
          this.shake = powered ? .12 : 0;
          this.burst(this.ball.x, 293, powered ? '#ffe36e' : this.definition.accent, powered ? 14 : 7);
        } else if (this.ball.y > 350) {
          this.hitPlayer(this.paddleX, 325);
          this.resetRallyBall(true);
        }
      }
      const maxSpeed = 430;
      this.ball.vx = clamp(this.ball.vx, -maxSpeed, maxSpeed);
      this.ball.vy = clamp(this.ball.vy, -maxSpeed, maxSpeed);
    }

    resetRallyBall(downward) {
      const direction = this.rallyHits % 2 ? -1 : 1;
      this.ball = {x: 320, y: 170, vx: (120 + this.rallyHits * 5) * direction, vy: (205 + this.rallyHits * 8) * (downward ? 1 : -1)};
      this.combo = 0;
    }

    updateArchery(delta) {
      const horizontal = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
      const vertical = (this.keys.has('down') ? 1 : 0) - (this.keys.has('up') ? 1 : 0);
      this.aim.x = clamp(this.aim.x + horizontal * 230 * delta, 300, 602);
      this.aim.y = clamp(this.aim.y + vertical * 230 * delta, 62, 292);
      this.fireCooldown = Math.max(0, this.fireCooldown - delta);
      this.archerySpawn -= delta;
      if (this.archerySpawn <= 0 && this.targets.length < 4) {
        const index = this.targetHits + this.targets.length + Math.floor(this.elapsed * 2);
        this.targets.push({
          x: 400 + (index * 71 % 185), y: 78 + (index * 83 % 190),
          vx: index % 2 ? 42 : -36, vy: index % 3 ? 24 : -28, radius: index % 4 === 0 ? 20 : 25,
          life: 7.5, phase: index * .8
        });
        this.archerySpawn = .82;
      }
      for (const target of this.targets) {
        target.x += target.vx * delta;
        target.y += target.vy * delta;
        target.life -= delta;
        if (target.x < 350 || target.x > 605) target.vx *= -1;
        if (target.y < 60 || target.y > 290) target.vy *= -1;
      }
      this.targets = this.targets.filter(target => target.life > 0 && !target.hit);
      for (const arrow of this.arrows) {
        arrow.x += arrow.vx * delta;
        arrow.y += arrow.vy * delta;
        for (const target of this.targets) {
          const distance = Math.hypot(arrow.x - target.x, arrow.y - target.y);
          if (!arrow.hit && !target.hit && distance < target.radius + 5) {
            arrow.hit = true;
            target.hit = true;
            this.targetHits += 1;
            this.combo += 1;
            this.bestCombo = Math.max(this.bestCombo, this.combo);
            const ring = distance < target.radius * .3 ? 3 : (distance < target.radius * .65 ? 2 : 1);
            this.score += ring * 180 + this.combo * 35;
            this.burst(target.x, target.y, ring === 3 ? '#ffe36e' : this.definition.accent, 16);
          }
        }
        if (!arrow.hit && (arrow.x > 660 || arrow.y < -20 || arrow.y > 380)) arrow.missed = true;
      }
      const newlyMissed = this.arrows.filter(arrow => arrow.missed && !arrow.counted);
      for (const arrow of newlyMissed) {
        arrow.counted = true;
        this.combo = 0;
        this.archeryMisses += 1;
        if (this.archeryMisses % 3 === 0) this.hitPlayer(105, 300);
      }
      this.arrows = this.arrows.filter(arrow => !arrow.hit && !arrow.counted);
    }

    fireArrow() {
      if (this.fireCooldown > 0) return;
      const origin = {x: 108, y: 291};
      const dx = this.aim.x - origin.x;
      const dy = this.aim.y - origin.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      this.arrows.push({x: origin.x, y: origin.y, vx: dx / length * 530, vy: dy / length * 530, hit: false, missed: false});
      this.fireCooldown = .24;
      this.burst(origin.x, origin.y, '#e9fff4', 5);
    }

    updateClimb(delta) {
      this.climbCooldown = Math.max(0, this.climbCooldown - delta);
      const pace = .58 + this.climbHeight / 5200;
      this.climbPhase += delta * pace;
      if (this.climbPhase >= 1) this.resolveClimb(false, 'LATE');
    }

    resolveClimb(success, label = '') {
      if (success) {
        this.climbHeight += 100;
        this.combo += 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        const timing = Math.abs(this.climbPhase - .78);
        this.score += timing < .08 ? 400 + this.combo * 30 : 240 + this.combo * 20;
        this.rhythmJudgement = timing < .08 ? 'PERFECT LEAP' : 'SAFE LEAP';
        this.burst(laneX(this.lane), 287, this.definition.accent, 14);
      } else {
        this.combo = 0;
        this.rhythmJudgement = label || 'MISSED PLATFORM';
        this.hitPlayer(laneX(this.lane), 295);
      }
      this.rhythmJudgementTime = .75;
      this.climbStep += 1;
      this.climbPhase = 0;
      this.climbCooldown = .22;
    }

    attemptClimb() {
      if (this.climbCooldown > 0) return;
      const targetLane = this.climbSequence[this.climbStep % this.climbSequence.length];
      if (this.climbPhase < .5) {
        this.combo = 0;
        this.rhythmJudgement = 'TOO EARLY';
        this.rhythmJudgementTime = .45;
        this.climbCooldown = .25;
        return;
      }
      this.resolveClimb(this.climbPhase <= .96 && this.lane === targetLane, this.lane === targetLane ? 'LATE' : 'WRONG PLATFORM');
    }

    updateSkate(delta) {
      const boost = this.keys.has('right') ? 35 : (this.keys.has('left') ? -25 : 0);
      const speed = clamp(this.skateSpeed + boost + this.elapsed * 1.7, 185, 315);
      this.skateDistance += speed * delta;
      this.skateSpawn -= delta;
      if (this.skateSpawn <= 0) {
        const index = this.skateSpawnIndex++;
        const isKey = index % 3 === 1;
        this.skateObjects.push({
          x: 680, kind: isKey ? 'key' : (index % 2 ? 'stack' : 'cart'),
          high: isKey && index % 2 === 1, hit: false, collected: false, spin: index
        });
        this.skateSpawn = .78 - Math.min(.18, this.elapsed * .003);
      }
      if (this.skateJump < 0 || this.skateVelocity < 0) {
        this.skateVelocity += 940 * delta;
        this.skateJump += this.skateVelocity * delta;
        this.skateRotation += ((this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0)) * 5.4 * delta;
        if (this.skateJump >= 0) {
          if (Math.abs(this.skateRotation) > 2.5) {
            this.combo += 1;
            this.score += 250 + this.combo * 40;
            this.burst(138, 308, '#ffe36e', 10);
          }
          this.skateJump = 0;
          this.skateVelocity = 0;
          this.skateRotation = 0;
        }
      }
      for (const object of this.skateObjects) {
        object.x -= speed * delta;
        if (object.kind === 'key' && !object.collected && object.x < 170 && object.x > 108) {
          const canCollect = object.high ? this.skateJump < -28 : this.skateJump > -65;
          if (canCollect) {
            object.collected = true;
            this.found += 1;
            this.combo += 1;
            this.score += 500 + this.combo * 60;
            this.burst(object.x, object.high ? 235 : 278, this.definition.accent, 16);
          }
        } else if (object.kind !== 'key' && !object.hit && object.x < 168 && object.x > 105 && this.skateJump > -38 && this.invulnerable <= 0) {
          object.hit = true;
          this.hitPlayer(138, 306);
        }
      }
      this.skateObjects = this.skateObjects.filter(object => object.x > -80 && !object.collected);
    }

    jumpSkate() {
      if (this.skateJump === 0 && this.skateVelocity === 0) {
        this.skateVelocity = -430;
        this.burst(138, 318, '#e9fff4', 6);
      }
    }

    updateRugby(delta) {
      const speed = 255 + Math.min(125, this.elapsed * 3.1);
      this.rugbyDistance += speed * delta;
      this.dash = Math.max(0, this.dash - delta);
      this.dashCooldown = Math.max(0, this.dashCooldown - delta);
      this.rugbySpawn -= delta;
      if (this.rugbySpawn <= 0) {
        const sequence = [1, 0, 2, 2, 0, 1, 2, 1, 0, 0, 2, 1];
        const enemyLane = sequence[this.rugbyIndex % sequence.length];
        const safeLane = (enemyLane + 1 + this.rugbyIndex % 2) % 3;
        this.rugbyObjects.push({lane: enemyLane, y: -55, kind: this.rugbyIndex % 3 === 0 ? 'snowball' : 'boss', hit: false});
        if (this.rugbyIndex % 2 === 0) this.rugbyObjects.push({lane: safeLane, y: -115, kind: 'fragment', collected: false});
        this.rugbyIndex += 1;
        this.rugbySpawn = .63 - Math.min(.15, this.elapsed * .003);
      }
      for (const object of this.rugbyObjects) {
        object.y += speed * delta;
        if (object.kind === 'fragment' && !object.collected && object.lane === this.lane && object.y > 275 && object.y < 340) {
          object.collected = true;
          this.fragments += 1;
          this.combo += 1;
          this.score += 350 + this.combo * 50;
          this.burst(laneX(this.lane), 300, '#ffe36e', 14);
        } else if (object.kind !== 'fragment' && !object.hit && object.lane === this.lane && object.y > 274 && object.y < 342) {
          object.hit = true;
          if (this.dash > 0) {
            this.combo += 1;
            this.score += 300 + this.combo * 40;
            this.burst(laneX(this.lane), 300, '#dff7ff', 14);
          } else if (this.invulnerable <= 0) this.hitPlayer(laneX(this.lane), 305);
        }
      }
      this.rugbyObjects = this.rugbyObjects.filter(object => object.y < 400 && !object.collected);
    }

    startDash() {
      if (this.dashCooldown > 0) return;
      this.dash = .36;
      this.dashCooldown = 1.35;
      this.shake = .08;
      this.burst(laneX(this.lane), 320, '#dff7ff', 10);
    }

    setRhythmControls(enabled) {
      for (let lane = 0; lane < 4; lane += 1) byId(`rhythm-lane-${lane}`).disabled = !enabled;
    }

    updateRhythm(delta) {
      this.rhythmJudgementTime = Math.max(0, this.rhythmJudgementTime - delta);
      this.rhythmLaneFlash = this.rhythmLaneFlash.map(value => Math.max(0, value - delta));
      this.rhythmSpawn -= delta;
      if (this.rhythmSpawn <= 0) {
        const sequence = [1, 3, 0, 2, 1, 0, 3, 2, 0, 1, 2, 3, 1, 2, 0, 3];
        this.rhythmNotes.push({lane: sequence[this.rhythmIndex % sequence.length], y: -35, hit: false, missed: false});
        this.rhythmIndex += 1;
        this.rhythmSpawn = .72 - Math.min(.08, this.elapsed * .0018);
      }
      const speed = 154 + Math.min(22, this.elapsed * .55);
      for (const note of this.rhythmNotes) {
        note.y += speed * delta;
        if (!note.hit && !note.missed && note.y > 357) {
          note.missed = true;
          this.rhythmResolved += 1;
          this.rhythmMissChain += 1;
          this.combo = 0;
          this.rhythmJudgement = 'MISS · KEEP GOING';
          this.rhythmJudgementTime = .48;
        }
      }
      this.rhythmNotes = this.rhythmNotes.filter(note => note.y < 410 && !note.hit);
    }

    hitRhythm() {
      this.hitRhythmLane(this.lane);
    }

    hitRhythmLane(lane) {
      if (!this.active || this.definition?.mode !== 'rhythm') return;
      this.lane = clamp(Number(lane) || 0, 0, 3);
      this.rhythmLaneFlash[this.lane] = .18;
      const targetY = 292;
      const candidates = this.rhythmNotes.filter(note => !note.hit && !note.missed && note.lane === this.lane && Math.abs(note.y - targetY) <= 105);
      candidates.sort((a, b) => Math.abs(a.y - targetY) - Math.abs(b.y - targetY));
      const note = candidates[0];
      if (!note) {
        this.rhythmJudgement = 'WAIT FOR A TILE';
        this.rhythmJudgementTime = .3;
        return;
      }
      const offset = Math.abs(note.y - targetY);
      note.hit = true;
      this.rhythmHits += 1;
      this.rhythmResolved += 1;
      this.rhythmMissChain = 0;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const perfect = offset <= 28;
      const good = offset <= 68;
      this.score += perfect ? 360 + this.combo * 28 : (good ? 260 + this.combo * 20 : 180 + this.combo * 14);
      this.rhythmJudgement = perfect ? 'PERFECT' : (good ? 'GOOD' : 'SAFE HIT');
      this.rhythmJudgementTime = .52;
      this.burst(rhythmLaneX(this.lane), targetY, perfect ? '#ffe36e' : this.definition.accent, perfect ? 16 : 11);
    }

    rhythmAccuracy() {
      return this.rhythmResolved ? this.rhythmHits / this.rhythmResolved : 0;
    }

    rhythmPassed() {
      return this.rhythmHits >= this.definition.target;
    }

    updateSubway(delta) {
      // Chapter 7 intentionally begins fast and continues accelerating.
      const speed = Math.min(565, 350 + this.elapsed * 5.1);
      this.escapeDistance += speed * delta;
      this.slide = Math.max(0, this.slide - delta);
      if (this.runnerJump < 0 || this.runnerVelocity < 0) {
        this.runnerVelocity += 1120 * delta;
        this.runnerJump += this.runnerVelocity * delta;
        if (this.runnerJump >= 0) {
          this.runnerJump = 0;
          this.runnerVelocity = 0;
          this.burst(laneX(this.lane), 325, '#e9fff4', 5);
        }
      }
      this.runnerSpawn -= delta;
      if (this.runnerSpawn <= 0) {
        const laneSequence = [1, 0, 2, 1, 2, 0, 0, 2, 1, 0, 2, 1, 1, 2, 0];
        const kindSequence = ['barrier', 'train', 'overhead', 'barrier', 'train', 'barrier', 'overhead'];
        const hazardLane = laneSequence[this.runnerIndex % laneSequence.length];
        const kind = kindSequence[this.runnerIndex % kindSequence.length];
        const safeLane = (hazardLane + 1 + this.runnerIndex % 2) % 3;
        this.runnerObjects.push({lane: hazardLane, y: -85, kind, hit: false});
        for (let coin = 0; coin < 3; coin += 1) {
          this.runnerObjects.push({lane: safeLane, y: -145 - coin * 42, kind: 'cell', collected: false, spin: coin});
        }
        this.runnerIndex += 1;
        this.runnerSpawn = Math.max(.42, .61 - this.elapsed * .0035);
      }
      for (const object of this.runnerObjects) {
        object.y += speed * delta;
        if (object.kind === 'cell' && !object.collected && object.lane === this.lane && object.y > 270 && object.y < 340) {
          object.collected = true;
          this.energyCells += 1;
          this.combo += 1;
          this.bestCombo = Math.max(this.bestCombo, this.combo);
          this.score += 120 + this.combo * 22;
          this.guardPressure = Math.max(.08, this.guardPressure - .025);
          this.burst(laneX(this.lane), 292 + this.runnerJump, '#63f5d1', 10);
        } else if (object.kind !== 'cell' && !object.hit && object.lane === this.lane && object.y > 258 && object.y < 340) {
          const avoided = object.kind === 'barrier' ? this.runnerJump < -38
            : object.kind === 'overhead' ? this.slide > 0
              : false;
          if (avoided) {
            object.hit = true;
            this.score += 220 + this.combo * 20;
            this.burst(laneX(this.lane), 300, '#ffe36e', 8);
          } else if (this.invulnerable <= 0) {
            object.hit = true;
            this.guardPressure = Math.min(1, this.guardPressure + .3);
            this.hitPlayer(laneX(this.lane), 305);
          }
        }
      }
      this.runnerObjects = this.runnerObjects.filter(object => object.y < 430 && !object.collected);
      this.guardPressure = Math.max(.08, this.guardPressure - delta * .01);
    }

    jumpRunner() {
      if (this.runnerJump === 0 && this.runnerVelocity === 0 && this.slide <= 0) {
        this.runnerVelocity = -520;
        this.burst(laneX(this.lane), 324, '#e9fff4', 7);
      }
    }

    slideRunner() {
      if (this.runnerJump === 0) {
        this.slide = .72;
        this.burst(laneX(this.lane), 326, '#ffe36e', 5);
      }
    }

    primaryAction() {
      if (!this.active) return;
      if (this.definition.mode === 'rally') this.powerWindow = .52;
      else if (this.definition.mode === 'archery') this.fireArrow();
      else if (this.definition.mode === 'climb') this.attemptClimb();
      else if (this.definition.mode === 'skate') this.jumpSkate();
      else if (this.definition.mode === 'rugby') this.startDash();
      else if (this.definition.mode === 'rhythm') this.hitRhythm();
      else this.jumpRunner();
    }

    moveHorizontal(direction) {
      if (!this.active) return;
      if (this.definition.mode === 'rally') this.paddleX = clamp(this.paddleX + direction * 38, 90, 550);
      else if (this.definition.mode === 'archery') this.aim.x = clamp(this.aim.x + direction * 30, 300, 602);
      else if (this.definition.mode === 'rhythm') {
        const next = clamp(this.lane + direction, 0, 3);
        if (next !== this.lane) this.burst(rhythmLaneX(this.lane), 330, '#ffffff77', 4);
        this.lane = next;
      } else if (['climb', 'rugby', 'subway'].includes(this.definition.mode)) {
        const next = clamp(this.lane + direction, 0, 2);
        if (next !== this.lane) this.burst(laneX(this.lane), 325, '#ffffff77', 4);
        this.lane = next;
      } else if (this.definition.mode === 'skate' && this.skateJump < 0) {
        this.skateRotation += direction * 1.1;
      }
    }

    verticalAction(direction) {
      if (!this.active) return;
      if (this.definition.mode === 'archery') this.aim.y = clamp(this.aim.y + direction * 28, 62, 292);
      else if (direction < 0) this.primaryAction();
      else if (this.definition.mode === 'subway') this.slideRunner();
    }

    handleCanvasPointer(event) {
      if (!this.active) return;
      const bounds = canvas.getBoundingClientRect();
      const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
      const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
      if (this.definition.mode === 'archery') {
        this.aim.x = clamp(x, 300, 602);
        this.aim.y = clamp(y, 62, 292);
        this.fireArrow();
      } else if (this.definition.mode === 'rhythm') {
        const lane = clamp(Math.floor((x - 68) / 126), 0, 3);
        this.hitRhythmLane(lane);
      } else if (this.definition.mode === 'subway' && y > 280) this.slideRunner();
      else this.primaryAction();
    }

    hitPlayer(x, y) {
      if (this.invulnerable > 0) return;
      this.lives -= 1;
      this.combo = 0;
      this.invulnerable = 1;
      this.flash = .22;
      this.shake = .3;
      this.burst(x, y, '#ff716a', 16);
    }

    updateParticles(delta) {
      for (const particle of this.particles) {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += 70 * delta;
        particle.life -= delta;
      }
      this.particles = this.particles.filter(particle => particle.life > 0);
    }

    burst(x, y, colour, amount = 8) {
      for (let index = 0; index < amount; index += 1) {
        const angle = index / amount * Math.PI * 2;
        const speed = 38 + (index % 5) * 18;
        this.particles.push({x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 18, life: .6, colour});
      }
    }

    modeComplete() {
      if (this.definition.mode === 'rally') return this.rallyHits >= this.definition.target;
      if (this.definition.mode === 'archery') return this.targetHits >= this.definition.target;
      if (this.definition.mode === 'climb') return this.climbHeight >= this.definition.target;
      if (this.definition.mode === 'skate') return this.found >= this.definition.target && this.skateDistance >= 3300;
      if (this.definition.mode === 'rugby') return this.fragments >= this.definition.target && this.rugbyDistance >= 7200;
      if (this.definition.mode === 'rhythm') return this.rhythmPassed();
      return this.escapeDistance >= this.definition.target;
    }

    renderProgress() {
      if (!this.definition) return;
      let progress = '';
      if (this.definition.mode === 'rally') progress = `${this.rallyHits}/${this.definition.target} RETURNS`;
      else if (this.definition.mode === 'archery') progress = `${this.targetHits}/${this.definition.target} TARGETS`;
      else if (this.definition.mode === 'climb') progress = `${Math.min(100, Math.round(this.climbHeight / this.definition.target * 100))}% HEIGHT`;
      else if (this.definition.mode === 'skate') progress = `${this.found}/${this.definition.target} KEYS`;
      else if (this.definition.mode === 'rugby') progress = `${this.fragments}/${this.definition.target} FRAGMENTS`;
      else if (this.definition.mode === 'rhythm') progress = `${this.rhythmHits}/${this.definition.target} TILES · ${Math.round(this.rhythmAccuracy() * 100)}%`;
      else progress = `${Math.min(100, Math.round(this.escapeDistance / this.definition.target * 100))}% · ${this.energyCells} CELLS`;
      const shields = `${'◆'.repeat(this.lives)}${'◇'.repeat(Math.max(0, this.maxLives - this.lives))}`;
      const combo = this.combo > 1 ? ` · x${this.combo}` : '';
      byId('mini-progress').textContent = this.definition.mode === 'rhythm'
        ? `${progress} · ${this.score}PTS${combo} · FORGIVING MODE`
        : `${progress} · ${this.score}PTS${combo} · ${shields}`;
    }

    succeed() {
      this.active = false;
      cancelAnimationFrame(this.raf);
      byId('mini-countdown').textContent = `CHALLENGE COMPLETE · ${this.score} PTS`;
      byId('mini-countdown').classList.remove('hidden');
      byId('mini-start').textContent = 'CHALLENGE COMPLETE';
      byId('mini-start').disabled = true;
      this.setRhythmControls(false);
      this.dispatchEvent(new CustomEvent('complete', {detail: {
        type: this.type, elapsed: this.elapsed, course: this.options.course || null,
        miniGameScore: this.score, bestCombo: this.bestCombo
      }}));
    }

    fail(reason = 'TRY AGAIN') {
      this.active = false;
      cancelAnimationFrame(this.raf);
      byId('mini-countdown').textContent = `${reason} · TRY AGAIN`;
      byId('mini-countdown').classList.remove('hidden');
      byId('mini-start').disabled = false;
      byId('mini-start').textContent = 'RETRY CHALLENGE';
      this.setRhythmControls(false);
      this.dispatchEvent(new CustomEvent('fail', {detail: {type: this.type}}));
    }

    drawIdle() {
      rect('#061820', 0, 0, canvas.width, canvas.height);
    }

    draw() {
      if (!this.definition) return this.drawIdle();
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      if (this.shake > 0) ctx.translate(Math.floor(this.elapsed * 55) % 2 ? -4 : 4, Math.floor(this.elapsed * 37) % 2 ? -2 : 2);
      if (this.definition.mode === 'rally') this.drawRally();
      else if (this.definition.mode === 'archery') this.drawArchery();
      else if (this.definition.mode === 'climb') this.drawClimb();
      else if (this.definition.mode === 'skate') this.drawSkate();
      else if (this.definition.mode === 'rugby') this.drawRugby();
      else if (this.definition.mode === 'rhythm') this.drawRhythm();
      else this.drawSubway();
      this.drawParticles();
      if (this.flash > 0) rect('rgba(255,113,106,.22)', 0, 0, 640, 360);
      ctx.restore();
    }

    drawRally() {
      rect('#11353a', 0, 0, 640, 360);
      for (let y = 0; y < 360; y += 24) for (let x = 0; x < 640; x += 24) rect((x / 24 + y / 24) % 2 ? '#184348' : '#143b40', x, y, 23, 23);
      rect('#d9ddc9', 45, 35, 550, 290);
      rect('#4a7975', 54, 44, 532, 272);
      rect('#d9ddc9', 58, 48, 524, 264);
      rect('#42847a', 64, 54, 512, 252);
      rect('#e9fff4', 64, 178, 512, 5);
      for (let x = 74; x < 568; x += 40) rect('#b8d5cb', x, 178, 20, 5);
      rect('#071418', this.opponentX - 54, 51, 108, 10);
      rect('#ff716a', this.opponentX - 48, 54, 96, 5);
      sprites?.drawLecturer(ctx, {x: this.opponentX, y: 46, frame: Math.floor(this.elapsed * 9) % 4, scale: .75});
      rect('#071418', this.paddleX - 58, 294, 116, 13);
      rect(this.powerWindow > 0 ? '#ffe36e' : this.definition.accent, this.paddleX - 51, 297, 102, 7);
      this.drawHero(this.paddleX, 347, 'up', 1.05);
      const trail = clamp(Math.abs(this.ball.vy) / 60, 2, 7);
      for (let i = 1; i < trail; i += 1) rect('rgba(233,255,244,.22)', this.ball.x - this.ball.vx * i * .012 - 4, this.ball.y - this.ball.vy * i * .012 - 4, 8, 8);
      rect('#071418', this.ball.x - 7, this.ball.y - 7, 14, 14);
      rect('#e9fff4', this.ball.x - 4, this.ball.y - 4, 8, 8);
      rect(this.definition.accent, this.ball.x - 2, this.ball.y - 2, 4, 4);
      this.drawCanvasHud(`${this.rallyHits}/${this.definition.target} RETURNS`, this.powerWindow > 0 ? 'POWER READY' : 'TIME YOUR RETURN');
    }

    drawArchery() {
      rect('#171d38', 0, 0, 640, 360);
      for (let y = 42; y < 355; y += 40) {
        rect('#241f48', 0, y, 640, 20);
        for (let x = 10; x < 630; x += 36) rect(['#7a4da8', '#3966b9', '#2da78b', '#d9843e'][(x / 36 + y / 40) % 4 | 0], x, y + 6, 22, 5);
      }
      rect('#0d1429', 278, 38, 350, 284);
      for (const target of this.targets) {
        const pulse = Math.sin(this.elapsed * 6 + target.phase) * 2;
        ctx.strokeStyle = '#071418'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(target.x, target.y, target.radius + pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#e9fff4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(target.x, target.y, target.radius + pulse - 3, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = this.definition.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(target.x, target.y, target.radius * .62, 0, Math.PI * 2); ctx.stroke();
        rect('#ffe36e', target.x - 4, target.y - 4, 8, 8);
      }
      ctx.strokeStyle = 'rgba(233,255,244,.35)'; ctx.lineWidth = 2; ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(108, 291); ctx.lineTo(this.aim.x, this.aim.y); ctx.stroke(); ctx.setLineDash([]);
      for (const arrow of this.arrows) {
        ctx.strokeStyle = '#ffe36e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(arrow.x - arrow.vx * .025, arrow.y - arrow.vy * .025); ctx.lineTo(arrow.x, arrow.y); ctx.stroke();
      }
      ctx.strokeStyle = this.definition.accent; ctx.lineWidth = 2; ctx.strokeRect(this.aim.x - 12, this.aim.y - 12, 24, 24); rect('#ffe36e', this.aim.x - 2, this.aim.y - 2, 4, 4);
      this.drawHero(104, 322, 'right', 1.05);
      rect('#8e603f', 112, 271, 4, 40); rect('#e9fff4', 116, 275, 4, 32);
      this.drawCanvasHud(`${this.targetHits}/${this.definition.target} TARGETS`, 'ARROWS AIM · SPACE FIRES');
    }

    drawClimb() {
      rect('#c8d7c7', 0, 0, 640, 360);
      rect('#99b5a4', 40, 0, 560, 360);
      for (let y = -40 + (this.climbHeight % 80); y < 360; y += 80) {
        rect('#789483', 45, y, 550, 26);
        rect('#dce6d4', 62, y + 5, 150, 7);
        rect('#6c8577', 435, y + 12, 145, 6);
      }
      for (let x = 82; x < 590; x += 80) {
        rect('#546b62', x, 0, 9, 360);
        for (let y = 20; y < 350; y += 64) rect('#82ef91', x - 5, y, 19, 8);
      }
      const targetLane = this.climbSequence[this.climbStep % this.climbSequence.length];
      const targetY = 48 + this.climbPhase * 252;
      const upcomingLane = this.climbSequence[(this.climbStep + 1) % this.climbSequence.length];
      this.drawPlatform(laneX(upcomingLane), 42, '#6b8377');
      this.drawPlatform(laneX(targetLane), targetY, this.climbPhase > .5 ? '#ffe36e' : this.definition.accent);
      rect('rgba(255,227,110,.18)', 76, 232, 488, 72);
      rect('#ffe36e', 76, 232, 488, 4); rect('#ffe36e', 76, 300, 488, 4);
      this.drawHero(laneX(this.lane), 329, 'up', 1.05, Math.sin(this.climbPhase * Math.PI) * -13);
      for (let rock = 0; rock < 4; rock += 1) {
        const y = (rock * 97 + this.elapsed * 85) % 410 - 40;
        rect('#4c5d56', 115 + rock * 130, y, 18, 14);
        rect('#70867b', 119 + rock * 130, y + 3, 10, 5);
      }
      if (this.rhythmJudgementTime > 0) text(this.rhythmJudgement, 320, 212, this.rhythmJudgement.includes('PERFECT') ? '#ffe36e' : '#ff716a', 15, 'center');
      this.drawCanvasHud(`${Math.round(this.climbHeight / 10)}M / ${Math.round(this.definition.target / 10)}M`, `PLATFORM ${this.climbStep + 1}`);
    }

    drawPlatform(x, y, colour) {
      rect('#071418', x - 48, y - 5, 96, 20);
      rect(colour, x - 42, y, 84, 10);
      rect('#e9fff4', x - 25, y + 3, 50, 3);
    }

    drawSkate() {
      rect('#342a22', 0, 0, 640, 360);
      const scroll = this.skateDistance % 96;
      for (let x = -96 + scroll; x < 720; x += 96) {
        rect('#5a4433', x, 40, 72, 180);
        for (let shelf = 0; shelf < 4; shelf += 1) {
          rect('#8c603f', x + 5, 65 + shelf * 38, 62, 5);
          for (let book = 0; book < 5; book += 1) rect(['#c54b42', '#3d79a0', '#d0a83d'][book % 3], x + 9 + book * 11, 48 + shelf * 38, 7, 17);
        }
      }
      rect('#a97f54', 0, 220, 640, 140);
      for (let x = -64 + (this.skateDistance * .65 % 64); x < 640; x += 64) { rect('#c79a67', x, 225, 62, 130); rect('#8a684a', x, 225, 2, 130); }
      rect('#071418', 0, 317, 640, 9);
      rect('#ffe36e', 0, 321, 640, 3);
      for (const object of this.skateObjects) this.drawSkateObject(object);
      ctx.save(); ctx.translate(138, 314 + this.skateJump); ctx.rotate(this.skateRotation); rect('#071418', -25, 2, 50, 8); rect('#ffe36e', -21, 4, 42, 4); rect('#63f5d1', -17, 10, 7, 5); rect('#63f5d1', 10, 10, 7, 5); ctx.restore();
      this.drawHero(138, 306 + this.skateJump, 'right', 1.02);
      this.drawCanvasHud(`${this.found}/${this.definition.target} MOLECULAR KEYS`, `${Math.round(this.skateDistance)}M · AIR TRICKS SCORE`);
    }

    drawSkateObject(object) {
      if (object.kind === 'key') {
        const y = object.high ? 246 : 285;
        const pulse = Math.round(Math.sin(this.elapsed * 7 + object.spin) * 3);
        rect('rgba(255,227,110,.2)', object.x - 24 - pulse, y - 27 - pulse, 48 + pulse * 2, 54 + pulse * 2);
        rect('#071418', object.x - 15, y - 19, 30, 38); rect('#ffe36e', object.x - 11, y - 15, 22, 30); rect('#071418', object.x - 4, y - 5, 8, 10);
      } else if (object.kind === 'cart') {
        rect('#071418', object.x - 28, 276, 56, 40); rect('#8c6848', object.x - 24, 280, 48, 29); rect('#d9c08e', object.x - 18, 284, 36, 8); rect('#071418', object.x - 20, 311, 10, 8); rect('#071418', object.x + 10, 311, 10, 8);
      } else {
        rect('#071418', object.x - 23, 282, 46, 36); for (let i = 0; i < 3; i += 1) { rect('#c44a42', object.x - 19 + i * 13, 286 - i * 4, 10, 27 + i * 4); rect('#f0d89b', object.x - 17 + i * 13, 290 - i * 4, 6, 5); }
      }
    }

    drawRugby() {
      rect('#c6e6e5', 0, 0, 640, 360);
      const offset = this.rugbyDistance % 72;
      for (let y = -72 + offset; y < 360; y += 72) {
        rect('#a9d3d5', 60, y, 520, 34);
        rect('#e9fff4', 60, y + 14, 520, 5);
      }
      rect('#7fb4b9', 60, 0, 8, 360); rect('#7fb4b9', 572, 0, 8, 360);
      for (let lane = 1; lane < 3; lane += 1) for (let y = -30 + offset; y < 360; y += 72) rect('#e9fff4', 80 + lane * 160 - 3, y, 6, 32);
      for (const object of this.rugbyObjects) {
        const x = laneX(object.lane);
        if (object.kind === 'fragment') {
          rect('#071418', x - 13, object.y - 13, 26, 26); rect('#ffe36e', x - 9, object.y - 9, 18, 18); text('◆', x, object.y + 5, '#071418', 13, 'center');
        } else if (object.kind === 'snowball') {
          ctx.fillStyle = '#e9ffff'; ctx.beginPath(); ctx.arc(x, object.y, 22, 0, Math.PI * 2); ctx.fill(); rect('#86b9c0', x - 12, object.y - 5, 24, 8);
        } else {
          rect('#071418', x - 25, object.y - 28, 50, 58); rect('#7f3442', x - 20, object.y - 23, 40, 45); rect('#dff7ff', x - 15, object.y - 18, 30, 16); rect('#071418', x - 13, object.y + 22, 10, 12); rect('#071418', x + 3, object.y + 22, 10, 12);
        }
      }
      if (this.dash > 0) { for (let i = 1; i < 5; i += 1) rect('rgba(223,247,255,.22)', laneX(this.lane) - 12, 330 + i * 10, 24, 6); }
      this.drawHero(laneX(this.lane), 340, 'up', this.dash > 0 ? 1.2 : 1.05, this.dash > 0 ? -9 : 0);
      this.drawOfficeBoss(320, 55);
      this.drawCanvasHud(`${this.fragments}/${this.definition.target} KEY FRAGMENTS`, this.dashCooldown > 0 ? `CHARGE ${this.dashCooldown.toFixed(1)}S` : 'CHARGE READY');
    }

    drawRhythm() {
      const course = courseThemes[this.options.course] || courseThemes.basic;
      rect('#0c171b', 0, 0, 640, 360);
      for (let x = 0; x < 640; x += 32) for (let y = 0; y < 360; y += 32) rect((x / 32 + y / 32) % 2 ? '#112329' : '#0f1e23', x, y, 31, 31);
      rect('#05090b', 58, 34, 524, 316);
      for (let lane = 0; lane < 4; lane += 1) {
        const x = 68 + lane * 126;
        const flashed = this.rhythmLaneFlash[lane] > 0;
        rect(lane === this.lane ? '#d8e4df' : '#f1f0e7', x, 42, 122, 300);
        rect(flashed ? course.accent : '#c3d0ca', x + 5, 47, 112, 290);
        rect(lane === this.lane ? '#edf8f3' : '#e5e8df', x + 8, 50, 106, 284);
        rect('#071418', x + 118, 42, 4, 300);
        text(['D', 'F', 'J', 'K'][lane], rhythmLaneX(lane), 330, lane === this.lane ? course.primary : '#5d706c', 14, 'center');
      }
      rect('rgba(99,245,209,.16)', 68, 205, 500, 126);
      rect('#ffe36e', 68, 292, 500, 8);
      rect('#fff7bd', 68, 294, 500, 3);
      for (const note of this.rhythmNotes) {
        const x = rhythmLaneX(note.lane);
        rect(course.accent, x - 51, note.y - 30, 102, 62);
        rect('#071418', x - 47, note.y - 26, 94, 54);
        rect('#15272b', x - 41, note.y - 20, 82, 42);
        rect(course.primary, x - 35, note.y - 15, 70, 5);
        text('⇌', x, note.y + 14, course.accent, 20, 'center');
      }
      if (this.rhythmJudgementTime > 0) {
        const positive = ['PERFECT', 'GOOD', 'SAFE HIT'].includes(this.rhythmJudgement);
        text(this.rhythmJudgement, 320, 188, this.rhythmJudgement === 'PERFECT' ? '#ffe36e' : (positive ? '#82ef91' : '#ff9d89'), 18, 'center');
      }
      this.drawCanvasHud(`${this.rhythmHits}/${this.definition.target} REACTION TILES`, `D F J K · ${course.symbol}`);
    }

    drawSubway() {
      rect('#07151b', 0, 0, 640, 360);
      const speed = Math.min(565, 350 + this.elapsed * 5.1);
      const offset = this.escapeDistance % 88;
      // Fast parallax campus edges.
      for (let y = -88 + offset; y < 400; y += 88) {
        rect('#173a30', 0, y, 74, 63); rect('#173a30', 566, y, 74, 63);
        rect('#315d41', 10, y + 12, 44, 34); rect('#315d41', 582, y + 12, 44, 34);
        rect('#d5c998', 26, y + 48, 9, 38); rect('#d5c998', 603, y + 48, 9, 38);
      }
      rect('#26383e', 76, 0, 488, 360);
      rect('#121f24', 82, 0, 6, 360); rect('#121f24', 552, 0, 6, 360);
      for (let lane = 1; lane < 3; lane += 1) for (let y = -55 + offset; y < 380; y += 88) rect('#e8dfa9', 80 + lane * 160 - 3, y, 6, 44);
      for (let y = -35 + (this.escapeDistance * .42 % 55); y < 380; y += 55) { rect('rgba(233,255,244,.13)', 93, y, 450, 3); }
      for (const object of this.runnerObjects) this.drawRunnerObject(object);
      const playerY = 337 + this.runnerJump;
      if (this.slide > 0) {
        rect('#071418', laneX(this.lane) - 26, 316, 52, 19);
        rect(this.definition.accent, laneX(this.lane) - 20, 320, 40, 10);
      } else this.drawHero(laneX(this.lane), playerY, 'up', 1.08);
      this.drawGuardChase();
      // Speed streaks intensify immediately and increase further.
      const streaks = 8 + Math.floor((speed - 350) / 35);
      for (let index = 0; index < streaks; index += 1) {
        const x = 95 + (index * 67 % 450);
        const y = (index * 53 + this.elapsed * speed * .7) % 350;
        rect('rgba(233,255,244,.22)', x, y, 2, 13 + index % 3 * 8);
      }
      this.drawCanvasHud(`${Math.min(100, Math.round(this.escapeDistance / this.definition.target * 100))}% ESCAPE`, `${Math.round(speed)} SPEED · ${this.energyCells} CELLS`);
    }

    drawRunnerObject(object) {
      const x = laneX(object.lane);
      if (object.kind === 'cell') {
        const pulse = Math.round(Math.sin(this.elapsed * 9 + object.spin) * 2);
        rect('rgba(99,245,209,.18)', x - 20 - pulse, object.y - 20 - pulse, 40 + pulse * 2, 40 + pulse * 2);
        rect('#071418', x - 12, object.y - 12, 24, 24); rect('#63f5d1', x - 8, object.y - 8, 16, 16); text('7', x, object.y + 5, '#071418', 11, 'center');
      } else if (object.kind === 'barrier') {
        rect('#071418', x - 42, object.y - 7, 84, 38); rect('#db7b34', x - 36, object.y, 72, 26); rect('#fff0b2', x - 31, object.y + 6, 62, 6); rect('#fff0b2', x - 16, object.y + 17, 32, 5);
      } else if (object.kind === 'overhead') {
        rect('#071418', x - 45, object.y - 38, 90, 70); rect('#8d3941', x - 39, object.y - 32, 78, 22); rect('#ffe36e', x - 31, object.y - 25, 62, 6); rect('#8d3941', x - 38, object.y - 10, 9, 42); rect('#8d3941', x + 29, object.y - 10, 9, 42);
      } else {
        rect('#071418', x - 48, object.y - 56, 96, 108); rect('#385c68', x - 42, object.y - 50, 84, 96); rect('#b9e0dd', x - 32, object.y - 39, 64, 28); rect('#ff716a', x - 30, object.y + 28, 20, 9); rect('#ff716a', x + 10, object.y + 28, 20, 9);
      }
    }

    drawGuardChase() {
      const x = laneX(this.lane);
      const y = 390 - this.guardPressure * 43;
      sprites?.drawGuard(ctx, {x, y, frame: Math.floor(this.elapsed * 12) % 2, scale: 1.1});
      rect('#071418', x - 32, 348, 64, 7);
      rect('#ff716a', x - 28, 350, 56 * this.guardPressure, 3);
    }

    drawOfficeBoss(x, y) {
      rect('#071418', x - 44, y - 31, 88, 60); rect('#6d3140', x - 38, y - 25, 76, 48); rect('#dff7ff', x - 27, y - 20, 54, 23); rect('#ff716a', x - 18, y - 12, 7, 7); rect('#ff716a', x + 11, y - 12, 7, 7); rect('#ffe36e', x - 6, y + 8, 12, 25);
    }

    drawHero(x, y, facing, scale = 1, verticalOffset = 0) {
      if (this.invulnerable > 0 && Math.floor(this.invulnerable * 13) % 2) return;
      if (sprites) sprites.drawCharacter(ctx, {
        x, y: y + verticalOffset, courseId: this.options.course || 'basic', facing,
        frame: Math.floor(this.elapsed * 11) % 4, scale
      });
      else { rect('#071418', x - 14, y - 38, 28, 38); rect(this.definition.accent, x - 10, y - 32, 20, 27); }
    }

    drawCanvasHud(left, right) {
      rect('rgba(4,16,20,.9)', 7, 6, 626, 30);
      text(left, 16, 25, '#e9fff4', 10, 'left');
      text(this.combo > 1 ? `COMBO x${this.combo}` : right, 624, 25, this.combo > 1 ? '#ffe36e' : this.definition.accent, 10, 'right');
    }

    drawParticles() {
      for (const particle of this.particles) rect(particle.colour, particle.x - 2, particle.y - 2, 5, 5);
    }

    debugFinish() {
      if (!this.active) return false;
      if (this.definition.mode === 'rally') this.rallyHits = this.definition.target;
      else if (this.definition.mode === 'archery') this.targetHits = this.definition.target;
      else if (this.definition.mode === 'climb') this.climbHeight = this.definition.target;
      else if (this.definition.mode === 'skate') { this.found = this.definition.target; this.skateDistance = 3300; }
      else if (this.definition.mode === 'rugby') { this.fragments = this.definition.target; this.rugbyDistance = 7200; }
      else if (this.definition.mode === 'rhythm') {
        this.rhythmHits = this.definition.target;
        this.rhythmResolved = this.definition.target;
        this.elapsed = this.definition.duration;
      } else this.escapeDistance = this.definition.target;
      return true;
    }
  }

  global.SeventhReactionMiniGames = new MiniGameController();
})(globalThis);
