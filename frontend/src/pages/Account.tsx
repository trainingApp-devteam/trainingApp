import React, { useState } from "react";
import { getAccountBodyWeight, saveAccountBodyWeight } from "../api/accountProfile";

export default function Account(): JSX.Element {
  const [bodyWeight, setBodyWeight] = useState(() => {
    const savedWeight = getAccountBodyWeight()
    return savedWeight === null ? '' : String(savedWeight)
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = Number(bodyWeight)
    if (bodyWeight === '' || !Number.isFinite(value) || value < 20 || value > 300) {
      setError('体重は20〜300kgの範囲で入力してください')
      setMessage('')
      return
    }

    saveAccountBodyWeight(value)
    setError('')
    setMessage('体重を保存しました')
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-4">アカウント</h2>
      <form onSubmit={saveProfile} className="max-w-xl space-y-4 rounded-lg bg-white p-6 text-gray-900 shadow-sm">
        <h3 className="text-lg font-semibold">プロフィール</h3>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">体重（kg）</span>
          <input
            type="number"
            min={20}
            max={300}
            step={0.1}
            value={bodyWeight}
            onChange={(event) => setBodyWeight(event.target.value)}
            required
            className="w-40 rounded border px-3 py-2"
          />
        </label>
        <p className="text-sm text-gray-600">トレーニングの消費カロリー推定に使用します。</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="text-sm text-green-700">{message}</p>}
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700">
          保存
        </button>
      </form>
    </div>
  );
}
