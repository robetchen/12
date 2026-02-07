/* Solitaire (Klondike Turn One) */

(() => {
  // Guard: kalau file ini ke-load 2x, stop supaya tidak double-bind / redeclare
  if (window.__klondike_turnone_loaded) return;
  window.__klondike_turnone_loaded = true;

  const SUITS = ["♠", "♥", "♦", "♣"];
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  const boardEl = document.getElementById("board");
  const dragLayer = document.getElementById("dragLayer");
  const stockEl = document.getElementById("stock");
  const wasteEl = document.getElementById("waste");
  const statusEl = document.getElementById("status");
  const undoBtn = document.getElementById("undoBtn");
  const newGameBtn = document.getElementById("newGameBtn");

  const foundationEls = [...Array(4)].map((_,i)=>document.getElementById(`foundation-${i}`));
  const tableauEls = [...Array(7)].map((_,i)=>document.getElementById(`tableau-${i}`));

  let state = null;
  let undoStack = [];
  let drag = null;

  function makeDeck(){
    const deck = [];
    for (let s=0; s<SUITS.length; s++){
      for (let r=0; r<RANKS.length; r++){
        deck.push({
          id: `${s}-${r}-${Math.random().toString(16).slice(2)}`,
          suit: SUITS[s],
          suitIndex: s,
          rank: RANKS[r],
          rankIndex: r,
          faceUp: false
        });
      }
    }
    return deck;
  }

  function shuffle(arr){
    for (let i=arr.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function deepClone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function pushUndo(){
    undoStack.push(deepClone(state));
    undoBtn.disabled = undoStack.length === 0;
  }

  function setStatus(msg){
    statusEl.textContent = msg || "";
  }

  function isRed(card){
    return card.suit === "♥" || card.suit === "♦";
  }

  function cardColorClass(card){
    return isRed(card) ? "red" : "black";
  }

  function canPlaceOnTableau(movingCard, destTopCard){
    if (!destTopCard) return movingCard.rankIndex === 12; // K
    const colorsDifferent = isRed(movingCard) !== isRed(destTopCard);
    const rankOk = movingCard.rankIndex === destTopCard.rankIndex - 1;
    return colorsDifferent && rankOk;
  }

  function canPlaceOnFoundation(movingCard, destTopCard){
    if (!destTopCard) return movingCard.rankIndex === 0; // A
    return movingCard.suit === destTopCard.suit &&
           movingCard.rankIndex === destTopCard.rankIndex + 1;
  }

  function peek(arr){ return arr.length ? arr[arr.length-1] : null; }

  function renderEmptyHint(text){
    const d = document.createElement("div");
    d.style.position="absolute";
    d.style.inset="0";
    d.style.display="flex";
    d.style.alignItems="center";
    d.style.justifyContent="center";
    d.style.color="rgba(255,255,255,.55)";
    d.style.fontWeight="800";
    d.style.fontSize="22px";
    d.textContent = text;
    return d;
  }

  function renderCard(card, opts={}){
    const el = document.createElement("div");
    el.className = "card";

    const faceDown = opts.faceDown || !card.faceUp;
    if (faceDown) el.classList.add("face-down");

    const colorCls = cardColorClass(card);

    const cornerTop = document.createElement("div");
    cornerTop.className = `corner ${colorCls}`;
    cornerTop.textContent = `${card.rank}${card.suit}`;

    const center = document.createElement("div");
    center.className = `center ${colorCls}`;
    center.textContent = card.suit;

    const cornerBottom = document.createElement("div");
    cornerBottom.className = `corner bottom ${colorCls}`;
    cornerBottom.textContent = `${card.rank}${card.suit}`;

    el.appendChild(cornerTop);
    el.appendChild(center);
    el.appendChild(cornerBottom);

    return el;
  }

  function render(){
    stockEl.innerHTML = "";
    wasteEl.innerHTML = "";
    foundationEls.forEach(el=>el.innerHTML="");
    tableauEls.forEach(el=>el.innerHTML="");

    if (state.stock.length){
      const c = state.stock[state.stock.length-1];
      stockEl.appendChild(renderCard(c, { faceDown:true }));
    } else {
      stockEl.appendChild(renderEmptyHint("↻"));
    }

    if (state.waste.length){
      wasteEl.appendChild(renderCard(peek(state.waste)));
    }

    state.foundations.forEach((pile, i)=>{
      const el = foundationEls[i];
      if (pile.length) el.appendChild(renderCard(peek(pile)));
      else el.appendChild(renderEmptyHint("A"));
    });

    state.tableau.forEach((pile, col)=>{
      const el = tableauEls[col];
      if (!pile.length) el.appendChild(renderEmptyHint("K"));

      pile.forEach((c, idx)=>{
        const cardEl = renderCard(c);
        const offset = idx * 26;
        cardEl.style.setProperty("--ty", `${offset}px`);
        el.appendChild(cardEl);
      });
    });

    undoBtn.disabled = undoStack.length === 0;

    const done = state.foundations.reduce((sum,p)=>sum+p.length,0);
    if (done === 52) setStatus("🎉 You win! (All cards in foundations)");
    else setStatus(`Foundations: ${done}/52`);
  }

  function newGame(){
    const deck = shuffle(makeDeck());
    state = {
      stock: [],
      waste: [],
      foundations: [[],[],[],[]],
      tableau: [[],[],[],[],[],[],[]]
    };
    undoStack = [];
    undoBtn.disabled = true;

    let idx = 0;
    for (let col=0; col<7; col++){
      for (let row=0; row<=col; row++){
        const c = deck[idx++];
        c.faceUp = (row === col);
        state.tableau[col].push(c);
      }
    }

    state.stock = deck.slice(idx).map(c=>({ ...c, faceUp:false }));
    render();
    setStatus("New game started.");
  }

  function onStockClick(){
    pushUndo();

    if (state.stock.length){
      const c = state.stock.pop();
      c.faceUp = true;
      state.waste.push(c);
      render();
      return;
    }

    if (state.waste.length){
      const recycled = state.waste.splice(0, state.waste.length).reverse();
      recycled.forEach(c=>c.faceUp=false);
      state.stock.push(...recycled);
      render();
      return;
    }

    undoStack.pop();
    undoBtn.disabled = undoStack.length===0;
  }

  function undo(){
    if (!undoStack.length) return;
    state = undoStack.pop();
    undoBtn.disabled = undoStack.length === 0;
    render();
  }

  // bind
  stockEl.addEventListener("click", onStockClick);
  newGameBtn.addEventListener("click", newGame);
  undoBtn.addEventListener("click", undo);

  newGame();
})();
