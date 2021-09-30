'use strict';

import {initializeApp} from 'https://www.gstatic.com/firebasejs/9.0.2/firebase-app.js';
import {getDatabase, ref, push} from 'https://www.gstatic.com/firebasejs/9.0.2/firebase-database.js';

initializeApp({
  apiKey: 'AIzaSyDv3aFlRfzXM8MoWCZRiM8p4JXBhN0Xpew',
  appId: '1:792962102421:web:e1fb2833c42a59914bd79c',
  authDomain: 'othello-logger.firebaseapp.com',
  databaseURL: 'https://othello-logger-default-rtdb.firebaseio.com',
  messagingSenderId: '792962102421',
  projectId: 'othello-logger',
  storageBucket: 'othello-logger.appspot.com'
});
const database = getDatabase();

const automode = document.querySelector('#automode');
const npcmode = document.querySelector('#npcmode');
const interval = document.querySelector('#interval');
const board = document.querySelector('#board');
const log = document.querySelector('#log');

const OPPONENT_TURN_STATUS = location.search.includes('reverse');
const PROPONENT_TURN_STATUS = !OPPONENT_TURN_STATUS;

const CELL_POINTS = [
  [ 30, -12,  0, -1, -1,  0, -12,  30],
  [-12, -15, -3, -3, -3, -3, -15, -12],
  [  0,  -3,  0, -1, -1,  0,  -3,   0],
  [ -1,  -3, -1, -1, -1, -1,  -3,  -1],
  [ -1,  -3, -1, -1, -1, -1,  -3,  -1],
  [  0,  -3,  0, -1, -1,  0,  -3,   0],
  [-12, -15, -3, -3, -3, -3, -15, -12],
  [ 30, -12,  0, -1, -1,  0, -12,  30]
];
/**
[
  [100, -40, 20,  5,  5, 20, -40, 100],
  [-40, -80, -1, -1, -1, -1, -80, -40],
  [ 20,  -1,  5,  1,  1,  5,  -1,  20],
  [  5,  -1,  1,  0,  0,  1,  -1,   5],
  [  5,  -1,  1,  0,  0,  1,  -1,   5],
  [ 20,  -1,  5,  1,  1,  5,  -1,  20],
  [-40, -80, -1, -1, -1, -1, -80, -40],
  [100, -40, 20,  5,  5, 20, -40, 100]
]
*/
const CURRENT_BOARD = [];
const PATTERN = [];

const inverseTurn = () => turn = !turn;
const sleep = milliseconds => new Promise(resolve => setTimeout(() => resolve(), milliseconds));
const statusIsNull = ({status}) => status === null;
const statusIsNotNull = ({status}) => status !== null;
const statusIsOpponent = ({status}) => status === OPPONENT_TURN_STATUS;
const statusIsProponent = ({status}) => status === PROPONENT_TURN_STATUS;
const turnIsOpponent = () => turn === OPPONENT_TURN_STATUS;
const turnIsProponent = () => turn === PROPONENT_TURN_STATUS;

let turn = null;
let milliseconds = 100;
let isAutoMode = false;
let isNPCMode = false;

(function main () {
  if (!confirm('このゲームでは、ゲームの終了時に以下の情報をサーバーへアップロードします。',
               '・ゲームの結果',
               '・ゲーム終了時点での、各プレイヤーのセルの数',
               '・セルがどの順序で配置されたかの履歴',
               '情報のアップロードに同意する場合は「OK」を選択してください。')) {
    return confirm('情報のアップロードが許可されませんでした。',
                   '初期化処理は実行されず、ゲームは動作しません。',
                   '選択しなおしますか？') ? main() : alert('選択しなおす場合は、ページを再読み込みしてください。');
  }
  initBoard();
  turn = true;
  automode.addEventListener('change', onChange, false);
  npcmode.addEventListener('change', onChange, false);
  interval.addEventListener('change', onChange, false);
})();

async function autoPlay () {
  // Maximum call stack size exceeded対策
  await sleep(milliseconds);
  let validCells = getValidCells();
  // プレイヤーAの置けるセルが0の場合はターンをプレイヤーBに渡す
  if (validCells.length === 0) {
    printLog(`${turnIsProponent() ? '黒' : '白'}の置けるセルがありません。`,
             `${turnIsProponent() ? '白' : '黒'}にターンを渡します。`);
    inverseTurn();
    // NPC/PvPモードはここで終了
    if (!isAutoMode) return;
    // プレイヤーBの置けるセルの数を取得
    validCells = getValidCells();
    // プレイヤーBの置けるセルが0の場合は終了する
    if (validCells.length === 0) {
      return printLog('置けるセルがありません。',
                      'ゲームを終了します。') || finish();
    }
  }
  validCells.sort((a, b) => b.point - a.point)[0].cell.click();
}

function createCell (rowIndex, columnIndex) {
  const div = document.createElement('div');
  div.style.gridRow = rowIndex + 1;
  div.style.gridColumn = columnIndex + 1;
  div.className = 'item';
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.rowIndex = rowIndex;
  cell.columnIndex = columnIndex;
  cell.addEventListener('click', onClick, false);
  div.appendChild(cell);
  return {cell, div};
}

function finish () {
  const cells = CURRENT_BOARD.flat();
  const black = cells.filter(statusIsProponent).length;
  const white = cells.filter(statusIsOpponent).length;
  printLog(`黒: ${black}`, `白: ${white}`);
  // オートモードではデータを収集しない
  if (isAutoMode) return;
  const pattern = PATTERN.map(p => p.join('-')).join('>');
  const result = {black, white};
  const winner = black === white ? 'draw' : black > white ? 'black' : 'white';
  push(ref(database, 'othello-logger'), {pattern, result, winner});
}

function getObtainableCells (row, column) {
  const cells = [];
  for (let x = -1; x <= 1; x ++) {
    for (let y = -1; y <= 1; y ++) {
      if (x === 0 && y === 0) continue;
      cells.push(...search(row, column, x, y));
    }
  }
  return cells;
}

function getValidCells () {
  const cells = [];
  let obtainableCells, point;
  CURRENT_BOARD.flat().forEach((cell, index) => {
    obtainableCells = getObtainableCells(~~(index / 8), index % 8);
    point = cell.point + obtainableCells.reduce((sum, {point}) => sum + point, 0);
    if (obtainableCells.length > 0) cells.push({point, cell});
  });
  return cells.filter(({cell}) => statusIsNull(cell));
}

function initBoard () {
  CURRENT_BOARD.length = 0;
  for (let row = 0; row < 8; row ++) {
    CURRENT_BOARD[row] = [];
    for (let column = 0; column < 8; column ++) {
      const {cell, div} = createCell(row, column);
      board.appendChild(div);
      cell.status = null;
      cell.point = CELL_POINTS[row][column];
      CURRENT_BOARD[row][column] = cell;
    }
  }
  CURRENT_BOARD[3][3].status = true;
  CURRENT_BOARD[3][4].status = false;
  CURRENT_BOARD[4][3].status = false;
  CURRENT_BOARD[4][4].status = true;
  CURRENT_BOARD.flat().filter(statusIsNotNull).forEach(cell => cell.className = `cell ${statusIsProponent(cell) ? 'black' : 'white'}`);
}

function onClick (event) {
  const {rowIndex, columnIndex} = this;
  // そのセルが置けるセルなのか判定
  const cell = CURRENT_BOARD[rowIndex][columnIndex];
  if (!statusIsNull(cell)) return;
  // そのセルで得られるセルの個数を判定
  const cells = getObtainableCells(rowIndex, columnIndex);
  if (cells.length === 0) return;
  // 得られるセル全ての色をターンに応じて変更する
  cells.push(cell);
  cells.forEach(cell => {
    cell.className = `cell ${turn ? 'black' : 'white'}`;
    cell.status = statusIsNull(cell) ? turn : !cell.status;
  });
  // パターンを保存する
  PATTERN.push([rowIndex, columnIndex]);
  // 全てのセルが配置済みか判定
  if (!CURRENT_BOARD.flat().find(statusIsNull)) {
    return printLog('全てのセルが埋まりました。') || finish();
  }
  // 相手にターンを渡す
  inverseTurn();
  // オートモードまたはNPCモードの相手ターンの場合、自動で次のターンを実行する
  if (isAutoMode || isNPCMode && turnIsOpponent()) autoPlay();
  // NPCモードの自分のターンまたはPvPモードの場合、置けるセルが無ければターンを相手に渡す
  else if (getValidCells().length === 0) {
    inverseTurn();
    // NPCモードの相手ターンの場合、自動で次のターンを実行する
    if (isNPCMode && turnIsOpponent()) autoPlay();
  }
}

function onChange (event) {
  switch (this) {
    case automode:
    case npcmode:
    case pvpmode:
      isAutoMode = this === automode;
      isNPCMode = this === npcmode;
      if (isAutoMode || isNPCMode && turnIsOpponent()) autoPlay();
      break;
    case interval:
      milliseconds = parseInt(interval.value);
      break;
  }
}

function printLog (...messages) {
  const li = document.createElement('li');
  li.innerHTML = messages.join('<br />');
  log.appendChild(li);
}

function search (row, column, dx, dy) {
  const cells = [];
  let flag = false, cell;
  loop: while (true) {
    row += dx;
    column += dy;
    if (row < 0 || row > 7 || column < 0 || column > 7) break;
    cell = CURRENT_BOARD[row][column];
    switch (cell.status) {
      case null:
        break loop;
      case PROPONENT_TURN_STATUS:
        flag = true;
        break loop;
      case OPPONENT_TURN_STATUS:
        cells.push(cell);
        break;
    }
  }
  return flag ? cells : [];
}
