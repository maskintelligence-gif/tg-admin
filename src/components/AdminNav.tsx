import { Home, Package, MessageCircle, DollarSign, ShoppingBag, BarChart2, Images } from 'lucide-react';

export type AdminTab = 'home' | 'orders' | 'chat' | 'payments' | 'products' | 'media' | 'reports';

interface AdminNavProps {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  badges?: Partial<Record<AdminTab, number>>;
}

const tabs: { id: AdminTab; label: string; Icon: any }[] = [
  { id: 'home',     label: 'Home',    Icon: Home },
  { id: 'orders',   label: 'Orders',  Icon: Package },
  { id: 'chat',     label: 'Chat',    Icon: MessageCircle },
  { id: 'payments', label: 'Pay',     Icon: DollarSign },
  { id: 'products', label: 'Products',Icon: ShoppingBag },
  { id: 'media',    label: 'Media',   Icon: Images },
  { id: 'reports',  label: 'Reports', Icon: BarChart2 },
];

export function AdminNav({ active, onChange, badges = {} }: AdminNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
      {/* Scrollable so all 7 tabs fit on small screens */}
      <div className="flex overflow-x-auto no-scrollbar">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = active === id;
          const badge = badges[id];
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex-shrink-0 flex flex-col items-center gap-0.5 py-2 px-2.5 transition-colors relative"
              style={{
                color: isActive ? 'var(--accent)' : 'var(--text3)',
                minWidth: '52px',
              }}
            >
              <div className="relative">
                <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                    style={{ background: 'var(--rose)', color: 'white' }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-medium leading-tight">{label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: 'var(--accent)' }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
