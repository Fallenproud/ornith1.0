/**
 * ULTIMATE ORNITH 1.0 — Real-Time Mathematical SVG Curves
 * 
 * Plots actual loss and accuracy curves from epoch metrics with high precision.
 */

import React from 'react';
import { EpochMetric } from '../types';

interface SvgLossChartProps {
  history: EpochMetric[];
  height?: number;
}

export const SvgLossChart: React.FC<SvgLossChartProps> = ({ history, height = 220 }) => {
  if (!history || history.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111111]/70 p-6 text-center text-xs text-[#A3A3A0]"
        style={{ height }}
      >
        Ingen treningsmålinger ennå. Start en treningsøkt for å se sanntids tapskurve (Loss).
      </div>
    );
  }

  const padding = { top: 20, right: 30, bottom: 30, left: 45 };
  const width = 600; // viewBox width for fluid responsiveness

  const epochs = history.map((h) => h.epoch);
  const minEpoch = 1;
  const maxEpoch = Math.max(...epochs, 5);

  const losses = history.map((h) => h.loss);
  const valLosses = history.map((h) => h.valLoss);
  const maxLoss = Math.max(...losses, ...valLosses, 1.0) * 1.1;
  const minLoss = 0;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (epoch: number) => {
    return padding.left + ((epoch - minEpoch) / (maxEpoch - minEpoch || 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return padding.top + chartHeight - ((val - minLoss) / (maxLoss - minLoss || 1)) * chartHeight;
  };

  const trainPath = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(h.epoch).toFixed(1)} ${getY(h.loss).toFixed(1)}`)
    .join(' ');

  const valPath = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(h.epoch).toFixed(1)} ${getY(h.valLoss).toFixed(1)}`)
    .join(' ');

  const yTicks = [0, maxLoss * 0.25, maxLoss * 0.5, maxLoss * 0.75, maxLoss];

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="inline-block h-2 w-2 rounded-full bg-[#8F2BFF]" />
            <span className="text-[#F4F4F2]">Treningstap (Loss)</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="inline-block h-2 w-2 rounded-full bg-[#77F23B]" />
            <span className="text-[#A3A3A0]">Valideringstap</span>
          </div>
        </div>
        <span className="font-mono text-[11px] text-[#A3A3A0]">
          Siste: {history[history.length - 1].loss.toFixed(4)}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        {/* Horizontal gridlines */}
        {yTicks.map((val, idx) => (
          <g key={idx}>
            <line
              x1={padding.left}
              y1={getY(val)}
              x2={width - padding.right}
              y2={getY(val)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 3"
            />
            <text
              x={padding.left - 8}
              y={getY(val) + 3}
              textAnchor="end"
              className="fill-[#6B6B67] text-[10px] font-mono"
            >
              {val.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Train curve */}
        <path
          d={trainPath}
          fill="none"
          stroke="#8F2BFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Validation curve */}
        <path
          d={valPath}
          fill="none"
          stroke="#77F23B"
          strokeWidth="2"
          strokeDasharray="4 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {history.map((h) => (
          <g key={h.epoch}>
            <circle cx={getX(h.epoch)} cy={getY(h.loss)} r="3" fill="#8F2BFF" />
            <circle cx={getX(h.epoch)} cy={getY(h.valLoss)} r="2.5" fill="#77F23B" />
          </g>
        ))}
      </svg>
    </div>
  );
};

export const SvgAccuracyChart: React.FC<SvgLossChartProps> = ({ history, height = 220 }) => {
  if (!history || history.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111111]/70 p-6 text-center text-xs text-[#A3A3A0]"
        style={{ height }}
      >
        Ingen treningsmålinger ennå.
      </div>
    );
  }

  const padding = { top: 20, right: 30, bottom: 30, left: 45 };
  const width = 600;

  const epochs = history.map((h) => h.epoch);
  const minEpoch = 1;
  const maxEpoch = Math.max(...epochs, 5);

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (epoch: number) => {
    return padding.left + ((epoch - minEpoch) / (maxEpoch - minEpoch || 1)) * chartWidth;
  };

  const getY = (acc: number) => {
    // 0 to 1.0
    return padding.top + chartHeight - acc * chartHeight;
  };

  const trainPath = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(h.epoch).toFixed(1)} ${getY(h.accuracy).toFixed(1)}`)
    .join(' ');

  const valPath = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(h.epoch).toFixed(1)} ${getY(h.valAccuracy).toFixed(1)}`)
    .join(' ');

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono">
            <span className="inline-block h-2 w-2 rounded-full bg-[#39D9E6]" />
            <span className="text-[#F4F4F2]">Treningsnøyaktighet</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="inline-block h-2 w-2 rounded-full bg-[#B25CFF]" />
            <span className="text-[#A3A3A0]">Valideringsnøyaktighet</span>
          </div>
        </div>
        <span className="font-mono text-[11px] text-[#A3A3A0]">
          Siste: {(history[history.length - 1].accuracy * 100).toFixed(1)}%
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1.0].map((val, idx) => (
          <g key={idx}>
            <line
              x1={padding.left}
              y1={getY(val)}
              x2={width - padding.right}
              y2={getY(val)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="3 3"
            />
            <text
              x={padding.left - 8}
              y={getY(val) + 3}
              textAnchor="end"
              className="fill-[#6B6B67] text-[10px] font-mono"
            >
              {Math.round(val * 100)}%
            </text>
          </g>
        ))}

        <path
          d={trainPath}
          fill="none"
          stroke="#39D9E6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d={valPath}
          fill="none"
          stroke="#B25CFF"
          strokeWidth="2"
          strokeDasharray="4 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {history.map((h) => (
          <g key={h.epoch}>
            <circle cx={getX(h.epoch)} cy={getY(h.accuracy)} r="3" fill="#39D9E6" />
            <circle cx={getX(h.epoch)} cy={getY(h.valAccuracy)} r="2.5" fill="#B25CFF" />
          </g>
        ))}
      </svg>
    </div>
  );
};
