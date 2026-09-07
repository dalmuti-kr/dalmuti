export default function Card({ number, name, isSelected, onClick, isPlayable = true, count = 1 }) {
  const isJester = number === 13;
  const displayNum = isJester ? 'J' : number;
  const mainName = name.split(' (')[0];
  const subName = name.split(' (')[1]?.replace(')', '');

  const bgStyle = {
    backgroundImage: `url(${import.meta.env.BASE_URL}assets/cards/${number}.png)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div 
      className={`playing-card ${isSelected ? 'selected' : ''} ${!isPlayable ? 'disabled' : ''}`}
      onClick={isPlayable ? onClick : undefined}
      style={bgStyle}
    >
      {count > 1 && (
        <div className="card-count-badge">
          x{count}
        </div>
      )}
      <div className="card-overlay-top">
        <span className="card-number-text">{displayNum}</span>
      </div>

      <div className="card-overlay-bottom">
        <span className="card-rank-main">{mainName}</span>
        {subName && <span className="card-rank-sub">{subName}</span>}
      </div>
    </div>
  );
}
