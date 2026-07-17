const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// The page-4 satellite image in Surau (1).pdf is the master coordinate system.
// Nothing in this building layer is stretched, mirrored, or globally rotated.
const MASTER_W = 1280;
const MASTER_H = 995;

// Page 2 and page 1 are higher-detail close views. These measured similarity
// transforms register their source pixels onto the unchanged page-4 master.
const FRAMES = {
  academic: {
    a: 0.3832853025936599,
    b: -0.6340057636887608,
    tx: 254.6628242074928,
    ty: 696.5360230547551
  },
  residential: {
    a: 0.3355776045359121,
    b: -0.4814847625795882,
    tx: 661.5819158988927,
    ty: 758.8853945192443
  },
  master: {a: 1, b: 0, tx: 0, ty: 0}
};

const COLORS = {
  grass: '#2f7849',
  grassLight: '#3f8954',
  grassDark: '#276a40',
  field: '#748d4c',
  fieldStripe: '#819a56',
  fieldLine: '#eee7b8',
  road: '#465053',
  roadEdge: '#d8ddc8',
  roadShade: '#343d40',
  parking: '#697170',
  parkingLine: '#ded3a7',
  path: '#3999dc',
  pathEdge: '#b8e1ef',
  courtBlue: '#327fae',
  courtBlueLight: '#4793bd',
  courtGreen: '#4b956e',
  courtGreenLight: '#62a77e',
  courtConcrete: '#aaa68f',
  courtConcreteLight: '#bab59e',
  courtLine: '#f2efd1',
  petanque: '#b99a65',
  fountain: '#80c9d4',
  waterDark: '#307b98',
  wall: '#f3dfb7',
  wallShade: '#bd9976',
  window: '#2d7479',
  windowLight: '#67b4b3',
  buildingShadow: '#102f32',
  paleRoof: '#df8951',
  paleLight: '#f0a36a',
  paleDark: '#a7523f',
  brownRoof: '#a84f3e',
  brownLight: '#c9684c',
  brownDark: '#6d3030',
  whiteRoof: '#efe1bd',
  outline: '#392528',
  ridge: '#71332f',
  metalBlue: '#7897a6',
  metalBlueLight: '#a9c9ce',
  metalBlueDark: '#4e6070',
  metalRed: '#a85e51',
  metalRedLight: '#cf8870',
  metalRedDark: '#6f3f3f',
  metalGreen: '#668f78',
  metalGreenLight: '#91b29b',
  metalGreenDark: '#415e53',
  metalGray: '#918b7f',
  metalGrayLight: '#b9b3a5',
  metalGrayDark: '#615e58'
};

const P = (x, y) => [x, y];
const polygon = points => ({kind: 'polygon', points});
const rect = (x, y, w, h, ridge = 'auto') => ({
  kind: 'rect', x, y, w, h, ridge
});
const paint = (palette, part) => ({...part, palette});

// Every part below is traced in the original close-view source coordinates.
// Touching parts intentionally remain touching; no decorative gaps are added.
const BUILDING_SOURCES = [
  {
    id: 'dewan-teknokrat',
    name: 'Dewan Teknokrat',
    frame: 'academic',
    palette: 'pale',
    parts: [
      rect(392, 66, 156, 88),
      rect(365, 101, 31, 30),
      rect(391, 145, 120, 16),
      rect(516, 50, 39, 31)
    ]
  },
  {
    id: 'gym',
    name: 'GYM',
    frame: 'academic',
    palette: 'pale',
    parts: [
      polygon([
        P(548, 142), P(600, 142), P(600, 181),
        P(518, 181), P(518, 154), P(548, 154)
      ]),
      rect(548, 121, 52, 47)
    ]
  },
  {
    id: 'stor-sukan',
    name: 'Stor Sukan',
    frame: 'academic',
    palette: 'pale',
    parts: [
      rect(600, 65, 56, 116),
      polygon([
        P(583, 91), P(608, 91), P(608, 168),
        P(600, 168), P(600, 121), P(583, 121)
      ])
    ]
  },
  {
    id: 'tutorial-e',
    name: 'Tutorial E / Dewan Peperiksaan',
    frame: 'academic',
    palette: 'brown',
    parts: [
      rect(450, 194, 260, 43),
      rect(450, 227, 25, 30, 'vertical'),
      rect(575, 228, 24, 42, 'vertical'),
      rect(686, 228, 24, 42, 'vertical')
    ]
  },
  {
    id: 'tutorial-d',
    name: 'Bilik Pensyarah 2 / Tutorial D / Dewan Peperiksaan',
    frame: 'academic',
    palette: 'brown',
    parts: [
      rect(450, 270, 260, 44),
      rect(443, 257, 32, 33, 'vertical')
    ]
  },
  {
    id: 'upp',
    name: 'UPP / Bilik Alatan',
    frame: 'academic',
    palette: 'brown',
    parts: [
      rect(710, 270, 126, 44),
      rect(710, 256, 29, 30, 'vertical')
    ]
  },
  {
    id: 'administration',
    name: 'Bilik Pensyarah 1 / Bangunan Pentadbiran',
    frame: 'academic',
    palette: 'brown',
    parts: [
      rect(365, 348, 45, 139, 'vertical'),
      rect(365, 348, 84, 43),
      rect(365, 449, 84, 38),
      rect(405, 379, 44, 78, 'vertical')
    ]
  },
  {
    id: 'library-dk-autocad',
    name: 'Library / DK1 / Makmal Bahasa / DK2-3 / AutoCAD',
    frame: 'academic',
    palette: 'brown',
    parts: [
      rect(510, 345, 164, 43),
      rect(510, 440, 164, 43),
      rect(510, 375, 43, 93, 'vertical'),
      rect(631, 375, 43, 93, 'vertical'),
      rect(548, 382, 89, 70),
      rect(573, 362, 39, 109, 'vertical')
    ]
  },
  {
    id: 'butik-barakah',
    name: 'Butik Barakah',
    frame: 'academic',
    palette: 'brown',
    parts: [
      polygon([
        P(674, 371), P(700, 371), P(700, 433),
        P(704, 433), P(704, 482), P(674, 482)
      ]),
      rect(688, 385, 12, 38),
      rect(681, 445, 50, 38)
    ]
  },
  {
    id: 'bengkel-awam',
    name: 'Bengkel Kejuruteraan Awam',
    frame: 'academic',
    palette: 'brown',
    parts: [
      rect(700, 350, 205, 48),
      polygon([
        P(700, 383), P(744, 383), P(744, 410),
        P(731, 410), P(731, 433), P(700, 433)
      ]),
      rect(867, 382, 38, 42, 'vertical')
    ]
  },
  {
    id: 'bengkel-ee-mech',
    name: 'Bengkel Kejuruteraan EE / Mechanical',
    frame: 'academic',
    palette: 'brown',
    parts: [
      rect(731, 440, 271, 50),
      rect(731, 410, 45, 63, 'vertical'),
      rect(966, 418, 36, 65, 'vertical')
    ]
  },
  {
    id: 'dewan-kuliah-5',
    name: 'Dewan Kuliah 5',
    frame: 'academic',
    palette: 'brown',
    parts: [
      rect(1002, 440, 93, 50),
      rect(1046, 383, 50, 107, 'vertical'),
      rect(1026, 408, 45, 45),
      rect(906, 417, 59, 23)
    ]
  },
  {
    id: 'bilik-bata',
    name: 'Bilik Bata',
    frame: 'academic',
    palette: 'pale',
    parts: [
      rect(1048, 490, 49, 72, 'vertical')
    ]
  },
  {
    id: 'makmal',
    name: 'Makmal Fizik / Makmal Kimia / Bilik LK',
    frame: 'academic',
    palette: 'pale',
    parts: [
      rect(425, 520, 426, 50),
      rect(426, 487, 34, 63, 'vertical'),
      rect(570, 484, 34, 66, 'vertical'),
      rect(696, 484, 34, 66, 'vertical'),
      rect(817, 490, 34, 60, 'vertical')
    ]
  },
  {
    id: 'kafeteria',
    name: 'Kafeteria',
    frame: 'residential',
    palette: 'pale',
    parts: [
      rect(500, 135, 230, 109),
      rect(500, 226, 55, 50, 'vertical'),
      rect(650, 226, 55, 50, 'vertical')
    ]
  },
  {
    id: 'bilik-rawatan',
    name: 'Bilik Rawatan',
    frame: 'residential',
    palette: 'pale',
    parts: [
      rect(500, 276, 55, 83, 'vertical'),
      rect(650, 276, 55, 83, 'vertical'),
      rect(500, 300, 205, 59),
      rect(545, 284, 45, 32)
    ]
  },
  {
    id: 'asrama-perempuan',
    name: 'Asrama Perempuan',
    frame: 'residential',
    palette: 'brown',
    parts: [
      rect(846, 145, 316, 50),
      rect(1120, 145, 55, 190, 'vertical'),
      rect(845, 280, 317, 55),
      rect(841, 156, 56, 143, 'vertical'),
      rect(808, 209, 54, 34),
      rect(798, 239, 66, 33),
      rect(873, 197, 43, 45),
      rect(873, 252, 45, 46)
    ]
  },
  {
    id: 'asrama-lelaki',
    name: 'Asrama Lelaki',
    frame: 'residential',
    palette: 'brown',
    parts: [
      rect(445, 395, 280, 51),
      rect(437, 395, 58, 193, 'vertical'),
      rect(440, 535, 287, 55),
      rect(683, 399, 54, 184, 'vertical'),
      rect(720, 419, 65, 48),
      rect(716, 500, 70, 50),
      rect(760, 443, 45, 95, 'vertical')
    ]
  },
  {
    id: 'surau',
    name: 'Surau Al-Azhar',
    frame: 'residential',
    palette: 'brown',
    parts: [
      polygon([P(221, 224), P(242, 174), P(258, 164), P(273, 224), P(255, 244)]),
      polygon([P(256, 224), P(294, 183), P(318, 188), P(300, 242), P(272, 249)]),
      polygon([P(284, 235), P(337, 208), P(356, 221), P(318, 270), P(282, 267)]),
      polygon([P(282, 258), P(346, 274), P(345, 302), P(284, 292), P(264, 270)]),
      polygon([P(260, 274), P(319, 314), P(311, 343), P(249, 304), P(242, 278)]),
      polygon([P(244, 276), P(257, 335), P(240, 353), P(211, 295), P(218, 272)]),
      polygon([P(221, 265), P(185, 329), P(162, 321), P(182, 263), P(208, 246)]),
      polygon([P(207, 248), P(154, 282), P(142, 260), P(188, 221), P(217, 225)]),
      polygon([P(202, 229), P(151, 220), P(150, 196), P(211, 197), P(231, 218)]),
      polygon([P(213, 219), P(184, 177), P(203, 164), P(240, 207), P(237, 230)]),
      polygon([
        P(221, 226), P(241, 214), P(267, 218), P(284, 239),
        P(282, 265), P(262, 283), P(234, 281), P(214, 263), P(211, 242)
      ])
    ]
  },
  {
    id: 'water-tank',
    name: 'Water Tank Tower',
    frame: 'residential',
    palette: 'white',
    parts: [
      rect(392, 683, 96, 96)
    ]
  },
  {
    id: 'garden-service-building',
    name: 'Garden Service Building',
    frame: 'master',
    palette: 'pale',
    parts: [
      rect(720, 741, 56, 61),
      rect(744, 730, 26, 75, 'vertical')
    ]
  },
  {
    id: 'security-lodge',
    name: 'Security Lodge',
    frame: 'master',
    palette: 'pale',
    parts: [
      rect(590, 873, 36, 20),
      rect(608, 889, 25, 34, 'vertical')
    ]
  },
  {
    id: 'staff-housing',
    name: 'KMKJ Staff Housing',
    frame: 'master',
    palette: 'brown',
    parts: [
      polygon([
        P(664, 838), P(709, 838), P(709, 858), P(718, 858),
        P(718, 884), P(710, 884), P(710, 890), P(672, 890),
        P(672, 883), P(664, 883)
      ]),
      polygon([
        P(713, 859), P(754, 859), P(754, 872), P(769, 872),
        P(769, 925), P(758, 925), P(758, 934), P(715, 934),
        P(715, 925), P(705, 925), P(705, 890), P(713, 890)
      ]),
      polygon([
        P(781, 831), P(826, 831), P(826, 846), P(834, 846),
        P(834, 888), P(827, 888), P(827, 907), P(790, 907),
        P(790, 899), P(779, 899), P(779, 858), P(781, 858)
      ]),
      polygon([
        P(815, 900), P(833, 900), P(833, 907), P(840, 907),
        P(840, 934), P(834, 934), P(834, 941), P(808, 941),
        P(808, 934), P(797, 934), P(797, 915), P(815, 915)
      ]),
      paint('pale', rect(778, 907, 31, 18)),
      paint('pale', rect(821, 891, 19, 14))
    ]
  },
  {
    id: 'east-housing',
    name: 'Housing East of KMKJ',
    frame: 'master',
    palette: 'metalGray',
    parts: [
      paint('metalGray', polygon([
        P(850, 839), P(883, 839), P(883, 884), P(850, 884)
      ])),
      paint('metalBlue', rect(883, 837, 25, 48)),
      paint('metalRed', rect(908, 837, 19, 48)),
      paint('metalBlue', rect(927, 836, 38, 49)),
      paint('metalGray', rect(965, 838, 22, 46)),
      paint('white', rect(1003, 833, 18, 29)),
      paint('white', rect(1000, 860, 21, 20)),
      paint('metalRed', rect(1023, 834, 23, 48)),
      paint('metalBlue', rect(1046, 841, 32, 42)),
      paint('metalBlue', rect(1078, 842, 35, 42)),
      paint('metalRed', rect(1113, 832, 48, 53)),
      paint('metalGray', polygon([
        P(850, 884), P(881, 884), P(881, 933), P(869, 933),
        P(869, 938), P(850, 938)
      ])),
      paint('metalBlue', rect(881, 884, 28, 55)),
      paint('metalGreen', rect(909, 884, 28, 55)),
      paint('metalBlue', rect(937, 884, 28, 55)),
      paint('metalGreen', rect(965, 884, 39, 55)),
      paint('metalBlue', rect(1004, 882, 22, 57)),
      paint('metalRed', rect(1026, 882, 22, 57)),
      paint('metalBlue', rect(1048, 882, 29, 57)),
      paint('metalBlue', rect(1077, 882, 25, 57)),
      paint('metalGray', rect(1102, 883, 48, 55)),
      paint('metalBlue', rect(1150, 909, 38, 24)),
      paint('metalBlue', rect(1047, 943, 32, 19)),
      paint('metalGray', rect(1085, 943, 39, 20)),
      paint('metalBlue', rect(1139, 943, 31, 20))
    ]
  }
];

function transformPoint(frameName, point) {
  const frame = FRAMES[frameName];
  const [x, y] = point;
  return [
    frame.a * x - frame.b * y + frame.tx,
    frame.b * x + frame.a * y + frame.ty
  ];
}

function mappedPart(frameName, sourcePart) {
  if (sourcePart.kind === 'polygon') {
    return {
      points: sourcePart.points.map(point => transformPoint(frameName, point)),
      ridge: null,
      palette: sourcePart.palette ?? null
    };
  }

  const {x, y, w, h} = sourcePart;
  const points = [
    transformPoint(frameName, P(x, y)),
    transformPoint(frameName, P(x + w, y)),
    transformPoint(frameName, P(x + w, y + h)),
    transformPoint(frameName, P(x, y + h))
  ];

  const horizontal = sourcePart.ridge === 'horizontal'
    || (sourcePart.ridge === 'auto' && w >= h);
  const vertical = sourcePart.ridge === 'vertical'
    || (sourcePart.ridge === 'auto' && h > w);
  let ridge = null;
  if (horizontal) {
    ridge = [
      transformPoint(frameName, P(x + w * 0.08, y + h * 0.5)),
      transformPoint(frameName, P(x + w * 0.92, y + h * 0.5))
    ];
  } else if (vertical) {
    ridge = [
      transformPoint(frameName, P(x + w * 0.5, y + h * 0.08)),
      transformPoint(frameName, P(x + w * 0.5, y + h * 0.92))
    ];
  }
  return {points, ridge, palette: sourcePart.palette ?? null};
}

const BUILDINGS = BUILDING_SOURCES.map(building => ({
  ...building,
  parts: building.parts.map(part => mappedPart(building.frame, part))
}));

const mappedPolygon = (frameName, points) => points.map(point => transformPoint(frameName, point));

// Parking surfaces are traced from the labelled page-2 and page-1 close views.
// They are rendered beneath the red road network and never modify a building.
const PARKING_AREAS = [
  mappedPolygon('academic', [P(320, 70), P(360, 70), P(360, 185), P(320, 185)]),
  mappedPolygon('academic', [P(395, 15), P(566, 15), P(566, 45), P(395, 45)]),
  mappedPolygon('academic', [
    P(557, 54), P(599, 54), P(599, 90),
    P(582, 90), P(582, 116), P(557, 116)
  ]),
  mappedPolygon('academic', [P(344, 192), P(401, 192), P(401, 310), P(344, 310)]),
  mappedPolygon('academic', [P(735, 219), P(842, 219), P(842, 250), P(735, 250)]),
  mappedPolygon('academic', [P(325, 329), P(360, 329), P(360, 497), P(325, 497)]),
  mappedPolygon('residential', [
    P(735, 145), P(838, 145), P(838, 200), P(790, 200),
    P(790, 305), P(838, 305), P(838, 365), P(735, 365)
  ])
];

const MULTI_SPORT_COURT = [
  P(338, 363), P(423, 397), P(373, 506), P(289, 471)
];
const TENNIS_COURTS = [
  [P(340, 374), P(403, 400), P(389, 431), P(326, 405)],
  [P(324, 412), P(387, 438), P(373, 469), P(310, 443)]
];
const FUTSAL_COURT = [
  P(307, 449), P(371, 475), P(361, 497), P(297, 471)
];
const SOUTH_COURTS = {
  basketball: [P(399, 841), P(452, 829), P(472, 891), P(417, 906)],
  takraw1: [P(439, 880), P(486, 867), P(502, 919), P(455, 934)],
  takraw2: [P(479, 901), P(527, 888), P(543, 937), P(493, 953)]
};
const VOLLEYBALL_COURT = mappedPolygon('residential', [
  P(350, 300), P(495, 300), P(495, 390), P(350, 390)
]);
const PETANQUE_COURT = mappedPolygon('residential', [
  P(562, 70), P(673, 70), P(673, 120), P(562, 120)
]);

function paletteFor(name) {
  if (name === 'pale') {
    return {roof: COLORS.paleRoof, light: COLORS.paleLight, dark: COLORS.paleDark};
  }
  if (name === 'white') {
    return {roof: COLORS.whiteRoof, light: '#fff4d4', dark: '#a9977b'};
  }
  if (name === 'metalBlue') {
    return {roof: COLORS.metalBlue, light: COLORS.metalBlueLight, dark: COLORS.metalBlueDark};
  }
  if (name === 'metalRed') {
    return {roof: COLORS.metalRed, light: COLORS.metalRedLight, dark: COLORS.metalRedDark};
  }
  if (name === 'metalGreen') {
    return {roof: COLORS.metalGreen, light: COLORS.metalGreenLight, dark: COLORS.metalGreenDark};
  }
  if (name === 'metalGray') {
    return {roof: COLORS.metalGray, light: COLORS.metalGrayLight, dark: COLORS.metalGrayDark};
  }
  return {roof: COLORS.brownRoof, light: COLORS.brownLight, dark: COLORS.brownDark};
}

function tracePolygon(points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
}

function fillPolygon(points, fill, stroke = null, lineWidth = 1) {
  tracePolygon(points);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'miter';
    ctx.stroke();
  }
}

function interpolate(a, b, amount) {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount
  ];
}

function distanceBetween(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function boundsFor(points) {
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  return {
    minX: Math.min(...xs), minY: Math.min(...ys),
    maxX: Math.max(...xs), maxY: Math.max(...ys)
  };
}

function centreFor(points) {
  const bounds = boundsFor(points);
  return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
}

function quadPoint(points, u, v) {
  return interpolate(interpolate(points[0], points[1], u), interpolate(points[3], points[2], u), v);
}

function drawLine(a, b, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function drawQuadLine(points, u1, v1, u2, v2, color = COLORS.courtLine, width = 1) {
  drawLine(quadPoint(points, u1, v1), quadPoint(points, u2, v2), color, width);
}

function drawGround() {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, MASTER_W, MASTER_H);

  // Deterministic scan lines and grass pixels keep the map crisp and repeatable.
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = COLORS.grassLight;
  for (let y = 2; y < MASTER_H; y += 5) ctx.fillRect(0, y, MASTER_W, 1);
  ctx.globalAlpha = 0.24;
  for (let index = 0; index < 520; index++) {
    const x = (index * 97 + 31) % MASTER_W;
    const y = (index * 53 + 17) % MASTER_H;
    ctx.fillStyle = index % 3 ? COLORS.grassDark : COLORS.grassLight;
    ctx.fillRect(x, y, index % 5 === 0 ? 2 : 1, 2);
  }
  ctx.globalAlpha = 1;
}

function drawRugbyField() {
  ctx.save();
  ctx.translate(354, 655);
  ctx.rotate(0.43);

  ctx.fillStyle = COLORS.buildingShadow;
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.ellipse(3, 4, 199, 129, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 196, 126, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = COLORS.field;
  ctx.fillRect(-202, -132, 404, 264);
  ctx.fillStyle = COLORS.fieldStripe;
  for (let x = -192; x < 196; x += 32) ctx.fillRect(x, -132, 16, 264);
  ctx.restore();

  ctx.strokeStyle = COLORS.fieldLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 196, 126, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-150, -88, 300, 176);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -88);
  ctx.lineTo(0, 88);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();
  for (let x = -120; x <= 120; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, -88);
    ctx.lineTo(x, 88);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.strokeRect(-150, -35, 30, 70);
  ctx.strokeRect(120, -35, 30, 70);
  ctx.restore();
}

function drawCourtSurface(points, fill, highlight) {
  ctx.save();
  ctx.translate(2, 3);
  ctx.globalAlpha = 0.3;
  fillPolygon(points, COLORS.buildingShadow);
  ctx.restore();

  fillPolygon(points, fill, COLORS.courtLine, 1.6);
  const bounds = boundsFor(points);
  ctx.save();
  tracePolygon(points);
  ctx.clip();
  ctx.strokeStyle = highlight;
  ctx.globalAlpha = 0.17;
  ctx.lineWidth = 1;
  for (let offset = bounds.minX - 120; offset < bounds.maxX + 120; offset += 8) {
    ctx.beginPath();
    ctx.moveTo(offset, bounds.minY - 20);
    ctx.lineTo(offset + 120, bounds.maxY + 20);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCentreMarkings(points, includeCircle = true) {
  const uLength = distanceBetween(points[0], points[1]);
  const vLength = distanceBetween(points[0], points[3]);
  if (uLength >= vLength) drawQuadLine(points, 0.5, 0.04, 0.5, 0.96, COLORS.courtLine, 1.2);
  else drawQuadLine(points, 0.04, 0.5, 0.96, 0.5, COLORS.courtLine, 1.2);
  if (!includeCircle) return;
  const centre = quadPoint(points, 0.5, 0.5);
  ctx.strokeStyle = COLORS.courtLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centre[0], centre[1], 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTennisCourt(points) {
  drawCourtSurface(points, COLORS.courtGreen, COLORS.courtGreenLight);
  drawQuadLine(points, 0.06, 0.08, 0.94, 0.08);
  drawQuadLine(points, 0.94, 0.08, 0.94, 0.92);
  drawQuadLine(points, 0.94, 0.92, 0.06, 0.92);
  drawQuadLine(points, 0.06, 0.92, 0.06, 0.08);
  drawQuadLine(points, 0.5, 0.04, 0.5, 0.96, '#f8f2cf', 1.4);
  drawQuadLine(points, 0.27, 0.2, 0.27, 0.8);
  drawQuadLine(points, 0.73, 0.2, 0.73, 0.8);
  drawQuadLine(points, 0.27, 0.5, 0.73, 0.5);
}

function drawBasketballCourt(points) {
  drawCourtSurface(points, COLORS.courtConcrete, COLORS.courtConcreteLight);
  drawCentreMarkings(points, true);
  const uLength = distanceBetween(points[0], points[1]);
  const vLength = distanceBetween(points[0], points[3]);
  if (vLength >= uLength) {
    drawQuadLine(points, 0.28, 0.16, 0.72, 0.16);
    drawQuadLine(points, 0.28, 0.84, 0.72, 0.84);
  } else {
    drawQuadLine(points, 0.16, 0.28, 0.16, 0.72);
    drawQuadLine(points, 0.84, 0.28, 0.84, 0.72);
  }
}

function drawNetCourt(points, fill = COLORS.courtConcrete) {
  drawCourtSurface(points, fill, COLORS.courtConcreteLight);
  drawCentreMarkings(points, false);
  drawQuadLine(points, 0.08, 0.08, 0.92, 0.08, COLORS.courtLine, 0.8);
  drawQuadLine(points, 0.92, 0.92, 0.08, 0.92, COLORS.courtLine, 0.8);
}

function drawSportsGrounds() {
  drawRugbyField();

  drawCourtSurface(MULTI_SPORT_COURT, COLORS.courtBlue, COLORS.courtBlueLight);
  for (const tennis of TENNIS_COURTS) drawTennisCourt(tennis);
  drawCourtSurface(FUTSAL_COURT, COLORS.courtBlue, COLORS.courtBlueLight);
  drawCentreMarkings(FUTSAL_COURT, true);
  drawQuadLine(FUTSAL_COURT, 0.14, 0.25, 0.14, 0.75, COLORS.courtLine, 0.8);
  drawQuadLine(FUTSAL_COURT, 0.86, 0.25, 0.86, 0.75, COLORS.courtLine, 0.8);

  drawBasketballCourt(SOUTH_COURTS.basketball);
  drawNetCourt(SOUTH_COURTS.takraw1);
  drawNetCourt(SOUTH_COURTS.takraw2);
  drawNetCourt(VOLLEYBALL_COURT);

  drawCourtSurface(PETANQUE_COURT, COLORS.petanque, '#cfb37c');
  const petanqueULength = distanceBetween(PETANQUE_COURT[0], PETANQUE_COURT[1]);
  const petanqueVLength = distanceBetween(PETANQUE_COURT[0], PETANQUE_COURT[3]);
  if (petanqueULength >= petanqueVLength) {
    for (let u = 0.2; u < 1; u += 0.2) drawQuadLine(PETANQUE_COURT, u, 0.05, u, 0.95, COLORS.courtLine, 0.7);
  } else {
    for (let v = 0.2; v < 1; v += 0.2) drawQuadLine(PETANQUE_COURT, 0.05, v, 0.95, v, COLORS.courtLine, 0.7);
  }
}

function drawParking() {
  for (const area of PARKING_AREAS) {
    ctx.save();
    ctx.translate(2, 3);
    ctx.globalAlpha = 0.25;
    fillPolygon(area, COLORS.buildingShadow);
    ctx.restore();
    fillPolygon(area, COLORS.parking, COLORS.parkingLine, 1);

    const bounds = boundsFor(area);
    ctx.save();
    tracePolygon(area);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#dce1d4';
    for (let x = bounds.minX - 80; x < bounds.maxX + 80; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.minY - 10);
      ctx.lineTo(x + 80, bounds.maxY + 10);
      ctx.stroke();
    }
    ctx.restore();

    if (area.length === 4) {
      const uLength = distanceBetween(area[0], area[1]);
      const vLength = distanceBetween(area[0], area[3]);
      ctx.globalAlpha = 0.75;
      if (uLength >= vLength) {
        for (let u = 0.12; u < 0.95; u += 0.14) {
          drawQuadLine(area, u, 0.04, u, 0.24, COLORS.parkingLine, 0.7);
          drawQuadLine(area, u, 0.76, u, 0.96, COLORS.parkingLine, 0.7);
        }
      } else {
        for (let v = 0.12; v < 0.95; v += 0.14) {
          drawQuadLine(area, 0.04, v, 0.24, v, COLORS.parkingLine, 0.7);
          drawQuadLine(area, 0.76, v, 0.96, v, COLORS.parkingLine, 0.7);
        }
      }
      ctx.globalAlpha = 1;
    }
  }
}

function drawRunLayer(runs, color, edgeColor, textureColor) {
  if (edgeColor) {
    ctx.fillStyle = edgeColor;
    for (const [y, start, end] of runs) ctx.fillRect(start - 1, y - 1, end - start + 2, 3);
  }
  ctx.fillStyle = color;
  for (const [y, start, end] of runs) {
    ctx.fillRect(start, y, end - start, 1);
  }
  if (textureColor) {
    ctx.fillStyle = textureColor;
    ctx.globalAlpha = 0.16;
    for (const [y, start, end] of runs) {
      if (y % 6 === 0) ctx.fillRect(start, y, end - start, 1);
    }
    ctx.globalAlpha = 1;
  }
}

function drawWaterFountain() {
  ctx.fillStyle = COLORS.buildingShadow;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(819, 581, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.wall;
  ctx.beginPath();
  ctx.arc(816, 577, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.fountain;
  ctx.strokeStyle = COLORS.courtLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(816, 577, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = COLORS.waterDark;
  ctx.beginPath();
  ctx.arc(816, 577, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#d9ffff';
  ctx.fillRect(815, 572, 2, 4);
}

function drawRoofShadow(part) {
  ctx.save();
  ctx.translate(3, 4);
  ctx.globalAlpha = 0.72;
  fillPolygon(part.points, COLORS.buildingShadow);
  ctx.restore();
}

function drawWallBase(part) {
  ctx.save();
  ctx.translate(0, 2.4);
  fillPolygon(part.points, COLORS.wallShade, COLORS.outline, 1);
  ctx.restore();
}

function drawRoofTiles(part, palette) {
  const bounds = boundsFor(part.points);
  ctx.save();
  tracePolygon(part.points);
  ctx.clip();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = palette.dark;
  ctx.lineWidth = 0.55;

  if (part.points.length === 4) {
    const [a, b, c, d] = part.points;
    const uLength = distanceBetween(a, b);
    const vLength = distanceBetween(a, d);
    if (uLength >= vLength) {
      for (let v = 0.12; v < 0.96; v += 0.13) drawLine(interpolate(a, d, v), interpolate(b, c, v), palette.dark, 0.55);
      ctx.globalAlpha = 0.14;
      for (let u = 0.12; u < 0.96; u += 0.14) drawLine(interpolate(a, b, u), interpolate(d, c, u), palette.light, 0.45);
    } else {
      for (let u = 0.12; u < 0.96; u += 0.13) drawLine(interpolate(a, b, u), interpolate(d, c, u), palette.dark, 0.55);
      ctx.globalAlpha = 0.14;
      for (let v = 0.12; v < 0.96; v += 0.14) drawLine(interpolate(a, d, v), interpolate(b, c, v), palette.light, 0.45);
    }
  } else {
    for (let y = bounds.minY; y <= bounds.maxY; y += 4) drawLine([bounds.minX, y], [bounds.maxX, y], palette.dark, 0.5);
  }
  ctx.restore();
}

function drawRoofPlanes(part, palette) {
  if (part.points.length !== 4) return;
  const [a, b, c, d] = part.points;
  ctx.globalAlpha = 0.28;

  if (part.ridge) {
    const [r0, r1] = part.ridge;
    const topMiddle = interpolate(a, b, 0.5);
    const leftMiddle = interpolate(a, d, 0.5);
    const verticalRidge = distanceBetween(r0, topMiddle) < distanceBetween(r0, leftMiddle);
    ctx.fillStyle = palette.light;
    tracePolygon(verticalRidge ? [a, r0, r1, d] : [a, b, r1, r0]);
    ctx.fill();
    ctx.fillStyle = palette.dark;
    tracePolygon(verticalRidge ? [r0, b, c, r1] : [r0, r1, c, d]);
    ctx.fill();
  } else {
    const centre = centreFor(part.points);
    ctx.fillStyle = palette.light;
    tracePolygon([a, b, centre, d]);
    ctx.fill();
    ctx.fillStyle = palette.dark;
    tracePolygon([b, c, d, centre]);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawEaveWindows(part) {
  if (part.points.length !== 4) return;
  const edges = part.points.map((point, index) => {
    const next = part.points[(index + 1) % part.points.length];
    return {a: point, b: next, y: (point[1] + next[1]) / 2, length: distanceBetween(point, next)};
  });
  const edge = edges.sort((left, right) => right.y - left.y || right.length - left.length)[0];
  if (edge.length < 15) return;
  const windows = Math.max(2, Math.min(10, Math.floor(edge.length / 12)));
  for (let index = 0; index < windows; index++) {
    const centre = (index + 0.5) / windows;
    const start = interpolate(edge.a, edge.b, centre - 0.025);
    const end = interpolate(edge.a, edge.b, centre + 0.025);
    drawLine(start, end, index % 2 ? COLORS.window : COLORS.windowLight, 1.8);
  }
}

function drawRoofFixture(part) {
  if (part.points.length !== 4) return;
  const bounds = boundsFor(part.points);
  if ((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) < 700) return;
  const centre = quadPoint(part.points, 0.38, 0.38);
  const angle = Math.atan2(part.points[1][1] - part.points[0][1], part.points[1][0] - part.points[0][0]);
  ctx.save();
  ctx.translate(centre[0], centre[1]);
  ctx.rotate(angle);
  ctx.fillStyle = '#92c2c2';
  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 0.7;
  ctx.fillRect(-2, -1.5, 4, 3);
  ctx.strokeRect(-2, -1.5, 4, 3);
  ctx.restore();
}

function drawRoofPart(part, palette) {
  tracePolygon(part.points);
  ctx.fillStyle = palette.roof;
  ctx.fill();

  // Cream eaves and walls match the supplied Champion Island-style reference.
  ctx.strokeStyle = COLORS.wall;
  ctx.lineWidth = 3.2;
  ctx.lineJoin = 'miter';
  ctx.stroke();
  tracePolygon(part.points);
  ctx.fillStyle = palette.roof;
  ctx.fill();

  drawRoofPlanes(part, palette);
  drawRoofTiles(part, palette);

  ctx.strokeStyle = COLORS.outline;
  ctx.lineWidth = 1.25;
  ctx.lineJoin = 'miter';
  tracePolygon(part.points);
  ctx.stroke();

  if (part.ridge) {
    ctx.strokeStyle = COLORS.ridge;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(part.ridge[0][0], part.ridge[0][1]);
    ctx.lineTo(part.ridge[1][0], part.ridge[1][1]);
    ctx.stroke();
    ctx.strokeStyle = palette.light;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(part.ridge[0][0], part.ridge[0][1] - 0.7);
    ctx.lineTo(part.ridge[1][0], part.ridge[1][1] - 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawEaveWindows(part);
  drawRoofFixture(part);
}

function buildingBounds(building) {
  return boundsFor(building.parts.flatMap(part => part.points));
}

function drawSpecialBuildingDetails(building) {
  const bounds = buildingBounds(building);
  const centre = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];

  if (building.id === 'water-tank') {
    const radius = Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.31;
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 2;
    for (const corner of [[bounds.minX + 4, bounds.minY + 4], [bounds.maxX - 4, bounds.minY + 4], [bounds.minX + 4, bounds.maxY - 4], [bounds.maxX - 4, bounds.maxY - 4]]) {
      drawLine(corner, centre, COLORS.wall, 2);
    }
    ctx.fillStyle = '#9ebdbf';
    ctx.strokeStyle = '#dcebea';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centre[0], centre[1], radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#6e999e';
    for (let y = centre[1] - radius + 3; y < centre[1] + radius; y += 3) ctx.fillRect(centre[0] - radius + 2, y, radius * 2 - 4, 1);
    ctx.globalAlpha = 1;
  }

  if (building.id === 'surau') {
    ctx.fillStyle = '#f4d065';
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(centre[0], centre[1], 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.brownDark;
    ctx.beginPath();
    ctx.arc(centre[0], centre[1], 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuildings() {
  // All decorative offsets are rendered separately; the registered polygons
  // below remain the only collision and placement geometry.
  for (const building of BUILDINGS) {
    for (const part of building.parts) drawRoofShadow(part);
  }
  for (const building of BUILDINGS) {
    for (const part of building.parts) drawWallBase(part);
    for (const part of building.parts) {
      drawRoofPart(part, paletteFor(part.palette || building.palette));
    }
    drawSpecialBuildingDetails(building);
  }
}

function drawCampusMap() {
  drawGround();
  drawSportsGrounds();
  drawParking();
  drawRunLayer(globalThis.ROAD_RUNS, COLORS.road, COLORS.roadEdge, COLORS.roadShade);
  drawRunLayer(globalThis.PATH_RUNS, COLORS.path, COLORS.pathEdge, '#d7f3fa');
  drawWaterFountain();
  drawBuildings();
}

// Headless geometry QA and the playable runtime use the same map draw entrypoint.
// Gameplay is deliberately kept in runtime.js so map coordinates cannot drift.
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCampusMap();
}

globalThis.KMKJCampusMap = Object.freeze({
  width: MASTER_W,
  height: MASTER_H,
  colors: Object.freeze({...COLORS}),
  buildings: BUILDINGS,
  parkingAreas: PARKING_AREAS,
  courts: Object.freeze({
    multiSport: MULTI_SPORT_COURT,
    tennis: TENNIS_COURTS,
    futsal: FUTSAL_COURT,
    south: SOUTH_COURTS,
    volleyball: VOLLEYBALL_COURT,
    petanque: PETANQUE_COURT
  }),
  fountain: Object.freeze({x: 816, y: 577, radius: 10}),
  draw: drawCampusMap
});

draw();
