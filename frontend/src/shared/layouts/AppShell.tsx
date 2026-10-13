import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import {
  BikeIcon,
  HomeIcon,
  LogoutIcon,
  PlansIcon,
  ProfileIcon,
  RidersIcon,
  TrainerIcon,
  ZoneTestIcon,
} from '../ui/icons';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-full px-3 py-2 text-sm ${
    isActive ? 'bg-panel-2 text-signal' : 'text-muted hover:bg-panel-2 hover:text-paper'
  }`;

export function AppShell() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel px-3 py-6">
        <p className="num px-3 text-3xl tracking-wide text-signal">Zwish</p>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          <NavItem to="/" end icon={<HomeIcon className="h-4 w-4" />}>
            Home
          </NavItem>
          <NavItem to="/plans" icon={<PlansIcon className="h-4 w-4" />}>
            Plans
          </NavItem>
          <NavItem to="/zone-tests" icon={<ZoneTestIcon className="h-4 w-4" />}>
            Zone test
          </NavItem>
          <NavItem to="/bikes" icon={<BikeIcon className="h-4 w-4" />}>
            Bikes
          </NavItem>
          <NavItem to="/trainers" icon={<TrainerIcon className="h-4 w-4" />}>
            Trainers
          </NavItem>
          <NavItem to="/profile" icon={<ProfileIcon className="h-4 w-4" />}>
            Profile
          </NavItem>
          {user?.role === 'admin' ? (
            <NavItem to="/riders" icon={<RidersIcon className="h-4 w-4" />}>
              Riders
            </NavItem>
          ) : null}
        </nav>
        <button
          className="flex items-center gap-2.5 rounded-full px-3 py-2 text-left text-sm text-muted hover:bg-panel-2 hover:text-paper"
          onClick={() => void logout()}
        >
          <LogoutIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">Log out {user?.name}</span>
        </button>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({
  to,
  end,
  icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <NavLink to={to} end={end} className={linkClass}>
      {icon}
      {children}
    </NavLink>
  );
}
