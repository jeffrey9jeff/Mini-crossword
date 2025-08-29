(() => {
  const gridEl = document.getElementById('grid');
  const acrossList = document.getElementById('across-list');
  const downList = document.getElementById('down-list');
  const timerEl = document.getElementById('timer');
  const btnCheck = document.getElementById('btn-check');
  const btnClear = document.getElementById('btn-clear');
  const winnerForm = document.getElementById('winner-form');
  const nameInput = document.getElementById('player-name');
  const lbLocal = document.getElementById('lb-local');
  const toastEl = document.getElementById('toast');

  // Use first puzzle
  let PUZ = (typeof getPuzzleById === 'function') ? getPuzzleById('mini-001') : (window.PUZZLES || [])[0];
  let size = PUZ.size;
  let inputs = [];
  let started = false, done = false, timerMs = 0, ticker = null;
  let currentDir = 'across';
  let currentClue = null;

  function buildGrid() {
    gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gridEl.innerHTML = '';
    inputs = [];
    for (let r=0; r<size; r++){
      const row = [];
      for (let c=0; c<size; c++){
        const cell = document.createElement('div');
        cell.className = 'cell';
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.maxLength = 1;
        inp.autocapitalize = 'characters';
        inp.autocomplete = 'off';
        inp.spellcheck = false;
        inp.inputMode = 'latin';
        inp.dataset.row = r; inp.dataset.col = c;
        // Events
        inp.addEventListener('focus', () => {
          if (currentClue == null) selectClue(PUZ.across[0], 'across');
        });
        inp.addEventListener('keydown', e => onKey(e, r, c));
        inp.addEventListener('input',  e => onType(e, r, c));
        cell.appendChild(inp);
        gridEl.appendChild(cell);
        row.push(inp);
      }
      inputs.push(row);
    }
    numberStarts();
  }

  function numberStarts(){
    const nums = new Map();
    for (const A of PUZ.across) nums.set(`${A.row},${A.col}`, A.num);
    for (const D of PUZ.down) if (!nums.has(`${D.row},${D.col}`)) nums.set(`${D.row},${D.col}`, D.num);
    for (let r=0;r<size;r++){
      for (let c=0;c<size;c++){
        const n = nums.get(`${r},${c}`);
        if (n){
          const badge = document.createElement('div');
          badge.className = 'num';
          badge.textContent = n;
          inputs[r][c].parentElement.appendChild(badge);
        }
      }
    }
  }

  function renderClues(){
    acrossList.innerHTML = '';
    for (const A of PUZ.across){
      const li = document.createElement('li');
      li.id = `A${A.num}`;
      li.innerHTML = `<strong>${A.num}.</strong> ${A.clue}`;
      li.addEventListener('click', () => selectClue(A, 'across'));
      acrossList.appendChild(li);
    }
    downList.innerHTML = '';
    for (const D of PUZ.down){
      const li = document.createElement('li');
      li.id = `D${D.num}`;
      li.innerHTML = `<strong>${D.num}.</strong> ${D.clue}`;
      li.addEventListener('click', () => selectClue(D, 'down'));
      downList.appendChild(li);
    }
  }

  function selectClue(clue, dir){
    currentDir = dir; currentClue = clue;
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('highlight'));
    document.querySelectorAll('.clue-list li').forEach(li => li.classList.remove('active'));
    document.getElementById((dir==='across'?'A':'D') + clue.num)?.classList.add('active');
    const {row, col, answer} = clue;
    for (let i=0;i<answer.length;i++){
      const rr = dir==='across' ? row : row+i;
      const cc = dir==='down'   ? col : col+i;
      inputs[rr][cc].parentElement.classList.add('highlight');
    }
    inputs[row][col].focus();
  }

  function onKey(e, r, c){
    switch(e.key){
      case 'ArrowRight': move(r,c,0,1); e.preventDefault(); break;
      case 'ArrowLeft':  move(r,c,0,-1); e.preventDefault(); break;
      case 'ArrowDown':  move(r,c,1,0); e.preventDefault(); break;
      case 'ArrowUp':    move(r,c,-1,0); e.preventDefault(); break;
      case 'Backspace':
        if (!inputs[r][c].value) prev(r,c);
        return;
      case ' ':
        currentDir = currentDir === 'across' ? 'down' : 'across';
        if (currentClue) selectClue(currentClue, currentDir);
        e.preventDefault();
        break;
      case 'c': case 'C': checkCurrent(); break;
      case 'Escape': clearGrid(); break;
    }
  }
  function move(r,c,dr,dc){
    const nr = Math.max(0, Math.min(size-1, r+dr));
    const nc = Math.max(0, Math.min(size-1, c+dc));
    inputs[nr][nc].focus();
  }
  function prev(r,c){ currentDir==='across' ? move(r,c,0,-1) : move(r,c,-1,0); }
  function next(r,c){ currentDir==='across' ? move(r,c,0, 1) : move(r,c, 1,0); }

  function onType(e, r, c){
    const v = e.target.value.toUpperCase().replace(/[^A-Z]/g,'');
    e.target.value = v;
    if (!started){ startTimer(); }
    if (v){ next(r,c); }
    checkSolved();
  }

  function startTimer(){
    started = true;
    const t0 = performance.now();
    ticker = setInterval(() => {
      timerMs = performance.now()-t0;
      timerEl.textContent = mmss(timerMs);
    }, 33);
  }
  function stopTimer(){ clearInterval(ticker); ticker=null; }
  function mmss(ms){
    const s = Math.floor(ms/1000), m = Math.floor(s/60);
    return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }

  function checkSolved(){
    for (let r=0;r<size;r++){
      for (let c=0;c<size;c++){
        const want = (PUZ.grid[r][c]||'').toUpperCase();
        const got  = (inputs[r][c].value||'').toUpperCase();
        if (want !== got) return false;
      }
    }
    if (!done){
      done = true; stopTimer();
      toast(`Solved in ${mmss(timerMs)}!`);
      winnerForm.classList.remove('hide');
      nameInput.focus();
      saveLocalScore('You', timerMs); // minimal local board preview
      lbLocal.innerHTML = renderTable(getLocalBoard()[PUZ.id]||[]);
    }
    return true;
  }

  function checkCurrent(){
    if (!currentClue) return;
    const {row,col,answer} = currentClue;
    for (let i=0;i<answer.length;i++){
      const rr = currentDir==='across' ? row : row+i;
      const cc = currentDir==='down'   ? col : col+i;
      const want = PUZ.grid[rr][cc].toUpperCase();
      const el = inputs[rr][cc];
      el.parentElement.classList.toggle('bad', el.value && el.value.toUpperCase() !== want);
      setTimeout(() => el.parentElement.classList.remove('bad'), 400);
    }
  }

  function clearGrid(){
    inputs.flat().forEach(i => i.value='');
    started=false; done=false; timerMs=0; if(ticker) stopTimer();
    timerEl.textContent='00:00';
    winnerForm.classList.add('hide');
  }

  // Local “leaderboard” (simple)
  const KEY='miniCrosswordTimes';
  function getLocalBoard(){ try{ return JSON.parse(localStorage.getItem(KEY) || '{}'); }catch{ return {}; } }
  function saveLocalScore(name, ms){
    const all=getLocalBoard(); const list=all[PUZ.id]||[];
    list.push({name,ms,ts:Date.now()}); list.sort((a,b)=>a.ms-b.ms);
    all[PUZ.id]=list.slice(0,10); localStorage.setItem(KEY, JSON.stringify(all));
  }
  function renderTable(list){
    if(!list.length) return "<p>No times yet.</p>";
    return `<table><thead><tr><th>#</th><th>Name</th><th>Time</th></tr></thead><tbody>${
      list.map((r,i)=>`<tr><td>${i+1}</td><td>${r.name}</td><td>${mmss(r.ms)}</td></tr>`).join('')
    }</tbody></table>`;
  }

  // Buttons
  btnCheck.addEventListener('click', checkCurrent);
  btnClear.addEventListener('click', clearGrid);
  winnerForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = (nameInput.value||'').trim().slice(0,20) || 'You';
    saveLocalScore(name, timerMs);
    toast('Saved!');
    winnerForm.classList.add('hide');
    lbLocal.innerHTML = renderTable(getLocalBoard()[PUZ.id]||[]);
  });

  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(()=>toastEl.classList.remove('show'), 1200);
  }

  // Init
  buildGrid();
  renderClues();
  // focus first clue
  (PUZ.across.length && selectClue(PUZ.across[0],'across'));
})();