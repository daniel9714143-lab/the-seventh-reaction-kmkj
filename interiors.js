(function initialiseInteriors(global) {
  'use strict';

  const overlay = document.getElementById('interior-screen');
  const canvas = document.getElementById('interior-canvas');
  const ctx = canvas.getContext('2d');
  const sprites = global.SeventhReactionSprites;
  const store = global.SeventhReactionState || null;
  const byId = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const WORLD_WIDTH = 1600;
  const WORLD_HEIGHT = 900;
  const ROOM_SCALE = 2;
  const TEACHER = {x: 1040, y: 285};
  const EXIT = {x: 800, y: 836};

  const rooms = {
    'chemistry-laboratory': {
      title: 'MAKMAL CHEMISTRY', subtitle: 'EC015 PRACTICAL LABORATORY', props: 'laboratory',
      palette: {floor: '#cbd0bd', floorAlt: '#b7c1ad', wall: '#63817c', trim: '#1d4549', accent: '#63f5d1'},
      station: 'LECTURER & LAB CONSOLE'
    },
    'dewan-teknokrat': {
      title: 'DEWAN TEKNOKRAT', subtitle: 'MAIN AUDITORIUM & STAGE', props: 'hall',
      palette: {floor: '#bb885a', floorAlt: '#a97550', wall: '#75443e', trim: '#2d3037', accent: '#ffe36e'},
      station: 'TEKNOKRAT STAGE'
    },
    dk5: {
      title: 'DEWAN KULIAH 5', subtitle: 'DK5 LECTURE THEATRE', props: 'lecture',
      palette: {floor: '#b8a176', floorAlt: '#a28b68', wall: '#715746', trim: '#213e4b', accent: '#63b7ee'},
      station: 'PERIODIC COMPASS SCREEN'
    },
    library: {
      title: 'PERPUSTAKAAN KMKJ', subtitle: 'LIBRARY, READING & ARCHIVE', props: 'library',
      palette: {floor: '#8d6e53', floorAlt: '#795c47', wall: '#5f4033', trim: '#263c3a', accent: '#ffe36e'},
      station: 'BONDED ARCHIVE'
    },
    'lecturer-office': {
      title: 'BILIK PENSYARAH', subtitle: 'LECTURER OFFICE SUITE', props: 'office',
      palette: {floor: '#a89270', floorAlt: '#957f65', wall: '#694a40', trim: '#293e45', accent: '#ff716a'},
      station: 'LECTURER OFFICE DOOR'
    },
    'engineering-workshop': {
      title: 'BENGKEL KEJURUTERAAN', subtitle: 'ENGINEERING PRACTICAL WORKSHOP', props: 'workshop',
      palette: {floor: '#90938d', floorAlt: '#777f7c', wall: '#545e5d', trim: '#243338', accent: '#63f5d1'},
      station: 'COURSE WORKBENCH'
    },
    cafeteria: {
      title: 'KAFETERIA KMKJ', subtitle: 'RESTAURANT · DINING HALL · LIVE LEADERBOARDS', props: 'cafeteria',
      palette: {floor: '#c39b69', floorAlt: '#b48658', wall: '#7b5941', trim: '#2e4540', accent: '#82ef91'},
      station: 'OPEN LIVE LEADERBOARDS'
    },
    'guard-house-exit': {
      title: 'PONDOK SECURITY', subtitle: 'KMKJ SECURITY & MAIN EXIT', props: 'security',
      palette: {floor: '#aaa99f', floorAlt: '#93958e', wall: '#575650', trim: '#25383e', accent: '#ff716a'},
      station: 'SECURITY GATE CONTROL'
    }
  };

  const rect = (colour, x, y, width, height) => {
    ctx.fillStyle = colour;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  };

  class InteriorController extends EventTarget {
    constructor() {
      super();
      this.location = null;
      this.room = null;
      this.course = null;
      this.options = {};
      this.player = {x: 800, y: 770, facing: 'up'};
      this.companion = {x: 836, y: 795, facing: 'left'};
      this.companionPath = [];
      this.camera = {x: 400, y: 450};
      this.keys = new Set();
      this.running = false;
      this.active = false;
      this.lastTime = 0;
      this.animationTime = 0;
      this.near = null;
      this.raf = 0;
      this.frame = this.frame.bind(this);
      this.bind();
      this.drawEmpty();
    }

    bind() {
      const movement = new Map([
        ['arrowup', 'up'], ['w', 'up'], ['arrowdown', 'down'], ['s', 'down'],
        ['arrowleft', 'left'], ['a', 'left'], ['arrowright', 'right'], ['d', 'right']
      ]);
      const isTypingTarget = target => Boolean(target?.matches?.('input, textarea, select, [contenteditable="true"]'));
      window.addEventListener('keydown', event => {
        if (overlay.classList.contains('hidden') || !this.active || isTypingTarget(event.target)) return;
        const key = event.key.toLowerCase();
        if (movement.has(key)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const direction = movement.get(key);
          this.keys.add(direction);
          this.nudge(direction);
        }
        if ((key === 'e' || key === 'enter') && !event.repeat) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.interact();
        }
      }, true);
      window.addEventListener('keyup', event => {
        const direction = movement.get(event.key.toLowerCase());
        if (direction) this.keys.delete(direction);
      }, true);
      window.addEventListener('blur', () => this.keys.clear());
      canvas.addEventListener('pointerdown', () => canvas.focus());
      canvas.addEventListener('pointerup', event => {
        if (!this.active) return;
        const bounds = canvas.getBoundingClientRect();
        const point = {
          x: this.camera.x + (event.clientX - bounds.left) * canvas.width / bounds.width,
          y: this.camera.y + (event.clientY - bounds.top) * canvas.height / bounds.height
        };
        if (Math.hypot(point.x - this.companion.x, point.y - this.companion.y) <= 48) {
          this.dispatchEvent(new CustomEvent('assistant', {detail: {source: 'interior-companion'}}));
        }
      });
      byId('interior-exit').addEventListener('click', () => this.exit());
      for (const button of document.querySelectorAll('[data-interior-move]')) {
        const direction = button.dataset.interiorMove;
        const release = () => this.keys.delete(direction);
        button.addEventListener('pointerdown', event => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          this.keys.add(direction);
          this.nudge(direction);
        });
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
      }
      document.querySelector('[data-interior-action="interact"]')?.addEventListener('click', () => this.interact());
    }

    enter(location, options = {}) {
      const room = rooms[location.id];
      if (!room) return false;
      this.location = location;
      this.room = room;
      this.course = options.course || null;
      this.options = options;
      this.player = {x: 800, y: 770, facing: 'up'};
      this.companion = {x: 836, y: 795, facing: 'left'};
      this.companionPath = [];
      this.updateCamera();
      this.keys.clear();
      this.running = true;
      this.active = true;
      this.lastTime = 0;
      this.near = null;
      byId('interior-title').textContent = room.title;
      byId('interior-objective').textContent = options.objective || 'Walk through the room to the glowing mission station and press E.';
      byId('interior-prompt-text').textContent = options.missionLabel || room.station;
      overlay.classList.remove('hidden');
      canvas.focus();
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(this.frame);
      this.draw();
      this.dispatchEvent(new CustomEvent('enter', {detail: {location}}));
      return true;
    }

    exit() {
      if (!this.location) return;
      const location = this.location;
      this.running = false;
      this.active = false;
      this.keys.clear();
      cancelAnimationFrame(this.raf);
      overlay.classList.add('hidden');
      byId('interior-prompt').classList.add('hidden');
      this.location = null;
      this.room = null;
      this.dispatchEvent(new CustomEvent('exit', {detail: {location}}));
    }

    pause() {
      this.active = false;
      this.keys.clear();
    }

    resume() {
      if (!this.location || overlay.classList.contains('hidden')) return;
      this.active = true;
      canvas.focus();
    }

    frame(timestamp) {
      if (!this.running) return;
      const delta = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, 0.05) : 0;
      this.lastTime = timestamp;
      this.animationTime += delta;
      if (this.active) this.update(delta);
      this.draw();
      this.raf = requestAnimationFrame(this.frame);
    }

    update(delta) {
      let dx = 0;
      let dy = 0;
      if (this.keys.has('left')) dx -= 1;
      if (this.keys.has('right')) dx += 1;
      if (this.keys.has('up')) dy -= 1;
      if (this.keys.has('down')) dy += 1;
      if (dx || dy) {
        const length = Math.hypot(dx, dy);
        const speed = 220;
        const nextX = clamp(this.player.x + dx / length * speed * delta, 90, 1510);
        const nextY = clamp(this.player.y + dy / length * speed * delta, 200, 830);
        if (!this.collides(nextX, this.player.y)) this.player.x = nextX;
        if (!this.collides(this.player.x, nextY)) this.player.y = nextY;
        if (Math.abs(dx) > Math.abs(dy)) this.player.facing = dx < 0 ? 'left' : 'right';
        else this.player.facing = dy < 0 ? 'up' : 'down';
        this.recordCompanionTrail();
      }
      this.updateCompanion(delta);
      this.updateCamera();
      const stationDistance = Math.hypot(this.player.x - TEACHER.x, this.player.y - TEACHER.y);
      const exitDistance = Math.hypot(this.player.x - EXIT.x, this.player.y - EXIT.y);
      const near = stationDistance < 74 ? 'mission' : (exitDistance < 55 ? 'exit' : null);
      if (near !== this.near) {
        this.near = near;
        byId('interior-prompt').classList.toggle('hidden', !near);
        byId('interior-prompt-text').textContent = near === 'exit' ? 'EXIT TO CAMPUS' : (this.options.missionLabel || this.room.station);
      }
    }

    nudge(direction, distance = 12) {
      if (!this.active) return;
      const vectors = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};
      const [dx, dy] = vectors[direction] || [0, 0];
      const nextX = clamp(this.player.x + dx * distance, 90, 1510);
      const nextY = clamp(this.player.y + dy * distance, 200, 830);
      if (!this.collides(nextX, this.player.y)) this.player.x = nextX;
      if (!this.collides(this.player.x, nextY)) this.player.y = nextY;
      if (dx) this.player.facing = dx < 0 ? 'left' : 'right';
      if (dy) this.player.facing = dy < 0 ? 'up' : 'down';
      this.recordCompanionTrail();
      this.updateCompanion(1 / 60);
      this.updateCamera();
    }

    recordCompanionTrail() {
      const last = this.companionPath[this.companionPath.length - 1];
      if (!last || Math.hypot(last.x - this.player.x, last.y - this.player.y) >= 8) {
        this.companionPath.push({x: this.player.x, y: this.player.y, facing: this.player.facing});
      }
      if (this.companionPath.length > 64) this.companionPath.splice(0, this.companionPath.length - 64);
    }

    updateCompanion(delta) {
      const playerGap = Math.hypot(this.companion.x - this.player.x, this.companion.y - this.player.y);
      if (playerGap > 280) {
        this.companion = {x: this.player.x + 36, y: this.player.y + 25, facing: 'left'};
        this.companionPath = [];
        return;
      }
      if (this.companionPath.length <= 4 && playerGap <= 48) return;
      const target = this.companionPath[0] || this.player;
      const targetGap = Math.hypot(target.x - this.companion.x, target.y - this.companion.y);
      if (targetGap < 5) {
        if (this.companionPath.length) this.companionPath.shift();
        return;
      }
      const step = Math.min(targetGap, 250 * delta);
      const dx = (target.x - this.companion.x) / targetGap;
      const dy = (target.y - this.companion.y) / targetGap;
      this.companion.x += dx * step;
      this.companion.y += dy * step;
      if (Math.abs(dx) > Math.abs(dy)) this.companion.facing = dx < 0 ? 'left' : 'right';
      else this.companion.facing = dy < 0 ? 'up' : 'down';
    }

    updateCamera() {
      this.camera.x = clamp(this.player.x - canvas.width / 2, 0, WORLD_WIDTH - canvas.width);
      this.camera.y = clamp(this.player.y - canvas.height / 2, 0, WORLD_HEIGHT - canvas.height);
    }

    logicalFurnitureBounds() {
      if (!this.room) return [];
      const station = {x: 320, y: 76, w: 160, h: 47};
      const layouts = {
        laboratory: [station, {x: 70, y: 164, w: 225, h: 48}, {x: 505, y: 164, w: 225, h: 48}, {x: 70, y: 276, w: 225, h: 48}, {x: 505, y: 276, w: 225, h: 48}],
        hall: [station, {x: 75, y: 206, w: 235, h: 34}, {x: 490, y: 206, w: 235, h: 34}, {x: 75, y: 282, w: 235, h: 34}, {x: 490, y: 282, w: 235, h: 34}, {x: 75, y: 350, w: 235, h: 28}, {x: 490, y: 350, w: 235, h: 28}],
        lecture: [station, {x: 88, y: 191, w: 215, h: 38}, {x: 497, y: 191, w: 215, h: 38}, {x: 88, y: 274, w: 215, h: 38}, {x: 497, y: 274, w: 215, h: 38}, {x: 88, y: 350, w: 215, h: 28}, {x: 497, y: 350, w: 215, h: 28}],
        library: [station, {x: 64, y: 150, w: 190, h: 44}, {x: 546, y: 150, w: 190, h: 44}, {x: 64, y: 268, w: 190, h: 44}, {x: 546, y: 268, w: 190, h: 44}],
        office: [station, {x: 76, y: 161, w: 230, h: 69}, {x: 494, y: 161, w: 230, h: 69}, {x: 76, y: 286, w: 230, h: 55}, {x: 494, y: 286, w: 230, h: 55}],
        workshop: [station, {x: 65, y: 155, w: 250, h: 58}, {x: 485, y: 155, w: 250, h: 58}, {x: 65, y: 282, w: 250, h: 58}, {x: 485, y: 282, w: 250, h: 58}],
        cafeteria: [station, {x: 45, y: 142, w: 275, h: 55}, {x: 535, y: 142, w: 220, h: 55}, {x: 75, y: 238, w: 155, h: 57}, {x: 570, y: 238, w: 155, h: 57}, {x: 75, y: 330, w: 155, h: 57}, {x: 570, y: 330, w: 155, h: 57}],
        security: [station, {x: 70, y: 154, w: 245, h: 78}, {x: 485, y: 154, w: 245, h: 78}, {x: 70, y: 292, w: 190, h: 47}, {x: 540, y: 292, w: 190, h: 47}]
      };
      return layouts[this.room.props] || [station];
    }

    furnitureBounds() {
      const collisionExtras = {
        lecture: [{x: 360, y: 151, w: 80, h: 34}],
        library: [{x: 300, y: 211, w: 200, h: 52}, {x: 300, y: 318, w: 200, h: 48}]
      };
      return [...this.logicalFurnitureBounds(), ...(collisionExtras[this.room.props] || [])].map(item => ({
        x: item.x * ROOM_SCALE, y: item.y * ROOM_SCALE,
        w: item.w * ROOM_SCALE, h: item.h * ROOM_SCALE
      }));
    }

    collides(x, y) {
      return this.furnitureBounds().some(rectangle => x + 11 > rectangle.x && x - 11 < rectangle.x + rectangle.w && y + 15 > rectangle.y && y - 15 < rectangle.y + rectangle.h);
    }

    interact() {
      if (!this.active) return;
      if (this.near === 'mission') this.dispatchEvent(new CustomEvent('mission', {detail: {location: this.location}}));
      else if (this.near === 'exit') this.exit();
      else this.dispatchEvent(new CustomEvent('notice', {detail: {message: this.room.props === 'cafeteria' ? 'Explore the restaurant, then walk to the glowing live leaderboard wall and press E.' : 'Explore the larger room, follow the minimap to Mdm. Balqis, or return through the exit door.'}}));
    }

    drawEmpty() {
      rect('#07161c', 0, 0, canvas.width, canvas.height);
    }

    draw() {
      if (!this.room) return this.drawEmpty();
      ctx.imageSmoothingEnabled = false;
      const palette = this.room.palette;
      rect('#071418', 0, 0, 800, 450);
      ctx.save();
      ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));
      ctx.save();
      ctx.scale(ROOM_SCALE, ROOM_SCALE);
      rect(palette.wall, 14, 14, 772, 416);
      rect(palette.trim, 24, 24, 752, 396);
      rect(palette.floor, 34, 91, 732, 319);
      this.drawFloor(palette);
      this.drawArchitecture(palette);
      this.drawMissionStation(palette);
      this.drawRoomProps(palette);
      this.drawExit();
      this.drawAtmosphere(palette);
      ctx.restore();
      this.drawNpcLayer();
      this.drawCompanion();
      this.drawPlayer();
      ctx.restore();
      this.drawInteriorHud(palette);
    }

    drawFloor(palette) {
      if (this.room.props === 'hall') {
        for (let y = 91; y < 410; y += 11) {
          rect(y % 22 ? palette.floorAlt : palette.floor, 34, y, 732, 10);
          for (let x = 50 + (y % 22 ? 20 : 0); x < 766; x += 80) rect('#6a473738', x, y, 2, 10);
        }
      } else if (this.room.props === 'library' || this.room.props === 'office') {
        rect(palette.floorAlt, 34, 91, 732, 319);
        for (let y = 98; y < 410; y += 16) for (let x = 40; x < 766; x += 16) rect('#ffffff0b', x, y, 8, 8);
        rect(this.room.props === 'library' ? '#3e6d68' : '#66506d', 325, 130, 150, 268);
        rect('#e7c86a', 334, 138, 132, 252);
        rect(this.room.props === 'library' ? '#3e6d68' : '#66506d', 340, 144, 120, 240);
      } else if (this.room.props === 'workshop') {
        for (let y = 91; y < 410; y += 32) for (let x = 34; x < 766; x += 32) {
          rect(((x + y) / 32) % 2 ? palette.floor : palette.floorAlt, x, y, 31, 31);
          rect('#48504e', x, y, 31, 1);
        }
        for (let y = 125; y < 390; y += 32) {
          rect('#f2c247', 370, y, 12, 16);
          rect('#111a1d', 382, y, 12, 16);
          rect('#f2c247', 394, y, 12, 16);
          rect('#111a1d', 406, y, 12, 16);
        }
      } else {
        for (let y = 91; y < 410; y += 28) for (let x = 34; x < 766; x += 28) {
          rect(((x + y) / 28) % 2 ? palette.floor : palette.floorAlt, x, y, 27, 27);
          rect('#ffffff12', x, y, 27, 1);
        }
      }
    }

    drawArchitecture(palette) {
      rect(palette.wall, 34, 34, 732, 57);
      rect('#071418', 42, 42, 238, 35);
      rect(palette.trim, 46, 46, 230, 27);
      ctx.fillStyle = '#e9fff4';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(this.room.title, 56, 63);
      ctx.fillStyle = palette.accent;
      ctx.font = 'bold 8px monospace';
      ctx.fillText(this.room.subtitle, 56, 73);

      // Real rooms need windows, wall lighting, emergency signs and depth.
      for (const x of [510, 590, 670]) {
        rect('#071418', x, 42, 62, 32);
        rect('#7fc4c9', x + 4, 46, 54, 24);
        rect('#dffcf2', x + 6, 48, 20, 8);
        rect('#4b8188', x + 30, 48, 26, 20);
      }
      rect('#e9fff4', 294, 47, 48, 18);
      rect('#2d8b58', 297, 50, 42, 12);
      ctx.fillStyle = '#e9fff4';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('KELUAR', 318, 59);
      for (const x of [110, 350, 590]) {
        rect('#e9fff4', x, 84, 100, 4);
        rect(palette.accent, x + 20, 85, 60, 2);
      }
    }

    drawMissionStation(palette) {
      const pulse = 2 + Math.round(Math.sin(this.animationTime * 5) * 2);
      rect('#071418', 316 - pulse, 72 - pulse, 168 + pulse * 2, 55 + pulse * 2);
      if (this.room.props === 'hall') {
        rect('#551f29', 320, 76, 160, 47);
        rect('#8f2730', 326, 80, 148, 32);
        rect('#e5bc52', 350, 84, 100, 5);
        rect('#071418', 386, 90, 28, 23);
      } else if (this.room.props === 'lecture') {
        rect('#e9efe8', 320, 76, 160, 47);
        rect('#15303d', 328, 83, 144, 31);
        this.drawPeriodicGrid(336, 88, palette.accent);
      } else if (this.room.props === 'library') {
        rect('#5f3c28', 320, 76, 160, 47);
        for (let x = 328; x < 472; x += 18) rect(x % 36 ? '#d65045' : '#4f91b2', x, 83, 13, 31);
        rect(palette.accent, 383, 88, 34, 22);
      } else if (this.room.props === 'office') {
        rect('#301d1b', 320, 76, 160, 47);
        rect('#735044', 329, 81, 142, 38);
        rect('#b4d4cf', 337, 86, 57, 28);
        rect('#b4d4cf', 406, 86, 57, 28);
        rect(palette.accent, 397, 94, 6, 12);
      } else if (this.room.props === 'security') {
        rect('#1c2c33', 320, 76, 160, 47);
        for (let x = 330; x < 470; x += 45) {
          rect('#71a4ad', x, 83, 37, 23);
          rect(x % 90 ? '#ff716a' : '#82ef91', x + 4, 87, 12, 4);
        }
      } else if (this.room.props === 'workshop') {
        rect('#354044', 320, 76, 160, 47);
        rect('#9aa7a7', 329, 84, 142, 30);
        rect(palette.accent, 338, 90, 124, 7);
        for (let x = 342; x < 460; x += 24) rect('#263237', x, 102, 13, 8);
      } else if (this.room.props === 'cafeteria') {
        rect('#233b37', 306, 74, 188, 51);
        rect('#102923', 312, 80, 176, 38);
        rect('#e8c661', 316, 84, 81, 29);
        rect('#16342e', 320, 88, 73, 21);
        rect('#71b7e7', 403, 84, 81, 29);
        rect('#16304a', 407, 88, 73, 21);
        ctx.fillStyle = '#fff1b8';
        ctx.font = 'bold 6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('COURSE', 356, 97);
        ctx.fillText('RANKING', 356, 105);
        ctx.fillText('COURSE', 444, 97);
        ctx.fillText('CHAMPIONS', 444, 105);
      } else {
        rect('#d9e4d8', 320, 76, 160, 47);
        rect('#6d8782', 328, 83, 144, 31);
        for (let x = 340; x < 462; x += 30) {
          rect('#dff9ff', x, 87, 16, 19);
          rect(palette.accent, x + 4, 94, 8, 12);
        }
      }
      rect(palette.accent, 350, 118, 100, 3);
    }

    drawPeriodicGrid(x, y, accent) {
      for (let row = 0; row < 3; row++) for (let column = 0; column < 8; column++) {
        rect((row + column) % 3 ? '#345c70' : accent, x + column * 16, y + row * 8, 13, 6);
      }
    }

    drawRoomProps(palette) {
      const type = this.room.props;
      if (type === 'laboratory') return this.drawLaboratory(palette);
      if (type === 'hall') return this.drawHall(palette);
      if (type === 'lecture') return this.drawLecture(palette);
      if (type === 'library') return this.drawLibrary(palette);
      if (type === 'office') return this.drawOffice(palette);
      if (type === 'workshop') return this.drawWorkshop(palette);
      if (type === 'cafeteria') return this.drawCafeteria(palette);
      this.drawSecurity(palette);
    }

    drawLaboratory(palette) {
      for (const area of this.logicalFurnitureBounds().slice(1)) {
        this.drawBench(area, '#dbe6d8', '#607b78');
        for (let x = area.x + 26; x < area.x + area.w - 18; x += 52) {
          rect('#071418', x - 5, area.y + 8, 30, 29);
          rect('#b9d0c8', x - 2, area.y + 11, 24, 23);
          rect(palette.accent, x + 6, area.y + 17, 8, 13);
          rect('#e9fff4', x + 4, area.y + 13, 12, 5);
        }
      }
      // Fume hoods, gas taps and safety equipment.
      rect('#071418', 45, 100, 84, 48); rect('#99bdb8', 49, 104, 76, 40); rect('#31535a', 55, 110, 64, 27);
      rect('#071418', 671, 100, 84, 48); rect('#99bdb8', 675, 104, 76, 40); rect('#31535a', 681, 110, 64, 27);
      rect('#ff716a', 746, 231, 10, 38); rect('#e9fff4', 748, 237, 6, 11);
      this.drawPlant(50, 365);
    }

    drawHall() {
      // Curtains and stage lighting.
      rect('#4d1721', 270, 92, 48, 74); rect('#4d1721', 482, 92, 48, 74);
      for (let y = 96; y < 164; y += 12) { rect('#8f2730', 276, y, 34, 7); rect('#8f2730', 490, y, 34, 7); }
      rect('#382a28', 300, 134, 200, 28); rect('#e1ba62', 306, 139, 188, 4);
      for (const row of this.logicalFurnitureBounds().slice(1)) this.drawChairRow(row);
      for (const x of [160, 640]) { rect('#071418', x - 8, 116, 16, 36); rect('#ffe36e', x - 3, 120, 6, 24); }
    }

    drawLecture(palette) {
      rect('#071418', 52, 105, 160, 57); rect('#e9efe8', 57, 110, 150, 47);
      this.drawPeriodicGrid(67, 120, palette.accent);
      rect('#071418', 588, 105, 160, 57); rect('#e9efe8', 593, 110, 150, 47);
      ctx.fillStyle = '#244a5b'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('EC015', 668, 138);
      for (const desk of this.logicalFurnitureBounds().slice(1)) this.drawLectureDesk(desk);
      rect('#071418', 360, 151, 80, 34); rect('#5a463a', 365, 156, 70, 24); rect(palette.accent, 390, 160, 20, 8);
    }

    drawLibrary(palette) {
      for (const shelf of this.logicalFurnitureBounds().slice(1)) this.drawShelf(shelf, palette.accent);
      this.drawReadingTable(300, 211, 200, 52);
      this.drawReadingTable(300, 318, 200, 48);
      rect('#071418', 55, 100, 142, 34); rect('#7d5237', 59, 104, 134, 26);
      ctx.fillStyle = '#e9fff4'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('KAUNTER PINJAMAN', 126, 121);
      this.drawPlant(728, 362); this.drawPlant(72, 362);
    }

    drawOffice(palette) {
      for (const desk of this.logicalFurnitureBounds().slice(1)) {
        this.drawOfficeDesk(desk);
      }
      rect('#071418', 333, 139, 134, 27); rect('#6b493e', 338, 144, 124, 17);
      ctx.fillStyle = palette.accent; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('AKSES PENSYARAH', 400, 156);
      for (const x of [45, 744]) { rect('#071418', x - 12, 110, 24, 52); rect('#7f8c88', x - 9, 114, 18, 44); for (let y = 120; y < 150; y += 11) rect('#26373b', x - 5, y, 10, 3); }
      this.drawPlant(714, 368);
    }

    drawWorkshop(palette) {
      for (const bench of this.logicalFurnitureBounds().slice(1)) {
        this.drawBench(bench, '#727d7a', '#303b3e');
        for (let x = bench.x + 24; x < bench.x + bench.w - 20; x += 58) this.drawMachine(x, bench.y + 11, palette.accent);
      }
      rect('#071418', 43, 105, 118, 36); rect('#26373b', 47, 109, 110, 28);
      ctx.fillStyle = '#f2c247'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('PPE WAJIB', 102, 126);
      rect('#f2c247', 692, 104, 60, 38); rect('#071418', 700, 111, 44, 5); rect('#071418', 700, 123, 44, 5);
    }

    drawCafeteria(palette) {
      const furniture = this.logicalFurnitureBounds();
      const counters = furniture.slice(1, 3);
      const tables = furniture.slice(3);

      // Restaurant kitchen pass, hot-food line and cashier counter.
      rect('#071418', 43, 100, 272, 34);
      rect('#28483f', 47, 104, 264, 26);
      ctx.fillStyle = '#fff1b8'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillText('MENU HARI INI · NASI · MEE · MINUMAN', 179, 120);
      rect('#071418', 489, 100, 264, 34);
      rect('#4a2d27', 493, 104, 256, 26);
      ctx.fillStyle = palette.accent;
      ctx.fillText('DAPUR KMKJ · PESANAN PANAS', 621, 120);

      counters.forEach((counter, counterIndex) => {
        this.drawBench(counter, '#e3c38c', counterIndex ? '#6f4a35' : '#7a5138');
        for (let x = counter.x + 18; x < counter.x + counter.w - 25; x += 47) {
          rect('#071418', x, counter.y + 9, 34, 25);
          rect((x + counterIndex) % 94 ? '#d96545' : '#82ad57', x + 4, counter.y + 13, 26, 16);
          rect('#fff1b8', x + 8, counter.y + 15, 18, 3);
        }
      });

      // Cash register, drink refrigerator, tray return and kitchen staff.
      rect('#071418', 286, 147, 25, 23); rect('#b7cfca', 290, 151, 17, 10); rect('#273e42', 293, 164, 13, 4);
      rect('#071418', 730, 105, 23, 34); rect('#73aeb6', 734, 109, 15, 26); rect('#dffcf2', 736, 112, 11, 8);
      rect('#071418', 45, 204, 76, 26); rect('#395a51', 49, 208, 68, 18);
      ctx.fillStyle = '#e9fff4'; ctx.font = 'bold 6px monospace'; ctx.fillText('PULANG TRAY', 83, 220);
      this.drawRestaurantGuest(520, 132, '#ffcf5c', '#8c553c', true);
      this.drawRestaurantGuest(695, 132, '#ffcf5c', '#b97857', true);

      // Four dining islands preserve a wide central walking aisle to the boards.
      for (const table of tables) {
        this.drawDiningSet(table.x, table.y);
        for (const plateX of [table.x + 30, table.x + 75, table.x + 120]) {
          rect('#f5efe0', plateX, table.y + 9, 14, 7);
          rect(plateX % 3 ? '#d85c45' : '#65a15c', plateX + 4, table.y + 11, 6, 3);
        }
      }
      this.drawRestaurantGuest(95, 294, '#4d84c4', '#a96746');
      this.drawRestaurantGuest(185, 294, '#bd4e48', '#d49a73');
      this.drawRestaurantGuest(590, 294, '#6aaf64', '#b97857');
      this.drawRestaurantGuest(680, 294, '#a36bc2', '#8c553c');
      this.drawRestaurantGuest(102, 386, '#e09d36', '#d49a73');
      this.drawRestaurantGuest(650, 386, '#4d84c4', '#a96746');

      // Central restaurant aisle, queue arrows and warm pendant lights.
      rect('#8a694c', 348, 139, 104, 256);
      for (let y = 172; y < 385; y += 40) {
        rect('#e8c661', 393, y, 14, 4); rect('#e8c661', 397, y - 4, 6, 12);
      }
      for (const x of [270, 400, 530]) {
        rect('#071418', x - 2, 91, 4, 14); rect('#ffd873', x - 12, 105, 24, 7); rect('#fff1b8', x - 7, 112, 14, 3);
      }
      this.drawPlant(52, 376); this.drawPlant(748, 376);
    }

    drawRestaurantGuest(x, y, shirt, skin, apron = false) {
      rect('#071418', x - 8, y - 18, 16, 18);
      rect(skin, x - 5, y - 15, 10, 8);
      rect(shirt, x - 6, y - 7, 12, 9);
      if (apron) rect('#f1eee2', x - 3, y - 6, 6, 7);
      rect('#071418', x - 5, y, 4, 4); rect('#071418', x + 1, y, 4, 4);
    }

    drawSecurity(palette) {
      // Guard desk, CCTV wall, visitor counter and gate controls.
      for (const area of this.logicalFurnitureBounds().slice(1)) this.drawOfficeDesk(area);
      rect('#071418', 55, 100, 218, 43); rect('#22383f', 59, 104, 210, 35);
      for (let x = 66; x < 260; x += 48) { rect('#6d9fa8', x, 109, 40, 23); rect(x % 96 ? '#ff716a' : '#82ef91', x + 4, 113, 10, 4); }
      rect('#071418', 527, 100, 218, 43); rect('#c4c7bb', 531, 104, 210, 35);
      ctx.fillStyle = '#26383e'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('DAFTAR PELAWAT', 636, 125);
      rect('#f2c247', 355, 143, 90, 9); rect('#071418', 394, 143, 8, 36);
      rect(palette.accent, 431, 139, 13, 17);
    }

    drawBench(area, top, base) {
      rect('#071418', area.x - 4, area.y - 4, area.w + 8, area.h + 8);
      rect(base, area.x, area.y, area.w, area.h);
      rect(top, area.x + 5, area.y + 5, area.w - 10, Math.min(18, area.h - 10));
      rect('#ffffff25', area.x + 8, area.y + 7, area.w - 16, 3);
    }

    drawChairRow(area) {
      for (let x = area.x; x < area.x + area.w - 20; x += 36) {
        rect('#071418', x, area.y, 29, area.h);
        rect('#873b38', x + 4, area.y + 4, 21, area.h - 8);
        rect('#c6684f', x + 7, area.y + 7, 15, 7);
      }
    }

    drawLectureDesk(area) {
      rect('#071418', area.x - 3, area.y - 3, area.w + 6, area.h + 6);
      rect('#735744', area.x, area.y, area.w, area.h);
      rect('#d1b780', area.x + 4, area.y + 4, area.w - 8, 10);
      for (let x = area.x + 15; x < area.x + area.w - 15; x += 42) rect('#2a4652', x, area.y + 19, 25, 13);
    }

    drawShelf(area, accent) {
      rect('#071418', area.x - 4, area.y - 4, area.w + 8, area.h + 8);
      rect('#593b2b', area.x, area.y, area.w, area.h);
      for (let x = area.x + 7; x < area.x + area.w - 8; x += 14) rect(x % 28 ? '#c34c42' : (x % 42 ? '#3e82a4' : accent), x, area.y + 6, 9, area.h - 12);
      rect('#c99452', area.x + 3, area.y + 18, area.w - 6, 4);
    }

    drawReadingTable(x, y, width, height) {
      rect('#071418', x - 4, y - 4, width + 8, height + 8);
      rect('#8a5b3d', x, y, width, height);
      rect('#d3a469', x + 6, y + 6, width - 12, 15);
      for (const chairX of [x - 22, x + width + 8]) { rect('#071418', chairX, y + 8, 18, 30); rect('#55756b', chairX + 3, y + 11, 12, 24); }
      for (let bookX = x + 28; bookX < x + width - 20; bookX += 62) { rect('#234f68', bookX, y + 8, 28, 9); rect('#e5d29d', bookX + 3, y + 10, 22, 5); }
    }

    drawOfficeDesk(area) {
      rect('#071418', area.x - 4, area.y - 4, area.w + 8, area.h + 8);
      rect('#6d5142', area.x, area.y, area.w, area.h);
      rect('#b89468', area.x + 5, area.y + 5, area.w - 10, 16);
      for (let x = area.x + 22; x < area.x + area.w - 30; x += 70) {
        rect('#071418', x, area.y + 26, 48, 31);
        rect('#5c9299', x + 4, area.y + 30, 40, 20);
        rect('#e9fff4', x + 14, area.y + 53, 20, 3);
      }
    }

    drawMachine(x, y, accent) {
      rect('#071418', x, y, 40, 37);
      rect('#4a5555', x + 4, y + 4, 32, 29);
      rect(accent, x + 9, y + 8, 22, 7);
      rect('#ff716a', x + 8, y + 21, 6, 6);
      rect('#82ef91', x + 18, y + 21, 6, 6);
      rect('#cdd9d6', x + 28, y + 21, 4, 8);
    }

    drawDiningSet(x, y) {
      rect('#071418', x - 4, y - 4, 155, 57);
      rect('#8b5d40', x, y, 147, 49);
      rect('#d3a66e', x + 6, y + 6, 135, 15);
      rect('#f3d394', x + 10, y + 8, 127, 3);
      for (const chairX of [x + 8, x + 62, x + 116]) { rect('#315b58', chairX, y + 29, 24, 15); rect('#071418', chairX + 5, y + 44, 4, 8); rect('#071418', chairX + 16, y + 44, 4, 8); }
    }

    drawPlant(x, y) {
      rect('#071418', x - 10, y - 4, 20, 20);
      rect('#9a6745', x - 7, y, 14, 12);
      rect('#315f42', x - 13, y - 22, 10, 20);
      rect('#397a4d', x + 3, y - 26, 11, 24);
      rect('#55a55e', x - 5, y - 31, 10, 28);
    }

    drawNpcLayer() {
      const frame = Math.floor(this.animationTime * 4) % 4;
      const pulse = 3 + Math.round(Math.sin(this.animationTime * 5) * 2);
      rect('#071418bb', TEACHER.x - 89, TEACHER.y - 62, 178, 22);
      rect(this.room.palette.accent, TEACHER.x - 85, TEACHER.y - 58, 170, 14);
      ctx.fillStyle = '#071418';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.room.props === 'cafeteria' ? 'MDM. BALQIS · BOARD HOST' : 'MDM. BALQIS · EC015', TEACHER.x, TEACHER.y - 48);
      ctx.strokeStyle = this.room.palette.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(TEACHER.x - 24 - pulse, TEACHER.y - 43 - pulse, 48 + pulse * 2, 48 + pulse * 2);
      sprites.drawLecturer(ctx, {x: TEACHER.x, y: TEACHER.y, frame, scale: 1.08});
      if (this.room.props === 'security') sprites.drawGuard(ctx, {x: 1140, y: 300, frame, scale: 1.02});
      if (this.room.props === 'office' && !this.options.missionLabel?.includes('READ')) {
        rect('#071418dd', 900, 258, 44, 42);
        rect('#dff7ff', 906, 264, 32, 27);
        rect('#ff716a', 912, 273, 6, 6); rect('#ff716a', 927, 273, 6, 6);
      }
    }

    drawExit() {
      rect('#071418', 347, 405, 106, 45);
      rect('#e9fff4', 358, 410, 84, 31);
      rect('#b9d3cf', 363, 414, 74, 22);
      rect('#071418', 432, 423, 4, 5);
      ctx.fillStyle = '#071418';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('KELUAR', 400, 432);
    }

    drawPlayer() {
      const moving = this.keys.size > 0;
      const frame = moving ? Math.floor(this.animationTime * 9) % 4 : Math.floor(this.animationTime * 2) % 4;
      sprites.drawCharacter(ctx, {
        x: this.player.x, y: this.player.y, courseId: this.course,
        ghost: !this.course, facing: this.player.facing, frame, scale: 1.08
      });
    }

    drawCompanion() {
      const moving = this.companionPath.length > 4;
      const frame = moving ? Math.floor(this.animationTime * 9) % 4 : Math.floor(this.animationTime * 2) % 4;
      sprites.drawRobotCompanion(ctx, {
        x: this.companion.x,
        y: this.companion.y,
        facing: this.companion.facing,
        frame,
        scale: .92,
        alert: Boolean(store?.state?.assistant?.unread)
      });
    }

    drawInteriorHud(palette) {
      const distance = Math.round(Math.hypot(this.player.x - TEACHER.x, this.player.y - TEACHER.y) / 10);
      const horizontal = TEACHER.x - this.player.x;
      const vertical = TEACHER.y - this.player.y;
      const arrow = Math.abs(horizontal) > Math.abs(vertical) ? (horizontal > 0 ? '→' : '←') : (vertical > 0 ? '↓' : '↑');
      rect('rgba(4,16,20,.92)', 10, 10, 245, 46);
      rect(palette.accent, 14, 14, 4, 38);
      ctx.fillStyle = '#e9fff4';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${arrow} ${this.room.props === 'cafeteria' ? 'LIVE LEADERBOARDS' : 'MDM. BALQIS'} · ${distance}M`, 28, 31);
      ctx.fillStyle = palette.accent;
      ctx.font = 'bold 8px monospace';
      ctx.fillText(this.room.props === 'cafeteria' ? 'PRESS E TO VIEW ALL RANKINGS' : 'TALK TO START OR PRACTICE EC015', 28, 45);

      const mapX = 654;
      const mapY = 10;
      rect('rgba(4,16,20,.94)', mapX, mapY, 136, 84);
      rect('#e9fff4', mapX + 7, mapY + 21, 122, 56);
      rect(palette.trim, mapX + 10, mapY + 24, 116, 50);
      const markerX = mapX + 10 + this.player.x / WORLD_WIDTH * 116;
      const markerY = mapY + 24 + this.player.y / WORLD_HEIGHT * 50;
      const teacherX = mapX + 10 + TEACHER.x / WORLD_WIDTH * 116;
      const teacherY = mapY + 24 + TEACHER.y / WORLD_HEIGHT * 50;
      rect('#ffe36e', teacherX - 3, teacherY - 3, 7, 7);
      rect('#ff716a', markerX - 3, markerY - 3, 7, 7);
      ctx.fillStyle = '#e9fff4';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ROOM MAP · 2× AREA', mapX + 68, mapY + 14);
    }

    drawAtmosphere(palette) {
      // Light shafts and tiny animated room particles make the interior feel occupied.
      ctx.save();
      ctx.globalAlpha = .08;
      rect('#e9fff4', 515, 75, 45, 270);
      rect('#e9fff4', 600, 75, 36, 210);
      ctx.globalAlpha = 1;
      for (let index = 0; index < 12; index++) {
        const x = 45 + ((index * 71 + this.animationTime * (5 + index % 3)) % 700);
        const y = 105 + ((index * 47 + this.animationTime * 3) % 270);
        rect(index % 2 ? palette.accent : '#e9fff4', x, y, 2, 2);
      }
      ctx.restore();
    }

    get isOpen() {
      return Boolean(this.location) && !overlay.classList.contains('hidden');
    }

    debugSnapshot() {
      return {
        world: [WORLD_WIDTH, WORLD_HEIGHT],
        camera: {...this.camera}, player: {...this.player}, companion: {...this.companion}, teacher: {...TEACHER},
        near: this.near, colliding: this.collides(this.player.x, this.player.y)
      };
    }
  }

  global.SeventhReactionInteriors = new InteriorController();
})(globalThis);
