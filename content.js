(function initialiseContent(global) {
  'use strict';

  const courses = [
    {id: 'basic', name: 'Basic Engineering', shortName: 'BASIC', hero: 'Spider-Man', color: '#e53935', accent: '#2864b7', sprite: 'S'},
    {id: 'civil', name: 'Civil Engineering', shortName: 'CIVIL', hero: 'Captain America', color: '#225da8', accent: '#d73232', sprite: 'C'},
    {id: 'mechanical', name: 'Mechanical Engineering', shortName: 'MECH', hero: 'Thor', color: '#69727a', accent: '#e3b93f', sprite: 'T'},
    {id: 'electrical', name: 'Electrical & Electronic Engineering', shortName: 'E&E', hero: 'Iron Man', color: '#b63232', accent: '#f2c247', sprite: 'I'}
  ];

  const locations = {
    'main-gate': {
      id: 'main-gate', name: 'KMKJ Main Gate', shortName: 'MAIN GATE', x: 617, y: 969,
      buildingId: null, interactionRadius: 34
    },
    'chemistry-laboratory': {
      id: 'chemistry-laboratory', name: 'Makmal Chemistry', shortName: 'MAKMAL CHEMISTRY', x: 760, y: 662,
      buildingId: 'makmal', interactionRadius: 38
    },
    'dewan-teknokrat': {
      id: 'dewan-teknokrat', name: 'Dewan Teknokrat', shortName: 'DEWAN TEKNOKRAT', x: 515, y: 531,
      buildingId: 'dewan-teknokrat', interactionRadius: 38
    },
    'dk5': {
      id: 'dk5', name: 'Dewan Kuliah 5 (DK5)', shortName: 'DK5', x: 995, y: 271,
      buildingId: 'dewan-kuliah-5', interactionRadius: 38
    },
    'library': {
      id: 'library', name: 'Library', shortName: 'LIBRARY', x: 716, y: 575,
      buildingId: 'library-dk-autocad', interactionRadius: 38
    },
    'lecturer-office': {
      id: 'lecturer-office', name: 'Bilik Pensyarah', shortName: 'BILIK PENSYARAH', x: 672, y: 674,
      buildingId: 'administration', interactionRadius: 38
    },
    'engineering-workshop': {
      id: 'engineering-workshop', name: 'Bengkel Kejuruteraan', shortName: 'BENGKEL KEJURUTERAAN', x: 906, y: 450,
      buildingId: 'bengkel-awam', interactionRadius: 42
    },
    'cafeteria': {
      id: 'cafeteria', name: 'Cafeteria', shortName: 'CAFETERIA', x: 957, y: 654,
      buildingId: 'kafeteria', interactionRadius: 42
    },
    'guard-house-exit': {
      id: 'guard-house-exit', name: 'Pondok Security', shortName: 'PONDOK SECURITY', x: 610, y: 948,
      buildingId: 'security-lodge', interactionRadius: 36
    }
  };

  const chapters = [
    {
      id: 1,
      topic: 'Matter',
      title: 'The Measure of Everything',
      locationId: 'chemistry-laboratory',
      nextLocationId: 'dewan-teknokrat',
      activity: 'lab-calibration',
      objective: 'Use amount of substance, mole ratios, and particles to stabilise the first reaction.',
      intro: 'Every engineering reaction begins by measuring matter correctly. Calibrate the laboratory before the unstable sample spreads.',
      summary: 'Matter calculations connect mass, moles, particles, and balanced-equation ratios.',
      questions: [
        {
          id: 'matter-1', type: 'mcq',
          prompt: 'Which is the SI unit for amount of substance?',
          options: ['gram', 'mole', 'litre', 'kilogram'], answer: 'mole',
          explanation: 'The mole (mol) is the SI base unit for amount of substance.'
        },
        {
          id: 'matter-2', type: 'mcq',
          prompt: 'For 2H₂ + O₂ → 2H₂O, what is the mole ratio H₂ : O₂?',
          options: ['1 : 1', '1 : 2', '2 : 1', '2 : 2'], answer: '2 : 1',
          explanation: 'The balanced coefficients give two moles of H₂ for every one mole of O₂.'
        },
        {
          id: 'matter-3', type: 'fill',
          prompt: 'How many formula units are in 0.50 mol NaCl? Enter in scientific notation.',
          answers: ['3.011e23', '3.01e23', '3.011 x 10^23', '3.01 x 10^23'],
          explanation: '0.50 × 6.022 × 10²³ = 3.011 × 10²³ formula units.'
        }
      ]
    },
    {
      id: 2,
      topic: 'Atomic Structure',
      title: 'Signals in the Shells',
      locationId: 'dewan-teknokrat',
      nextLocationId: 'dk5',
      activity: 'spectrum-lock',
      objective: 'Decode electron shells and configurations to open the Teknokrat signal lock.',
      intro: 'The second reaction is hidden in an atomic signal. Read its shells, orbitals, and electron arrangement.',
      summary: 'Atomic structure is described by energy levels, orbitals, and electron configurations.',
      questions: [
        {id: 'atomic-1', type: 'mcq', prompt: 'What is the maximum number of electrons in the n = 2 shell?', options: ['2', '4', '8', '18'], answer: '8', explanation: 'A shell holds a maximum of 2n² electrons; for n = 2, this is 8.'},
        {id: 'atomic-2', type: 'mcq', prompt: 'Which description matches an s orbital?', options: ['spherical', 'dumbbell-shaped', 'four-lobed', 'linear'], answer: 'spherical', explanation: 'An s orbital has spherical electron-density symmetry.'},
        {id: 'atomic-3', type: 'fill', prompt: 'Enter the ground-state electron configuration of oxygen.', answers: ['1s2 2s2 2p4', '1s² 2s² 2p⁴'], explanation: 'Oxygen has eight electrons: 1s² 2s² 2p⁴.'}
      ]
    },
    {
      id: 3,
      topic: 'Periodic Table',
      title: 'The Periodic Compass',
      locationId: 'dk5',
      nextLocationId: 'library',
      activity: 'periodic-compass',
      objective: 'Use periodic trends to point the compass toward the hidden archive.',
      intro: 'Elements repeat their behaviour in patterns. Follow the periodic trends to find the third reaction.',
      summary: 'Periodic trends arise from effective nuclear charge, shielding, and electron-shell structure.',
      questions: [
        {id: 'periodic-1', type: 'mcq', prompt: 'Across a period from left to right, atomic radius generally…', options: ['increases', 'decreases', 'stays constant', 'changes randomly'], answer: 'decreases', explanation: 'Increasing effective nuclear charge pulls electrons closer within the same principal shell.'},
        {id: 'periodic-2', type: 'mcq', prompt: 'Which group contains the halogens?', options: ['Group 1', 'Group 2', 'Group 17', 'Group 18'], answer: 'Group 17', explanation: 'F, Cl, Br, I, and At are Group 17 halogens.'},
        {id: 'periodic-3', type: 'mcq', prompt: 'Which has the highest first ionisation energy?', options: ['Na', 'Mg', 'Al', 'K'], answer: 'Mg', explanation: 'Mg has a filled 3s subshell; removing Al’s first 3p electron requires less energy.'}
      ]
    },
    {
      id: 4,
      topic: 'Chemical Bonding',
      title: 'The Bonded Archive',
      locationId: 'library',
      nextLocationId: 'lecturer-office',
      activity: 'treasure-hunt',
      objective: 'Complete the 1–2 minute treasure hunt by matching structures, shapes, and bonds.',
      intro: 'The archive scattered its molecular keys. Recover them by recognising how atoms bond and shape molecules.',
      summary: 'Lewis structures, molecular geometry, polarity, hybridisation, and intermolecular forces explain bonding behaviour.',
      questions: [
        {id: 'bonding-1', type: 'mcq', prompt: 'What is the molecular shape of CO₂?', options: ['bent', 'linear', 'trigonal planar', 'tetrahedral'], answer: 'linear', explanation: 'Two electron domains around carbon give a linear shape with a 180° bond angle.'},
        {id: 'bonding-2', type: 'mcq', prompt: 'Which statement about NH₃ is correct?', options: ['It is non-polar', 'It is polar', 'It is linear', 'It has no lone pair'], answer: 'It is polar', explanation: 'NH₃ is trigonal pyramidal; its bond dipoles do not cancel.'},
        {id: 'bonding-3', type: 'fill', prompt: 'How many sigma (σ) bonds are present in ethene, C₂H₄?', answers: ['5', 'five'], explanation: 'Ethene has four C–H sigma bonds and one C–C sigma bond.'}
      ]
    },
    {
      id: 5,
      topic: 'State of Matter',
      title: 'The Lecturer Office Key',
      locationId: 'lecturer-office',
      nextLocationId: 'engineering-workshop',
      activity: 'boss-key-challenge',
      objective: 'Defeat the snowball Boss, recover the office key, then score at least 80/100 in the State of Matter mission.',
      intro: 'The Lecturer Office is locked. Survive the Boss challenge, recover its key, and prove your mastery with a mark of at least 80/100.',
      summary: 'States of matter reflect particle energy, intermolecular forces, and gas-law relationships.',
      questions: [
        {id: 'state-1', type: 'mcq', prompt: 'Which equation is the ideal gas equation?', options: ['PV = nRT', 'P = mV', 'E = mc²', 'q = mcΔT'], answer: 'PV = nRT', explanation: 'The ideal gas law relates pressure, volume, amount, and absolute temperature.'},
        {id: 'state-2', type: 'mcq', prompt: 'Stronger intermolecular forces generally produce a…', options: ['lower boiling point', 'higher boiling point', 'smaller molar mass', 'lower density in every case'], answer: 'higher boiling point', explanation: 'More energy is needed to overcome stronger attractions between particles.'},
        {id: 'state-3', type: 'mcq', prompt: 'At constant temperature, halving a gas volume causes its pressure to…', options: ['halve', 'double', 'remain constant', 'become zero'], answer: 'double', explanation: 'Boyle’s law gives P₁V₁ = P₂V₂ when temperature and amount are constant.'}
      ]
    },
    {
      id: 6,
      topic: 'Chemical Equilibrium',
      title: 'Workshop in Balance',
      locationId: 'engineering-workshop',
      nextLocationId: 'guard-house-exit',
      activity: 'course-workshop',
      objective: 'Enter the workshop assigned to your selected KMKJ engineering course and restore dynamic equilibrium.',
      intro: 'The sixth reaction oscillates between products and reactants. Your chosen engineering identity determines the workshop apparatus used to balance it.',
      summary: 'At dynamic equilibrium, forward and reverse rates are equal; disturbances shift the equilibrium position.',
      questions: [
        {id: 'equilibrium-1', type: 'mcq', prompt: 'At constant temperature, adding a catalyst changes Kc by…', options: ['increasing it', 'decreasing it', 'not changing it', 'making it zero'], answer: 'not changing it', explanation: 'A catalyst speeds both directions equally and does not change the equilibrium constant.'},
        {id: 'equilibrium-2', type: 'mcq', prompt: 'Increasing pressure shifts a gaseous equilibrium toward the side with…', options: ['more gas moles', 'fewer gas moles', 'more solids', 'the catalyst'], answer: 'fewer gas moles', explanation: 'The system opposes increased pressure by favouring the side with fewer moles of gas.'},
        {id: 'equilibrium-3', type: 'mcq', prompt: 'At dynamic equilibrium, the forward and reverse reactions have…', options: ['equal rates', 'equal concentrations in every system', 'both stopped', 'zero activation energy'], answer: 'equal rates', explanation: 'Both reactions continue, but their rates are equal, so macroscopic concentrations stay constant.'}
      ]
    },
    {
      id: 7,
      topic: 'Ionic Equilibria',
      title: 'The Seventh Reaction',
      locationId: 'guard-house-exit',
      nextLocationId: 'guard-house-exit',
      activity: 'escape-runner',
      objective: 'Complete the Escape Runner and answer the final ionic-equilibria question at the finish line.',
      intro: 'The final reaction has begun. Control acids, bases, and ionic equilibria while the Security Guard closes in.',
      summary: 'Ionic equilibria connect acid–base strength, conjugate pairs, pH, and equilibrium constants.',
      questions: [
        {id: 'ionic-1', type: 'mcq', prompt: 'What is [H⁺] when pH = 3.00?', options: ['1.0 × 10⁻³ M', '3.0 M', '1.0 × 10³ M', '3.0 × 10⁻¹⁴ M'], answer: '1.0 × 10⁻³ M', explanation: '[H⁺] = 10⁻ᵖᴴ = 10⁻³ M.'},
        {id: 'ionic-2', type: 'fill', prompt: 'Enter the conjugate base of H₂CO₃.', answers: ['HCO3-', 'HCO₃⁻', 'HCO3−'], explanation: 'Removing one proton from H₂CO₃ produces HCO₃⁻.'},
        {id: 'ionic-3', type: 'mcq', prompt: 'At 25 °C, the equivalence-point pH for a strong acid–strong base titration is…', options: ['1', '5', '7', '14'], answer: '7', explanation: 'At equivalence, the resulting strong-acid/strong-base salt is neutral at 25 °C.'}
      ]
    }
  ];

  const siteLabels = [
    {name: 'Rugby / Football Field', x: 346, y: 655},
    {name: 'Futsal Court', x: 334, y: 475},
    {name: 'Tennis Courts (2)', x: 360, y: 409},
    {name: 'Basketball Court', x: 430, y: 865},
    {name: 'Takraw Courts (2)', x: 500, y: 922},
    {name: 'Volleyball Court', x: 944, y: 690},
    {name: 'Petanque Court', x: 920, y: 491},
    {name: 'Water Fountain', x: 816, y: 577},
    {name: 'Water Tank Tower', x: 1161, y: 793},
    {name: 'Security Lodge', x: 612, y: 899}
  ];

  global.SEVENTH_REACTION_CONTENT = Object.freeze({
    courses: Object.freeze(courses),
    locations: Object.freeze(locations),
    chapters: Object.freeze(chapters),
    siteLabels: Object.freeze(siteLabels),
    lecturer: Object.freeze({
      name: 'Mdm. Balqis',
      welcome: [
        'You arrived as a Ghost—not because you have no identity, but because you have not chosen what kind of engineer you will become.',
        'Seven reactions are destabilising KMKJ. Learn the chemistry behind each one, explore the campus, and restore them in sequence.',
        'First, meet the four Engineering Heroes. Then choose the programme whose colours you will carry.'
      ],
      encouragement: 'A failed reaction is evidence, not defeat. Review the hint, reset the apparatus, and try the chapter again.'
    })
  });
})(globalThis);
