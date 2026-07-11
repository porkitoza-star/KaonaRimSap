import type { DashboardGranularity } from '@/lib/types';

const OPTIONS: { value: DashboardGranularity; label: string }[] = [
  { value: 'day', label: 'รายวัน' },
  { value: 'month', label: 'รายเดือน' },
  { value: 'year', label: 'รายปี' },
];

export function GranularityToggle({
  value,
  onChange,
}: {
  value: DashboardGranularity;
  onChange: (value: DashboardGranularity) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1 font-medium transition ${
            value === opt.value ? 'bg-white text-[#1B5E3A] shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
