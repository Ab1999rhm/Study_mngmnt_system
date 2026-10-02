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
