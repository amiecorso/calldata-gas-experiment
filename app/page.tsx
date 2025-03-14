'use client';

import { useState } from 'react'
import { runExperiment, setLogFunction } from './lib/scripts/payment-escrow-experiment'

export default function Home() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const handleRunExperiment = async () => {
    setLoading(true)
    setError(null)
    setLogs([]) // Clear previous logs
    
    // Set up logging
    setLogFunction((message: string) => {
      setLogs(prev => [...prev, message])
    })
    
    try {
      const receipt = await runExperiment()
      setResult(JSON.stringify(receipt, null, 2))
    } catch (err) {
      console.error('Error running experiment:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Payment Escrow Gas Experiment</h1>
      
      <button
        onClick={handleRunExperiment}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Run Experiment'}
      </button>

      {error && (
        <div className="text-red-500 mb-4">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-2">Results:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {result}
          </pre>
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-bold mb-2">Logs:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {logs.join('\n')}
          </pre>
        </div>
      )}
    </main>
  )
}
