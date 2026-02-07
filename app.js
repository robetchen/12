/* Solitaire (Klondike Turn One) - drag/drop + undo + animation */

(() => {
  // Guard: prevent double load
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

  /** Game state */
  let state = null;         // { stock:[], waste:[], foundations:[[],[],[],[]], tableau:[[],..7] }
  let undoStack = [];       // stack of snapshots
  let drag = null;          // current drag data

  function makeDeck(){
    const deck = [];
    for (let s=0; s<SUITS.length; s++){
      for (let r=0; r<RANKS.length; r++){
        deck.push({
          id: `${s}-${r}-${Math.random().toString(16).slice(2)}`,
          suit: SUITS[s],
          suitIndex: s,
          rank: RANKS[r],
          rankIndex: r,       // 0..12
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
    // tableau: descending rank, alternating colors. Empty => King.
    if (!destTopCard){
      return movingCard.rankIndex === 12; // K
    }
    const colorsDifferent = isRed(movingCard) !== isRed(destTopCard);
    const rankOk = movingCard.rankIndex === destTopCard.rankIndex - 1;
    return colorsDifferent && rankOk;
  }

  function canPlaceOnFoundation(movingCard, destTopCard){
    // foundation: ascending rank, same suit. Empty => Ace.
    if (!destTopCard){
      return movingCard.rankIndex === 0; // A
    }
    return movingCard.suit === destTopCard.suit &&
           movingCard.rankIndex === destTopCard.rankIndex + 1;
  }

  function peek(arr){ return arr.length ? arr[arr.length-1] : null; }

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

    // Deal tableau: pile i gets i+1 cards, last one face up
    let idx = 0;
    for (let col=0; col<7; col++){
      for (let row=0; row<=col; row++){
        const c = deck[idx++];
        c.faceUp = (row === col);
        state.tableau[col].push(c);
      }
    }

    // Remaining to stock (face down)
    state.stock = deck.slice(idx).map(c=>({ ...c, faceUp:false }));

    render();
    setStatus("New game started.");
  }

  function render(){
    // clear piles
    stockEl.innerHTML = "";
    wasteEl.innerHTML = "";
    foundationEls.forEach(el=>el.innerHTML="");
    tableauEls.forEach(el=>el.innerHTML="");

    // stock: show just a back if any
    if (state.stock.length){
      const c = state.stock[state.stock.length-1];
      stockEl.appendChild(renderCard(c, { faceDown:true }));
    } else {
      stockEl.appendChild(renderEmptyHint("↻"));
    }

    // waste: show top card
    if (state.waste.length){
      const c = peek(state.waste);
      wasteEl.appendChild(renderCard(c));
    }

    // foundations: top card
    state.foundations.forEach((pile, i)=>{
      const el = foundationEls[i];
      if (pile.length){
        el.appendChild(renderCard(peek(pile)));
      } else {
        el.appendChild(renderEmptyHint("A"));
      }
    });

    // tableau: render all cards with vertical offsets
    state.tableau.forEach((pile, col)=>{
      const el = tableauEls[col];
      if (!pile.length){
        el.appendChild(renderEmptyHint("K"));
      }
      pile.forEach((c, idx)=>{
        const cardEl = renderCard(c);
        const offset = idx * 26; // spacing
        cardEl.style.setProperty("--ty", `${offset}px`);
        cardEl.dataset.tableauIndex = String(col);
        cardEl.dataset.cardPos = String(idx);
        el.appendChild(cardEl);
      });
    });

    undoBtn.disabled = undoStack.length === 0;

    // win check
    const done = state.foundations.reduce((sum,p)=>sum+p.length,0);
    if (done === 52){
      setStatus("🎉 You win! (All cards in foundations)");
    } else {
      setStatus(`Foundations: ${done}/52`);
    }
  }

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
    el.dataset.cardId = card.id;

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

    // Events
    el.addEventListener("pointerdown", onCardPointerDown);
    el.addEventListener("dblclick", onCardDoubleClick);

    return el;
  }

  /** Find a card location in state: returns { pileType, pileIndex, cardIndex } */
  function findCard(cardId){
    // waste
    for (let i=0; i<state.waste.length; i++){
      if (state.waste[i].id === cardId) return { pileType:"waste", pileIndex:0, cardIndex:i };
    }
    // foundations
    for (let f=0; f<4; f++){
      const pile = state.foundations[f];
      for (let i=0; i<pile.length; i++){
        if (pile[i].id === cardId) return { pileType:"foundation", pileIndex:f, cardIndex:i };
      }
    }
    // tableau
    for (let t=0; t<7; t++){
      const pile = state.tableau[t];
      for (let i=0; i<pile.length; i++){
        if (pile[i].id === cardId) return { pileType:"tableau", pileIndex:t, cardIndex:i };
      }
    }
    // stock
    for (let i=0; i<state.stock.length; i++){
      if (state.stock[i].id === cardId) return { pileType:"stock", pileIndex:0, cardIndex:i };
    }
    return null;
  }

  function getMovableStack(from){
    // returns array of cards to move (single for waste/foundation top, or tableau face-up stack)
    if (!from) return [];
    if (from.pileType === "waste"){
      if (from.cardIndex !== state.waste.length-1) return [];
      return [peek(state.waste)];
    }
    if (from.pileType === "foundation"){
      const pile = state.foundations[from.pileIndex];
      if (from.cardIndex !== pile.length-1) return [];
      return [peek(pile)];
    }
    if (from.pileType === "tableau"){
      const pile = state.tableau[from.pileIndex];
      const moving = pile.slice(from.cardIndex);
      if (!moving.length) return [];
      if (!moving[0].faceUp) return [];
      if (moving.some(c=>!c.faceUp)) return [];

      // ensure sequence is valid descending alt-color within moving stack
      for (let i=0; i<moving.length-1; i++){
        const a = moving[i], b = moving[i+1];
        const ok = (a.rankIndex === b.rankIndex+1) && (isRed(a)!==isRed(b));
        if (!ok) return [];
      }
      return moving;
    }
    return [];
  }

  function removeCards(from, count){
    if (from.pileType === "waste"){
      return state.waste.splice(state.waste.length-count, count);
    }
    if (from.pileType === "foundation"){
      return state.foundations[from.pileIndex].splice(state.foundations[from.pileIndex].length-count, count);
    }
    if (from.pileType === "tableau"){
      return state.tableau[from.pileIndex].splice(from.cardIndex, count);
    }
    return [];
  }

  function addCards(to, cards){
    if (to.pileType === "foundation"){
      state.foundations[to.pileIndex].push(...cards);
      return;
    }
    if (to.pileType === "tableau"){
      state.tableau[to.pileIndex].push(...cards);
      return;
    }
    if (to.pileType === "waste"){
      state.waste.push(...cards);
      return;
    }
  }

  function tryFlipTableauTop(col){
    const pile = state.tableau[col];
    if (!pile.length) return false;
    const c = peek(pile);
    if (!c.faceUp){
      c.faceUp = true;
      return true;
    }
    return false;
  }

  function onStockClick(){
    // Turn one: draw 1 to waste. If stock empty, recycle waste -> stock (face down)
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
    // nothing
    undoStack.pop();
    undoBtn.disabled = undoStack.length===0;
  }

  function onCardDoubleClick(e){
    const cardId = e.currentTarget.dataset.cardId;
    const from = findCard(cardId);
    const stack = getMovableStack(from);
    if (stack.length !== 1) return;

    const card = stack[0];

    // attempt move to any foundation where valid
    for (let f=0; f<4; f++){
      const destTop = peek(state.foundations[f]);
      if (canPlaceOnFoundation(card, destTop)){
        pushUndo();
        const removed = removeCards(from, 1);
        addCards({ pileType:"foundation", pileIndex:f }, removed);

        // flip tableau if needed
        if (from.pileType === "tableau"){
          tryFlipTableauTop(from.pileIndex);
        }

        render();
        return;
      }
    }
  }

  function onCardPointerDown(e){
    const cardId = e.currentTarget.dataset.cardId;
    const from = findCard(cardId);
    if (!from) return;

    // cannot move face-down card; but allow click on tableau facedown top to flip
    if (from.pileType === "tableau"){
      const pile = state.tableau[from.pileIndex];
      const c = pile[from.cardIndex];
      const isTop = from.cardIndex === pile.length-1;
      if (!c.faceUp && isTop){
        pushUndo();
        c.faceUp = true;
        render();
        return;
      }
    }

    const stack = getMovableStack(from);
    if (!stack.length) return;

    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = boardEl.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    // create clones in dragLayer for smooth movement
    dragLayer.innerHTML = "";
    const dragCardsEls = stack.map((c, i)=>{
      const el = renderCard(c);
      el.classList.add("no-anim");
      el.style.setProperty("--x", `${startX}px`);
      el.style.setProperty("--y", `${startY + i*26}px`);
      dragLayer.appendChild(el);
      return el;
    });

    drag = {
      pointerId: e.pointerId,
      from,
      cards: stack,
      dragCardsEls,
      offsetX: 55,
      offsetY: 20,
      baseX: startX,
      baseY: startY,
      lastOver: null
    };

    window.addEventListener("pointermove", onPointerMove, { passive:false });
    window.addEventListener("pointerup", onPointerUp, { passive:false });
  }

  function pileFromElement(el){
    if (!el) return null;
    const pile = el.closest(".pile");
    if (!pile) return null;
    const type = pile.dataset.pile;
    if (type === "foundation"){
      return { pileType:"foundation", pileIndex: Number(pile.dataset.index) };
    }
    if (type === "tableau"){
      return { pileType:"tableau", pileIndex: Number(pile.dataset.index) };
    }
    if (type === "waste"){
      return { pileType:"waste", pileIndex: 0 };
    }
    if (type === "stock"){
      return { pileType:"stock", pileIndex: 0 };
    }
    return null;
  }

  function clearDropHighlights(){
    document.querySelectorAll(".pile.drop-ok").forEach(p=>p.classList.remove("drop-ok"));
  }

  function highlightIfValidDrop(to, movingCards){
    clearDropHighlights();
    if (!to) return false;

    if (to.pileType === "foundation"){
      if (movingCards.length !== 1) return false;
      const destTop = peek(state.foundations[to.pileIndex]);
      const ok = canPlaceOnFoundation(movingCards[0], destTop);
      if (ok) foundationEls[to.pileIndex].classList.add("drop-ok");
      return ok;
    }

    if (to.pileType === "tableau"){
      const destTop = peek(state.tableau[to.pileIndex]);
      const ok = canPlaceOnTableau(movingCards[0], destTop);
      if (ok) tableauEls[to.pileIndex].classList.add("drop-ok");
      return ok;
    }

    return false;
  }

function onPointerMove(e){
  if (!drag || e.pointerId !== drag.pointerId) return;
  e.preventDefault();

  const rect = boardEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const dx = x - drag.baseX;
  const dy = y - drag.baseY;

  drag.dragCardsEls.forEach((el, i)=>{
    el.style.setProperty("--x", `${drag.baseX + dx - drag.offsetX}px`);
    el.style.setProperty("--y", `${drag.baseY + dy - drag.offsetY + i*26}px`);
  });

  // ✅ FIX: jangan pakai elementFromPoint karena bisa kena dragLayer
  const stackEls = document.elementsFromPoint(e.clientX, e.clientY);
  const elUnder = stackEls.find(el => !el.closest("#dragLayer")) || null;

  const to = pileFromElement(elUnder);
  drag.lastOver = to;

  highlightIfValidDrop(to, drag.cards);
}


  function finalizeMoveAnimationTo(pileEl){
    drag.dragCardsEls.forEach(el=>el.classList.remove("no-anim"));

    requestAnimationFrame(()=>{
      drag.dragCardsEls.forEach((el, i)=>{
        const rectBoard = boardEl.getBoundingClientRect();
        const rectPile = pileEl.getBoundingClientRect();
        const targetX = rectPile.left - rectBoard.left;
        const targetY = rectPile.top - rectBoard.top +
          (pileEl.classList.contains("tableau")
            ? (state.tableau[Number(pileEl.dataset.index)].length + i) * 26
            : 0);

        el.style.setProperty("--x", `${targetX}px`);
        el.style.setProperty("--y", `${targetY}px`);
      });
    });
  }

  function onPointerUp(e){
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);

    clearDropHighlights();

    const to = drag.lastOver;
    const from = drag.from;
    const moving = drag.cards;

    let ok = false;
    if (to){
      if (to.pileType === "foundation"){
        ok = (moving.length===1) && canPlaceOnFoundation(moving[0], peek(state.foundations[to.pileIndex]));
      } else if (to.pileType === "tableau"){
        ok = canPlaceOnTableau(moving[0], peek(state.tableau[to.pileIndex]));
      }
    }

    if (!ok){
      dragLayer.innerHTML = "";
      drag = null;
      return;
    }

    pushUndo();

    const removed = removeCards(from, moving.length);
    addCards(to, removed);

    if (from.pileType === "tableau"){
      tryFlipTableauTop(from.pileIndex);
    }

    const destEl =
      to.pileType === "foundation" ? foundationEls[to.pileIndex] :
      to.pileType === "tableau" ? tableauEls[to.pileIndex] :
      null;

    if (destEl){
      finalizeMoveAnimationTo(destEl);
      setTimeout(()=>{
        dragLayer.innerHTML = "";
        drag = null;
        render();
      }, 190);
    } else {
      dragLayer.innerHTML = "";
      drag = null;
      render();
    }
  }

  function undo(){
    if (!undoStack.length) return;
    state = undoStack.pop();
    undoBtn.disabled = undoStack.length === 0;
    render();
  }

  // Bind pile clicks
  stockEl.addEventListener("click", onStockClick);

  newGameBtn.addEventListener("click", newGame);
  undoBtn.addEventListener("click", undo);

  newGame();
})();

