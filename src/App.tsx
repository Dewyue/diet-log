import { NavLink, Route, Routes } from 'react-router-dom'
import CalendarPage from './pages/CalendarPage'
import SettingsPage from './pages/SettingsPage'
import TodayPage from './pages/TodayPage'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        [
          'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition',
          isActive
            ? 'text-orange-500 dark:text-orange-400'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
        ].join(' ')
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="mx-auto flex min-h-full max-w-[430px] flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-black/5 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-black/80">
        <div className="flex px-2 pb-[env(safe-area-inset-bottom)]">
          <NavItem to="/" label="今日" />
          <NavItem to="/calendar" label="数据" />
          <NavItem to="/settings" label="设置" />
        </div>
      </nav>
    </div>
  )
}
