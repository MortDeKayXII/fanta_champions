import { Route, Routes } from 'react-router-dom'

function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold text-blue-800">Fanta Champions</h1>
      <p className="mt-2 text-slate-600">Il sito è in costruzione.</p>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
