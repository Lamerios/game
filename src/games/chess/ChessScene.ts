import { Chess, type Square } from 'chess.js';
import Phaser from 'phaser';
import { phrase, type PhraseId } from '../../core/phrases';
import { FONT, H, W } from '../../scenes/ui';
import type { HintStep } from '../common/attempt';
import { MiniGameScene } from '../common/MiniGameScene';
import { generateChess, type ChessTask } from './generator';

const CELL = 80;
const BX = 60;
const BY = (H - 8 * CELL) / 2;
const FILES = 'abcdefgh';

export class ChessScene extends MiniGameScene {
  private puzzle!: ChessTask;
  private board!: Chess;
  private selected?: Square;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('Chess');
  }

  protected itemId() {
    return this.puzzle.itemId;
  }

  protected instruction() {
    return phrase(this.puzzle.goal);
  }

  create() {
    this.puzzle = generateChess(this.task.level, this.rng);
    this.board = new Chess(this.puzzle.fen);
    this.selected = undefined;
    this.cameras.main.setBackgroundColor(0x264653);
    this.add.image(W / 2, H / 2, 'bg-beach').setDisplaySize(W, H);
    this.add.rectangle(BX - 14, BY - 14, 8 * CELL + 28, 8 * CELL + 28, 0x7a4a24).setOrigin(0).setStrokeStyle(6, 0x2b2d42);
    this.add.rectangle(BX + 8 * CELL + 30, 40, W - (BX + 8 * CELL + 50), H - 80, 0x264653, 0.85).setOrigin(0).setStrokeStyle(4, 0xffd166);
    this.add.image(BX + 8 * CELL + 120, 200, 'char-general').setDisplaySize(150, 150);
    this.add.text(BX + 8 * CELL + 50, 80, 'Форт Ладья', { fontFamily: FONT, fontSize: '44px', color: '#ffffff' });
    this.add.text(BX + 8 * CELL + 50, 330, this.instruction().show, { fontFamily: FONT, fontSize: '32px', color: '#e9c46a', wordWrap: { width: W - (BX + 8 * CELL + 90) } });
    this.add.text(BX + 8 * CELL + 50, H - 120, 'Ты играешь белыми', { fontFamily: FONT, fontSize: '26px', color: '#ffffff' });
    this.layer = this.add.container(0, 0);
    this.draw();
    this.addParrot();
    this.say(this.instruction());
  }

  private squareXY(s: Square): [number, number] {
    const f = FILES.indexOf(s[0]!);
    const r = Number(s[1]) - 1;
    return [BX + f * CELL, BY + (7 - r) * CELL];
  }

  private draw(highlight: Square[] = [], marks: Square[] = []) {
    this.layer.removeAll(true);
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        const s = `${FILES[f]}${r + 1}` as Square;
        const [x, y] = this.squareXY(s);
        const light = (f + r) % 2 === 1;
        let color = light ? 0xf0d9b5 : 0xb58863;
        if (s === this.selected) color = 0x90be6d;
        if (highlight.includes(s)) color = 0xf9c74f;
        const cell = this.add.rectangle(x, y, CELL, CELL, color).setOrigin(0).setInteractive();
        cell.on('pointerup', () => this.tap(s));
        this.layer.add(cell);
        if (marks.includes(s)) this.layer.add(this.add.circle(x + CELL / 2, y + CELL / 2, 12, 0x2a9d8f, 0.8));
        const p = this.board.get(s);
        if (p) {
          this.layer.add(this.add.image(x + CELL / 2, y + CELL / 2, `piece-${p.color}${p.type}`).setDisplaySize(CELL - 6, CELL - 6));
        }
      }
    }
  }

  private legalTargets(from: Square): Square[] {
    return this.board.moves({ square: from, verbose: true }).map((m) => m.to);
  }

  private tap(s: Square) {
    if (this.locked) return;
    const p = this.board.get(s);
    if (p && p.color === 'w') {
      this.selected = s;
      // Show legal squares on L1–L3 only; later levels the child finds them.
      this.draw([], this.task.level <= 3 ? this.legalTargets(s) : []);
      return;
    }
    if (!this.selected) return;
    const from = this.selected;
    if (!this.legalTargets(from).includes(s)) {
      this.say(phrase('chess.illegal'));
      return;
    }
    const mv = `${from}-${s}`;
    this.selected = undefined;
    // Only a move from the list of solutions finishes the task, also after the
    // solution was shown: then the child repeats it on the board themselves.
    if (this.puzzle.correct.includes(mv)) {
      this.locked = true;
      this.board.move({ from, to: s, promotion: 'q' });
      this.draw([from, s]);
      if (this.attempt.solutionShown) this.say(phrase('chess.followed'));
      void this.finish();
      return;
    }
    if (this.attempt.solutionShown) {
      this.say(phrase('chess.follow'));
      this.showMove();
      return;
    }
    this.showConsequence(from, s);
  }

  /** Highlights the solution's piece and its target square; the child makes the move. */
  private showMove() {
    const [from, to] = this.puzzle.correct[0]!.split('-') as [Square, Square];
    this.selected = from;
    this.draw([from, to], [to]);
  }

  /** Wrong but legal move: play it, show black's reply, then take it back (SDD 3.4). */
  private showConsequence(from: Square, to: Square) {
    this.locked = true;
    const before = this.board.fen();
    this.board.move({ from, to, promotion: 'q' });
    this.draw([from, to]);
    const reply = this.board.moves({ verbose: true }).find((m) => m.to === to && m.captured) ?? this.board.moves({ verbose: true }).find((m) => m.captured);
    this.time.delayedCall(700, () => {
      if (reply) {
        this.board.move(reply);
        this.draw([reply.from, reply.to]);
        this.say(phrase('chess.reply'));
      } else {
        this.say(phrase('chess.unsolved'));
      }
      // Let the line finish, so the hint that follows doesn't cut it off.
      void this.afterSpeech(1600).then(() => {
        if (!this.sys.isActive()) return;
        this.board = new Chess(before);
        this.draw();
        this.locked = false;
        this.wrong();
      });
    });
  }

  protected showHint(step: HintStep) {
    const [from, to] = this.puzzle.correct[0]!.split('-') as [Square, Square];
    if (step === 1) {
      this.say(this.instruction());
    } else if (step === 2) {
      this.say(phrase(`chess.tip.${this.puzzle.level}` as PhraseId));
    } else if (step === 3) {
      this.say(phrase('chess.hint.piece'));
      this.selected = from;
      this.draw([from], this.legalTargets(from));
    } else {
      // Show the move, take it back, and let the child make it: the task is
      // never counted as solved by a move the child didn't make.
      this.locked = true;
      this.selected = undefined;
      const before = this.board.fen();
      this.say(phrase('chess.solution'));
      this.board.move({ from, to, promotion: 'q' });
      this.draw([from, to]);
      this.time.delayedCall(1800, () => {
        if (!this.sys.isActive()) return;
        this.board = new Chess(before);
        this.showMove();
        this.locked = false;
      });
    }
  }
}
