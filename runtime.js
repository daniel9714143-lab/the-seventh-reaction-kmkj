(function initialiseRuntime(global) {
  'use strict';

  const map = global.KMKJCampusMap;
  const content = global.SEVENTH_REACTION_CONTENT;
  const store = global.SeventhReactionState;
  const sprites = global.SeventhReactionSprites;
  const canvas = document.getElementById('game');
  let ctx = canvas.getContext('2d');

  if (!map || !content || !store || !canvas) {
    throw new Error('The Seventh Reaction runtime dependencies are missing.');
  }

  // The source plan remains the immutable 1280 × 995 registration frame.
  // A single uniform multiplier creates a human-scale world without moving,
  // stretching, rotating, or independently resizing any campus structure.
  const WORLD_SCALE = 8;
  const WORLD_WIDTH = map.width * WORLD_SCALE;
  const WORLD_HEIGHT = map.height * WORLD_SCALE;
  const MIN_ZOOM = 1 / WORLD_SCALE;
  const MAX_ZOOM = 3;
  const PLAYER_RADIUS = 7;
  const MIN_SPEED = 60;
  const MAX_SPEED = 600;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const scalePoint = point => [point[0] * WORLD_SCALE, point[1] * WORLD_SCALE];
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const worldLocation = location => ({
    ...location,
    x: location.x * WORLD_SCALE,
    y: location.y * WORLD_SCALE,
    // Interaction distance represents a few real metres and is not enlarged
    // with the architecture.
    interactionRadius: Math.max(38, Number(location.interactionRadius) || 38)
  });

  const locations = Object.fromEntries(Object.entries(content.locations)
    .map(([id, location]) => [id, worldLocation(location)]));

  // game.js draws the registered plan once at its native pixel resolution.
  // Enlarging that frozen frame with smoothing disabled preserves the earlier
  // block-pixel aesthetic while retaining the exact corrected geometry.
  const mapTexture = document.createElement('canvas');
  mapTexture.width = map.width;
  mapTexture.height = map.height;
  const mapTextureContext = mapTexture.getContext('2d');
  mapTextureContext.imageSmoothingEnabled = false;
  mapTextureContext.drawImage(canvas, 0, 0);

  function pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i][0];
      const yi = points[i][1];
      const xj = points[j][0];
      const yj = points[j][1];
      const crosses = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (crosses) inside = !inside;
    }
    return inside;
  }

  function polygonBounds(points) {
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    return {
      minX: Math.min(...xs), minY: Math.min(...ys),
      maxX: Math.max(...xs), maxY: Math.max(...ys)
    };
  }

  const colliders = map.buildings.flatMap(building => building.parts.map(part => {
    const points = part.points.map(scalePoint);
    return {buildingId: building.id, points, bounds: polygonBounds(points)};
  }));

  const buildingLabels = map.buildings.map(building => {
    const points = building.parts.flatMap(part => part.points).map(scalePoint);
    const bounds = polygonBounds(points);
    return {
      id: building.id,
      name: building.name,
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
  });

  const siteLabels = content.siteLabels.map(label => ({
    ...label,
    x: label.x * WORLD_SCALE,
    y: label.y * WORLD_SCALE
  }));

  const accessibleBuildingIds = new Set(Object.values(content.locations)
    .map(location => location.buildingId)
    .filter(Boolean));

  class KMKJGameRuntime extends EventTarget {
    constructor() {
      super();
      this.active = false;
      this.running = false;
      this.lastTime = 0;
      this.lastPositionSave = 0;
      this.keys = new Set();
      this.camera = {x: 0, y: 0};
      this.nearbyLocation = null;
      this.lastPromptId = null;
      this.animationTime = 0;
      this.forceAllLabels = false;
      const player = store.state.position;
      this.companion = {x: player.x + 34, y: player.y + 22, facing: 'left'};
      this.companionPath = [];
      this.bindInput();
      this.frame = this.frame.bind(this);
      this.draw();
    }

    bindInput() {
      const movementKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D']);
      const isTypingTarget = target => Boolean(target?.matches?.('input, textarea, select, [contenteditable="true"]'));
      window.addEventListener('keydown', event => {
        if (!this.active || isTypingTarget(event.target)) return;
        if (movementKeys.has(event.key)) {
          event.preventDefault();
          this.keys.add(event.key.toLowerCase());
        }
        if ((event.key === 'e' || event.key === 'E' || event.key === 'Enter') && !event.repeat) {
          event.preventDefault();
          this.interact();
        }
      });
      window.addEventListener('keyup', event => this.keys.delete(event.key.toLowerCase()));
      window.addEventListener('blur', () => this.keys.clear());
      canvas.addEventListener('pointerdown', () => canvas.focus());
      canvas.addEventListener('pointerup', event => {
        if (!this.active) return;
        const bounds = canvas.getBoundingClientRect();
        const zoom = clamp(Number(store.state.settings.mapZoom) || 1, MIN_ZOOM, MAX_ZOOM);
        const screenX = (event.clientX - bounds.left) * canvas.width / bounds.width;
        const screenY = (event.clientY - bounds.top) * canvas.height / bounds.height;
        const worldPoint = {x: this.camera.x + screenX / zoom, y: this.camera.y + screenY / zoom};
        if (distance(worldPoint, this.companion) <= 42 / zoom) {
          this.dispatchEvent(new CustomEvent('assistant', {detail: {source: 'companion'}}));
        }
      });
      canvas.addEventListener('wheel', event => {
        if (!this.active) return;
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
        this.setZoom(store.state.settings.mapZoom * factor);
      }, {passive: false});

      for (const button of document.querySelectorAll('[data-move]')) {
        const key = button.dataset.move;
        const release = () => this.keys.delete(key);
        button.addEventListener('pointerdown', event => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          this.keys.add(key);
        });
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
      }
      const actionButton = document.querySelector('[data-action="interact"]');
      if (actionButton) actionButton.addEventListener('click', () => this.interact());
    }

    start() {
      this.active = true;
      this.running = true;
      canvas.focus();
      if (!this.lastTime) requestAnimationFrame(this.frame);
    }

    pause() {
      this.active = false;
      this.keys.clear();
    }

    resume() {
      this.active = true;
      canvas.focus();
    }

    stop() {
      this.active = false;
      this.running = false;
      this.keys.clear();
    }

    frame(timestamp) {
      if (!this.running) {
        this.lastTime = 0;
        return;
      }
      const delta = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.05) : 0;
      this.lastTime = timestamp;
      this.animationTime += delta;
      if (this.active) this.update(delta, timestamp);
      this.draw();
      requestAnimationFrame(this.frame);
    }

    update(delta, timestamp) {
      const state = store.state;
      let dx = 0;
      let dy = 0;
      if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

      if (dx || dy) {
        const length = Math.hypot(dx, dy);
        dx /= length;
        dy /= length;
        const speed = clamp(Number(state.settings.movementSpeed) || 120, MIN_SPEED, MAX_SPEED);
        const position = {...state.position};
        const stepX = dx * speed * delta;
        const stepY = dy * speed * delta;
        if (!this.collides(position.x + stepX, position.y, PLAYER_RADIUS)) position.x += stepX;
        if (!this.collides(position.x, position.y + stepY, PLAYER_RADIUS)) position.y += stepY;
        if (Math.abs(dx) > Math.abs(dy)) position.facing = dx < 0 ? 'left' : 'right';
        else position.facing = dy < 0 ? 'up' : 'down';
        state.position = position;
        this.recordCompanionTrail(position);

        if (timestamp - this.lastPositionSave > 900) {
          this.lastPositionSave = timestamp;
          store.persist();
        }
      }

      this.updateCompanion(delta);
      this.updateNearbyLocation();
    }

    recordCompanionTrail(position) {
      const last = this.companionPath[this.companionPath.length - 1];
      if (!last || distance(last, position) >= 8) {
        this.companionPath.push({x: position.x, y: position.y, facing: position.facing || 'down'});
      }
      if (this.companionPath.length > 64) this.companionPath.splice(0, this.companionPath.length - 64);
    }

    resetCompanion(x = store.state.position.x, y = store.state.position.y) {
      this.companion = {x: x + 34, y: y + 22, facing: 'left'};
      this.companionPath = [];
    }

    updateCompanion(delta) {
      const player = store.state.position;
      const playerGap = distance(this.companion, player);
      if (playerGap > 280) {
        this.resetCompanion(player.x, player.y);
        return;
      }
      if (this.companionPath.length <= 4 && playerGap <= 46) return;
      const target = this.companionPath[0] || player;
      const targetGap = distance(this.companion, target);
      if (targetGap < 5) {
        if (this.companionPath.length) this.companionPath.shift();
        return;
      }
      const speed = clamp((Number(store.state.settings.movementSpeed) || 120) * 1.12, 100, 670);
      const step = Math.min(targetGap, speed * delta);
      const dx = (target.x - this.companion.x) / targetGap;
      const dy = (target.y - this.companion.y) / targetGap;
      this.companion.x += dx * step;
      this.companion.y += dy * step;
      if (Math.abs(dx) > Math.abs(dy)) this.companion.facing = dx < 0 ? 'left' : 'right';
      else this.companion.facing = dy < 0 ? 'up' : 'down';
    }

    collides(x, y, radius = PLAYER_RADIUS) {
      if (x - radius < 0 || y - radius < 0 || x + radius > WORLD_WIDTH || y + radius > WORLD_HEIGHT) return true;
      const samples = [[0, 0]];
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        samples.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }
      return colliders.some(collider => {
        if (x + radius < collider.bounds.minX || x - radius > collider.bounds.maxX
          || y + radius < collider.bounds.minY || y - radius > collider.bounds.maxY) return false;
        return samples.some(([offsetX, offsetY]) => pointInPolygon(x + offsetX, y + offsetY, collider.points));
      });
    }

    updateNearbyLocation() {
      const position = store.state.position;
      let nearest = null;
      for (const location of Object.values(locations)) {
        const separation = distance(position, location);
        if (separation <= location.interactionRadius && (!nearest || separation < nearest.distance)) {
          nearest = {...location, distance: separation};
        }
      }
      this.nearbyLocation = nearest;
      const promptId = nearest?.id || null;
      if (promptId !== this.lastPromptId) {
        this.lastPromptId = promptId;
        this.dispatchEvent(new CustomEvent('proximity', {detail: nearest}));
      }
    }

    interact() {
      this.updateNearbyLocation();
      if (!this.nearbyLocation) {
        this.dispatchEvent(new CustomEvent('notice', {detail: {message: 'Move closer to a marked location.'}}));
        return;
      }
      this.dispatchEvent(new CustomEvent('interact', {detail: this.nearbyLocation}));
    }

    objectiveLocation() {
      const state = store.state;
      if (state.currentChapter === 0 || !state.profile.course) return locations['chemistry-laboratory'];
      if (state.phase === 'ending') return locations['guard-house-exit'];
      if (state.phase === 'complete') return null;
      const chapter = content.chapters[state.currentChapter - 1];
      if (!chapter) return locations['guard-house-exit'];
      const progress = state.chapterProgress[String(chapter.id)] || {};
      return locations[progress.quizComplete ? chapter.nextLocationId : chapter.locationId];
    }

    setZoom(value) {
      store.update(state => {
        state.settings.mapZoom = clamp(Number(value) || 1, MIN_ZOOM, MAX_ZOOM);
        return state;
      });
      this.draw();
    }

    setFullMapView() {
      this.setZoom(MIN_ZOOM);
    }

    toggleAllLabels(force = null) {
      this.forceAllLabels = force === null ? !this.forceAllLabels : Boolean(force);
      this.draw();
      return this.forceAllLabels;
    }

    teleport(locationId) {
      const location = locations[locationId];
      if (!location) return false;
      const candidates = [
        [location.x, location.y],
        [location.x + 32, location.y], [location.x - 32, location.y],
        [location.x, location.y + 32], [location.x, location.y - 32]
      ];
      const safe = candidates.find(([x, y]) => !this.collides(x, y));
      if (!safe) return false;
      store.update(state => {
        state.position = {x: safe[0], y: safe[1], facing: 'up'};
        return state;
      });
      this.resetCompanion(safe[0], safe[1]);
      this.camera.x = safe[0] - canvas.width / (2 * store.state.settings.mapZoom);
      this.camera.y = safe[1] - canvas.height / (2 * store.state.settings.mapZoom);
      this.updateNearbyLocation();
      return true;
    }

    cameraForPlayer() {
      const zoom = clamp(Number(store.state.settings.mapZoom) || 1, MIN_ZOOM, MAX_ZOOM);
      const visibleWidth = canvas.width / zoom;
      const visibleHeight = canvas.height / zoom;
      const maxCameraX = Math.max(0, WORLD_WIDTH - visibleWidth);
      const maxCameraY = Math.max(0, WORLD_HEIGHT - visibleHeight);
      const targetX = store.state.position.x - visibleWidth / 2;
      const targetY = store.state.position.y - visibleHeight / 2;
      const ease = this.running ? 0.16 : 1;
      this.camera.x += (clamp(targetX, 0, maxCameraX) - this.camera.x) * ease;
      this.camera.y += (clamp(targetY, 0, maxCameraY) - this.camera.y) * ease;
      return zoom;
    }

    draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      const zoom = this.cameraForPlayer();
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-this.camera.x, -this.camera.y);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(mapTexture, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.drawObjective(zoom);
      this.drawLecturerAndHeroes();
      this.drawLabels(zoom);
      this.drawCompanion();
      this.drawPlayer();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(3, 12, 17, 0.08)';
      for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 1);
      ctx.restore();
    }

    drawObjective(zoom) {
      const target = this.objectiveLocation();
      if (!target) return;
      const inverseZoom = 1 / zoom;
      const pulse = (2 + Math.sin(this.animationTime * 4) * 1.5) * inverseZoom;
      const radius = 15 * inverseZoom;
      ctx.save();
      ctx.strokeStyle = '#ffe66d';
      ctx.fillStyle = '#ffe66d';
      ctx.lineWidth = Math.max(1, 2 * inverseZoom);
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(Math.round(target.x - 2 * inverseZoom), Math.round(target.y - 29 * inverseZoom - pulse), Math.max(2, Math.round(5 * inverseZoom)), Math.max(4, Math.round(12 * inverseZoom)));
      ctx.fillRect(Math.round(target.x - 2 * inverseZoom), Math.round(target.y - 11 * inverseZoom - pulse), Math.max(2, Math.round(5 * inverseZoom)), Math.max(2, Math.round(5 * inverseZoom)));
      ctx.restore();
    }

    drawLecturerAndHeroes() {
      const state = store.state;
      if (state.currentChapter > 0 && state.profile.course) return;
      this.drawLecturer(741 * WORLD_SCALE, 654 * WORLD_SCALE);
      if (state.phase === 'course-selection') {
        const heroPositions = [[714, 686], [738, 700], [765, 701], [790, 687]];
        content.courses.forEach((course, index) => {
          const [x, y] = heroPositions[index];
          this.drawHeroSprite(x * WORLD_SCALE, y * WORLD_SCALE, course, 0);
        });
      }
    }

    drawLecturer(x, y) {
      sprites.drawLecturer(ctx, {x, y, frame: Math.floor(this.animationTime * 4)});
    }

    drawHeroSprite(x, y, course, frame = 0, facing = 'down') {
      sprites.drawCharacter(ctx, {x, y, courseId: course.id, facing, frame});
    }

    drawGhostSprite(x, y, frame = 0) {
      sprites.drawGhost(ctx, {x, y, frame});
    }

    drawCompanion() {
      const frame = this.companionPath.length ? Math.floor(this.animationTime * 9) % 4 : Math.floor(this.animationTime * 2) % 4;
      sprites.drawRobotCompanion(ctx, {
        x: this.companion.x,
        y: this.companion.y,
        facing: this.companion.facing,
        frame,
        scale: .92,
        alert: Boolean(store.state.assistant?.unread)
      });
    }

    drawPlayer() {
      const {position, profile} = store.state;
      const course = content.courses.find(item => item.id === profile.course);
      const x = Math.round(position.x);
      const y = Math.round(position.y);
      const frame = this.keys.size ? Math.floor(this.animationTime * 9) % 4 : Math.floor(this.animationTime * 2) % 4;
      if (course) this.drawHeroSprite(x, y, course, frame, position.facing || 'down');
      else this.drawGhostSprite(x, y, frame);
    }

    paintHeroPreview(targetCanvas, courseId) {
      if (!targetCanvas) return false;
      const course = content.courses.find(item => item.id === courseId);
      if (!course) return false;
      const gameContext = ctx;
      const previewContext = targetCanvas.getContext('2d');
      previewContext.imageSmoothingEnabled = false;
      previewContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
      try {
        ctx = previewContext;
        sprites.drawCharacter(ctx, {
          x: Math.round(targetCanvas.width / 2), y: targetCanvas.height - 1,
          courseId, facing: 'down', frame: 0, shadow: false, scale: .8
        });
      } finally {
        ctx = gameContext;
      }
      return true;
    }

    drawLabels(zoom) {
      if (zoom < 0.42 && !this.forceAllLabels) return;
      const visible = {
        minX: this.camera.x - 120,
        minY: this.camera.y - 120,
        maxX: this.camera.x + canvas.width / zoom + 120,
        maxY: this.camera.y + canvas.height / zoom + 120
      };
      for (const label of buildingLabels) {
        if (!this.forceAllLabels && !accessibleBuildingIds.has(label.id) && zoom < 0.8) continue;
        if (label.x < visible.minX || label.x > visible.maxX || label.y < visible.minY || label.y > visible.maxY) continue;
        this.drawLabel(label.name, label.x, label.y, accessibleBuildingIds.has(label.id), zoom);
      }
      if (zoom >= 0.58 || this.forceAllLabels) {
        for (const label of siteLabels) {
          if (label.x < visible.minX || label.x > visible.maxX || label.y < visible.minY || label.y > visible.maxY) continue;
          this.drawLabel(label.name, label.x, label.y, false, zoom);
        }
      }
    }

    drawLabel(text, x, y, important, zoom) {
      const label = String(text).toUpperCase();
      const inverseZoom = 1 / zoom;
      const fontSize = clamp((important ? 24 : 20) * inverseZoom, 5, 192);
      const paddingX = 9 * inverseZoom;
      const paddingY = 7 * inverseZoom;
      const lineHeight = fontSize * 1.22;
      const maxTextWidth = 380 * inverseZoom;
      ctx.save();
      ctx.font = `${important ? 'bold ' : ''}${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const lines = [];
      let currentLine = '';
      for (const word of label.split(/\s+/)) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (currentLine && ctx.measureText(candidate).width > maxTextWidth) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = candidate;
        }
      }
      if (currentLine) lines.push(currentLine);

      const widestLine = Math.max(...lines.map(line => ctx.measureText(line).width));
      const width = Math.min(maxTextWidth + paddingX * 2, widestLine + paddingX * 2);
      const height = lines.length * lineHeight + paddingY * 2;
      ctx.fillStyle = '#020a0dd4';
      ctx.fillRect(Math.round(x - width / 2 + 2 * inverseZoom), Math.round(y - height / 2 + 2 * inverseZoom), Math.round(width), Math.round(height));
      ctx.fillStyle = important ? '#071418e8' : '#071418c7';
      ctx.fillRect(Math.round(x - width / 2), Math.round(y - height / 2), Math.round(width), Math.round(height));
      ctx.strokeStyle = important ? '#f5d867' : '#63aeb5';
      ctx.lineWidth = inverseZoom;
      ctx.strokeRect(Math.round(x - width / 2), Math.round(y - height / 2), Math.round(width), Math.round(height));
      ctx.fillStyle = important ? '#fff0a6' : '#d8f2e4';
      lines.forEach((line, index) => {
        const lineY = y + (index - (lines.length - 1) / 2) * lineHeight;
        ctx.fillText(line, Math.round(x), Math.round(lineY));
      });
      ctx.restore();
    }

    debugSnapshot() {
      return {
        worldScale: WORLD_SCALE,
        world: [WORLD_WIDTH, WORLD_HEIGHT],
        zoomRange: [MIN_ZOOM, MAX_ZOOM],
        speedRange: [MIN_SPEED, MAX_SPEED],
        active: this.active,
        position: {...store.state.position},
        companion: {...this.companion},
        companionTrail: this.companionPath.length,
        nearbyLocation: this.nearbyLocation?.id || null,
        objective: this.objectiveLocation()?.id || null,
        colliding: this.collides(store.state.position.x, store.state.position.y),
        anchors: Object.fromEntries(Object.values(locations).map(location => [
          location.id,
          {x: location.x, y: location.y, colliding: this.collides(location.x, location.y)}
        ]))
      };
    }
  }

  global.SeventhReactionGame = new KMKJGameRuntime();
})(globalThis);
