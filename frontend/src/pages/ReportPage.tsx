import { Button, Card } from '../components/ui'
import { api } from '../api/client'
import { useToast } from '../components/ux'

export function ReportPage() {
  const toast = useToast()

  const download = async () => {
    try {
      const res = await fetch(api.reportUrl())
      if (!res.ok) throw new Error('Failed to generate report')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'nexus_quant_research_report.pdf'
      a.click()
      URL.revokeObjectURL(url)
      toast.push('Research report downloaded')
    } catch (e) {
      toast.push((e as Error).message, 'err')
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card
        title="Research Report Generator"
        subtitle="One-click PDF covering dataset, features, models, SHAP and insights"
      >
        <p className="text-sm text-[var(--color-muted)] mb-6 leading-relaxed">
          The report includes an executive summary, dataset overview, feature engineering notes,
          model comparison tables, hyperparameters, evaluation metrics, SHAP drivers,
          latest predictions, research insights, and suggested future improvements.
        </p>
        <Button onClick={download}>Generate Research Report</Button>
      </Card>
    </div>
  )
}
