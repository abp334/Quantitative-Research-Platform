import { featureLabel } from './financeGlossary'

export type ResearchStance =
  | 'constructive'
  | 'cautious_constructive'
  | 'neutral'
  | 'cautious_defensive'
  | 'defensive'

export type DecisionBrief = {
  stance: ResearchStance
  headline: string
  plainEnglish: string
  actionHint: string
  checklist: Array<{ ok: boolean; text: string }>
  whyInPlainWords: string[]
  riskNotes: string[]
}

function stanceFromSignal(label: string, confidence: number, probabilityUp: number): ResearchStance {
  const up = label === 'UP'
  if (up && confidence >= 0.55) return 'constructive'
  if (up && confidence >= 0.3) return 'cautious_constructive'
  if (!up && confidence >= 0.55) return 'defensive'
  if (!up && confidence >= 0.3) return 'cautious_defensive'
  // Near coin-flip
  if (probabilityUp >= 0.48 && probabilityUp <= 0.52) return 'neutral'
  return up ? 'cautious_constructive' : 'cautious_defensive'
}

const STANCE_COPY: Record<
  ResearchStance,
  { headline: string; actionHint: string; tone: 'up' | 'down' | 'neutral' }
> = {
  constructive: {
    headline: 'Constructive short-horizon bias',
    actionHint:
      'Model leans bullish with meaningful conviction. Treat as a research lean to investigate further — not an automatic buy.',
    tone: 'up',
  },
  cautious_constructive: {
    headline: 'Mildly constructive — contested',
    actionHint:
      'Lean is UP but conviction is modest. Wait for price/volume confirmation or compare with peers before acting.',
    tone: 'up',
  },
  neutral: {
    headline: 'No clear edge',
    actionHint:
      'Probability sits near a coin flip. Do not use this output to initiate a position; dig into Data Explorer or skip.',
    tone: 'neutral',
  },
  cautious_defensive: {
    headline: 'Mildly defensive — contested',
    actionHint:
      'Lean is DOWN with modest conviction. Prefer caution on new longs for this horizon; confirm with charts and risk limits.',
    tone: 'down',
  },
  defensive: {
    headline: 'Defensive short-horizon bias',
    actionHint:
      'Model leans bearish with meaningful conviction. Research stance: avoid fresh long exposure for this horizon unless other evidence overrides.',
    tone: 'down',
  },
}

export function stanceTone(stance: ResearchStance): 'up' | 'down' | 'neutral' {
  return STANCE_COPY[stance].tone
}

export function buildDecisionBrief(input: {
  symbol: string
  label: string
  probabilityUp: number
  confidence: number
  horizon: number
  asOfDate?: string
  topFeatures?: Array<{ feature: string; shap: number }>
}): DecisionBrief {
  const { symbol, label, probabilityUp, confidence, horizon, asOfDate, topFeatures = [] } = input
  const stance = stanceFromSignal(label, confidence, probabilityUp)
  const copy = STANCE_COPY[stance]
  const horizonTxt = horizon === 1 ? 'the next trading session' : `the next ${horizon} trading sessions`

  const drivers = [...topFeatures]
    .sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap))
    .slice(0, 3)

  const whyInPlainWords = drivers.map((d) => {
    const name = featureLabel(d.feature)
    if (d.shap >= 0) {
      return `${name} is pushing the model toward a rise over ${horizonTxt}.`
    }
    return `${name} is pushing the model toward a fall over ${horizonTxt}.`
  })

  if (whyInPlainWords.length === 0) {
    whyInPlainWords.push('Not enough factor detail was returned to explain the drivers in plain language.')
  }

  const checklist = [
    {
      ok: confidence >= 0.35,
      text: 'Conviction is high enough to care (not a pure coin flip)',
    },
    {
      ok: label === 'UP' ? probabilityUp >= 0.55 : probabilityUp <= 0.45,
      text: 'Directional probability is clearly on one side of 50%',
    },
    {
      ok: drivers.length >= 2,
      text: 'At least two technical factors support the same story',
    },
    {
      ok: drivers.filter((d) => (label === 'UP' ? d.shap > 0 : d.shap < 0)).length >= 1,
      text: 'Top drivers agree with the UP/DOWN label (not fighting it)',
    },
  ]

  const agreement = checklist.filter((c) => c.ok).length
  const plainEnglish =
    stance === 'neutral'
      ? `For ${symbol}, the model does not see a usable edge over ${horizonTxt}` +
        (asOfDate ? ` (as of ${asOfDate})` : '') +
        `. Probability of an up move is ${formatPct(probabilityUp)}.`
      : `For ${symbol}, the research model sees a ${label === 'UP' ? 'bullish' : 'bearish'} lean over ${horizonTxt}` +
        (asOfDate ? ` (as of ${asOfDate})` : '') +
        `. Chance of an up move: ${formatPct(probabilityUp)}. Conviction: ${formatPct(confidence)}. ` +
        `${agreement}/4 checklist items pass — use that as a go / no-go filter, not a guarantee.`

  const riskNotes = [
    'This is a quantitative research signal on historical OHLCV features — not personalized investment advice.',
    'The training data ends with the Kaggle NIFTY-50 archive (~2021). Do not treat outputs as live market orders.',
    'Always size positions with your own risk rules, liquidity, and fundamental view. Model hit-rate ≠ your P&L.',
  ]

  return {
    stance,
    headline: copy.headline,
    plainEnglish,
    actionHint: copy.actionHint,
    checklist,
    whyInPlainWords,
    riskNotes,
  }
}

function formatPct(x: number): string {
  return `${(x * 100).toFixed(0)}%`
}

/** Suggested user workflow shown before they run a prediction. */
export const HOW_TO_DECIDE_STEPS = [
  {
    step: 1,
    title: 'Pick a stock & horizon',
    body: 'Choose the name you care about and how far ahead you want the lean (1 / 3 / 5 sessions).',
  },
  {
    step: 2,
    title: 'Read the research stance',
    body: 'After Predict, start with the green/red verdict card — constructive, defensive, or no clear edge.',
  },
  {
    step: 3,
    title: 'Check the checklist',
    body: 'Only act on further research when conviction, probability, and drivers line up. If items fail, skip or dig deeper.',
  },
  {
    step: 4,
    title: 'Confirm elsewhere',
    body: 'Open Data Explorer for the chart, Models for hit-rate quality, then apply your own risk rules before any capital decision.',
  },
] as const
