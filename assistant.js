(function initialiseReactionCompanion(global) {
  'use strict';

  const clean = value => String(value ?? '').trim();
  const normalise = value => clean(value).toLowerCase().replace(/[^a-z0-9+\- ]/g, ' ').replace(/\s+/g, ' ');
  const mentions = (text, terms) => terms.some(term => text.includes(term));

  const topicNotes = [
    {
      terms: ['matter', 'solid', 'liquid', 'gas', 'phase change', 'melting', 'boiling'],
      answer: 'Matter has mass and occupies space. Solids have fixed shape and volume, liquids keep a fixed volume but flow, and gases have neither fixed shape nor fixed volume. During a phase change, temperature stays constant while energy changes intermolecular attractions.'
    },
    {
      terms: ['principal quantum number', 'electron shell', 'shell capacity', 'orbital capacity', '2n2', 'n 2', '8 electron', 'eight electron'],
      answer: 'The maximum number of electrons in shell n is 2n². For n = 2, the shell contains the 2s subshell (1 orbital) and the 2p subshell (3 orbitals), giving 4 orbitals altogether. Each orbital holds at most 2 electrons with opposite spins, so the n = 2 shell holds 4 × 2 = 8 electrons.'
    },
    {
      terms: ['atom', 'atomic structure', 'proton', 'neutron', 'electron', 'isotope'],
      answer: 'An atom contains protons and neutrons in its nucleus with electrons around it. Atomic number equals the number of protons. Isotopes have the same proton number but different neutron numbers, so they are the same element with different mass numbers.'
    },
    {
      terms: ['periodic', 'atomic radius', 'ionisation', 'ionization', 'electronegativity', 'periodic trend'],
      answer: 'Across a period, effective nuclear charge increases: atomic radius generally decreases while ionisation energy and electronegativity generally increase. Down a group, extra electron shells increase radius and shielding, so ionisation energy generally decreases.'
    },
    {
      terms: ['bond', 'ionic', 'covalent', 'metallic', 'lewis'],
      answer: 'Ionic bonding is electrostatic attraction between oppositely charged ions. Covalent bonding shares electron pairs between atoms. Metallic bonding is attraction between positive metal ions and delocalised electrons. A Lewis structure should satisfy valence-electron counting before shape and polarity are judged.'
    },
    {
      terms: ['intermolecular', 'hydrogen bond', 'dipole', 'london force', 'state of matter'],
      answer: 'Intermolecular forces act between particles. London dispersion forces occur in all particles, permanent dipole attractions occur between polar molecules, and hydrogen bonding requires H bonded directly to N, O, or F. Stronger attractions usually give higher boiling points.'
    },
    {
      terms: ['equilibrium', 'le chatelier', 'kc', 'catalyst', 'forward rate', 'reverse rate'],
      answer: 'Dynamic equilibrium occurs in a closed system when forward and reverse reaction rates are equal; concentrations are constant, not necessarily equal. Le Chatelier’s principle predicts a shift that opposes a disturbance. A catalyst speeds both directions equally and does not change Kc or the equilibrium position.'
    },
    {
      terms: ['acid', 'base', 'ph', 'poh', 'ka', 'kb', 'buffer', 'ionic equilibria'],
      answer: 'For aqueous solutions at 25 °C, pH = −log[H⁺], pOH = −log[OH⁻], and pH + pOH = 14. Ka and Kb measure acid and base strength. A buffer contains a weak acid/base and its conjugate partner, so it resists small pH changes.'
    },
    {
      terms: ['mole', 'stoichiometry', 'molar mass', 'limiting reagent', 'concentration'],
      answer: 'Start a stoichiometry calculation by balancing the equation. Convert the known amount to moles, apply the mole ratio, then convert to the requested unit. Useful relations are n = m/M and concentration c = n/V, with volume in dm³.'
    },
    {
      terms: ['oxidation', 'reduction', 'redox', 'oxidation number'],
      answer: 'Oxidation is loss of electrons or an increase in oxidation number; reduction is gain of electrons or a decrease in oxidation number. Balance atoms and charge, then verify that electrons lost equal electrons gained.'
    }
  ];

  function explainWrong(wrong) {
    if (!wrong) {
      return 'I have not recorded a wrong answer yet. Try a chapter question, then choose EXPLAIN MY LAST ANSWER if you need help.';
    }
    const selected = clean(wrong.selected) || 'no answer';
    const correct = clean(wrong.correct) || 'the accepted answer';
    return `For “${clean(wrong.prompt)}” you answered “${selected}”. The accepted answer is “${correct}”. ${clean(wrong.explanation)} This is a learning explanation only—your fixed question and score have not been changed.`;
  }

  function answer(question, context = {}) {
    const raw = clean(question);
    const text = normalise(raw);
    if (!text) return 'Type a Chemistry or game question and I will help.';

    const asksOxygenConfiguration = text.includes('oxygen')
      && mentions(text, ['electron', 'configuration', '1s2', '2p4']);
    if (asksOxygenConfiguration) {
      return 'A neutral oxygen atom has atomic number 8, so it has 8 electrons. Fill orbitals from lower to higher energy: 1s takes 2 electrons and 2s takes 2, leaving 4 electrons for 2p. Therefore the configuration is 1s² 2s² 2p⁴. The three 2p orbitals fill singly before pairing according to Hund’s rule, so the fourth 2p electron pairs in one orbital. The superscripts confirm the total: 2 + 2 + 4 = 8 electrons.';
    }

    const asksSodiumIon = (text.includes('sodium') || text.includes('na+'))
      && mentions(text, ['ion', 'na+', 'positive', 'charge', 'become']);
    if (asksSodiumIon) {
      return 'A neutral sodium atom has 11 protons and 11 electrons, with electron configuration 1s² 2s² 2p⁶ 3s¹. It loses its single, higher-energy 3s electron when forming an ion. The resulting Na⁺ ion has 11 protons but only 10 electrons, so its net charge is +1. Its remaining configuration, 1s² 2s² 2p⁶, is the stable filled-shell configuration of neon.';
    }

    if (mentions(text, ['wrong answer', 'last answer', 'my mistake', 'why wrong', 'explain answer'])) {
      return explainWrong(context.lastWrongAnswer);
    }
    if (mentions(text, ['where do i go', 'next destination', 'current mission', 'where is my mission', 'what next'])) {
      return `Your current mission is ${clean(context.missionTitle) || 'the active KMKJ mission'}. ${clean(context.missionText) || 'Follow the glowing destination marker on the campus map.'}`;
    }
    if (mentions(text, ['my progress', 'my score', 'chapters completed', 'how many chapter'])) {
      return `You have completed ${Number(context.completedChapters) || 0} of 7 chapters and earned ${Number(context.score) || 0} points.`;
    }
    if (mentions(text, ['hint', 'help current', 'current question'])) {
      if (context.question?.explanation) return `Hint for ${clean(context.chapterTopic)}: ${clean(context.question.explanation)}`;
      return `Current chapter: ${clean(context.chapterTopic) || 'Prologue'}. Enter the active building and talk to Mdm. Balqis for the next fixed challenge.`;
    }
    if (mentions(text, ['hello', 'hi bot', 'who are you', 'your name'])) {
      return 'I am Bond Bot, your blue KMKJ AI companion. When the real AI connection is online, you can ask me general questions as well as EC015 Chemistry, calculations, writing, coding, and game-navigation questions.';
    }

    const note = topicNotes.find(item => mentions(text, item.terms));
    if (note) return note.answer;

    return 'That question needs the real AI connection for a reliable answer. Bond Bot’s offline mode only covers verified EC015 Chemistry and game information; it will not invent an answer.';
  }

  global.SeventhReactionAssistant = Object.freeze({answer, explainWrong});
})(globalThis);
