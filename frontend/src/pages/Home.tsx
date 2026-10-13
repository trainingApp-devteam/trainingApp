import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

type LinkItem = { key: string; label: string; to: string };

const links: LinkItem[] = [
  { key: "record", label: "記録", to: "/record" },
  { key: "history", label: "履歴", to: "/history" },
  { key: "body", label: "身体測定", to: "/body" },
  { key: "menu", label: "メニュー", to: "/menu" },
  { key: "account", label: "アカウント", to: "/account" },
];

export default function Home(): JSX.Element {
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!(e.target instanceof Node)) return
      if (!menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  return (
    <div className="container mx-auto px-4 py-10">

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-2 bg-white/5 p-6 rounded-2xl shadow-lg">
          <h2 className="text-xl font-semibold mb-4">トレーニングを記録</h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/record/select"
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 rounded-lg font-medium text-center"
            >
              今すぐ記録
            </Link>
            <Link
              to="/menu"
              className="flex-1 border border-gray-600 text-gray-100 py-3 rounded-lg text-center"
            >
              メニューを作成
            </Link>
          </div>

          <div className="mt-6 text-gray-300">
            <h3 className="font-semibold mb-2">直近の記録</h3>
            <div className="p-4 bg-white/3 rounded-lg">
              まだ記録がありません。最初の記録を追加しましょう。
            </div>
          </div>
        </section>

        <aside className="bg-white/5 p-6 rounded-2xl shadow-inner">
          <h3 className="text-lg font-semibold mb-4">クイックリンク</h3>
          <nav className="flex flex-col gap-3">
            {links.map((l) => (
              <Link
                key={l.key}
                to={l.to}
                className="px-3 py-2 rounded-md bg-white/3 hover:bg-white/10"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 text-sm text-gray-400">
            <div className="font-medium text-gray-200 mb-1">身体測定</div>
            <div>体重: — kg</div>
            <div>身長: — cm</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
