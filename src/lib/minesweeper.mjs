export const levels = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 12, cols: 9, mines: 20 },
  hard: { rows: 16, cols: 9, mines: 35 },
};

export function createGame(level = 'easy', random = Math.random) {
  const { rows, cols, mines } = levels[level];
  const cells = Array.from({ length: rows * cols }, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false }));
  let status = 'ready';
  let revealed = 0;
  let flags = 0;
  let exploded = -1;

  function neighbors(index) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const result = [];
    for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y++) {
      for (let x = Math.max(0, col - 1); x <= Math.min(cols - 1, col + 1); x++) {
        if (y * cols + x !== index) result.push(y * cols + x);
      }
    }
    return result;
  }

  function placeMines(first) {
    const safe = new Set([first, ...neighbors(first)]);
    const candidates = cells.map((_, i) => i).filter(i => !safe.has(i));
    for (let i = 0; i < mines; i++) {
      const choice = i + Math.floor(random() * (candidates.length - i));
      [candidates[i], candidates[choice]] = [candidates[choice], candidates[i]];
      cells[candidates[i]].mine = true;
    }
    cells.forEach((cell, i) => { cell.adjacent = neighbors(i).filter(n => cells[n].mine).length; });
    status = 'playing';
  }

  function reveal(index) {
    const cell = cells[index];
    if (!cell || cell.flagged || cell.revealed || status === 'won' || status === 'lost') return;
    if (status === 'ready') placeMines(index);
    if (cell.mine) {
      cell.revealed = true;
      exploded = index;
      status = 'lost';
      return;
    }
    const pending = [index];
    while (pending.length) {
      const next = pending.pop();
      const current = cells[next];
      if (current.revealed || current.flagged || current.mine) continue;
      current.revealed = true;
      revealed++;
      if (current.adjacent === 0) pending.push(...neighbors(next));
    }
    if (revealed === cells.length - mines) {
      status = 'won';
      cells.forEach(c => { if (c.mine) c.flagged = true; });
      flags = mines;
    }
  }

  function toggleFlag(index) {
    const cell = cells[index];
    if (!cell || cell.revealed || status === 'won' || status === 'lost') return;
    if (!cell.flagged && flags === mines) return;
    cell.flagged = !cell.flagged;
    flags += cell.flagged ? 1 : -1;
  }

  return {
    rows, cols, mines, cells, reveal, toggleFlag,
    get status() { return status; },
    get flags() { return flags; },
    get revealed() { return revealed; },
    get exploded() { return exploded; },
  };
}
