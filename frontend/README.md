# Nexus frontend

React/Vite interface for the Nexus historical stock-intelligence workspace.

## Development

```bash
npm ci
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` to the FastAPI service on port `8000`.

## Production build

```bash
npm run build
```

The Docker image builds the application and serves it through Nginx. Routes are code-split so
the charting bundle is loaded only when a visualization page needs it.

## Product surfaces

- AI forecast dashboard
- Market Pulse breadth and industry view
- AI stock scanner
- Multi-stock relative-performance comparison
- Multi-horizon Forecast Lab and capital stress test
- Historical market charts
- Browser-persistent watchlist and research notes
- Held-out forecast track record

All results are based on the bundled archive ending 30 April 2021. The frontend deliberately
labels forecasts and comparisons as historical rather than live-market output.
