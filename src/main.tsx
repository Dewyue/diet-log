import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { getStorageBackend, getStorageError, initStorage } from './db'
import './index.css'
import App from './App.tsx'

function Bootstrap() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    initStorage()
      .then(() => setReady(true))
      .catch((err) => {
        setError(err instanceof Error ? err.message : '存储初始化失败')
        setReady(true)
      })
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        正在初始化…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-lg font-semibold text-red-600">无法使用本地存储</p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <p className="mt-4 text-xs text-slate-400">
          请尝试：退出无痕模式、使用 Safari/Chrome 系统浏览器打开、或添加到主屏幕后重试。
        </p>
      </div>
    )
  }

  const backend = getStorageBackend()
  const storageNote = getStorageError()

  return (
    <>
      {storageNote && (
        <div className="bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          {storageNote}
        </div>
      )}
      {backend === 'localstorage' && !storageNote && (
        <div className="bg-sky-50 px-4 py-2 text-center text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-200">
          当前使用 localStorage 存储（手机局域网访问时的兼容模式）
        </div>
      )}
      <App />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <Bootstrap />
    </BrowserRouter>
  </StrictMode>,
)
