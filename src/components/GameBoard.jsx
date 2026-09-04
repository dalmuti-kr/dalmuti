import { useState, useEffect } from 'react';
import Card from './Card';
import { db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { generateDeck, shuffleDeck, distributeCards, validatePlay, getNextPlayer } from '../gameLogic';

export const CARD_NAMES = {
  1: 'Dalmuti',
  2: 'Archbishop',
  3: 'Earl Marshal',
  4: 'Baroness',
  5: 'Abbess',
  6: 'Knight',
  7: 'Seamstress',
  8: 'Mason',
  9: 'Cook',
  10: 'Shepherdess',
  11: 'Stonecutter',
  12: 'Peasant',
  13: 'Jester'
};

export default function GameBoard({ roomCode, nickname, onLeave }) {
  const [roomData, setRoomData] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);

  useEffect(() => {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomData(snapshot.val());
      } else {
        onLeave();
      }
    });
    return () => unsubscribe();
  }, [roomCode, onLeave]);

  if (!roomData) return <div className="lobby-container">Loading...</div>;

  const players = roomData.players || {};
  const me = players[nickname];
  const isHost = me?.isHost;

  const toggleReady = () => {
    update(ref(db, `rooms/${roomCode}/players/${nickname}`), {
      isReady: !me.isReady
    });
  };

  const startGame = () => {
    const deck = shuffleDeck(generateDeck());
    const playerNames = Object.keys(players);
    const hands = distributeCards(deck, playerNames);
    
    // 만약 이전 라운드의 결과(ranks)가 있다면 대농노부터 섞지 않고 시작할 수 있지만 
    // 여기서는 가장 단순하게 무작위로 시작 플레이어를 정합니다.
    const startPlayer = roomData.ranks ? roomData.ranks[0] : playerNames[Math.floor(Math.random() * playerNames.length)];

    const updates = {
      status: 'playing',
      currentTurn: startPlayer,
      centerCards: null,
      lastPlayedBy: null,
      passedPlayers: [],
      finishedPlayers: []
    };
    
    playerNames.forEach(name => {
      updates[`players/${name}/hand`] = hands[name];
    });

    update(ref(db, `rooms/${roomCode}`), updates);
  };

  const allReady = Object.values(players).every(p => p.isReady);

  const myHand = me?.hand || [];
  const currentTurnPlayer = roomData.currentTurn;
  const isMyTurn = currentTurnPlayer === nickname;
  const centerCards = roomData.centerCards;
  const finishedPlayers = roomData.finishedPlayers || [];
  const isFinished = finishedPlayers.includes(nickname);

  const handleCardClick = (idx) => {
    if (selectedCards.includes(idx)) {
      setSelectedCards(selectedCards.filter(i => i !== idx));
    } else {
      setSelectedCards([...selectedCards, idx]);
    }
  };

  const playCards = () => {
    const selectedValues = selectedCards.map(idx => myHand[idx]);
    const validation = validatePlay(selectedValues, centerCards);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }
    
    const newHand = myHand.filter((_, idx) => !selectedCards.includes(idx));
    
    let nextFinished = [...finishedPlayers];
    if (newHand.length === 0) {
      nextFinished.push(nickname);
    }
    
    const playerNames = Object.keys(players);
    const activePlayers = playerNames.filter(p => !nextFinished.includes(p));
    
    let nextUpdates = {
      centerCards: {
        cards: selectedValues,
        rank: validation.rank,
        count: validation.count
      },
      lastPlayedBy: nickname,
      passedPlayers: [],
      [`players/${nickname}/hand`]: newHand,
      finishedPlayers: nextFinished
    };
    
    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) nextFinished.push(activePlayers[0]);
      nextUpdates.status = 'round_over';
      nextUpdates.ranks = nextFinished;
    } else {
      nextUpdates.currentTurn = getNextPlayer(nickname, playerNames, [], nextFinished);
    }
    
    update(ref(db, `rooms/${roomCode}`), nextUpdates);
    setSelectedCards([]);
  };

  const passTurn = () => {
    const playerNames = Object.keys(players);
    const passed = roomData.passedPlayers || [];
    const activeCount = playerNames.filter(p => !finishedPlayers.includes(p)).length;
    
    const newPassed = [...passed, nickname];
    let nextUpdates = { passedPlayers: newPassed };
    
    // 나를 제외한 모든 액티브 플레이어가 패스한 경우
    if (newPassed.length >= activeCount - 1) {
      const lastPlayer = roomData.lastPlayedBy;
      let nextLead = lastPlayer;
      // 마지막으로 낸 사람이 이미 게임을 끝냈다면, 그 다음 사람이 선을 잡음
      if (finishedPlayers.includes(lastPlayer)) {
         nextLead = getNextPlayer(lastPlayer, playerNames, [], finishedPlayers);
      }
      nextUpdates.centerCards = null;
      nextUpdates.passedPlayers = [];
      nextUpdates.currentTurn = nextLead;
      nextUpdates.lastPlayedBy = null;
    } else {
      nextUpdates.currentTurn = getNextPlayer(nickname, playerNames, newPassed, finishedPlayers);
    }
    
    update(ref(db, `rooms/${roomCode}`), nextUpdates);
    setSelectedCards([]);
  };

  return (
    <div className="game-board">
      <div className="game-header">
        <h2 className="room-code-display">Room: {roomCode}</h2>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={onLeave}>나가기</button>
      </div>
      
      <p className="philosophy-text" style={{ textAlign: 'center', marginBottom: '2rem' }}>Das Leben ist ungerecht</p>

      {roomData.status === 'waiting' && (
        <div className="waiting-room">
          <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>대기실</h3>
          <div className="player-list">
            {Object.entries(players).map(([name, data]) => (
              <div key={name} className={`player-item ${data.isReady ? 'ready' : ''}`}>
                <span className="player-name">{name} {data.isHost ? '👑' : ''}</span>
                <span className="player-status">{data.isReady ? 'Ready' : 'Waiting...'}</span>
              </div>
            ))}
          </div>
          
          <div className="waiting-actions">
            <button className={`btn ${me.isReady ? 'btn-secondary' : ''}`} onClick={toggleReady}>
              {me.isReady ? '준비 취소' : '준비 완료'}
            </button>
            {isHost && (
              <button 
                className="btn" 
                onClick={startGame}
                disabled={!allReady || Object.keys(players).length < 2}
                style={{ marginTop: '1rem', opacity: (!allReady || Object.keys(players).length < 2) ? 0.5 : 1 }}
              >
                게임 시작 (최소 2인)
              </button>
            )}
          </div>
        </div>
      )}

      {roomData.status === 'playing' && (
        <div className="play-area">
          <div className="center-table">
            <div className="center-cards" style={{ display: 'flex', gap: '1rem' }}>
              {centerCards ? (
                centerCards.cards.map((num, idx) => (
                  <Card key={idx} number={num} name={CARD_NAMES[num]} isPlayable={false} />
                ))
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>테이블 중앙이 비어있습니다. 아무 카드나 낼 수 있습니다.</p>
              )}
            </div>
            {centerCards && <p style={{ position: 'absolute', bottom: '2rem', color: 'var(--text-muted)' }}>마지막으로 낸 사람: {roomData.lastPlayedBy}</p>}
          </div>
          
          <div className="my-hand-container">
            <div className="turn-indicator" style={{ marginBottom: '1rem', fontWeight: 'bold', color: isMyTurn ? 'var(--accent-color)' : 'var(--text-muted)' }}>
              {isFinished ? '🎉 게임 종료! 다른 플레이어들을 기다립니다.' : (isMyTurn ? '👉 내 턴입니다!' : `⏳ ${currentTurnPlayer}의 턴을 기다리는 중...`)}
            </div>
            <div className="hand-actions">
              <button className="btn" disabled={!isMyTurn || selectedCards.length === 0 || isFinished} onClick={playCards}>카드 내기</button>
              <button className="btn btn-secondary" disabled={!isMyTurn || (!centerCards) || isFinished} onClick={passTurn}>패스 (Pass)</button>
            </div>
            <div className="hand-cards">
              {myHand.map((num, idx) => (
                <div 
                  key={idx} 
                  className="hand-card-wrapper" 
                >
                  <Card 
                    number={num} 
                    name={CARD_NAMES[num]} 
                    isSelected={selectedCards.includes(idx)}
                    onClick={() => handleCardClick(idx)}
                    isPlayable={!isFinished}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {roomData.status === 'round_over' && (
        <div className="waiting-room text-center">
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }}>🎉 게임 종료! 🎉</h2>
          <h3>최종 계급도</h3>
          <ol style={{ marginTop: '1rem', marginBottom: '2rem', textAlign: 'left', display: 'inline-block' }}>
            {roomData.ranks && roomData.ranks.map((name, idx) => {
               let title = '';
               if (idx === 0) title = '👑 대달무티 (왕)';
               else if (idx === 1) title = '💎 소달무티 (귀족)';
               else if (idx === roomData.ranks.length - 1) title = '🧹 대농노 (노예)';
               else if (idx === roomData.ranks.length - 2) title = '⛏️ 소농노 (평민)';
               else title = '상인';
               return <li key={name} style={{ margin: '0.5rem 0', fontSize: '1.1rem' }}>{title} - <strong>{name}</strong></li>;
            })}
          </ol>
          {isHost && (
            <button className="btn" onClick={() => update(ref(db, `rooms/${roomCode}`), { status: 'waiting', ranks: roomData.ranks })}>
              다음 판 준비하기 (로비로 돌아가기)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
