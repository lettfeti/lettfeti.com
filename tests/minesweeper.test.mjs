import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, levels } from '../src/lib/minesweeper.mjs';

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test('every level fits nine columns and protects every possible first move', () => {
  for (const [level, config] of Object.entries(levels)) {
    assert.equal(config.cols, 9);
    for (let first = 0; first < config.rows * config.cols; first++) {
      const game = createGame(level, seededRandom(first));
      game.reveal(first);
      assert.notEqual(game.status, 'lost');
      assert.equal(game.cells[first].revealed, true);
      assert.equal(game.cells[first].adjacent, 0);
      assert.equal(game.cells.filter(c => c.mine).length, config.mines);
      assert.equal(game.cells.filter(c => c.mine && c.revealed).length, 0);
      game.cells.forEach((cell, index) => {
        const row = Math.floor(index / config.cols);
        const col = index % config.cols;
        const nearby = game.cells.filter((neighbor, other) => neighbor.mine && other !== index
          && Math.abs(Math.floor(other / config.cols) - row) <= 1
          && Math.abs(other % config.cols - col) <= 1).length;
        assert.equal(cell.adjacent, nearby);
      });
    }
  }
});

test('flags do not start a game, prevent revealing, and are limited to mine count', () => {
  const game = createGame('easy', seededRandom(42));
  for (let i = 0; i <= game.mines; i++) game.toggleFlag(i);
  assert.equal(game.flags, game.mines);
  assert.equal(game.cells[game.mines].flagged, false);
  game.reveal(0);
  assert.equal(game.status, 'ready');
  assert.equal(game.cells[0].revealed, false);
  game.toggleFlag(0);
  game.reveal(0);
  assert.equal(game.status, 'playing');
  assert.equal(game.cells[1].revealed, false);
  const flags = game.flags;
  game.toggleFlag(0);
  assert.equal(game.flags, flags);
});

test('revealing all safe cells wins without requiring flags and freezes the board', () => {
  for (const level of Object.keys(levels)) {
    const game = createGame(level, seededRandom(99));
    game.reveal(0);
    game.cells.forEach((cell, i) => { if (!cell.mine) game.reveal(i); });
    assert.equal(game.status, 'won');
    assert.equal(game.revealed, game.cells.length - game.mines);
    assert.equal(game.flags, game.mines);
    assert.ok(game.cells.filter(c => c.mine).every(c => c.flagged));
    const mine = game.cells.findIndex(c => c.mine);
    game.toggleFlag(mine);
    game.reveal(mine);
    assert.equal(game.status, 'won');
    assert.equal(game.cells[mine].flagged, true);
  }
});

test('hitting a mine loses and freezes further reveals and flags', () => {
  const game = createGame('hard', seededRandom(7));
  game.reveal(0);
  const mine = game.cells.findIndex(c => c.mine);
  game.reveal(mine);
  assert.equal(game.status, 'lost');
  assert.equal(game.exploded, mine);
  const snapshot = JSON.stringify(game.cells);
  game.cells.forEach((_, i) => { game.reveal(i); game.toggleFlag(i); });
  assert.equal(JSON.stringify(game.cells), snapshot);
});

test('new games reset independently and ignore invalid cell indexes', () => {
  const first = createGame();
  first.reveal(40);
  const fresh = createGame();
  fresh.reveal(-1);
  fresh.toggleFlag(1000);
  assert.equal(fresh.status, 'ready');
  assert.equal(fresh.revealed, 0);
  assert.equal(fresh.flags, 0);
  assert.ok(fresh.cells.every(c => !c.mine && !c.revealed && !c.flagged));
});
