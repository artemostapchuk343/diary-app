import { useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, BarChart2 } from 'lucide-react'

const TABS = [
  { path: '/',        label: 'Diary',   icon: BookOpen,  match: p => p === '/' || p.startsWith('/entry') },
  { path: '/finance', label: 'Finance', icon: BarChart2, match: p => p.startsWith('/finance') },
]

export default function TabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-black/50 backdrop-blur-md border-t border-white/[0.06]">
      <div className="flex">
        {TABS.map(({ path, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex-1 flex flex-col items-center gap-1 py-3 transition-colors"
            >
              <Icon size={22} className={active ? 'text-emerald-400' : 'text-slate-500'} />
              <span className={`text-xs font-medium ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-emerald-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
