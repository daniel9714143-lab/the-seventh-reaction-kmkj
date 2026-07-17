(function initialisePixelAudio(global) {
  'use strict';

  const AudioContextClass = global.AudioContext || global.webkitAudioContext;
  const melody = [72, 76, 79, 76, 74, 77, 81, 77, 69, 72, 76, 72, 67, 71, 74, 79];
  const harmony = [48, 48, 45, 45, 50, 50, 43, 43];
  const midiToHz = note => 440 * (2 ** ((note - 69) / 12));

  class PixelMusic {
    constructor() {
      this.enabled = true;
      this.context = null;
      this.master = null;
      this.timer = 0;
      this.step = 0;
      this.nextStepTime = 0;
      this.unlocked = false;
      this.unlock = this.unlock.bind(this);
      global.addEventListener('pointerdown', this.unlock, {capture: true});
      global.addEventListener('keydown', this.unlock, {capture: true});
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stopScheduler();
        else if (this.enabled && this.unlocked) this.start();
      });
    }

    async unlock() {
      if (!this.enabled || !AudioContextClass) return;
      try {
        if (!this.context) {
          this.context = new AudioContextClass();
          this.master = this.context.createGain();
          this.master.gain.value = 0.045;
          this.master.connect(this.context.destination);
        }
        await this.context.resume();
        this.unlocked = true;
        global.removeEventListener('pointerdown', this.unlock, {capture: true});
        global.removeEventListener('keydown', this.unlock, {capture: true});
        this.start();
      } catch (_) {
        // The next player gesture can retry if a browser blocks this gesture.
      }
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (!this.enabled) {
        this.stopScheduler();
        if (this.master && this.context) {
          this.master.gain.cancelScheduledValues(this.context.currentTime);
          this.master.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.04);
        }
        return;
      }
      if (this.unlocked) this.start();
    }

    start() {
      if (!this.enabled || !this.context || document.hidden) return;
      this.context.resume().catch(() => {});
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(0.045, this.context.currentTime, 0.08);
      if (this.timer) return;
      this.nextStepTime = this.context.currentTime + 0.04;
      this.timer = global.setInterval(() => this.scheduleAhead(), 80);
      this.scheduleAhead();
    }

    stopScheduler() {
      if (this.timer) global.clearInterval(this.timer);
      this.timer = 0;
    }

    scheduleAhead() {
      if (!this.enabled || !this.context) return;
      while (this.nextStepTime < this.context.currentTime + 0.28) {
        this.scheduleStep(this.nextStepTime, this.step);
        this.step += 1;
        this.nextStepTime += 0.205;
      }
    }

    tone(note, time, duration, type, level, detune = 0) {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(midiToHz(note), time);
      oscillator.detune.value = detune;
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(level, time + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
    }

    scheduleStep(time, step) {
      const melodyNote = melody[step % melody.length];
      this.tone(melodyNote, time, 0.13, 'square', 0.22);
      if (step % 2 === 0) this.tone(harmony[(step / 2) % harmony.length], time, 0.32, 'triangle', 0.27);
      if (step % 4 === 2) this.tone(melodyNote - 12, time, 0.09, 'square', 0.08, -5);
      if (step % 2 === 0) this.tone(35, time, 0.045, 'square', 0.12);
    }

    debug() {
      return {
        enabled: this.enabled,
        supported: Boolean(AudioContextClass),
        unlocked: this.unlocked,
        playing: Boolean(this.timer),
        contextState: this.context?.state || 'not-created'
      };
    }
  }

  global.SeventhReactionAudio = new PixelMusic();
})(globalThis);
