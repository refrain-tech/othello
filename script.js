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

const currentBoard = [];
const pattern = [];
const points = [
  [100, -40, 20,  5,  5, 20, -40, 100],
  [-40, -80, -1, -1, -1, -1, -80, -40],
  [ 20,  -1,  5,  1,  1,  5,  -1,  20],
  [  5,  -1,  1,  0,  0,  1,  -1,   5],
  [  5,  -1,  1,  0,  0,  1,  -1,   5],
  [ 20,  -1,  5,  1,  1,  5,  -1,  20],
  [-40, -80, -1, -1, -1, -1, -80, -40],
  [100, -40, 20,  5,  5, 20, -40, 100]
];

let turn = null;
let milliseconds = 100;
let auto = false;
let npc = false;
let debug = false;

const sleep = milliseconds => new Promise(resolve => setTimeout(() => resolve(), milliseconds));

(function main () {
  if (!confirm('このゲームでは、ゲームの終了時に以下の情報をサーバーへアップロードします。\n' +
               '・どちらのプレイヤーが勝利したか、又は引き分けになったか\n' +
               '・ゲーム終了時点での、各プレイヤーのセルの数\n' +
               '・セルがどの順序で配置されたかの履歴\n' +
               '情報のアップロードに同意する場合は「OK」を選択してください。')) {
    return confirm('情報のアップロードが許可されませんでした。\n' +
                   '初期化処理は実行されず、ゲームは動作しません。\n' +
                   '選択しなおしますか？') ? main() : alert('選択しなおす場合は、ページを再読み込みしてください。');
  }
  
  currentBoard.length = 0;
  for (let row = 0; row < 8; row ++) {
    currentBoard[row] = [];
    for (let column = 0; column < 8; column ++) {
      const {cell, div} = createCell(row, column);
      board.appendChild(div);
      cell.status = null;
      cell.point = points[row][column];
      currentBoard[row][column] = cell;
    }
  }
  currentBoard[3][3].status = true;
  currentBoard[3][4].status = false;
  currentBoard[4][3].status = false;
  currentBoard[4][4].status = true;
  
  turn = true;
  
  automode.addEventListener('change', onChange, false);
  npcmode.addEventListener('change', onChange, false);
  interval.addEventListener('change', onChange, false);
  
  const array = currentBoard.flat();
  array.filter(({status}) => status !== null).forEach(cell => cell.className = `cell ${cell.status ? 'black' : 'white'}`);
  
  if (debug) array.forEach(cell => cell.textContent = points[cell.rowIndex][cell.columnIndex]);
})();

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

function onClick (event) {
  const {rowIndex, columnIndex} = this;
  
  const cell = currentBoard[rowIndex][columnIndex];
  if (cell.status !== null) return;

  const cells = getObtainableCells(rowIndex, columnIndex);
  if (cells.length === 0) return;

  cells.push(cell);
  cells.forEach(cell => {
    cell.className = `cell ${turn ? 'black' : 'white'}`;
    cell.status = cell.status === null ? turn : !cell.status;
  });
  
  const array = currentBoard.flat();
  if (debug) {
    array.forEach(cell => cell.textContent = points[cell.rowIndex][cell.columnIndex]);
    getValidCells().forEach(({cell, point}) => cell.textContent = point);
  }
  
  pattern.push([rowIndex, columnIndex]);

  if (array.find(({status}) => status === null) === undefined) {
    printLog('全てのセルが埋まりました。');
    return finish();
  }

  turn = !turn;
  
  if (auto || (npc && !turn)) autoPlay();
  // 自分のターンであり、取れるセルが0個の場合は相手にターンを渡す
  else if (getValidCells().length === 0) turn = !turn;
}

function onChange (event) {
  switch (this) {
    case automode:
    case npcmode:
    case pvpmode:
      auto = this === automode;
      npc = this === npcmode;
      if (auto) autoPlay();
      break;
    case interval:
      milliseconds = parseInt(interval.value);
      break;
  }
}

function getObtainableCells (row, column) {
  const cells = [];
  for (let x = -1; x <= 1; x ++) {
    for (let y = -1; y <= 1; y ++) {
      if (x !== 0 || y !== 0) cells.push(...search(row, column, x, y));
    }
  }
  return cells;
}

function search (row, column, dx, dy) {
  let flag = false, cell;
  const cells = [];

  loop: while (true) {
    row += dx;
    column += dy;

    if (row < 0 || row > 7 || column < 0 || column > 7) break;

    cell = currentBoard[row][column];
    switch (cell.status) {
      case null:
        break loop;
      case turn:
        flag = true;
        break loop;
      case !turn:
        cells.push(cell);
        break;
      default:
        break;
    }
  }

  return flag ? cells : [];
}

function printLog (message) {
  const li = document.createElement('li');
  li.innerHTML = message.replace('\n', '<br />');
  log.appendChild(li);
}

function finish () {
  const array = currentBoard.flat();
  const black = array.filter(({status}) => status).length;
  const white = array.filter(({status}) => !status).length;
  printLog(`黒: ${black}
白: ${white}`);
  
  if (auto) return;
  
  push(ref(database, 'othello-logger'), {
    pattern,
    result: {black, white},
    winner: black === white ? 'draw' : black > white ? 'black' : 'white'
  });
}

async function autoPlay () {
  // Maximum call stack size exceeded対策
  await sleep(milliseconds);

  let validCells = getValidCells();
  // プレイヤーAの置けるセルが0の場合はターンをプレイヤーBに渡す
  if (validCells.length === 0) {
    printLog(`${turn ? '黒' : '白'}の置けるセルがありません。
${turn ? '白' : '黒'}にターンを渡します。`);
    turn = !turn;
    
    // NPC/PvPモードはここで終了
    if (!auto) return;
    
    // プレイヤーBの置けるセルの数を取得
    validCells = getValidCells();

    // プレイヤーBの置けるセルが0の場合は終了する
    if (validCells.length === 0) {
      printLog(`置けるセルがありません。
ゲームを終了します。`);
      return finish();
    }
  }
  // プレイヤーAまたはBの置けるセルの中で、最も得点の得られるセルをクリックする
  valid.sort((a, b) => b.point - a.point)[0].cell.click();
}

function getValidCells () {
  const cells = [];
  let obtainableCells, point;
  currentBoard.flat().forEach((cell, index) => {
    obtainableCells = getObtainableCells(~~(index / 8), index % 8);
    point = cell.point + obtainableCells.reduce((accumulator, {point}) => accumulator + point, 0);
    if (obtainableCells.length > 0) cells.push({point, cell});
  });

  return cells.filter(({cell: {status}}) => status === null);
}
