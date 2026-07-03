// @ts-check
// Minimal line-level text diff (LCS) for the Docs CMS edit-history view.
//
// Given two versions of a markdown body it returns a flat op list the UI renders
// as removed / added / unchanged lines — so an editor can see exactly what a
// revision changed before restoring it, instead of eyeballing two full texts.
// Pure (string in, ops out) and dependency-free, so it's unit-tested directly.

/**
 * @typedef {{ type: 'eq' | 'add' | 'del', text: string }} DiffOp
 */

/**
 * Line-level diff of two texts via longest-common-subsequence. `del` lines are
 * present in `oldText` only, `add` lines in `newText` only, `eq` lines in both.
 * @param {string} oldText
 * @param {string} newText
 * @returns {DiffOp[]}
 */
export function diffLines(oldText, newText) {
  // A truly empty body is zero lines (not one empty line), so diffing against
  // empty content shows pure additions/removals instead of a phantom blank line.
  const toLines = (t) => {
    const s = String(t ?? '');
    return s === '' ? [] : s.split('\n');
  };
  const a = toLines(oldText);
  const b = toLines(newText);
  const n = a.length;
  const m = b.length;

  // dp[i][j] = LCS length of a[i:] and b[j:]. Filled bottom-up.
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  /** @type {DiffOp[]} */
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'eq', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', text: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'del', text: a[i++] });
  while (j < m) ops.push({ type: 'add', text: b[j++] });
  return ops;
}

/**
 * Added / removed line counts for a diff — drives a "+3 −1" header.
 * @param {DiffOp[]} ops
 * @returns {{ add: number, del: number }}
 */
export function diffStat(ops) {
  let add = 0;
  let del = 0;
  for (const o of ops) {
    if (o.type === 'add') add++;
    else if (o.type === 'del') del++;
  }
  return { add, del };
}
