'use strict';
const automode = document.querySelector('#automode');
const npcmode = document.querySelector('#npcmode');
const interval = document.querySelector('#interval');
const board = document.querySelector('#board');
const log = document.querySelector('#log');
const currentBoard = [];
const calc = [];
const values = [
  [100, -40, 20, 5, 5, 20, -40, 100],
  [-40, -80, -1, -1, -1, -1, -80, -40],
  [20, -1, 5, 1, 1, 5, -1, 20],
  [5, -1, 1, 0, 0, 1, -1, 5],
  [5, -1, 1, 0, 0, 1, -1, 5],
  [20, -1, 5, 1, 1, 5, -1, 20],
  [-40, -80, -1, -1, -1, -1, -80, -40],
  [100, -40, 20, 5, 5, 20, -40, 100]
];

automode.addEventListener('change', onChange, false);
npcmode.addEventListener('change', onChange, false);
interval.addEventListener('change', onChange, false);

const sleep = async (milliseconds) => new Promise(resolve => setTimeout(() => resolve(), milliseconds));

let turn = null;
let milliseconds = 1;
let auto = false;
let npc = false;
let debug = true;

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

function main () {
  currentBoard.length = 0;
  for (let row = 0; row < 8; row ++) {
    currentBoard[row] = [];
    for (let column = 0; column < 8; column ++) {
      const {cell, div} = createCell(row, column);
      board.appendChild(div);
      cell.status = null;
      cell.point = values[row][column];
      currentBoard[row][column] = cell;
    }
  }
  currentBoard[3][3].status = true;
  currentBoard[3][4].status = false;
  currentBoard[4][3].status = false;
  currentBoard[4][4].status = true;
  turn = true;
  currentBoard.flat().flat().filter(({status}) => status !== null).forEach(cell => {
    cell.className = `cell ${cell.status ? 'black' : 'white'}`;
    cell.textContent = values[cell.rowIndex][cell.columnIndex];
  });
}

function createCell (rowIndex, columnIndex) {
  const div = document.createElement('div');
  div.style.gridRow = rowIndex + 1;
  div.style.gridColumn = columnIndex + 1;
  div.className = 'item';
  div.rowIndex = rowIndex;
  div.columnIndex = columnIndex;
  div.addEventListener('click', onClick, false);
  const cell = document.createElement('div');
  cell.className = 'cell';
  div.appendChild(cell);
  return {cell, div};
}

function onClick (event) {
  const {rowIndex, columnIndex} = this;
  const cell = currentBoard[rowIndex][columnIndex];
  if (cell.status !== null) return;

  const cells = [];
  for (let x = -1; x <= 1; x ++) {
    for (let y = -1; y <= 1; y ++) {
      if (x === 0 && y === 0) continue;
      cells.push(...getCount(rowIndex, columnIndex, x, y));
    }
  }
  if (cells.length === 0) return;

  cells.push(cell);

  cells.forEach(cell => {
    cell.className = `cell ${turn ? 'black' : 'white'}`;
    cell.status = cell.status === null ? turn : !cell.status;
    cell.textContent = values[cell.rowIndex][cell.columnIndex];
  });
  calc.push([rowIndex, columnIndex]);

  if (currentBoard.flat().filter(({status}) => status === null).length === 0) {
    printLog('全てのセルが埋まりました。');
    return finish();
  }

  turn = !turn;
  if (auto) autoPlay();
  else if (npc && !turn) autoPlay();
  else if (npc && turn && getValidCells().length === 0) {
    turn = !turn;
    autoPlay();
  } else if (getValidCells().length === 0) turn = !turn;
}

function getCount (row, column, dx, dy) {
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
  const white = currentBoard.flat().filter(({status}) => !status).length;
  const black = currentBoard.flat().filter(({status}) => status).length;
  printLog(`黒: ${black}
白: ${white}`);
}

async function autoPlay () {
  // Maximum call stack size exceeded対策
  await sleep(milliseconds);

  let valid = getValidCells();
  if (valid.length === 0) {
console.log(valid);
    printLog(`${turn ? '黒' : '白'}の置けるセルがありません。
${turn ? '白' : '黒'}にターンを渡します。`);
    turn = !turn;
    if (!auto) return;
    valid = getValidCells();

    if (valid.length === 0) {
      printLog(`置けるセルがありません。
ゲームを終了します。`);
      return finish();
    }
  }
  // 最大評価値が得られる挙動
  valid.sort((a, b) => b.point - a.point)[0].cell.click();
  // 最大数が得られる挙動
  //valid.sort((a, b) => b.count - a.count)[0].cell.cell.click();
  // 最小数が得られる挙動
  // valid.sort((a, b) => a.count - b.count)[0].cell.cell.click();
}

function getValidCells () {
  const cells = [];
  let point;
  currentBoard.flat().flat().forEach((cell, index) => {
    const temp = [];
    for (let x = -1; x <= 1; x ++) {
      for (let y = -1; y <= 1; y ++) {
        if (x === 0 && y === 0) continue;
        temp.push(...getCount(~~(index / 8), index % 8, x, y));
      }
    }
    point = cell.point + temp.reduce((accumulator, {point}) => accumulator + point, 0);
    if (temp.length > 0) cells.push({point, cell});
  });

  return cells.filter(({cell: {status}}) => status === null);
}

main();
