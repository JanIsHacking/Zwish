import type { RpmPoint } from '../../../shared/api/types';

interface RpmChartProps {
  measured: RpmPoint[];
  fitted?: RpmPoint[];
  xDomain?: { min: number; max: number };
  guideRpm?: number;
}

const WIDTH = 640;
const HEIGHT = 260;
const PAD_LEFT = 62;
const PAD_RIGHT = 16;
const PAD_BOTTOM = 40;

export function RpmChart({ measured, fitted = [], xDomain, guideRpm }: RpmChartProps) {
  const points = [...measured, ...fitted];
  const xMin = xDomain?.min ?? Math.min(0, ...points.map((point) => point.tSec), 0);
  const xMax = xDomain?.max ?? Math.max(1, ...points.map((point) => point.tSec));
  const yValues = points.map((point) => point.wheelRpm);
  const yMin = Math.min(0, ...yValues, 0);
  const yMax = Math.max(guideRpm ?? 0, ...yValues, 1) * (yMin < 0 ? 1 : 1.08);
  const xTicks = ticks(xMin, xMax, 4);
  const yTicks = ticks(yMin, yMax, 4);
  const padTop = fitted.length > 1 ? 32 : 16;
  const mapX = (value: number) => PAD_LEFT + ((value - xMin) / span(xMin, xMax)) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const mapY = (value: number) => padTop + (1 - (value - yMin) / span(yMin, yMax)) * (HEIGHT - padTop - PAD_BOTTOM);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-64 w-full" role="img" aria-label="Wheel rpm against time">
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={mapY(tick)} y2={mapY(tick)} stroke="#3a4032" />
          <text x={PAD_LEFT - 8} y={mapY(tick) + 4} textAnchor="end" fill="#a39e90" fontSize="12">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <text key={`x-${tick}`} x={mapX(tick)} y={HEIGHT - PAD_BOTTOM + 18} textAnchor="middle" fill="#a39e90" fontSize="12">
          {formatTick(tick)}
        </text>
      ))}
      {guideRpm !== undefined ? (
        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={mapY(guideRpm)}
          y2={mapY(guideRpm)}
          stroke="#8eb6ff"
          strokeDasharray="5 4"
        />
      ) : null}
      {measured.length > 1 ? (
        <polyline fill="none" stroke="#a39e90" strokeWidth="2" points={toPoints(measured, mapX, mapY)} />
      ) : null}
      {fitted.length > 1 ? (
        <polyline fill="none" stroke="#e4f25a" strokeWidth="2.5" points={toPoints(fitted, mapX, mapY)} />
      ) : null}
      <text x={(PAD_LEFT + WIDTH - PAD_RIGHT) / 2} y={HEIGHT - 6} textAnchor="middle" fill="#a39e90" fontSize="13">
        Time (s)
      </text>
      <text
        transform={`translate(16 ${(padTop + HEIGHT - PAD_BOTTOM) / 2}) rotate(-90)`}
        textAnchor="middle"
        fill="#a39e90"
        fontSize="13"
      >
        Wheel rpm
      </text>
      {fitted.length > 1 ? (
        <g>
          <line x1={PAD_LEFT + 8} x2={PAD_LEFT + 28} y1={14} y2={14} stroke="#a39e90" strokeWidth="2" />
          <text x={PAD_LEFT + 34} y={18} fill="#a39e90" fontSize="12">
            Measured
          </text>
          <line x1={PAD_LEFT + 108} x2={PAD_LEFT + 128} y1={14} y2={14} stroke="#e4f25a" strokeWidth="2.5" />
          <text x={PAD_LEFT + 134} y={18} fill="#e4f25a" fontSize="12">
            Fit
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function toPoints(points: RpmPoint[], mapX: (value: number) => number, mapY: (value: number) => number): string {
  return points.map((point) => `${mapX(point.tSec).toFixed(1)},${mapY(point.wheelRpm).toFixed(1)}`).join(' ');
}

function span(min: number, max: number): number {
  return max - min || 1;
}

function ticks(min: number, max: number, count: number): number[] {
  const step = niceStep((max - min) / count);
  const start = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let value = start; value <= max + step * 0.01; value += step) {
    values.push(Math.abs(value) < 1e-9 ? 0 : value);
    if (values.length > 8) {
      break;
    }
  }
  return values;
}

function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 10 || Number.isInteger(value)) {
    return String(Math.round(value));
  }
  return value.toFixed(1);
}
