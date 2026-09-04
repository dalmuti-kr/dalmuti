import { useState, useEffect } from 'react';
import Card from './Card';
import { db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { generateDeck, shuffleDeck, distributeCards, validatePlay, getNextPlayer } from '../gameLogic';

export const CARD_NAMES = {
  1: '달무티 (Dalmuti)',
  2: '대주교 (Erzbischof)',
  3: '시종장 (Hofmarschall)',
  4: '남작부인 (Baronin)',
  5: '수녀원장 (Äbtissin)',
  6: '기사 (Ritter)',
  7: '재봉사 (Näherin)',
  8: '석공 (Steinmetz)',
  9: '요리사 (Köchin)',
  10: '양치기 (Schafhirtin)',
  11: '광부 (Bergmann)',
  12: '농노 (Tagelöhner)',
  13: '어릿광대 (Narr)'
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

  // 세금 교환 및 혁명 처리 (방장만 계산하여 업데이트)
  useEffect(() => {
    if (roomData?.status === 'taxing' && roomData.players && roomData.players[nickname]?.isHost) {
      const taxState = roomData.taxState;
      const ranks = roomData.ranks;
      
      if (!ranks || ranks.length < 4) {
        update(ref(db, `rooms/${roomCode}`), {
          status: 'playing',
          currentTurn: ranks ? ranks[0] : Object.keys(roomData.players)[0],
          taxState: null
        });
        return;
      }

      if (taxState?.revolution) {
        if (!taxState.processedRevolution) {
           update(ref(db, `rooms/${roomCode}/taxState/processedRevolution`), true);
           setTimeout(() => {
             let newRanks = [...ranks];
             if (taxState.revolution === 'greater') {
               newRanks.reverse();
             }
             update(ref(db, `rooms/${roomCode}`), {
               status: 'playing',
               currentTurn: newRanks[0],
               ranks: newRanks,
               taxState: null
             });
           }, 4000);
        }
        return;
      }

      const dalmutiReady = taxState?.dalmutiCards !== undefined;
      const nobleReady = taxState?.nobleCards !== undefined;
      
      if (dalmutiReady && nobleReady) {
        const dalmutiName = ranks[0];
        const nobleName = ranks[1];
        const lesserPeasantName = ranks[ranks.length - 2];
        const peasantName = ranks[ranks.length - 1];
        
        const dalmutiHand = [...roomData.players[dalmutiName].hand];
        const nobleHand = [...roomData.players[nobleName].hand];
        const lesserPeasantHand = [...roomData.players[lesserPeasantName].hand];
        const peasantHand = [...roomData.players[peasantName].hand];
        
        taxState.dalmutiCards.forEach(c => {
           const idx = dalmutiHand.indexOf(c);
           if (idx > -1) dalmutiHand.splice(idx, 1);
        });
        taxState.nobleCards.forEach(c => {
           const idx = nobleHand.indexOf(c);
           if (idx > -1) nobleHand.splice(idx, 1);
        });
        
        peasantHand.sort((a,b) => a-b);
        const pBest = peasantHand.splice(0, 2);
        
        lesserPeasantHand.sort((a,b) => a-b);
        const lpBest = lesserPeasantHand.splice(0, 1);
        
        dalmutiHand.push(...pBest);
        dalmutiHand.sort((a,b) => a-b);
        
        nobleHand.push(...lpBest);
        nobleHand.sort((a,b) => a-b);
        
        peasantHand.push(...taxState.dalmutiCards);
        peasantHand.sort((a,b) => a-b);
        
        lesserPeasantHand.push(...taxState.nobleCards);
        lesserPeasantHand.sort((a,b) => a-b);
        
        update(ref(db, `rooms/${roomCode}`), {
          status: 'playing',
          currentTurn: ranks[0],
          taxState: null,
          [`players/${dalmutiName}/hand`]: dalmutiHand,
          [`players/${nobleName}/hand`]: nobleHand,
          [`players/${lesserPeasantName}/hand`]: lesserPeasantHand,
          [`players/${peasantName}/hand`]: peasantHand,
        });
      }
    }
  }, [roomData?.status, roomData?.taxState]);

  if (!roomData) return <div className="lobby-container">Loading...</div>;

  const players = roomData.players || {};
  const me = players[nickname];
  const isHost = me?.isHost;
  const playerCount = Object.keys(players).length;

  const toggleReady = () => {
    update(ref(db, `rooms/${roomCode}/players/${nickname}`), {
      isReady: !me.isReady
    });
  };

  const startGame = () => {
    const deck = shuffleDeck(generateDeck());
    const playerNames = Object.keys(players);
    const hands = distributeCards(deck, playerNames);
    
    const isFirstGame = !roomData.ranks;
    const startPlayer = isFirstGame ? playerNames[Math.floor(Math.random() * playerNames.length)] : null;

    const updates = {
      status: isFirstGame ? 'playing' : 'taxing',
      centerCards: null,
      lastPlayedBy: null,
      passedPlayers: [],
      finishedPlayers: []
    };
    
    if (isFirstGame) {
      updates.currentTurn = startPlayer;
    } else {
      updates.taxState = {
        dalmutiCards: null,
        nobleCards: null,
        revolution: false,
        revolutionBy: null
      };
    }
    
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

  const hasRevolution = myHand.filter(c => c === 13).length >= 2;
  const myRankIndex = roomData.ranks ? roomData.ranks.indexOf(nickname) : -1;
  const isDalmuti = myRankIndex === 0;
  const isNoble = myRankIndex === 1;
  const isPeasant = roomData.ranks && myRankIndex === roomData.ranks.length - 1;

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
    
    if (newPassed.length >= activeCount - 1) {
      const lastPlayer = roomData.lastPlayedBy;
      let nextLead = lastPlayer;
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

  const declareRevolution = () => {
    update(ref(db, `rooms/${roomCode}/taxState`), {
      revolution: isPeasant ? 'greater' : true,
      revolutionBy: nickname
    });
  };

  const giveTax = () => {
    if (isDalmuti && selectedCards.length !== 2) {
      alert('농노에게 줄 카드 2장을 선택해주세요.');
      return;
    }
    if (isNoble && selectedCards.length !== 1) {
      alert('소농노에게 줄 카드 1장을 선택해주세요.');
      return;
    }
    const selectedValues = selectedCards.map(idx => myHand[idx]);
    const target = isDalmuti ? 'dalmutiCards' : 'nobleCards';
    update(ref(db, `rooms/${roomCode}/taxState/${target}`), selectedValues);
    setSelectedCards([]);
  };

  // UI 편의성 고도화 상태 및 파생 변수 계산
  const selectedValuesForValidation = selectedCards.map(idx => myHand[idx]);
  const currentValidation = validatePlay(selectedValuesForValidation, centerCards);
  const isSelectionValid = currentValidation.valid && selectedValuesForValidation.length > 0;
  const hasSelectedNormalCard = selectedValuesForValidation.some(num => num !== 13);
  
  const validationMessage = selectedValuesForValidation.length === 0 
    ? '제출할 카드를 선택해주세요' 
    : isSelectionValid 
      ? `선택된 조합: ${currentValidation.rank}계급 ${currentValidation.count}장` 
      : `불가: ${currentValidation.reason}`;

  const getIsCardDimmed = (num) => {
    if (isFinished || !isMyTurn || roomData.status !== 'playing') return false;
    if (!centerCards) return false;
    if (num === 13) return false; // 조커는 어두워지지 않음
    return num >= centerCards.rank; // 낼 수 없는 숫자(계급)면 딤(Dim) 처리
  };

  const isCardJesterGlow = (num) => {
    // 13(조커)이고, 무언가 일반 카드를 선택한 상태라면 반짝임
    return num === 13 && hasSelectedNormalCard && roomData.status === 'playing';
  };

  // 상대방 플레이어 배치 계산 (U자형 Grid 레이아웃)
  const orderedPlayers = roomData.ranks || Object.keys(players);
  const myIndex = orderedPlayers.indexOf(nickname);
  const opponents = [];
  
  if (myIndex !== -1) {
    for (let i = 1; i < orderedPlayers.length; i++) {
      const oppName = orderedPlayers[(myIndex + i) % orderedPlayers.length];
      opponents.push(oppName);
    }
  }

  const K = opponents.length;
  let leftCount = 0, topCount = 0, rightCount = 0;
  if (K === 1) topCount = 1;
  else if (K === 2) { leftCount = 1; rightCount = 1; }
  else if (K === 3) { leftCount = 1; topCount = 1; rightCount = 1; }
  else if (K === 4) { leftCount = 1; topCount = 2; rightCount = 1; }
  else if (K === 5) { leftCount = 2; topCount = 1; rightCount = 2; }
  else if (K === 6) { leftCount = 2; topCount = 2; rightCount = 2; }
  else if (K === 7) { leftCount = 2; topCount = 3; rightCount = 2; }

  const leftOpponents = opponents.slice(0, leftCount).reverse(); // 왼쪽은 아래부터 위로 채움
  const topOpponents = opponents.slice(leftCount, leftCount + topCount); // 위쪽은 왼쪽부터 오른쪽으로
  const rightOpponents = opponents.slice(leftCount + topCount, leftCount + topCount + rightCount); // 오른쪽은 위부터 아래로

  const getRankEmoji = (playerName) => {
    if (!roomData.ranks) return '👤';
    const idx = roomData.ranks.indexOf(playerName);
    if (idx === 0) return '👑'; // 대달무티
    if (idx === 1) return '💎'; // 소달무티
    if (idx === roomData.ranks.length - 1) return '🧹'; // 대농노
    if (idx === roomData.ranks.length - 2) return '⛏️'; // 소농노
    return '💼'; // 상인
  };

  const renderOpponent = (oppName) => {
    const isOppTurn = oppName === currentTurnPlayer;
    const isOppFinished = finishedPlayers.includes(oppName);
    const oppHandCount = roomData.players[oppName]?.hand?.length || 0;
    
    return (
      <div key={oppName} className={`opponent-avatar ${isOppTurn && !isOppFinished ? 'current-turn' : ''} ${isOppFinished ? 'finished' : ''}`}>
        <div className="opponent-rank">{getRankEmoji(oppName)}</div>
        <div className="opponent-name">{oppName}</div>
        <div className="opponent-cards">{isOppFinished ? '🎉 통과' : `🎴 ${oppHandCount}장`}</div>
      </div>
    );
  };

  // 카드 분리 렌더링을 위한 인덱스 계산
  const stagedIndices = selectedCards;
  const unselectedIndices = myHand.map((_, i) => i).filter(i => !selectedCards.includes(i));

  return (
    <div className="game-board">
      <div className="game-header">
        <h2 className="room-code-display">Room: {roomCode}</h2>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={onLeave}>나가기</button>
      </div>
      
      <p className="philosophy-text" style={{ textAlign: 'center', marginBottom: '1rem' }}>Das Leben ist ungerecht</p>

      {roomData.status === 'waiting' && (
        <div className="waiting-room">
          <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>대기실 (현재 {playerCount}명)</h3>
          <p style={{textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem'}}>
            달무티는 4~8인이 즐기기에 가장 적합합니다. (최소 4인 필요)
          </p>
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
                disabled={!allReady || playerCount < 4 || playerCount > 8}
                style={{ marginTop: '1rem', opacity: (!allReady || playerCount < 4 || playerCount > 8) ? 0.5 : 1 }}
              >
                게임 시작 (4~8인)
              </button>
            )}
          </div>
        </div>
      )}

      {roomData.status === 'taxing' && (
        <div className="waiting-room text-center">
          {roomData.taxState?.revolution ? (
            <div style={{ padding: '3rem 0', animation: 'fadeIn 0.5s ease' }}>
              <h1 style={{ fontSize: '3rem', color: 'var(--danger-color)', marginBottom: '1rem' }}>
                {roomData.taxState.revolution === 'greater' ? '대혁명 발동!!!' : '혁명 발동!'}
              </h1>
              <h2 style={{ color: 'var(--accent-color)' }}>
                {roomData.taxState.revolutionBy}님이 조커 2장으로 혁명을 일으켰습니다!
              </h2>
              <p style={{ marginTop: '1rem', fontSize: '1.2rem' }}>
                {roomData.taxState.revolution === 'greater' ? '모든 계급이 완전히 거꾸로 뒤집힙니다! 세금 납부가 무효화됩니다.' : '세금 납부가 무효화됩니다.'}
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }}>⚖️ 세금 징수 시간 ⚖️</h2>
              
              {hasRevolution && (
                <button className="btn" style={{ backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)', marginBottom: '2rem' }} onClick={declareRevolution}>
                  🔥 조커 2장으로 혁명 일으키기 🔥
                </button>
              )}

              {isDalmuti ? (
                roomData.taxState?.dalmutiCards ? (
                  <p>농노에게 하사할 카드를 전달했습니다. 다른 플레이어를 기다리는 중...</p>
                ) : (
                  <div>
                    <p style={{ marginBottom: '1rem' }}>👑 대달무티이십니다. 농노에게 하사할 아무 카드나 2장 선택해주세요.</p>
                    <button className="btn" disabled={selectedCards.length !== 2} onClick={giveTax}>하사하기</button>
                  </div>
                )
              ) : isNoble ? (
                roomData.taxState?.nobleCards ? (
                  <p>소농노에게 하사할 카드를 전달했습니다. 다른 플레이어를 기다리는 중...</p>
                ) : (
                  <div>
                    <p style={{ marginBottom: '1rem' }}>💎 소달무티이십니다. 소농노에게 하사할 아무 카드나 1장 선택해주세요.</p>
                    <button className="btn" disabled={selectedCards.length !== 1} onClick={giveTax}>하사하기</button>
                  </div>
                )
              ) : (
                <div style={{ marginBottom: '2rem' }}>
                  <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>👑 왕과 귀족이 노예에게 줄 카드를 고르고 있습니다...</p>
                  {isPeasant && <p style={{ marginTop: '1rem', color: 'var(--danger-color)' }}>당신은 대농노입니다. 가장 좋은 카드 2장이 자동으로 왕에게 바쳐집니다.</p>}
                  {myRankIndex === roomData.ranks?.length - 2 && <p style={{ marginTop: '1rem', color: 'var(--danger-color)' }}>당신은 소농노입니다. 가장 좋은 카드 1장이 자동으로 귀족에게 바쳐집니다.</p>}
                </div>
              )}
              
              <div className="hand-cards" style={{ marginTop: '2rem' }}>
                {unselectedIndices.map((idx, i) => {
                  const num = myHand[idx];
                  const isSameAsPrev = i > 0 && myHand[unselectedIndices[i-1]] === num;
                  return (
                    <div 
                      key={`tax-hand-${idx}`} 
                      className="hand-card-wrapper"
                      style={{ marginLeft: isSameAsPrev ? '-40px' : '5px' }}
                    >
                      <Card 
                        number={num} 
                        name={CARD_NAMES[num]} 
                        isSelected={false}
                        onClick={() => handleCardClick(idx)}
                        isPlayable={(!roomData.taxState?.dalmutiCards && isDalmuti) || (!roomData.taxState?.nobleCards && isNoble)}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {roomData.status === 'playing' && (
        <div className="play-area">
          <div className="table-container">
            <div className="left-opponents">
              {leftOpponents.map(renderOpponent)}
            </div>
            
            <div className="top-opponents">
              {topOpponents.map(renderOpponent)}
            </div>
            
            <div className="right-opponents">
              {rightOpponents.map(renderOpponent)}
            </div>
            
            <div className="center-table">
              <div className="center-cards" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                {centerCards ? (
                  centerCards.cards.map((num, idx) => (
                    <Card key={idx} number={num} name={CARD_NAMES[num]} isPlayable={false} />
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>테이블이 비어있습니다.</p>
                )}
              </div>
              {centerCards && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>마지막으로 낸 사람: {roomData.lastPlayedBy}</p>}
            </div>
          </div>
          
          <div className="my-hand-container">
            <div className="turn-indicator" style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: isMyTurn ? 'var(--accent-color)' : 'var(--text-muted)' }}>
              {isFinished ? '🎉 모든 카드를 털었습니다! 구경 중...' : (isMyTurn ? '👉 내 턴입니다!' : `⏳ ${currentTurnPlayer}의 턴을 기다리는 중...`)}
            </div>
            
            <div className="validation-message" style={{ height: '20px', marginBottom: '0.5rem', color: isSelectionValid ? 'var(--accent-color)' : 'var(--danger-color)', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {isMyTurn && !isFinished ? validationMessage : ''}
            </div>

            <div className="staging-area" style={{ minHeight: '160px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem', border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '1rem', background: 'rgba(0,0,0,0.2)' }}>
              {stagedIndices.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>제출할 카드를 터치해서 올리세요</p>
              ) : (
                <div style={{ display: 'flex' }}>
                  {stagedIndices.map((idx, i) => {
                    const num = myHand[idx];
                    const isSameAsPrev = i > 0 && myHand[stagedIndices[i-1]] === num;
                    return (
                      <div 
                        key={`staged-${idx}`} 
                        className="hand-card-wrapper" 
                        style={{ marginLeft: isSameAsPrev ? '-40px' : '5px' }}
                      >
                        <Card 
                          number={num} 
                          name={CARD_NAMES[num]} 
                          isSelected={false}
                          onClick={() => handleCardClick(idx)}
                          isPlayable={true}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hand-actions">
              <button 
                className="btn" 
                disabled={!isMyTurn || !isSelectionValid || isFinished} 
                onClick={playCards}
              >
                카드 내기
              </button>
              <button className="btn btn-secondary" disabled={!isMyTurn || (!centerCards) || isFinished} onClick={passTurn}>패스 (Pass)</button>
            </div>
            
            <div className="hand-cards">
              {unselectedIndices.map((idx, i) => {
                const num = myHand[idx];
                const isSameAsPrev = i > 0 && myHand[unselectedIndices[i-1]] === num;
                const isDimmed = getIsCardDimmed(num);
                return (
                  <div 
                    key={`hand-${idx}`} 
                    className={`hand-card-wrapper ${isDimmed ? 'dimmed' : ''} ${isCardJesterGlow(num) ? 'jester-glow' : ''}`} 
                    style={{ marginLeft: isSameAsPrev ? '-40px' : '5px' }}
                  >
                    <Card 
                      number={num} 
                      name={CARD_NAMES[num]} 
                      isSelected={false}
                      onClick={() => {
                        if (isDimmed) return;
                        handleCardClick(idx);
                      }}
                      isPlayable={!isFinished}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {roomData.status === 'round_over' && (
        <div className="waiting-room text-center">
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }}>🎉 라운드 종료! 🎉</h2>
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
            <button className="btn" onClick={startGame}>
              다음 판 시작하기 (세금 납부 및 카드 섞기)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
