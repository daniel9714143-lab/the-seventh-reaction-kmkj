(function initialiseState(global) {
  'use strict';

  const STORAGE_KEY = 'the-seventh-reaction:v1';
  const STATE_VERSION = 2;
  const WORLD_SCALE = 8;
  const newRunId = () => global.crypto?.randomUUID?.() || `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const defaultState = () => ({
    version: STATE_VERSION,
    worldScale: WORLD_SCALE,
    runId: newRunId(),
    playerId: null,
    authenticated: false,
    profile: {fullName: '', nickname: 'Ghost', className: '', course: null},
    phase: 'splash',
    currentChapter: 0,
    completedChapters: [],
    score: 0,
    awardedQuestions: [],
    quiz: {chapterId: null, questionIndex: 0, attempts: 0},
    chapterProgress: {},
    interiorLocationId: null,
    position: {x: 617 * WORLD_SCALE, y: 949 * WORLD_SCALE, facing: 'up'},
    settings: {movementSpeed: 120, mapZoom: 1, sound: false, music: true},
    weakTopics: {},
    assistant: {lastWrongAnswer: null, unread: false},
    updatedAt: new Date().toISOString()
  });

  const mergeState = raw => {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    const sourceScale = Number(raw.worldScale) || 1;
    const requiresWorldMigration = Number(raw.version || 1) < STATE_VERSION || sourceScale !== WORLD_SCALE;
    const scaleRatio = WORLD_SCALE / sourceScale;
    const rawPosition = raw.position || {};
    const position = {
      ...base.position,
      ...rawPosition,
      x: requiresWorldMigration ? (Number(rawPosition.x) || 617) * scaleRatio : Number(rawPosition.x) || base.position.x,
      y: requiresWorldMigration ? (Number(rawPosition.y) || 949) * scaleRatio : Number(rawPosition.y) || base.position.y
    };
    const settings = {
      ...base.settings,
      ...(raw.settings || {})
    };
    if (requiresWorldMigration) {
      settings.movementSpeed = 120;
      settings.mapZoom = 1;
    }
    return {
      ...base,
      ...raw,
      version: STATE_VERSION,
      worldScale: WORLD_SCALE,
      profile: {...base.profile, ...(raw.profile || {})},
      quiz: {...base.quiz, ...(raw.quiz || {})},
      position,
      settings,
      assistant: {...base.assistant, ...(raw.assistant || {})},
      chapterProgress: {...(raw.chapterProgress || {})},
      weakTopics: {...(raw.weakTopics || {})},
      completedChapters: Array.isArray(raw.completedChapters) ? raw.completedChapters : [],
      awardedQuestions: Array.isArray(raw.awardedQuestions) ? raw.awardedQuestions : []
    };
  };

  class GameStateStore extends EventTarget {
    constructor() {
      super();
      this.state = defaultState();
      this.remoteSaveTimer = null;
      this.loadLocal();
    }

    loadLocal() {
      try {
        this.state = mergeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
      } catch (_) {
        this.state = defaultState();
      }
      return this.state;
    }

    replace(nextState, options = {}) {
      this.state = mergeState(nextState);
      this.persist(options);
      return this.state;
    }

    update(patch, options = {}) {
      const next = typeof patch === 'function' ? patch(structuredClone(this.state)) : {...this.state, ...patch};
      this.state = mergeState(next);
      this.persist(options);
      return this.state;
    }

    persist({remote = true} = {}) {
      this.state.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.dispatchEvent(new CustomEvent('change', {detail: this.snapshot()}));
      if (remote && this.state.authenticated) this.scheduleRemoteSave();
    }

    scheduleRemoteSave() {
      clearTimeout(this.remoteSaveTimer);
      this.remoteSaveTimer = setTimeout(() => this.saveRemote(), 500);
    }

    cancelPendingRemoteSave() {
      clearTimeout(this.remoteSaveTimer);
      this.remoteSaveTimer = null;
    }

    async saveRemote() {
      this.cancelPendingRemoteSave();
      try {
        const response = await fetch('api/save.php', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({state: this.state})
        });
        if (!response.ok) throw new Error(`Save failed (${response.status})`);
        this.dispatchEvent(new CustomEvent('sync', {detail: {ok: true}}));
        return true;
      } catch (error) {
        this.dispatchEvent(new CustomEvent('sync', {detail: {ok: false, error: error.message}}));
        return false;
      }
    }

    async hydrateFromSession() {
      try {
        const response = await fetch('api/session.php', {headers: {'Accept': 'application/json'}});
        if (!response.ok) return {authenticated: false};
        const payload = await response.json();
        if (payload.authenticated && payload.state) {
          const localUpdated = Date.parse(this.state.updatedAt || 0);
          const remoteUpdated = Date.parse(payload.state.updatedAt || 0);
          const selected = remoteUpdated >= localUpdated ? payload.state : this.state;
          this.replace({
            ...selected,
            authenticated: true,
            playerId: payload.player.id,
            profile: {
              ...selected.profile,
              fullName: payload.player.fullName,
              nickname: payload.player.nickname,
              className: payload.player.className,
              course: payload.player.course || selected.profile?.course || null
            }
          }, {remote: false});
        }
        return payload;
      } catch (_) {
        return {authenticated: false, offline: true};
      }
    }

    reset({preserveProfile = true} = {}) {
      this.cancelPendingRemoteSave();
      const profile = preserveProfile ? this.state.profile : defaultState().profile;
      const authenticated = preserveProfile ? this.state.authenticated : false;
      const playerId = preserveProfile ? this.state.playerId : null;
      this.replace({...defaultState(), profile, authenticated, playerId});
    }

    snapshot() {
      return structuredClone(this.state);
    }
  }

  global.SeventhReactionState = new GameStateStore();
})(globalThis);
