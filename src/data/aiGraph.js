export const END = '__end__';

// Minimal LangGraph-style state graph: named nodes (state reducers) wired with
// static or conditional edges evaluated on (state, event).
export function createGraph(entry = 'start') {
  const nodes = {};
  const edges = {};
  const conds = {};

  const api = {
    entry,
    nodes,
    addNode(key, fn) { nodes[key] = fn || (s => s); return api; },
    addEdge(from, to) { edges[from] = to; return api; },
    addConditionalEdges(from, selector) { conds[from] = selector; return api; },

    // Single transition: resolve the outgoing edge of `current`, run the target node.
    next(current, state, event) {
      const s = { ...state, event };
      const key = conds[current] ? conds[current](s, event) : edges[current];
      if (!key || key === END || !nodes[key]) return { node: END, state: s };
      const patch = nodes[key](s) || {};
      return { node: key, state: { ...s, ...patch } };
    },

    // Full run from entry until END (LangGraph invoke-style, for batch flows).
    async invoke(initialState, { maxSteps = 32 } = {}) {
      let state = { ...initialState };
      let current = entry;
      const path = [];
      let guard = 0;
      while (current && current !== END && guard++ < maxSteps) {
        path.push(current);
        const patch = (await nodes[current](state)) || {};
        state = { ...state, ...patch };
        current = conds[current] ? conds[current](state, state.event) : (edges[current] || END);
      }
      return { node: current, state, path };
    }
  };
  return api;
}

// Adaptive lesson workflow: quiz score < 3/5 routes the student through a
// remediation node before the chapter exam.
export const lessonGraph = createGraph('welcome')
  .addNode('welcome', () => ({ step: 0, review: false }))
  .addNode('lessons', s => ({ step: 1, review: !!s.review }))
  .addNode('lesson_quiz', () => ({ step: 2 }))
  .addNode('remediate', s => ({ step: 1, review: true, lastScore: s.lastScore || 0 }))
  .addNode('chapter_exam', () => ({ step: 3 }))
  .addNode('complete', () => ({ step: 4 }))
  .addConditionalEdges('welcome', (_s, e) => (e === 'begin' ? 'lessons' : 'welcome'))
  .addConditionalEdges('lessons', (_s, e) => (e === 'next' ? 'lesson_quiz' : e === 'back' ? 'welcome' : 'lessons'))
  .addConditionalEdges('lesson_quiz', (s, e) => {
    if (e === 'quiz-done') return (s.lastScore || 0) >= 3 ? 'chapter_exam' : 'remediate';
    return e === 'back' ? 'lessons' : 'lesson_quiz';
  })
  .addConditionalEdges('remediate', (_s, e) => {
    if (e === 'review-done') return 'chapter_exam';
    if (e === 'next') return 'lesson_quiz';
    return e === 'back' ? 'lessons' : 'remediate';
  })
  .addConditionalEdges('chapter_exam', (_s, e) => (e === 'exam-done' ? 'complete' : e === 'back' ? 'lesson_quiz' : 'chapter_exam'))
  .addConditionalEdges('complete', () => 'complete');

export const LESSON_WORKFLOW = [
  '🧭 welcome', '📖 lessons', '❓ lesson quiz', '🔁 remediate', '📋 chapter exam', '🎉 complete'
];

// Payment / access-code workflow used by the Store redeem flow.
export const redeemGraph = createGraph('validate')
  .addNode('validate', s => ({ ...s, stage: 'validate' }))
  .addNode('reject', s => ({ ...s, stage: 'error' }))
  .addNode('unlock_item', s => ({ ...s, stage: 'ok', unlocked: 'item' }))
  .addNode('unlock_full', s => ({ ...s, stage: 'ok', unlocked: 'full' }))
  .addConditionalEdges('validate', (s, e) => {
    if (e !== 'redeem') return 'validate';
    if (!s.found || s.used) return 'reject';
    return s.plan === 'full' ? 'unlock_full' : 'unlock_item';
  })
  .addConditionalEdges('reject', (_s, e) => (e === 'redeem' ? 'validate' : 'reject'))
  .addConditionalEdges('unlock_full', () => 'unlock_full')
  .addConditionalEdges('unlock_item', () => 'unlock_item');
