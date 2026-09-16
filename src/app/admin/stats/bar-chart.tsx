import type { BucketStat } from "@/lib/stats";

// 새 차트 라이브러리를 추가하지 않고(불필요한 의존성 추가는 CLAUDE.md 원칙과 어긋남),
// "간단한 그래프" 요구사항에 맞춰 순수 SVG로 막대그래프를 그린다. 데이터가 적은 POC 규모에 충분하다.
export default function BarChart({ data }: { data: BucketStat[] }) {
  const width = 640;
  const height = 180;
  const paddingBottom = 24;
  const paddingTop = 12;
  const chartHeight = height - paddingBottom - paddingTop;
  const maxValue = Math.max(1, ...data.map((d) => d.questions));
  const groupWidth = width / Math.max(1, data.length);
  const barWidth = Math.min(18, groupWidth / 3);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="기간별 질문 수 · 활성 사용자 수">
      {data.map((d, i) => {
        const groupX = i * groupWidth + groupWidth / 2;
        const qHeight = (d.questions / maxValue) * chartHeight;
        const uHeight = (d.activeUsers / maxValue) * chartHeight;
        return (
          <g key={d.label}>
            <rect
              x={groupX - barWidth - 2}
              y={paddingTop + chartHeight - qHeight}
              width={barWidth}
              height={qHeight}
              rx={2}
              className="fill-zinc-900 dark:fill-zinc-100"
            />
            <rect
              x={groupX + 2}
              y={paddingTop + chartHeight - uHeight}
              width={barWidth}
              height={uHeight}
              rx={2}
              className="fill-amber-500"
            />
            <text
              x={groupX}
              y={height - 6}
              textAnchor="middle"
              className="fill-zinc-500 text-[9px]"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
