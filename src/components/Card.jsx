export default function Card({ number, name, isSelected, onClick, isPlayable = true }) {
  const isJester = number === 13;
  const displayNum = isJester ? 'J' : number;

  return (
    <div 
      className={`playing-card ${isSelected ? 'selected' : ''} ${!isPlayable ? 'disabled' : ''}`}
      onClick={isPlayable ? onClick : undefined}
    >
      <div className="card-top">
        <span className="card-number">{displayNum}</span>
      </div>
      <div className="card-center">
        <span className="card-rank">{name}</span>
      </div>
      <div className="card-bottom">
        <span className="card-number">{displayNum}</span>
      </div>
    </div>
  );
}
