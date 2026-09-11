// Lean ECharts build: only the renderer/chart/components this app actually uses (see
// `chartConfig.ts`), avoiding pulling in the full `echarts` bundle (maps, 3D, etc.).
import * as echarts from 'echarts/core'
import { BarChart, BoxplotChart, HeatmapChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  BoxplotChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export default echarts
export type { ECharts, EChartsOption } from 'echarts'
