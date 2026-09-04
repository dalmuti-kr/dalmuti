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
      <div className="card-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className="card-rank" style={{ fontWeight: 'bold' }}>{name.split(' (')[0]}</span>
        <span className="card-rank" style={{ fontSize: '0.75rem', opacity: 0.8 }}>{name.split(' (')[1]?.replace(')', '')}</span>
      </div>
      <div className="card-bottom">
        <span className="card-number">{displayNum}</span>
      </div>
    </div>
  );
}
