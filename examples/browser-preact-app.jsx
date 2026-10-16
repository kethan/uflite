import { app, useRouter } from './browser-preact'

app.get('/', () => <h1>🏠 Preact Home</h1>)
app.get('/about', () => <h1>ℹ️ Preact About</h1>)

export default function App() {
  const [view, linkProps] = useRouter(<h1>Loading...</h1>)

  return (
    <div {...linkProps} style={{ display: 'flex', gap: '20px' }}>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
      {/* Passing the signal wrapper directly handles fine-grained UI swaps */}
      <main>{view}</main>
    </div>
  )
}
