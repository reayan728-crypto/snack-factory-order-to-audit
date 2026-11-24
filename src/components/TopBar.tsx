import { ScreenView } from '../types/erp';

interface TopBarProps {
  activeScreen: ScreenView;
  onSelectScreen: (screen: ScreenView) => void;
  onOpenNewWorkOrder: () => void;
}

const NAV_ITEMS: { id: ScreenView; label: string }[] = [
  { id: ScreenView.LINE_OVERVIEW, label: 'Line Overview' },
  { id: ScreenView.PRODUCTION_SCHEDULE, label: 'Production Schedule' },
  { id: ScreenView.WORKSTATION_TELEMETRY, label: 'Workstation Telemetry' },
  { id: ScreenView.QUALITY_VARIANCE, label: 'Quality & Variance' },
  { id: ScreenView.MATERIAL_STAGING, label: 'Material Staging' },
];

export function TopBar({
  activeScreen,
  onSelectScreen,
  onOpenNewWorkOrder,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="max-w-[1440px] mx-auto px-4 h-14 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onSelectScreen(ScreenView.LINE_OVERVIEW)}
          className="font-display text-[17px] font-semibold tracking-tight text-[#0F172A] dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#2563EB] rounded"
        >
          Vektor MES
        </button>

        <nav
          aria-label="Primary Console Navigation"
          className="flex items-center gap-6 overflow-x-auto no-scrollbar h-full"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectScreen(item.id)}
                className={`relative h-full flex items-center text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[#2563EB] ${
                  isActive
                    ? 'text-[#0F172A] dark:text-white'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2563EB]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenNewWorkOrder}
            className="px-3.5 py-2 rounded bg-[#1E293B] hover:bg-[#0F172A] text-white text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
          >
            New Work Order
          </button>
        </div>
      </div>
    </header>
  );
}
