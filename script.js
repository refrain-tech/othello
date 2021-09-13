'use strict';
const board = document.querySelector('#board');
const automode = document.querySelector('#automode');
const npcmode = document.querySelector('#npcmode');
const interval = document.querySelector('#interval');
const currentBoard = [];
const calc = [];

automode.addEventListener('change', onChange, false);
npcmode.addEventListener('change', onChange, false);

function onChange (event) {
  switch (this) {
    case automode:
    case npcmode:
    case pvpmode:
      auto = this === automode;
      npc = this === npcmode;
      break;
    case interval:
      milliseconds = parseInt(interval.value);
      break;
  }
}

const sleep = async (milliseconds) => new Promise(resolve => setTimeout(() => resolve(), milliseconds));

let turn = null;
let milliseconds = 1;
let auto = false;
let npc = false;

function main () {
  currentBoard.length = 0;
  for (let row = 0; row < 8; row ++) {
    currentBoard[row] = [];
    for (let column = 0; column < 8; column ++) {
      const {cell, div} = createCell(row, column);
      board.appendChild(div);
      currentBoard[row][column] = {cell, status: null};
    }
  }
  currentBoard[3][3].status = true;
  currentBoard[3][4].status = false;
  currentBoard[4][3].status = false;
  currentBoard[4][4].status = true;
  turn = true;
  currentBoard.flat().flat().filter(({status}) => status !== null).forEach(({cell, status}) => cell.className = `cell ${status ? 'black' : 'white'}`);
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
  const element = currentBoard[rowIndex][columnIndex];
  if (element.status !== null) return;

  const cells = [];
  for (let x = -1; x <= 1; x ++) {
    for (let y = -1; y <= 1; y ++) {
      if (x === 0 && y === 0) continue;
      cells.push(...getCount(rowIndex, columnIndex, x, y));
    }
  }
  if (cells.length === 0) return;

  cells.push(element);

  cells.forEach(cell => {
    cell.status = cell.status === null ? turn : !cell.status;
    cell.cell.className = `cell ${turn ? 'black' : 'white'}`;
  });
  calc.push([rowIndex, columnIndex]);

  if (currentBoard.flat().filter(({status}) => status === null).length === 0) {
    console.log('全てのセルが埋まりました。');
    return finish();
  }

  turn = !turn;
  if (auto) autoPlay();
  else if (npc && !turn) autoPlay();
  else if (getValidCells().length === 0) turn = !turn;
}

function getCount (row, column, dx, dy) {
  let flag = false, cell;
  const cells = [];

  loop: while (true) {
    row += dx;
    column += dy;

    if (row < 0 || row > 7 || column < 0 || column > 7) break;

    cell= currentBoard[row][column];
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

function finish () {
  const white = currentBoard.flat().filter(({status}) => !status).length;
  const black = currentBoard.flat().filter(({status}) => status).length;
  console.log(`黒: ${black}
白: ${white}`);
}

async function autoPlay () {
  // Maximum call stack size exceeded対策
  await sleep(milliseconds);

  let valid = getValidCells();
  let cell = valid.cell;
  let count = valid.count;
  if (valid.length === 0) {
    console.log(`${turn ? '黒' : '白'}の置けるセルがありません。
${turn ? '白' : '黒'}にターンを渡します。`);
    turn = !turn;
    if (!auto) return;
    valid = getValidCells();
    cell = valid.cell;
    count = valid.count;

    if (valid.length === 0) {
      console.log(`置けるセルがありません。
ゲームを終了します。`);
      return finish();
    }
  }
  // 最大数が得られる挙動
  // valid.sort((a, b) => b.count - a.count)[0].cell.cell.click();
  // 最小数が得られる挙動
  valid.sort((a, b) => a.count - b.count)[0].cell.cell.click();
}

function getValidCells () {
  const cells = [];
  currentBoard.flat().flat().forEach((cell, index) => {
    let count = 0;
    for (let x = -1; x <= 1; x ++) {
      for (let y = -1; y <= 1; y ++) {
        if (x === 0 && y === 0) continue;
        count += getCount(~~(index / 8), index % 8, x, y).length;
      }
    }
    if (count > 0) cells.push({count, cell});
  });

  return cells.filter(({cell: {status}}) => status === null);
}

main();