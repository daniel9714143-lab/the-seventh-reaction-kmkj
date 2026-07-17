(function initialiseApplication(global) {
  'use strict';

  const content = global.SEVENTH_REACTION_CONTENT;
  const store = global.SeventhReactionState;
  const game = global.SeventhReactionGame;
  const interiors = global.SeventhReactionInteriors;
  const miniGames = global.SeventhReactionMiniGames;
  const audio = global.SeventhReactionAudio;
  const assistant = global.SeventhReactionAssistant;
  const byId = id => document.getElementById(id);

  const ui = {
    splash: byId('splash-screen'), auth: byId('auth-screen'), course: byId('course-screen'),
    quiz: byId('quiz-screen'), mini: byId('mini-game-screen'), ending: byId('ending-screen'),
    dialogue: byId('dialogue'), interior: byId('interior-screen'), letter: byId('letter-screen'),
    cafeteriaBoard: byId('cafeteria-leaderboard'),
    settings: byId('settings-panel'), assistant: byId('ai-panel'), toast: byId('toast'),
    hudPlayer: byId('hud-player'), hudChapter: byId('hud-chapter'), hudScore: byId('hud-score'),
    questTitle: byId('quest-title'), questText: byId('quest-text'), track: byId('chapter-track'),
    routeLabel: byId('route-label'), locationBanner: byId('location-banner'),
    prompt: byId('interaction-prompt'), saveLight: byId('save-light'), saveStatus: byId('save-status')
  };

  let dialogueQueue = [];
  let dialogueDone = null;
  let quizSelection = null;
  let quizOutcome = null;
  let toastTimer = null;
  let currentNearby = null;
  let miniGameChapterId = null;
  let miniGamePurpose = 'chapter';
  let letterChapterId = null;
  let practiceChapterId = null;
  let practiceQuiz = {questionIndex: 0, attempts: 0};
  let aiBusy = false;

  function activeQuizChapter() {
    return practiceChapterId ? content.chapters[practiceChapterId - 1] : currentChapter();
  }

  function activeQuizIndex() {
    return practiceChapterId ? practiceQuiz.questionIndex : store.state.quiz.questionIndex;
  }

  function activeQuizAttempts() {
    return practiceChapterId ? practiceQuiz.attempts : store.state.quiz.attempts;
  }

  function formatZoom(value) {
    const zoom = Number(value);
    return `${zoom < 1 ? zoom.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : zoom.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}×`;
  }

  function setOverlay(element, visible) {
    element.classList.toggle('hidden', !visible);
  }

  function modalOpen() {
    return [ui.splash, ui.auth, ui.course, ui.quiz, ui.mini, ui.ending, ui.dialogue, ui.letter, ui.cafeteriaBoard]
      .some(element => !element.classList.contains('hidden'));
  }

  function pauseScene() {
    game.pause();
    interiors.pause();
  }

  function resumeScene() {
    if (modalOpen()) return;
    if (interiors.isOpen) interiors.resume();
    else game.resume();
  }

  function startPlaying() {
    setOverlay(ui.splash, false);
    setOverlay(ui.auth, false);
    byId('ai-toggle').classList.remove('hidden');
    renderHud();
    game.start();
    if (store.state.interiorLocationId && content.locations[store.state.interiorLocationId]
      && locationIsUnlocked(store.state.interiorLocationId)) {
      enterBuilding(content.locations[store.state.interiorLocationId], {restore: true});
    }
    if (store.state.phase === 'ending') setTimeout(() => showEnding(), 0);
  }

  function showToast(message, duration = 3000) {
    clearTimeout(toastTimer);
    ui.toast.textContent = message;
    setOverlay(ui.toast, true);
    toastTimer = setTimeout(() => setOverlay(ui.toast, false), duration);
  }

  function currentChapter() {
    return content.chapters[store.state.currentChapter - 1] || null;
  }

  function currentProgress(chapterId = store.state.currentChapter) {
    return store.state.chapterProgress[String(chapterId)] || {};
  }

  function missionForState() {
    const state = store.state;
    if (state.currentChapter === 0 || !state.profile.course) {
      return {title: 'THE FIRST FOOTSTEP', text: 'Travel to Makmal Chemistry to begin the story. The Cafeteria restaurant and live leaderboards are already open.'};
    }
    if (state.phase === 'ending') {
      return {title: 'CAMPUS RESTORED', text: 'The seven reactions are stable. View the final course and player rankings.'};
    }
    if (state.phase === 'complete') {
      return {title: 'FREE EXPLORE MODE', text: 'Chemistry Master status achieved. Every KMKJ location is unlocked for free exploration and chapter practice.'};
    }
    const chapter = currentChapter();
    if (!chapter) return {title: 'CAMPUS RESTORED', text: 'The seven reactions are stable.'};
    const progress = currentProgress();
    if (chapter.id === 5 && !progress.hasKey) {
      return {title: 'THE LOCKED OFFICE · 5/7', text: 'Enter the Bilik Pensyarah vestibule and defeat the snowball Boss to obtain the key.'};
    }
    if (progress.quizComplete) {
      return {title: `LETTER DESTINATION · ${chapter.id}/7`, text: `Travel to ${content.locations[chapter.nextLocationId].name.toUpperCase()}. This is the only newly unlocked chapter destination.`};
    }
    return {title: `${chapter.title.toUpperCase()} · ${chapter.id}/7`, text: `${chapter.objective} Enter the building and walk to its glowing mission station.`};
  }

  function unlockedLocationIds() {
    const state = store.state;
    if (state.phase === 'complete') return new Set(Object.keys(content.locations));
    const ids = new Set(['main-gate', 'cafeteria']);
    if (state.currentChapter === 0 || !state.profile.course) {
      ids.add('chemistry-laboratory');
      return ids;
    }
    for (const chapterId of state.completedChapters) {
      const chapter = content.chapters[chapterId - 1];
      if (chapter) ids.add(chapter.locationId);
    }
    const chapter = currentChapter();
    if (chapter) {
      ids.add(chapter.locationId);
      if (currentProgress().quizComplete) ids.add(chapter.nextLocationId);
    }
    if (state.phase === 'ending' || state.phase === 'complete') ids.add('guard-house-exit');
    return ids;
  }

  function locationIsUnlocked(locationId) {
    return unlockedLocationIds().has(locationId);
  }

  function renderTeleportOptions() {
    const select = byId('teleport-destination');
    if (!select) return;
    const unlocked = unlockedLocationIds();
    const target = game.objectiveLocation();
    select.replaceChildren(...[...unlocked]
      .filter(id => content.locations[id])
      .map(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${id === target?.id ? '★ ' : ''}${content.locations[id].name.toUpperCase()}`;
        if (id === target?.id) option.selected = true;
        return option;
      }));
  }

  function renderHud() {
    const state = store.state;
    const course = content.courses.find(item => item.id === state.profile.course);
    ui.hudPlayer.textContent = course ? `${course.hero} · ${state.profile.nickname}` : (state.profile.nickname || 'GHOST');
    ui.hudChapter.textContent = state.currentChapter ? `${state.currentChapter} / 7` : 'PROLOGUE';
    ui.hudScore.textContent = String(state.score || 0).padStart(6, '0');
    const mission = missionForState();
    ui.questTitle.textContent = mission.title;
    ui.questText.textContent = mission.text;
    ui.track.replaceChildren(...content.chapters.map(chapter => {
      const marker = document.createElement('i');
      if (state.completedChapters.includes(chapter.id)) marker.className = 'done';
      else if (state.currentChapter === chapter.id) marker.className = 'current';
      marker.title = `Chapter ${chapter.id}: ${chapter.topic}`;
      return marker;
    }));
    const target = game.objectiveLocation();
    ui.routeLabel.textContent = `DESTINATION: ${target?.name.toUpperCase() || 'EXPLORE KMKJ'}`;
    byId('local-continue').classList.toggle('hidden', state.phase === 'splash' && state.currentChapter === 0 && !state.authenticated);
    byId('movement-speed').value = String(state.settings.movementSpeed);
    byId('movement-speed-value').value = String(state.settings.movementSpeed);
    byId('map-zoom').value = String(state.settings.mapZoom);
    byId('map-zoom-value').value = formatZoom(state.settings.mapZoom);
    byId('sound-toggle').checked = Boolean(state.settings.music);
    audio?.setEnabled(Boolean(state.settings.music));
    byId('logout-player').classList.toggle('hidden', state.phase === 'splash' && !state.authenticated);
    byId('ai-toggle').classList.toggle('has-alert', Boolean(state.assistant?.unread));
    byId('quiz-ai').classList.toggle('has-alert', Boolean(state.assistant?.unread));
    renderTeleportOptions();
  }

  function showDialogue({speaker = 'Mdm. Balqis', portrait = 'L', lines, onDone = null}) {
    dialogueQueue = Array.isArray(lines) ? [...lines] : [String(lines)];
    dialogueDone = onDone;
    byId('dialogue-speaker').textContent = speaker.toUpperCase();
    byId('dialogue-portrait').textContent = portrait;
    setOverlay(ui.dialogue, true);
    pauseScene();
    advanceDialogue();
  }

  function advanceDialogue() {
    if (dialogueQueue.length) {
      byId('dialogue-text').textContent = dialogueQueue.shift();
      byId('dialogue-next').textContent = dialogueQueue.length ? 'NEXT ▸' : 'CLOSE ×';
      return;
    }
    setOverlay(ui.dialogue, false);
    const callback = dialogueDone;
    dialogueDone = null;
    if (callback) callback();
    else resumeScene();
  }

  function renderCourseCards() {
    const grid = byId('course-grid');
    grid.replaceChildren(...content.courses.map(course => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'course-card';
      card.dataset.course = course.id;
      card.style.setProperty('--hero-color', course.color);
      card.style.setProperty('--hero-accent', course.accent);
      card.innerHTML = `<span class="hero-pixel" aria-hidden="true"><canvas width="32" height="34"></canvas></span><b>${course.hero}</b><strong>${course.name}</strong><small>Transform the Ghost and use this programme's apparatus in Chapter 6.</small>`;
      game.paintHeroPreview(card.querySelector('canvas'), course.id);
      card.addEventListener('click', () => chooseCourse(course));
      return card;
    }));
  }

  function chooseCourse(course) {
    store.update(state => {
      state.profile.course = course.id;
      state.phase = 'chapter';
      state.currentChapter = 1;
      state.quiz = {chapterId: null, questionIndex: 0, attempts: 0};
      state.interiorLocationId = 'chemistry-laboratory';
      return state;
    });
    setOverlay(ui.course, false);
    showDialogue({
      speaker: course.hero,
      portrait: course.sprite,
      lines: [
        `${course.hero} represents ${course.name}. Your Ghost form has transformed.`,
        'Every hero completes the same seven EC015 chapters, but Chapter 6 will use your selected course workshop.',
        'Walk to the glowing laboratory console and press E to start Chapter 1.'
      ]
    });
  }

  function introduceCourseSelection() {
    store.update(state => { state.phase = 'course-selection'; return state; });
    renderCourseCards();
    setOverlay(ui.course, true);
    pauseScene();
  }

  function interiorOptions(location) {
    const chapter = currentChapter();
    const progress = currentProgress();
    const completed = content.chapters.find(item => item.locationId === location.id && store.state.completedChapters.includes(item.id));
    let missionLabel = 'INSPECT LOCATION';
    let objective = 'Explore the larger room, find Mdm. Balqis, and press E to talk.';
    if ((store.state.currentChapter === 0 || !store.state.profile.course) && location.id === 'chemistry-laboratory') {
      missionLabel = 'MEET MDM. BALQIS';
      objective = 'Walk to the Lecturer to discover your engineering identity.';
    } else if (completed && (completed.id !== chapter?.id || ['ending', 'complete'].includes(store.state.phase))) {
      missionLabel = `PRACTICE CHAPTER ${completed.id}`;
      objective = `Talk to Mdm. Balqis to redo the ${completed.topic} questions and replay its mini-game.`;
    } else if (chapter?.locationId === location.id) {
      missionLabel = chapter.id === 5 && !progress.hasKey ? 'CHALLENGE THE BOSS' : `START CHAPTER ${chapter.id}`;
      if (progress.quizComplete) missionLabel = 'READ DESTINATION LETTER';
      objective = `Find Mdm. Balqis. ${chapter.objective}`;
    } else if (location.id === 'cafeteria') {
      missionLabel = 'OPEN LIVE LEADERBOARDS';
      objective = 'Explore the KMKJ restaurant, then inspect the best player from each course and the permanent course ranking.';
    }
    return {course: store.state.profile.course, missionLabel, objective};
  }

  function enterBuilding(location, {restore = false} = {}) {
    if (!location || !locationIsUnlocked(location.id)) {
      showToast('That building is locked. Complete the active mission first.');
      return false;
    }
    game.pause();
    ui.prompt.classList.add('hidden');
    if (!restore || store.state.interiorLocationId !== location.id) {
      store.update(state => { state.interiorLocationId = location.id; return state; });
    }
    interiors.enter(location, interiorOptions(location));
    return true;
  }

  function handleExteriorInteraction(location) {
    const state = store.state;
    if (state.currentChapter === 0 || !state.profile.course) {
      if (location.id === 'cafeteria') {
        enterBuilding(location);
        return;
      }
      if (location.id !== 'chemistry-laboratory') return showToast('Only Makmal Chemistry and the Cafeteria are unlocked. Follow the yellow story marker.');
      enterBuilding(location);
      return;
    }
    const chapter = currentChapter();
    if (!chapter) {
      if (location.id === 'cafeteria') enterBuilding(location);
      else showToast('The seven reactions are complete. The Cafeteria leaderboard is available.');
      return;
    }
    const progress = currentProgress();
    if (location.id === chapter.locationId) {
      enterBuilding(location);
      return;
    }
    if (progress.quizComplete && location.id === chapter.nextLocationId) {
      completeChapter(chapter, location);
      return;
    }
    if (locationIsUnlocked(location.id)) {
      enterBuilding(location);
      return;
    }
    showToast(`LOCKED · Complete Chapter ${chapter.id} and follow the letter before entering ${location.name}.`);
  }

  function handleInteriorMission(location) {
    const state = store.state;
    if (location.id === 'cafeteria') {
      loadLeaderboard(true);
      return;
    }
    if (state.currentChapter === 0 || !state.profile.course) {
      if (location.id !== 'chemistry-laboratory') return;
      showDialogue({speaker: content.lecturer.name, lines: content.lecturer.welcome, onDone: introduceCourseSelection});
      return;
    }
    const chapter = currentChapter();
    const completed = content.chapters.find(item => item.locationId === location.id && state.completedChapters.includes(item.id));
    const practiceEligible = completed && (completed.id !== chapter?.id || ['ending', 'complete'].includes(state.phase));
    if (practiceEligible) {
      showDialogue({
        speaker: content.lecturer.name,
        lines: [
          `Welcome back to Chapter ${completed.id}: ${completed.topic}.`,
          completed.summary,
          'Practice mode will repeat all fixed questions and the full mini-game. It will not change your chapter progress or award duplicate leaderboard points.'
        ],
        onDone: () => openQuiz(completed, {practice: true})
      });
      return;
    }
    if (!chapter || location.id !== chapter.locationId) {
      if (completed) showDialogue({speaker: content.lecturer.name, lines: [`Chapter ${completed.id} is complete.`, completed.summary, 'Talk to me again when this chapter is available for practice mode.']});
      else showToast('There is no active mission at this station.');
      return;
    }
    const progress = currentProgress();
    if (progress.quizComplete) {
      showLetter(chapter);
      return;
    }
    if (chapter.id === 5 && !progress.hasKey) {
      showDialogue({
        speaker: 'Office Boss', portrait: '◆',
        lines: ['Bilik Pensyarah is locked. Dodge my snowballs and you may take the key.', 'Survive the three-lane Boss challenge. Losing all three shields restarts the mini-game.'],
        onDone: () => launchMiniGame(chapter, 'boss-key-challenge', 'entry-key')
      });
      return;
    }
    showDialogue({
      speaker: content.lecturer.name,
      lines: [`Chapter ${chapter.id}: ${chapter.topic}.`, chapter.intro, chapter.objective],
      onDone: () => openQuiz(chapter)
    });
  }

  function completeChapter(chapter, destinationLocation) {
    store.update(state => {
      if (!state.completedChapters.includes(chapter.id)) state.completedChapters.push(chapter.id);
      state.chapterProgress[String(chapter.id)] = {...currentProgress(chapter.id), completed: true};
      state.currentChapter = Math.min(7, chapter.id + 1);
      state.phase = 'chapter';
      state.quiz = {chapterId: null, questionIndex: 0, attempts: 0};
      state.interiorLocationId = destinationLocation.id;
      return state;
    });
    enterBuilding(destinationLocation, {restore: true});
    const next = currentChapter();
    showDialogue({
      speaker: content.lecturer.name,
      lines: [`${destinationLocation.name.toUpperCase()} reached. Chapter ${chapter.id} is complete.`, `Chapter ${next.id}: ${next.topic} is now unlocked inside this building.`]
    });
  }

  function openQuiz(chapter, {practice = false} = {}) {
    if (practice) {
      practiceChapterId = chapter.id;
      practiceQuiz = {questionIndex: 0, attempts: 0};
    } else {
      practiceChapterId = null;
      store.update(state => {
        if (state.quiz.chapterId !== chapter.id) state.quiz = {chapterId: chapter.id, questionIndex: 0, attempts: 0};
        return state;
      });
    }
    quizSelection = null;
    quizOutcome = null;
    setOverlay(ui.quiz, true);
    pauseScene();
    renderQuestion();
  }

  function activeQuestion() {
    const chapter = activeQuizChapter();
    return chapter?.questions[activeQuizIndex()] || null;
  }

  function renderQuestion() {
    const chapter = activeQuizChapter();
    const question = activeQuestion();
    if (!chapter || !question) return;
    const index = activeQuizIndex();
    quizSelection = null;
    quizOutcome = null;
    byId('quiz-chapter').textContent = `${practiceChapterId ? 'PRACTICE · ' : ''}CHAPTER ${chapter.id} · QUESTION ${index + 1}/${chapter.questions.length}`;
    byId('quiz-topic').textContent = chapter.topic.toUpperCase();
    byId('quiz-prompt').textContent = question.prompt;
    byId('quiz-progress-bar').style.width = `${(index / chapter.questions.length) * 100}%`;
    byId('quiz-feedback').className = 'quiz-feedback hidden';
    byId('quiz-feedback').textContent = '';
    byId('quiz-submit').classList.remove('hidden');
    byId('quiz-continue').classList.add('hidden');
    renderAttemptLights();
    const area = byId('quiz-answer-area');
    area.replaceChildren();
    if (question.type === 'mcq') {
      for (const option of question.options) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'answer-option';
        button.textContent = option;
        button.addEventListener('click', () => {
          quizSelection = option;
          for (const candidate of area.querySelectorAll('.answer-option')) candidate.classList.toggle('selected', candidate === button);
        });
        area.append(button);
      }
    } else {
      const input = document.createElement('input');
      input.className = 'fill-answer';
      input.type = 'text';
      input.autocomplete = 'off';
      input.placeholder = 'TYPE YOUR ANSWER';
      input.addEventListener('input', () => { quizSelection = input.value; });
      input.addEventListener('keydown', event => { if (event.key === 'Enter') submitAnswer(); });
      area.append(input);
      setTimeout(() => input.focus(), 0);
    }
  }

  function normaliseAnswer(value) {
    return String(value ?? '').trim().toLowerCase()
      .replace(/[₂₃₄₅₆₇₈₉₀]/g, digit => '₂₃₄₅₆₇₈₉₀'.indexOf(digit))
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, digit => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(digit))
      .replace(/[−–—]/g, '-').replace(/×10\^?/g, 'e').replace(/x10\^?/g, 'e').replace(/[\s*·^]/g, '');
  }

  function answerIsCorrect(question, value) {
    const accepted = question.type === 'mcq' ? [question.answer] : question.answers;
    return accepted.some(answer => normaliseAnswer(answer) === normaliseAnswer(value));
  }

  function wrongAnswerRecord(chapter, question, selected) {
    return {
      chapterId: chapter.id,
      questionId: question.id,
      topic: chapter.topic,
      prompt: question.prompt,
      selected: String(selected ?? ''),
      correct: question.type === 'mcq' ? question.answer : question.answers[0],
      explanation: question.explanation,
      recordedAt: new Date().toISOString()
    };
  }

  function markAssistantAttention() {
    const toggle = byId('ai-toggle');
    toggle.classList.add('has-alert');
    byId('quiz-ai').classList.add('has-alert');
    toggle.setAttribute('aria-label', 'Bond Bot has an explanation for your latest answer');
    toggle.title = 'Bond Bot can explain that answer';
  }

  function submitAnswer() {
    const chapter = activeQuizChapter();
    const question = activeQuestion();
    if (!chapter || !question || quizOutcome) return;
    if (!String(quizSelection ?? '').trim()) return showToast('Choose or enter an answer first.');
    const feedback = byId('quiz-feedback');
    if (answerIsCorrect(question, quizSelection)) {
      quizOutcome = 'correct';
      const mark = Math.max(60, 100 - activeQuizAttempts() * 20);
      let awarded = false;
      if (!practiceChapterId) {
        store.update(state => {
          if (!state.awardedQuestions.includes(question.id)) {
            state.awardedQuestions.push(question.id);
            state.score += 300;
            awarded = true;
          }
          const progress = state.chapterProgress[String(chapter.id)] || {};
          state.chapterProgress[String(chapter.id)] = {...progress, quizMarks: {...(progress.quizMarks || {}), [question.id]: mark}};
          return state;
        });
      }
      feedback.className = 'quiz-feedback correct';
      feedback.textContent = practiceChapterId
        ? `PRACTICE CORRECT · NO EXTRA LEADERBOARD POINTS · MARK ${mark}/100 — ${question.explanation}`
        : `CORRECT · ${awarded ? '+300 POINTS' : 'POINTS ALREADY SAVED'} · MARK ${mark}/100 — ${question.explanation}`;
      byId('quiz-submit').classList.add('hidden');
      byId('quiz-continue').classList.remove('hidden');
      byId('quiz-progress-bar').style.width = `${((activeQuizIndex() + 1) / chapter.questions.length) * 100}%`;
      return;
    }
    const attempts = activeQuizAttempts() + 1;
    const wrongAnswer = wrongAnswerRecord(chapter, question, quizSelection);
    if (practiceChapterId) {
      practiceQuiz.attempts = attempts;
      store.update(state => {
        state.assistant = {...state.assistant, lastWrongAnswer: wrongAnswer, unread: true};
        return state;
      });
    }
    else {
      store.update(state => {
        state.quiz.attempts = attempts;
        state.weakTopics[chapter.topic] = (state.weakTopics[chapter.topic] || 0) + 1;
        state.assistant = {...state.assistant, lastWrongAnswer: wrongAnswer, unread: true};
        return state;
      });
    }
    markAssistantAttention();
    feedback.className = 'quiz-feedback wrong';
    if (attempts >= 3) {
      quizOutcome = 'failed';
      feedback.textContent = `THREE ATTEMPTS USED — ${question.explanation} Mdm. Balqis will reset the chapter questions.`;
      byId('quiz-submit').classList.add('hidden');
      byId('quiz-continue').classList.remove('hidden');
    } else {
      feedback.textContent = `NOT YET · ${3 - attempts} ATTEMPT${3 - attempts === 1 ? '' : 'S'} LEFT — ${question.explanation}`;
      quizSelection = null;
      renderAttemptLights();
      for (const button of byId('quiz-answer-area').querySelectorAll('.answer-option')) button.classList.remove('selected');
      const input = byId('quiz-answer-area').querySelector('input');
      if (input) { input.value = ''; input.focus(); }
    }
  }

  function renderAttemptLights() {
    const lights = byId('attempt-lights');
    if (!lights.children.length) lights.replaceChildren(...[0, 1, 2].map(() => document.createElement('i')));
    [...lights.children].forEach((light, index) => light.classList.toggle('used', index < activeQuizAttempts()));
  }

  function resetQuizAfterFailure(chapter, thresholdFailure = false) {
    setOverlay(ui.quiz, false);
    if (practiceChapterId) {
      practiceChapterId = null;
      practiceQuiz = {questionIndex: 0, attempts: 0};
      showDialogue({
        speaker: content.lecturer.name,
        lines: ['Practice attempt reset. Your saved chapter progress and leaderboard score were not changed.', 'Talk to me again when you are ready to repeat the practice questions and mini-game.']
      });
      return;
    }
    store.update(state => {
      const old = state.chapterProgress[String(chapter.id)] || {};
      state.quiz = {chapterId: chapter.id, questionIndex: 0, attempts: 0};
      state.chapterProgress[String(chapter.id)] = chapter.id === 5
        ? {hasKey: Boolean(old.hasKey), miniGameComplete: Boolean(old.miniGameComplete), quizMarks: {}}
        : {quizMarks: {}};
      return state;
    });
    showDialogue({
      speaker: content.lecturer.name,
      lines: thresholdFailure
        ? ['Your Chapter 5 result is below 80/100. The key remains yours, but the assessment must be repeated.', 'Return to the office mission desk and answer the fixed questions again.']
        : [content.lecturer.encouragement, `Remain inside ${content.locations[chapter.locationId].name} and restart Chapter ${chapter.id} at the mission station.`]
    });
  }

  function chapterAverage(chapter) {
    const marks = currentProgress(chapter.id).quizMarks || {};
    const values = chapter.questions.map(question => Number(marks[question.id]) || 0);
    return Math.round(values.reduce((sum, mark) => sum + mark, 0) / chapter.questions.length);
  }

  function continueQuiz() {
    const chapter = activeQuizChapter();
    if (!chapter) return;
    if (quizOutcome === 'failed') return resetQuizAfterFailure(chapter);
    if (quizOutcome !== 'correct') return;
    const nextIndex = activeQuizIndex() + 1;
    if (practiceChapterId) {
      if (nextIndex < chapter.questions.length) {
        practiceQuiz = {questionIndex: nextIndex, attempts: 0};
        renderQuestion();
      } else {
        setOverlay(ui.quiz, false);
        launchMiniGame(chapter, chapter.activity, 'practice');
      }
      return;
    }
    const progress = currentProgress(chapter.id);

    if (chapter.id === 7 && nextIndex === chapter.questions.length - 1 && !progress.miniGameComplete) {
      store.update(state => { state.quiz.questionIndex = nextIndex; state.quiz.attempts = 0; return state; });
      setOverlay(ui.quiz, false);
      launchMiniGame(chapter, 'escape-runner', 'final-chase');
      return;
    }
    if (nextIndex < chapter.questions.length) {
      store.update(state => { state.quiz.questionIndex = nextIndex; state.quiz.attempts = 0; return state; });
      renderQuestion();
      return;
    }
    if (chapter.id === 7) {
      setOverlay(ui.quiz, false);
      finishFinalChapter(chapter);
      return;
    }
    if (chapter.id === 5) {
      const average = chapterAverage(chapter);
      if (average < 80) return resetQuizAfterFailure(chapter, true);
      store.update(state => {
        state.chapterProgress[String(chapter.id)] = {...currentProgress(chapter.id), assessmentAverage: average};
        return state;
      });
    }
    if (!currentProgress(chapter.id).miniGameComplete) {
      setOverlay(ui.quiz, false);
      launchMiniGame(chapter);
      return;
    }
    unlockExplore(chapter);
  }

  function launchMiniGame(chapter, type = chapter.activity, purpose = 'chapter') {
    miniGameChapterId = chapter.id;
    miniGamePurpose = purpose;
    if (purpose !== 'practice') {
      store.update(state => {
        state.chapterProgress[String(chapter.id)] = {...currentProgress(chapter.id), miniGameStarted: true};
        return state;
      });
    }
    miniGames.start(type, {course: store.state.profile.course});
    pauseScene();
  }

  function unlockExplore(chapter) {
    setOverlay(ui.quiz, false);
    store.update(state => {
      state.chapterProgress[String(chapter.id)] = {...currentProgress(chapter.id), quizComplete: true, letterUnlocked: true};
      state.quiz = {chapterId: null, questionIndex: 0, attempts: 0};
      return state;
    });
    showDialogue({
      speaker: content.lecturer.name,
      lines: [`Reaction ${chapter.id} stabilised. ${chapter.summary}`, 'A sealed destination letter has appeared inside the building.'],
      onDone: () => showLetter(chapter)
    });
  }

  function showLetter(chapter) {
    letterChapterId = chapter.id;
    const destination = content.locations[chapter.nextLocationId].name.toUpperCase();
    byId('letter-destination').textContent = destination;
    byId('letter-message').textContent = `Chapter ${chapter.id} is complete. Travel across the registered KMKJ campus to ${destination}. That destination is now unlocked; later buildings remain locked.`;
    setOverlay(ui.letter, true);
    pauseScene();
  }

  function closeLetter() {
    const chapter = content.chapters[(letterChapterId || store.state.currentChapter) - 1];
    if (chapter) {
      store.update(state => {
        state.chapterProgress[String(chapter.id)] = {...currentProgress(chapter.id), letterSeen: true};
        return state;
      });
    }
    setOverlay(ui.letter, false);
    letterChapterId = null;
    if (interiors.isOpen) interiors.exit();
    else resumeScene();
    showToast('Letter stored. Travel to the newly unlocked destination or use Fast Travel in Settings.');
  }

  function finishFinalChapter(chapter) {
    store.update(state => {
      if (!state.completedChapters.includes(chapter.id)) state.completedChapters.push(chapter.id);
      state.chapterProgress[String(chapter.id)] = {...currentProgress(chapter.id), quizComplete: true, completed: true};
      state.quiz = {chapterId: null, questionIndex: 0, attempts: 0};
      state.phase = 'ending';
      return state;
    });
    showDialogue({
      speaker: 'Security Guard', portrait: '!',
      lines: ['You crossed the finish line and answered the final reaction correctly.', 'The chase is over. Mdm. Balqis is waiting at Pondok Security with your final result.'],
      onDone: showEnding
    });
  }

  async function aiResponse(action) {
    const chapter = activeQuizChapter();
    const question = activeQuestion();
    const state = store.state;
    let message = '';
    if (action === 'explain') {
      if (!state.assistant?.lastWrongAnswer) {
        appendAssistantMessage(assistant.explainWrong(null), 'bot');
        return;
      }
      await requestAssistantAnswer('Explain my latest wrong answer clearly. Show the Chemistry idea or calculation that proves the accepted answer.', {
        displayQuestion: 'Explain my latest wrong answer.',
        fallbackAnswer: assistant.explainWrong(state.assistant.lastWrongAnswer)
      });
      return;
    }
    else if (action === 'hint') message = question ? `Think about ${chapter.topic}: ${question.explanation}` : 'Enter the active building and walk to its mission station for a chapter-specific hint.';
    else if (action === 'summary') message = chapter?.summary || 'Begin at Makmal Chemistry to unlock EC015 chapter summaries.';
    else if (action === 'progress') message = `You have completed ${state.completedChapters.length} of 7 chapters and earned ${state.score} points. Current mission: ${missionForState().title}.`;
    else {
      const weak = Object.entries(state.weakTopics).sort((a, b) => b[1] - a[1]);
      message = weak.length ? `Review priority: ${weak.slice(0, 3).map(([topic, count]) => `${topic} (${count} miss${count === 1 ? '' : 'es'})`).join(', ')}.` : 'No weak topic has been detected yet. Keep exploring.';
    }
    appendAssistantMessage(message, 'bot');
  }

  function appendAssistantMessage(message, role = 'bot') {
    const chat = byId('ai-chat');
    const bubble = document.createElement('div');
    bubble.className = `assistant-message ${role === 'user' ? 'user-message' : 'bot-message'}`;
    if (role !== 'user') {
      const avatar = document.createElement('span');
      avatar.className = 'mini-robot';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.innerHTML = '<i>&gt;_</i>';
      bubble.append(avatar);
    }
    const copy = document.createElement('p');
    copy.textContent = message;
    bubble.append(copy);
    chat.append(bubble);
    while (chat.children.length > 10) chat.firstElementChild.remove();
    chat.scrollTop = chat.scrollHeight;
    return bubble;
  }

  function assistantContext() {
    const state = store.state;
    const chapter = activeQuizChapter();
    const mission = missionForState();
    return {
      chapterTopic: chapter?.topic || '',
      chapterSummary: chapter?.summary || '',
      question: activeQuestion(),
      lastWrongAnswer: state.assistant?.lastWrongAnswer || null,
      completedChapters: state.completedChapters.length,
      score: state.score,
      missionTitle: mission.title,
      missionText: mission.text,
      course: state.profile.course || '',
      currentChapter: state.currentChapter
    };
  }

  function recentAssistantConversation() {
    return [...byId('ai-chat').querySelectorAll('.assistant-message')]
      .filter(bubble => !bubble.classList.contains('thinking-message'))
      .slice(-6)
      .map(bubble => ({
        role: bubble.classList.contains('user-message') ? 'user' : 'assistant',
        text: bubble.querySelector('p')?.textContent?.trim() || ''
      }))
      .filter(item => item.text);
  }

  async function requestAssistantAnswer(question, {displayQuestion = question, fallbackAnswer = ''} = {}) {
    if (aiBusy) {
      showToast('Bond Bot is still thinking about the previous question.');
      return;
    }
    aiBusy = true;
    const context = {...assistantContext(), conversation: recentAssistantConversation()};
    appendAssistantMessage(displayQuestion, 'user');
    const thinking = appendAssistantMessage('Thinking about your question…', 'bot');
    thinking.classList.add('thinking-message');
    const chat = byId('ai-chat');
    const submit = byId('ai-form').querySelector('button[type="submit"]');
    chat.setAttribute('aria-busy', 'true');
    submit.disabled = true;

    try {
      if (byId('app-root').dataset.aiConfigured !== 'true') {
        throw new Error('Real AI setup is required on this server.');
      }
      const response = await fetch('api/assistant.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({question, context})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.answer) {
        throw new Error(payload.error || 'The AI tutor is temporarily unavailable.');
      }
      thinking.remove();
      appendAssistantMessage(payload.answer, 'bot');
    } catch (error) {
      thinking.remove();
      const verifiedFallback = fallbackAnswer || assistant.answer(question, assistantContext());
      appendAssistantMessage(`${verifiedFallback}\n\nAI CONNECTION: ${error.message || 'temporarily unavailable'} I used the verified offline answer instead.`, 'bot');
    } finally {
      aiBusy = false;
      chat.setAttribute('aria-busy', 'false');
      submit.disabled = false;
    }
  }

  async function askAssistant(event) {
    event.preventDefault();
    const input = byId('ai-question');
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    await requestAssistantAnswer(question);
    input.focus();
  }

  function openAssistant(force = null) {
    const opening = force === null ? ui.assistant.classList.contains('hidden') : Boolean(force);
    setOverlay(ui.assistant, opening);
    byId('ai-toggle').setAttribute('aria-expanded', String(opening));
    if (!opening) return;
    byId('ai-toggle').classList.remove('has-alert');
    byId('quiz-ai').classList.remove('has-alert');
    byId('ai-toggle').setAttribute('aria-label', 'Open Bond Bot Chemistry companion');
    byId('ai-toggle').title = 'Open Bond Bot';
    if (store.state.assistant?.unread) {
      store.update(state => {
        state.assistant = {...state.assistant, unread: false};
        return state;
      });
      appendAssistantMessage('I saved your latest wrong answer. Choose EXPLAIN MY LAST ANSWER, or ask me what part is confusing.', 'bot');
    }
  }

  function openAuth(mode) {
    const register = mode === 'register';
    const password = byId('player-password');
    const confirmation = byId('confirm-password');
    byId('auth-mode').value = mode;
    byId('auth-title').textContent = register ? 'CREATE PLAYER' : 'WELCOME BACK';
    byId('auth-subtitle').textContent = register ? 'Register with your Matric Card / Student ID. Your engineering identity will be chosen inside Makmal Chemistry.' : 'Enter your Matric Card / Student ID to continue from where you stopped.';
    byId('register-fields').classList.toggle('hidden', !register);
    for (const input of byId('register-fields').querySelectorAll('input')) input.required = register;
    byId('confirm-password-field').classList.toggle('hidden', !register);
    confirmation.required = register;
    confirmation.value = '';
    confirmation.setCustomValidity('');
    password.autocomplete = register ? 'new-password' : 'current-password';
    byId('auth-submit').textContent = register ? 'REGISTER & ENTER' : 'LOGIN & CONTINUE';
    byId('auth-switch').textContent = register ? 'I ALREADY HAVE A PLAYER ACCOUNT' : 'CREATE A NEW PLAYER ACCOUNT';
    byId('auth-error').textContent = '';
    setOverlay(ui.splash, false);
    setOverlay(ui.auth, true);
    pauseScene();
  }

  function validatePasswordConfirmation() {
    const confirmation = byId('confirm-password');
    const registering = byId('auth-mode').value === 'register';
    const matches = !registering || confirmation.value === byId('player-password').value;
    confirmation.setCustomValidity(matches ? '' : 'Confirm Password must match Password.');
    return matches;
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!validatePasswordConfirmation()) {
      byId('auth-error').textContent = 'Confirm Password must match Password.';
      byId('confirm-password').focus();
      byId('confirm-password').reportValidity();
      return;
    }
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    data.action = byId('auth-mode').value;
    byId('auth-submit').disabled = true;
    byId('auth-error').textContent = '';
    try {
      const response = await fetch('api/auth.php', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to authenticate.');
      store.replace({...payload.state, authenticated: true, playerId: payload.player.id, profile: {...payload.state.profile, ...payload.player}});
      startPlaying();
      showToast(data.action === 'register' ? 'Player created. Spawned at Pondok Security.' : 'Progress restored.');
    } catch (error) {
      byId('auth-error').textContent = error.message;
    } finally {
      byId('auth-submit').disabled = false;
    }
  }

  async function logoutPlayer() {
    const button = byId('logout-player');
    const authenticated = store.state.authenticated;
    button.disabled = true;
    button.textContent = authenticated ? 'SAVING PROGRESS…' : 'EXITING…';
    pauseScene();

    try {
      if (authenticated) {
        const saved = await store.saveRemote();
        if (!saved) throw new Error('Progress could not be saved. Logout was cancelled.');
        const response = await fetch('api/auth.php', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({action: 'logout'})
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to logout.');
      }

      store.reset({preserveProfile: false});
      if (interiors.isOpen) interiors.exit();
      game.stop();
      for (const overlay of [ui.auth, ui.course, ui.quiz, ui.mini, ui.ending, ui.dialogue, ui.letter, ui.cafeteriaBoard, ui.settings, ui.assistant]) {
        setOverlay(overlay, false);
      }
      byId('settings-toggle').setAttribute('aria-expanded', 'false');
      byId('ai-toggle').setAttribute('aria-expanded', 'false');
      byId('ai-toggle').classList.add('hidden');
      byId('auth-form').reset();
      ui.saveLight.className = '';
      ui.saveStatus.textContent = 'LOCAL SAVE READY';
      setOverlay(ui.splash, true);
      showToast(authenticated ? 'Progress saved. You are now logged out.' : 'Demo closed.');
    } catch (error) {
      showToast(error.message || 'Unable to logout. Please try again.', 4500);
      resumeScene();
    } finally {
      button.disabled = false;
      button.textContent = 'LOGOUT';
    }
  }

  function startDemo() {
    store.reset({preserveProfile: false});
    store.update(state => {
      state.phase = 'tutorial';
      state.profile = {fullName: 'Offline Explorer', nickname: 'Ghost', className: 'DEMO', course: null};
      return state;
    }, {remote: false});
    game.teleport('guard-house-exit');
    startPlaying();
    showDialogue({speaker: content.lecturer.name, lines: ['You have spawned as a Ghost in front of Pondok Security.', 'Travel to Makmal Chemistry. Use WASD or arrows to walk, or use unlocked Fast Travel in Settings. Press E at the building entrance.']});
  }

  function courseDetails(courseId) {
    return content.courses.find(course => course.id === courseId) || {
      id: courseId || 'unknown', name: 'Unselected Course', shortName: 'N/A'
    };
  }

  function scoreboardRow({rank, courseId, name, detail, score}) {
    const row = document.createElement('article');
    row.className = 'scoreboard-row';
    row.dataset.course = courseId || 'unknown';

    const rankNode = document.createElement('span');
    rankNode.className = 'scoreboard-rank';
    rankNode.textContent = String(rank);

    const identity = document.createElement('div');
    identity.className = 'scoreboard-identity';
    const playerName = document.createElement('strong');
    playerName.textContent = name;
    const description = document.createElement('small');
    description.textContent = detail;
    identity.append(playerName, description);

    const points = document.createElement('b');
    points.className = 'scoreboard-points';
    points.textContent = Number(score || 0).toLocaleString('en-MY');
    const label = document.createElement('small');
    label.textContent = 'POINTS';
    points.append(label);
    row.append(rankNode, identity, points);
    return row;
  }

  function renderCafeteriaLeaderboard(payload, errorMessage = '') {
    const status = byId('cafeteria-board-status');
    status.className = `board-live-status${errorMessage ? ' error' : ''}`;
    status.innerHTML = '<i></i>';
    status.append(document.createTextNode(errorMessage || 'LIVE FROM THE KMKJ DATABASE'));

    const suppliedLeaders = new Map((payload.courseLeaders || []).map(row => [row.courseId, row]));
    if (!suppliedLeaders.size) {
      for (const player of payload.topPlayers || []) {
        if (player.courseId && !suppliedLeaders.has(player.courseId)) suppliedLeaders.set(player.courseId, player);
      }
    }
    const leaderRows = content.courses.map(course => {
      const leader = suppliedLeaders.get(course.id);
      return scoreboardRow({
        rank: '★', courseId: course.id,
        name: leader?.nickname || 'NO PLAYER YET',
        detail: `${course.name.toUpperCase()} · ${leader?.className || 'WAITING FOR A SCORE'}`,
        score: leader?.score || 0
      });
    });
    byId('course-leader-list').replaceChildren(...leaderRows);

    const rankingByCourse = new Map((payload.courseRanking || []).map(row => [row.courseId, row]));
    const rankingRows = content.courses
      .map(course => rankingByCourse.get(course.id) || {courseId: course.id, courseName: course.name, score: 0})
      .sort((left, right) => Number(right.score) - Number(left.score) || left.courseName.localeCompare(right.courseName))
      .map((row, index) => {
        const course = courseDetails(row.courseId);
        return scoreboardRow({
          rank: index + 1, courseId: row.courseId,
          name: row.courseName || course.name,
          detail: `${course.shortName} · PERMANENT CUMULATIVE SCORE`,
          score: row.score
        });
      });
    byId('course-ranking-list').replaceChildren(...rankingRows);

    const topRows = (payload.topPlayers || []).slice(0, 5).map((player, index) => {
      const course = courseDetails(player.courseId);
      return scoreboardRow({
        rank: index + 1, courseId: player.courseId,
        name: player.nickname || 'PLAYER',
        detail: `${course.shortName} · ${player.className || 'KMKJ'}`,
        score: player.score
      });
    });
    const overallList = byId('overall-player-list');
    if (topRows.length) overallList.replaceChildren(...topRows);
    else {
      const empty = document.createElement('p');
      empty.className = 'scoreboard-empty';
      empty.textContent = 'The board is waiting for the first KMKJ player score.';
      overallList.replaceChildren(empty);
    }
  }

  function closeCafeteriaLeaderboard() {
    setOverlay(ui.cafeteriaBoard, false);
    resumeScene();
  }

  async function loadLeaderboard(showBoard = false) {
    if (showBoard) {
      pauseScene();
      setOverlay(ui.cafeteriaBoard, true);
      const status = byId('cafeteria-board-status');
      status.className = 'board-live-status loading';
      status.innerHTML = '<i></i>SYNCING LIVE KMKJ SCORES…';
    }
    try {
      const response = await fetch('api/leaderboard.php', {headers: {'Accept': 'application/json'}});
      if (!response.ok) throw new Error('Leaderboard unavailable');
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || 'Leaderboard unavailable');
      if (showBoard) renderCafeteriaLeaderboard(payload);
      return payload;
    } catch (error) {
      const empty = {courseRanking: [], courseLeaders: [], topPlayers: []};
      if (showBoard) renderCafeteriaLeaderboard(empty, 'DATABASE OFFLINE · SCORES WILL APPEAR AFTER XAMPP SYNCS');
      return empty;
    }
  }

  async function showEnding() {
    pauseScene();
    const leaderboard = await loadLeaderboard(false);
    const state = store.state;
    byId('ending-title').textContent = 'Congrats! You are a chemistry master!';
    byId('ending-copy').textContent = `${state.profile.nickname}, you completed all seven EC015 reactions. Press FINISH to unlock the whole KMKJ campus for free exploration, practice questions and mini-game replays.`;
    byId('ending-score').textContent = String(state.score);
    const rankings = byId('ending-rankings');
    const courseRows = leaderboard.courseRanking?.slice(0, 4) || [];
    rankings.replaceChildren(...courseRows.map((row, index) => {
      const item = document.createElement('div');
      item.innerHTML = `<span>${index + 1}. ${row.courseName}</span><strong>${row.score}</strong>`;
      return item;
    }));
    setOverlay(ui.ending, true);
  }

  function finishGameAndExplore() {
    store.update(state => {
      state.phase = 'complete';
      state.completedChapters = content.chapters.map(chapter => chapter.id);
      state.interiorLocationId = null;
      state.quiz = {chapterId: null, questionIndex: 0, attempts: 0};
      return state;
    });
    setOverlay(ui.ending, false);
    if (interiors.isOpen) interiors.exit();
    game.teleport('guard-house-exit');
    renderTeleportOptions();
    game.resume();
    showToast('CHEMISTRY MASTER · THE WHOLE KMKJ CAMPUS IS NOW UNLOCKED', 5000);
  }

  function teleportToLocation(locationId) {
    if (!locationIsUnlocked(locationId)) return showToast('That location is locked.');
    if (interiors.isOpen) interiors.exit();
    const ok = game.teleport(locationId);
    setOverlay(ui.settings, false);
    byId('settings-toggle').setAttribute('aria-expanded', 'false');
    if (ok) {
      game.resume();
      const destination = locationId === 'cafeteria' ? 'Kafeteria KMKJ' : content.locations[locationId].name;
      showToast(`Teleported outside ${destination}. Press E to enter.`);
    }
  }

  function teleportToSelected() {
    teleportToLocation(byId('teleport-destination').value);
  }

  function bindUi() {
    byId('new-player').addEventListener('click', () => openAuth('register'));
    byId('login-player').addEventListener('click', () => openAuth('login'));
    byId('demo-player').addEventListener('click', startDemo);
    byId('local-continue').addEventListener('click', startPlaying);
    byId('auth-back').addEventListener('click', () => { setOverlay(ui.auth, false); setOverlay(ui.splash, true); });
    byId('auth-switch').addEventListener('click', () => openAuth(byId('auth-mode').value === 'register' ? 'login' : 'register'));
    byId('auth-form').addEventListener('submit', submitAuth);
    byId('player-password').addEventListener('input', validatePasswordConfirmation);
    byId('confirm-password').addEventListener('input', () => {
      validatePasswordConfirmation();
      byId('auth-error').textContent = '';
    });
    byId('dialogue-next').addEventListener('click', advanceDialogue);
    byId('quiz-submit').addEventListener('click', submitAnswer);
    byId('quiz-continue').addEventListener('click', continueQuiz);
    byId('letter-continue').addEventListener('click', closeLetter);
    byId('cafeteria-board-close').addEventListener('click', closeCafeteriaLeaderboard);
    byId('cafeteria-board-return').addEventListener('click', closeCafeteriaLeaderboard);
    byId('cafeteria-board-refresh').addEventListener('click', () => loadLeaderboard(true));
    byId('finish-game').addEventListener('click', finishGameAndExplore);

    byId('settings-toggle').addEventListener('click', () => {
      const opening = ui.settings.classList.contains('hidden');
      renderTeleportOptions();
      setOverlay(ui.settings, opening);
      byId('settings-toggle').setAttribute('aria-expanded', String(opening));
    });
    byId('settings-close').addEventListener('click', () => { setOverlay(ui.settings, false); byId('settings-toggle').setAttribute('aria-expanded', 'false'); });
    byId('movement-speed').addEventListener('input', event => {
      const value = Number(event.target.value);
      byId('movement-speed-value').value = String(value);
      store.update(state => { state.settings.movementSpeed = value; return state; });
    });
    byId('map-zoom').addEventListener('input', event => {
      const value = Number(event.target.value);
      byId('map-zoom-value').value = formatZoom(value);
      game.setZoom(value);
    });
    byId('sound-toggle').addEventListener('change', event => {
      const enabled = event.target.checked;
      store.update(state => { state.settings.music = enabled; return state; });
      audio?.setEnabled(enabled);
      showToast(enabled ? 'BACKGROUND MUSIC ON · TAP OR PRESS A KEY TO START' : 'BACKGROUND MUSIC OFF');
    });
    byId('teleport-cafeteria').addEventListener('click', () => teleportToLocation('cafeteria'));
    byId('teleport-objective').addEventListener('click', teleportToSelected);
    byId('return-gate').addEventListener('click', () => {
      if (interiors.isOpen) interiors.exit();
      game.teleport('main-gate');
      setOverlay(ui.settings, false);
      game.resume();
      showToast('Returned to KMKJ Main Gate.');
    });
    byId('open-map-key').addEventListener('click', event => {
      const showing = game.toggleAllLabels();
      event.currentTarget.textContent = showing ? 'HIDE EXTRA MAP LABELS' : 'SHOW ALL MAP LABELS';
      setOverlay(ui.settings, false);
      showToast(showing ? 'All building and structure labels are enabled.' : 'Extra map labels are hidden.');
    });
    byId('full-map-view').addEventListener('click', () => {
      game.setFullMapView();
      byId('map-zoom').value = String(store.state.settings.mapZoom);
      byId('map-zoom-value').value = formatZoom(store.state.settings.mapZoom);
      setOverlay(ui.settings, false);
      showToast('Full 10,240 × 7,960 KMKJ campus view enabled.');
    });
    byId('logout-player').addEventListener('click', logoutPlayer);

    byId('ai-toggle').addEventListener('click', () => openAssistant());
    byId('quiz-ai').addEventListener('click', () => openAssistant(true));
    byId('ai-close').addEventListener('click', () => openAssistant(false));
    byId('ai-form').addEventListener('submit', askAssistant);
    for (const button of document.querySelectorAll('[data-ai-action]')) button.addEventListener('click', () => aiResponse(button.dataset.aiAction));

    byId('replay-game').addEventListener('click', () => {
      const profile = {...store.state.profile, course: null};
      const authenticated = store.state.authenticated;
      const playerId = store.state.playerId;
      if (interiors.isOpen) interiors.exit();
      store.reset({preserveProfile: false});
      store.update(state => { state.profile = profile; state.authenticated = authenticated; state.playerId = playerId; state.phase = 'tutorial'; return state; });
      setOverlay(ui.ending, false);
      game.teleport('guard-house-exit');
      startPlaying();
    });

    miniGames.addEventListener('complete', event => {
      const chapter = content.chapters[(miniGameChapterId || 1) - 1];
      if (!chapter) return;
      const purpose = miniGamePurpose;
      const result = {...event.detail};
      if (purpose !== 'practice') {
        store.update(state => {
          const progress = currentProgress(chapter.id);
          state.chapterProgress[String(chapter.id)] = {
            ...progress,
            miniGameComplete: true,
            ...(purpose === 'entry-key' ? {hasKey: true} : {})
          };
          return state;
        });
      }
      setTimeout(() => {
        miniGames.close();
        if (purpose === 'practice') {
          practiceChapterId = null;
          practiceQuiz = {questionIndex: 0, attempts: 0};
          showDialogue({
            speaker: content.lecturer.name,
            lines: [
              `Practice Chapter ${chapter.id} complete.`,
              `Mini-game score: ${Number(result.miniGameScore) || 0}. Your saved journey and permanent leaderboards were not changed.`,
              'You may talk to me again inside this building whenever you want another full practice run.'
            ]
          });
        } else if (purpose === 'entry-key') {
          showDialogue({
            speaker: 'Office Boss', portrait: '◆',
            lines: ['You survived the snowballs. The Bilik Pensyarah key is yours.', 'The office assessment is now unlocked. Score at least 80/100 to receive the next letter.'],
            onDone: () => openQuiz(chapter)
          });
        } else if (result.type === 'escape-runner') {
          showDialogue({
            speaker: 'Security Guard', portrait: '!',
            lines: ['You reached the finish line, but the final reaction gate is still locked.', 'Answer the last Ionic Equilibria question now to escape.'],
            onDone: () => openQuiz(chapter)
          });
        } else {
          unlockExplore(chapter);
        }
      }, 700);
    });
    miniGames.addEventListener('fail', event => {
      const retryMessages = {
        'lab-calibration': 'Reaction Rally reset. Track the accelerating orb and time powered returns near your paddle.',
        'spectrum-lock': 'Spectrum Archery reset. Move the reticle onto each ring and fire with SPACE or ACTION.',
        'periodic-compass': 'Periodic Ascent reset. Choose the highlighted platform and leap inside the gold timing zone.',
        'treasure-hunt': 'Skate Quest reset. Jump the archive obstacles and recover all five molecular keys.',
        'boss-key-challenge': 'Key Rush reset. Change lanes and use CHARGE to break through the Boss team.',
        'course-workshop': 'Equilibrium Piano Tiles reset. Tap the large falling tiles with D F J K or tap the lanes directly; misses never remove a shield.',
        'escape-runner': 'Security caught up. Switch lanes immediately; jump barriers and press DOWN to slide under gates.'
      };
      const message = retryMessages[event.detail.type] || 'Challenge reset. Press RETRY CHALLENGE when ready.';
      showToast(message);
    });

    game.addEventListener('interact', event => handleExteriorInteraction(event.detail));
    game.addEventListener('assistant', () => openAssistant(true));
    game.addEventListener('notice', event => showToast(event.detail.message));
    game.addEventListener('proximity', event => {
      currentNearby = event.detail;
      ui.prompt.classList.toggle('hidden', !currentNearby);
      ui.locationBanner.textContent = currentNearby?.name.toUpperCase() || 'KMKJ CAMPUS';
    });
    interiors.addEventListener('mission', event => handleInteriorMission(event.detail.location));
    interiors.addEventListener('assistant', () => openAssistant(true));
    interiors.addEventListener('notice', event => showToast(event.detail.message));
    interiors.addEventListener('exit', () => {
      store.update(state => { state.interiorLocationId = null; return state; });
      resumeScene();
    });
    store.addEventListener('change', renderHud);
    store.addEventListener('sync', event => {
      ui.saveLight.className = event.detail.ok ? '' : 'error';
      ui.saveStatus.textContent = event.detail.ok ? 'SAVED TO DATABASE' : 'LOCAL SAVE · SYNC PENDING';
    });
  }

  async function boot() {
    bindUi();
    renderCourseCards();
    renderHud();
    game.stop();
    const session = await store.hydrateFromSession();
    if (session.authenticated) {
      ui.saveStatus.textContent = 'DATABASE SESSION READY';
      byId('local-continue').classList.remove('hidden');
    } else if (session.offline) {
      ui.saveLight.className = 'offline';
      ui.saveStatus.textContent = 'OFFLINE LOCAL SAVE';
    }
    renderHud();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=67', {updateViaCache: 'none'})
        .then(registration => registration.update())
        .catch(() => { ui.saveLight.className = 'offline'; });
    }
  }

  global.SeventhReactionApp = Object.freeze({
    startDemo,
    showDialogue,
    openQuiz,
    renderHud,
    debug: () => ({state: store.snapshot(), nearby: currentNearby?.id || null, interior: interiors.location?.id || null, modalOpen: modalOpen()})
  });

  boot();
})(globalThis);
