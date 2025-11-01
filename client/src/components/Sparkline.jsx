/**
 * Sparkline Component
 * Small SVG line chart for showing trends
 */
const Sparkline = ({ data, width = 100, height = 30, color = '#10b981' }) => {
  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} className="opacity-50">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="2" />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1; // Avoid division by zero

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default Sparkline;

