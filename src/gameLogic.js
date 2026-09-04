// src/gameLogic.js

export function generateDeck() {
  const deck = [];
  // 1번 카드 1장, 2번 카드 2장 ... 12번 카드 12장
  for (let rank = 1; rank <= 12; rank++) {
    for (let count = 0; count < rank; count++) {
      deck.push(rank);
    }
  }
  // 13 어릿광대(Jester) 2장
  deck.push(13, 13);
  return deck;
}

export function shuffleDeck(deck) {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

export function distributeCards(deck, playerNames) {
  const hands = {};
  playerNames.forEach(name => {
    hands[name] = [];
  });
  
  let i = 0;
  while (i < deck.length) {
    for (const name of playerNames) {
      if (i < deck.length) {
        hands[name].push(deck[i]);
        i++;
      } else {
        break;
      }
    }
  }
  
  // 손패를 숫자 순서대로 정렬 (보기 편하게)
  for (const name in hands) {
    hands[name].sort((a, b) => a - b);
  }
  return hands;
}

export function getNextPlayer(currentPlayer, playerNames, passedPlayers = [], finishedPlayers = []) {
  const currentIndex = playerNames.indexOf(currentPlayer);
  for (let i = 1; i <= playerNames.length; i++) {
    const nextIndex = (currentIndex + i) % playerNames.length;
    const nextPlayer = playerNames[nextIndex];
    if (!passedPlayers.includes(nextPlayer) && !finishedPlayers.includes(nextPlayer)) {
      return nextPlayer;
    }
  }
  return currentPlayer;
}

export function validatePlay(selectedCards, centerCards) {
  if (!selectedCards || selectedCards.length === 0) return { valid: false, reason: "카드를 선택해주세요." };
  
  const nonJesters = selectedCards.filter(c => c !== 13);
  let rank = 13;

  if (nonJesters.length > 0) {
    const targetRank = nonJesters[0];
    const allSame = nonJesters.every(c => c === targetRank);
    if (!allSame) return { valid: false, reason: "서로 다른 숫자의 카드를 함께 낼 수 없습니다." };
    rank = targetRank;
  } else {
    // 조커만 낸 경우
    rank = 13;
  }
  
  const count = selectedCards.length;
  
  if (centerCards && centerCards.count > 0) {
    if (count !== centerCards.count) return { valid: false, reason: `현재 중앙에 놓인 카드(${centerCards.count}장)와 동일한 장수를 내야 합니다.` };
    if (rank >= centerCards.rank) return { valid: false, reason: "현재 중앙에 놓인 카드보다 더 낮은 숫자를 내야 합니다." };
  }
  
  return { valid: true, rank, count };
}
