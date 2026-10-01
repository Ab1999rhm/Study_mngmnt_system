const gradeLabel = g => g === 'remedial' ? 'Remedial' : `Grade ${g}`;

const BANDS = {
  primary: { grades: [1, 2, 3, 4], subjects: ['Mathematics', 'English', 'Environmental Science', 'Afaan Oromo'] },
  upper: { grades: [5, 6, 7, 8], subjects: ['Mathematics', 'English', 'Science', 'Social Studies', 'ICT'] },
  secondary: { grades: [9, 10], subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Geography', 'History'] },
  prep: { grades: [11, 12], subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Economics', 'Civics'] },
  remedial: { grades: ['remedial'], subjects: ['Mathematics', 'English', 'Science'] }
};

function bandOf(grade) {
  for (const [k, b] of Object.entries(BANDS)) {
    if (b.grades.includes(Number(grade)) || String(grade) === 'remedial') return k;
  }
  return 'upper';
}

const CONTENT = {
  Mathematics: [
    {
      title: 'Numbers & Operations',
      terms: [
        ['Addition', 'combining two or more numbers to get a sum'],
        ['Subtraction', 'taking one number away from another'],
        ['Multiplication', 'repeated addition of equal groups'],
        ['Division', 'splitting a number into equal parts'],
        ['Fraction', 'a part of a whole expressed as a/b'],
        ['Decimal', 'a number with a point such as 3.5'],
        ['Percentage', 'a fraction out of one hundred'],
        ['Average', 'the sum divided by the count']
      ],
      statements: [
        ['Multiplication is repeated addition.', true],
        ['A fraction can never be larger than 1.', false],
        ['Dividing by zero gives zero.', false],
        ['The average of 2, 4, 6 is 4.', true],
        ['50% of 200 is 100.', true]
      ]
    },
    {
      title: 'Algebra & Equations',
      terms: [
        ['Variable', 'a letter that stands for an unknown number'],
        ['Equation', 'a statement that two expressions are equal'],
        ['Coefficient', 'the number in front of a variable'],
        ['Expression', 'a combination of numbers and operations'],
        ['Simplify', 'to rewrite in a shorter equivalent form'],
        ['Exponent', 'how many times a number is multiplied by itself'],
        ['Inequality', 'a comparison using < or >'],
        ['Solution', 'the value that makes an equation true']
      ],
      statements: [
        ['In 3x, the coefficient is 3.', true],
        ['x + x equals 2x.', true],
        ['An equation must contain an equals sign.', true],
        ['5 > 9 is a true inequality.', false],
        ['The solution of x + 2 = 5 is x = 3.', true]
      ]
    },
    {
      title: 'Geometry & Measurement',
      terms: [
        ['Perimeter', 'the total distance around a shape'],
        ['Area', 'the space a flat shape covers'],
        ['Volume', 'the space a solid object takes up'],
        ['Angle', 'the turn between two lines'],
        ['Triangle', 'a shape with three sides'],
        ['Circle', 'a round shape with all points equal from center'],
        ['Radius', 'the distance from the center to the edge'],
        ['Diameter', 'the distance across a circle through its center']
      ],
      statements: [
        ['A triangle has three sides.', true],
        ['The area of a rectangle is length + width.', false],
        ['A right angle is 90 degrees.', true],
        ['Diameter is twice the radius.', true],
        ['Perimeter is measured in square units.', false]
      ]
    }
  ],
  English: [
    {
      title: 'Grammar Essentials',
      terms: [
        ['Noun', 'a word that names a person, place or thing'],
        ['Verb', 'a word that shows action or state'],
        ['Adjective', 'a word that describes a noun'],
        ['Adverb', 'a word that describes a verb'],
        ['Pronoun', 'a word used instead of a noun'],
        ['Tense', 'the time of an action in a verb'],
        ['Subject', 'who or what the sentence is about'],
        ['Object', 'the person or thing affected by the action']
      ],
      statements: [
        ['Run is a verb.', true],
        ['A pronoun replaces a noun.', true],
        ['Quickly is an adjective.', false],
        ['"She" is a pronoun.', true],
        ['The subject usually comes before the verb.', true]
      ]
    },
    {
      title: 'Reading & Comprehension',
      terms: [
        ['Main idea', 'the central point of a text'],
        ['Summary', 'a short statement of the key points'],
        ['Context', 'the words around a word that give meaning'],
        ['Inference', 'a conclusion drawn from evidence'],
        ['Theme', 'the underlying message of a story'],
        ['Vocabulary', 'the words a person knows'],
        ['Paragraph', 'a group of sentences about one idea'],
        ['Conclusion', 'the final judgment at the end']
      ],
      statements: [
        ['A summary should be shorter than the original.', true],
        ['An inference is always stated directly.', false],
        ['Context clues help guess word meaning.', true],
        ['Theme is the same as the plot.', false],
        ['Each paragraph should focus on one idea.', true]
      ]
    },
    {
      title: 'Writing Skills',
      terms: [
        ['Introduction', 'the opening part that hooks the reader'],
        ['Thesis', 'the main claim of an essay'],
        ['Transition', 'a word or phrase that links ideas'],
        ['Punctuation', 'marks that structure writing'],
        ['Draft', 'a first version of a text'],
        ['Revising', 'improving content and organization'],
        ['Narrative', 'a story written in order of events'],
        ['Persuasive', 'writing meant to convince']
      ],
      statements: [
        ['A thesis states the main idea of an essay.', true],
        ['Transitions make writing jump randomly.', false],
        ['Editing comes before drafting.', false],
        ['Commas separate items in a list.', true],
        ['A persuasive essay tries to convince the reader.', true]
      ]
    }
  ],
  'Environmental Science': [
    {
      title: 'Ecosystems & Living Things',
      terms: [
        ['Ecosystem', 'a community of living things and their environment'],
        ['Habitat', 'the natural home of an organism'],
        ['Food chain', 'the path of energy from plant to animal'],
        ['Producer', 'an organism that makes its own food'],
        ['Consumer', 'an organism that eats others'],
        ['Biodiversity', 'the variety of life in an area'],
        ['Climate', 'the usual weather pattern of a place'],
        ['Adaptation', 'a trait that helps survival']
      ],
      statements: [
        ['Plants are producers.', true],
        ['A habitat is where an animal works.', false],
        ['Sunlight starts most food chains.', true],
        ['Extinct species can return naturally.', false],
        ['Adaptation helps organisms survive.', true]
      ]
    },
    {
      title: 'Natural Resources & Conservation',
      terms: [
        ['Renewable', 'a resource that replaces itself'],
        ['Non-renewable', 'a resource that runs out'],
        ['Pollution', 'harmful contamination of air, water or soil'],
        ['Recycle', 'to process waste into new material'],
        ['Conserve', 'to use carefully and avoid waste'],
        ['Deforestation', 'cutting down forests'],
        ['Water cycle', 'the movement of water on Earth'],
        ['Soil erosion', 'washing away of topsoil']
      ],
      statements: [
        ['Solar energy is renewable.', true],
        ['Oil is an endless resource.', false],
        ['Recycling reduces waste.', true],
        ['Deforestation helps soil stay.', false],
        ['Clean water is a natural resource.', true]
      ]
    }
  ],
  'Afaan Oromo': [
    {
      title: 'Barreessuu Afaanii',
      terms: [
        ['Hiramaa', 'a word that shows an action'],
        ['Gochaa', 'verb in Afaan Oromo'],
        ['Meezaan', 'a naming word'],
        ['Hiramaa geseessuu', 'describing word'],
        ['Jecha', 'the meaning of a word'],
        ['Bareessuu', 'the skill of writing'],
        ['Dublata', 'to read aloud'],
        ['Gabaabina', 'a short form of expression']
      ],
      statements: [
        ['Meezaan badhaadha geyyuun deemuu dha.', true],
        ['Gochi wal balaaluu hin danda\'u.', false],
        ['Barreessiin afaanii amantaa qabu.', true],
        ['Hiramaan meezanaan wal balaaluu hin danda\'u.', false],
        ['Gabaabin gabaabumatti fayyadamu dha.', true]
      ]
    }
  ],
  Science: [
    {
      title: 'Matter & Energy',
      terms: [
        ['Atom', 'the smallest unit of an element'],
        ['Molecule', 'two or more atoms bonded together'],
        ['Solid', 'a state of matter with fixed shape'],
        ['Liquid', 'a state of matter that flows'],
        ['Gas', 'a state of matter that fills its container'],
        ['Energy', 'the ability to do work'],
        ['Heat', 'energy that moves between temperatures'],
        ['Change', 'when matter becomes something new']
      ],
      statements: [
        ['Water freezes at 0°C.', true],
        ['Gas has a fixed shape.', false],
        ['Atoms make up molecules.', true],
        ['Energy is needed to do work.', true],
        ['Melting is a physical change only.', false]
      ]
    },
    {
      title: 'Forces & Motion',
      terms: [
        ['Force', 'a push or pull on an object'],
        ['Gravity', 'the pull of the Earth on objects'],
        ['Friction', 'a force that resists motion'],
        ['Speed', 'distance traveled per unit of time'],
        ['Acceleration', 'the rate of change of speed'],
        ['Mass', 'the amount of matter in an object'],
        ['Weight', 'the pull of gravity on mass'],
        ['Balanced force', 'forces that cancel each other']
      ],
      statements: [
        ['Gravity pulls objects toward the Earth.', true],
        ['Friction helps objects slide faster.', false],
        ['Speed equals distance divided by time.', true],
        ['Mass changes on the Moon.', false],
        ['Balanced forces cause no change in motion.', true]
      ]
    },
    {
      title: 'Living Systems',
      terms: [
        ['Cell', 'the basic unit of life'],
        ['Tissue', 'a group of similar cells'],
        ['Organ', 'a part of the body with a function'],
        ['Respiration', 'cells releasing energy from food'],
        ['Photosynthesis', 'plants making food using light'],
        ['Nutrition', 'taking in and using food'],
        ['Reproduction', 'producing new individuals'],
        ['Environment', 'everything around a living thing']
      ],
      statements: [
        ['All living things are made of cells.', true],
        ['Photosynthesis happens in the dark.', false],
        ['The heart is an organ.', true],
        ['Respiration releases energy.', true],
        ['A tissue is a single cell.', false]
      ]
    }
  ],
  'Social Studies': [
    {
      title: 'People, Places & History',
      terms: [
        ['Civilization', 'an advanced society with cities and culture'],
        ['Government', 'the group that rules a country'],
        ['Culture', 'the customs and beliefs of a people'],
        ['Geography', 'the study of Earth places'],
        ['Population', 'the number of people in a place'],
        ['Migration', 'movement of people to a new place'],
        ['Heritage', 'what is passed down from the past'],
        ['Democracy', 'rule by the people through voting']
      ],
      statements: [
        ['Democracy means rule by the people.', true],
        ['Migration means staying in one place.', false],
        ['Culture includes food and festivals.', true],
        ['Population means animal count only.', false],
        ['Heritage comes from previous generations.', true]
      ]
    }
  ],
  ICT: [
    {
      title: 'Computer Basics',
      terms: [
        ['Hardware', 'the physical parts of a computer'],
        ['Software', 'programs that run on a computer'],
        ['Input device', 'a device that sends data to a computer'],
        ['Output device', 'a device that shows results'],
        ['Internet', 'a global network of connected computers'],
        ['File', 'a named collection of data'],
        ['Keyboard', 'a device used to type'],
        ['Processor', 'the part that executes instructions']
      ],
      statements: [
        ['A mouse is an input device.', true],
        ['Software is a physical part.', false],
        ['The internet connects computers worldwide.', true],
        ['A monitor is an input device.', false],
        ['A file stores data.', true]
      ]
    }
  ],
  Physics: [
    {
      title: 'Mechanics',
      terms: [
        ['Velocity', 'speed in a stated direction'],
        ['Momentum', 'mass multiplied by velocity'],
        ['Newton', 'the SI unit of force'],
        ['Work', 'force applied over a distance'],
        ['Power', 'the rate of doing work'],
        ['Energy', 'the capacity to cause change'],
        ['Vector', 'a quantity with magnitude and direction'],
        ['Equilibrium', 'a state of balanced forces']
      ],
      statements: [
        ['Momentum equals mass times velocity.', true],
        ['Power is measured in joules.', false],
        ['Velocity has direction.', true],
        ['Work equals force times distance.', true],
        ['An object at rest has zero momentum.', true]
      ]
    },
    {
      title: 'Waves, Light & Sound',
      terms: [
        ['Wavelength', 'the distance between two wave peaks'],
        ['Frequency', 'the number of waves per second'],
        ['Refraction', 'bending of light as it changes medium'],
        ['Reflection', 'light bouncing off a surface'],
        ['Amplitude', 'the height of a wave'],
        ['Pitch', 'how high or low a sound is'],
        ['Medium', 'the material a wave travels through'],
        ['Electromagnetic wave', 'a wave of electric and magnetic energy']
      ],
      statements: [
        ['Sound needs a medium to travel.', true],
        ['Light bends during reflection only.', false],
        ['Higher frequency means higher pitch.', true],
        ['Amplitude is the wave width.', false],
        ['Visible light is an electromagnetic wave.', true]
      ]
    }
  ],
  Chemistry: [
    {
      title: 'Elements & Compounds',
      terms: [
        ['Element', 'a pure substance of one kind of atom'],
        ['Compound', 'two or more elements chemically joined'],
        ['Mixture', 'substances physically combined'],
        ['Periodic table', 'the chart of all elements'],
        ['Bond', 'the force holding atoms together'],
        ['Ion', 'an atom with a charge'],
        ['Valency', 'the combining capacity of an element'],
        ['Molecule', 'the smallest unit of a compound']
      ],
      statements: [
        ['Water is a compound.', true],
        ['Air is a pure element.', false],
        ['A mixture can be separated physically.', true],
        ['An ion has no charge.', false],
        ['Gold is an element.', true]
      ]
    },
    {
      title: 'Chemical Reactions',
      terms: [
        ['Reactant', 'a substance that starts a reaction'],
        ['Product', 'a substance formed in a reaction'],
        ['Catalyst', 'a substance that speeds a reaction'],
        ['Oxidation', 'a reaction involving oxygen gain'],
        ['Acid', 'a substance with low pH'],
        ['Base', 'a substance with high pH'],
        ['Neutralization', 'acid and base forming salt and water'],
        ['Equation', 'a symbolic description of a reaction']
      ],
      statements: [
        ['Rusting is oxidation.', true],
        ['A catalyst is used up in a reaction.', false],
        ['Acids have high pH.', false],
        ['Neutralization produces salt and water.', true],
        ['Products come before reactants.', false]
      ]
    }
  ],
  Biology: [
    {
      title: 'Cells & Human Body',
      terms: [
        ['Organelle', 'a specialized part inside a cell'],
        ['DNA', 'the molecule carrying genetic instructions'],
        ['Heart', 'the organ that pumps blood'],
        ['Neuron', 'a nerve cell carrying signals'],
        ['Enzyme', 'a protein that speeds reactions'],
        ['Digestion', 'breaking food into absorbable parts'],
        ['Circulation', 'movement of blood in the body'],
        ['Homeostasis', 'keeping internal conditions stable']
      ],
      statements: [
        ['DNA carries genetic information.', true],
        ['Neurons carry nerve signals.', true],
        ['Enzymes are consumed in every reaction.', false],
        ['The heart pumps blood.', true],
        ['Homeostasis means total instability.', false]
      ]
    },
    {
      title: 'Genetics & Evolution',
      terms: [
        ['Gene', 'a unit of heredity'],
        ['Trait', 'a characteristic passed to offspring'],
        ['Mutation', 'a change in DNA'],
        ['Natural selection', 'survival of the best adapted'],
        ['Species', 'a group that can interbreed'],
        ['Evolution', 'change of species over time'],
        ['Chromosome', 'a structure carrying genes'],
        ['Heredity', 'passing traits from parents to offspring']
      ],
      statements: [
        ['Genes are units of heredity.', true],
        ['Evolution happens in a single day.', false],
        ['Mutations always cause disease.', false],
        ['Natural selection favors adapted traits.', true],
        ['Chromosomes carry genes.', true]
      ]
    }
  ],
  Geography: [
    {
      title: 'Physical Geography',
      terms: [
        ['Latitude', 'lines running east to west measuring north/south'],
        ['Longitude', 'lines running north to south measuring east/west'],
        ['Climate zone', 'a region with similar climate'],
        ['Continent', 'a large continuous landmass'],
        ['Ocean', 'a vast body of salt water'],
        ['Plateau', 'a flat elevated area of land'],
        ['River basin', 'the land drained by a river'],
        ['Monsoon', 'a seasonal wind bringing rain']
      ],
      statements: [
        ['The equator has latitude 0°.', true],
        ['Longitude measures north and south.', false],
        ['Africa is a continent.', true],
        ['A plateau is always under water.', false],
        ['Monsoon winds bring seasonal rain.', true]
      ]
    }
  ],
  History: [
    {
      title: 'Civilizations & Nations',
      terms: [
        ['Empire', 'a group of states under one ruler'],
        ['Dynasty', 'a line of rulers from the same family'],
        ['Independence', 'freedom from foreign rule'],
        ['Colony', 'a land ruled by another country'],
        ['Revolution', 'a major overthrow of a system'],
        ['Archive', 'stored historical records'],
        ['Artifact', 'an object made by past humans'],
        ['Treaty', 'a formal agreement between states']
      ],
      statements: [
        ['An empire is ruled by many unrelated kings.', false],
        ['Independence means freedom from outside rule.', true],
        ['Artifacts are made by past people.', true],
        ['A treaty is an informal handshake only.', false],
        ['A dynasty is a line of rulers in one family.', true]
      ]
    }
  ],
  Economics: [
    {
      title: 'Basics of Economics',
      terms: [
        ['Supply', 'the amount offered for sale'],
        ['Demand', 'the wish to buy at a price'],
        ['Inflation', 'a general rise in prices'],
        ['Market', 'a place or system of exchange'],
        ['Budget', 'a plan of income and spending'],
        ['Profit', 'money earned above costs'],
        ['Scarcity', 'having less than needed'],
        ['Currency', 'the money used in a place']
      ],
      statements: [
        ['Inflation means prices generally rise.', true],
        ['Demand is the seller offering goods.', false],
        ['A budget plans income and spending.', true],
        ['Scarcity means unlimited resources.', false],
        ['Profit is revenue minus cost.', true]
      ]
    }
  ],
  Civics: [
    {
      title: 'Rights & Responsibilities',
      terms: [
        ['Citizenship', 'being a member of a country'],
        ['Right', 'something a person is entitled to'],
        ['Duty', 'something a person must do'],
        ['Constitution', 'the supreme law of a country'],
        ['Justice', 'treating people fairly by law'],
        ['Freedom', 'the right to act within the law'],
        ['Vote', 'to choose a representative'],
        ['Community', 'a group living together']
      ].filter(Boolean),
      statements: [
        ['Citizens have both rights and duties.', true],
        ['The constitution is the supreme law.', true],
        ['Freedom means doing anything without law.', false],
        ['Voting chooses representatives.', true],
        ['Justice means fair treatment by law.', true]
      ]
    }
  ]
};

function bank(subject) {
  if (CONTENT[subject]) return CONTENT[subject];
  if (subject === 'Mathematics' || subject === 'English' || subject === 'Science') return CONTENT[subject];
  return CONTENT.Science;
}

const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const pick = (arr, n) => shuffle(arr).slice(0, n);

export function subjectsFor(grade) {
  const b = BANDS[bandOf(grade)];
  return b.subjects.map(name => ({
    name,
    chapters: bank(name).map((c, i) => ({ ...c, index: i + 1 }))
  }));
}

export function buildAIIntro(subject, chapter, grade) {
  const lvl = grade === 'remedial' ? 'a supportive remedial pace' : `Grade ${grade} level`;
  return {
    welcome: `Welcome to ${subject} — ${chapter.title}. This lesson is prepared at ${lvl}.`,
    method: [
      'Read the introduction first and say the key terms aloud in your own language.',
      'Study one sub-section at a time; write a 3-line note after each one.',
      'Teach the idea back to yourself or a friend — if you can explain it, you know it.',
      'Finish with the 5-question check, then retry the questions you missed tomorrow.',
      'Revise the whole chapter before the 40-question chapter exam.'
    ],
    timetable: [
      { day: 'Monday', task: `Read introduction & sub-section 1 of ${chapter.title}`, mins: 30 },
      { day: 'Tuesday', task: 'Sub-section 2 + write short notes', mins: 30 },
      { day: 'Wednesday', task: 'Sub-section 3 + watch related video', mins: 35 },
      { day: 'Thursday', task: 'Practice exercises & 5-question quiz', mins: 25 },
      { day: 'Friday', task: 'Revise weak points from quiz', mins: 20 },
      { day: 'Saturday', task: 'Take the 40-question chapter exam', mins: 45 },
      { day: 'Sunday', task: 'Rest + light review of notes', mins: 15 }
    ]
  };
}

export function buildSubsections(chapter) {
  const t = chapter.terms;
  return [
    {
      title: '1. Big Picture',
      body: `In this chapter you will learn ${chapter.title.toLowerCase()}. ${t.slice(0, 3).map(([k, v]) => `${k} means ${v}`).join('; ')}. These ideas build on what you already know and will be used in every lesson that follows.`
    },
    {
      title: '2. Key Concepts',
      body: `Focus on these definitions: ${t.map(([k]) => k).join(', ')}. Cover the right column and repeat each definition from memory — then check yourself. Repetition in short sessions beats long cramming.`
    },
    {
      title: '3. Worked Examples',
      body: `Take each term and write your own example sentence or solved problem. For instance: "${t[0][0]} — ${t[0][1]}." Now create your own example for ${t[1][0]} and ${t[2][0]}. Compare with a classmate to check accuracy.`
    },
    {
      title: '4. Common Mistakes',
      body: `Students often confuse ${t[3][0]} with ${t[4][0]}. Remember: ${t[3][1]}, while ${t[4][1]}. Slow down and read the question twice before answering the quiz.`
    }
  ];
}

export function lessonQuiz(chapter) {
  const t = chapter.terms;
  const s = chapter.statements;
  const qs = [];
  qs.push({
    type: 'mcq',
    q: `Which option best defines "${t[0][0]}"?`,
    options: shuffle([t[0][1], t[1][1], t[2][1], t[3][1]]),
    answer: t[0][1]
  });
  qs.push({
    type: 'blank',
    q: `Complete: ${t[1][0]} means __________.`,
    answer: t[1][1].split(' ')[0]
  });
  qs.push({
    type: 'tf',
    q: s[0][0],
    answer: s[0][1] ? 'True' : 'False'
  });
  qs.push({
    type: 'mcq',
    q: `What is "${t[2][0]}"?`,
    options: shuffle([t[2][1], t[4][1], t[5][1], t[6][1]]),
    answer: t[2][1]
  });
  qs.push({
    type: 'mcq',
    q: `Choose the correct statement about ${chapter.title}:`,
    options: shuffle([s[1][0], s[2][0], s[3][0], s[4][0]]),
    answer: s[1][0]
  });
  return qs;
}

export function chapterExam(chapter) {
  const t = chapter.terms;
  const s = chapter.statements;
  const qs = [];

  for (let i = 0; i < 12; i++) {
    const term = t[i % t.length];
    const wrong = pick(t.filter(x => x[0] !== term[0]), 3).map(x => x[1]);
    qs.push({ type: 'mcq', q: `Define or identify: "${term[0]}"`, options: shuffle([term[1], ...wrong]), answer: term[1] });
  }
  for (let i = 0; i < 8; i++) {
    const term = t[i % t.length];
    qs.push({ type: 'blank', q: `__________ : ${term[1]}`, answer: term[0] });
  }
  for (let i = 0; i < 8; i++) {
    const a = t[i % t.length];
    qs.push({ type: 'tf', q: s[i % s.length][0], answer: s[i % s.length][1] ? 'True' : 'False' });
  }
  const matchPairs = t.slice(0, 6).map(([k, v]) => ({ left: k, right: v }));
  qs.push({
    type: 'matching',
    q: 'Match each term on the left with its meaning on the right (set 1).',
    pairs: matchPairs,
    options: shuffle(matchPairs.map(p => p.right)),
    answers: matchPairs.map(p => p.right)
  });
  const matchPairs2 = t.slice(2, 8).map(([k, v]) => ({ left: k, right: v }));
  qs.push({
    type: 'matching',
    q: 'Match each term on the left with its meaning on the right (set 2).',
    pairs: matchPairs2,
    options: shuffle(matchPairs2.map(p => p.right)),
    answers: matchPairs2.map(p => p.right)
  });
  for (let i = 0; i < 10; i++) {
    const a = t[i % t.length];
    qs.push({
      type: 'open',
      q: `Explain in 2-3 sentences: what is "${a[0]}" and why does it matter in ${chapter.title}?`,
      answer: a[1]
    });
  }
  return qs.slice(0, 40);
}

export function gradeSubjects(grade) {
  return subjectsFor(grade);
}

export { gradeLabel, bandOf };