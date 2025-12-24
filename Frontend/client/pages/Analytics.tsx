'use client';

import { useMemory } from '@/data/memoryStore';
import { ArrowLeft, BarChart2, Hash, PieChart, Smile } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  ArcElement,
  BarElement,
  CategoryScale,
  ChartData,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

  const ChartCard = ({ title, icon: Icon, children }: { title: string, icon: React.ElementType, children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-6 shadow-xl transition-all hover:border-ring/50">
    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-card-foreground">
      <Icon className="h-5 w-5 text-cyan-400" />
      {title}
    </h2>
    <div className="relative h-80">{children}</div>
  </div>
);

// ... (createGradient function)

export default function AnalyticsPage() {
  const { items } = useMemory();

  // For Doughnut Chart 1: Content Type
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const type = item.type.charAt(0).toUpperCase() + item.type.slice(1);
      counts.set(type, (counts.get(type) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  // For Doughnut Chart 2: Emotion Breakdown
  const emotionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const emotion = (item.emotion || 'neutral').charAt(0).toUpperCase() + (item.emotion || 'neutral').slice(1);
      counts.set(emotion, (counts.get(emotion) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  // For Bar Chart 1: Top Keywords
  const keywordCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      (item.keywords || []).forEach(keyword => {
        const kw = keyword.charAt(0).toUpperCase() + keyword.slice(1);
        counts.set(kw, (counts.get(kw) || 0) + 1);
      });
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  // For Bar Chart 2: Top Sources
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      if (item.url) {
        try {
          const hostname = new URL(item.url).hostname.replace(/^www\./, '');
          counts.set(hostname, (counts.get(hostname) || 0) + 1);
        } catch (e) {
          // invalid URL
        }
      }
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [items]);

  // --- Artistic Color Palette ---
  const colors = {
    cyan: 'rgba(34, 211, 238, 0.7)',
    blue: 'rgba(59, 130, 246, 0.7)',
    purple: 'rgba(168, 85, 247, 0.7)',
    green: 'rgba(16, 185, 129, 0.7)',
    yellow: 'rgba(234, 179, 8, 0.7)',
    red: 'rgba(239, 68, 68, 0.7)',
    
    cyanFull: 'rgba(34, 211, 238, 1)',
    blueFull: 'rgba(59, 130, 246, 1)',
    purpleFull: 'rgba(168, 85, 247, 1)',
    greenFull: 'rgba(16, 185, 129, 1)',
  };

  const chartTextColor = '#71717a';
  const chartGridColor = '#e4e4e7';

  // --- Data for Doughnut 1 (Type) ---
  const typeChartData: ChartData<'doughnut'> = {
    labels: typeCounts.map(([type]) => type),
    datasets: [
      {
        label: '# of Memories',
        data: typeCounts.map(([, count]) => count),
        backgroundColor: [colors.cyan, colors.blue, colors.purple, colors.green, colors.yellow, colors.red],
        borderColor: '#18181b', // This might need to be dynamic or transparent? 
        borderWidth: 0, // Set to 0 for cleaner look in both themes
      },
    ],
  };

  // --- Data for Doughnut 2 (Emotion) ---
  const emotionChartData: ChartData<'doughnut'> = {
    labels: emotionCounts.map(([emotion]) => emotion),
    datasets: [
      {
        label: '# of Memories',
        data: emotionCounts.map(([, count]) => count),
        backgroundColor: [colors.green, colors.purple, colors.cyan, colors.blue, colors.yellow, colors.red],
        borderColor: '#18181b',
        borderWidth: 0,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
        legend: {
            position: 'bottom' as const,
            labels: {
                color: chartTextColor,
                font: { size: 12 },
                boxWidth: 15,
                padding: 15,
            },
        },
        title: { display: false },
    },
  };

  // --- Data for Horizontal Bar (Keywords) ---
  const keywordChartData: ChartData<'bar'> = {
    labels: keywordCounts.map(([kw]) => kw),
    datasets: [
      {
        label: 'Keyword Count',
        data: keywordCounts.map(([, count]) => count),
        backgroundColor: function(context) {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          // Use solid colors if gradient causes issues or simpler
          return colors.cyanFull; 
        },
        borderRadius: 4,
      },
    ],
  };

  const horizontalBarOptions = {
    indexAxis: 'y' as const, // This makes it horizontal
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        ticks: { color: chartTextColor },
        grid: { color: chartGridColor, drawOnChartArea: false },
      },
      x: {
        ticks: { color: chartTextColor },
        grid: { color: chartGridColor },
      },
    },
  };

  // --- Data for Vertical Bar (Sources) ---
  const sourceChartData: ChartData<'bar'> = {
    labels: sourceCounts.map(([source]) => source),
    datasets: [
      {
        label: 'Source Count',
        data: sourceCounts.map(([, count]) => count),
        backgroundColor: colors.blueFull,
        borderRadius: 4,
      },
    ],
  };

  const verticalBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      y: {
        ticks: { color: chartTextColor },
        grid: { color: chartGridColor },
      },
      x: {
        ticks: { color: chartTextColor, maxRotation: 45, minRotation: 45 },
        grid: { color: chartGridColor, drawOnChartArea: false },
      },
    },
  };

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          
          <ChartCard title="Content Type Distribution" icon={PieChart}>
            <Doughnut options={doughnutOptions} data={typeChartData} />
          </ChartCard>

          <ChartCard title="Emotion Breakdown" icon={Smile}>
            <Doughnut options={doughnutOptions} data={emotionChartData} />
          </ChartCard>

          <ChartCard title="Top Keywords" icon={Hash}>
            <Bar options={horizontalBarOptions} data={keywordChartData} />
          </ChartCard>

          <ChartCard title="Top Sources" icon={BarChart2}>
            <Bar options={verticalBarOptions} data={sourceChartData} />
          </ChartCard>
          
        </div>
      </div>
    </div>
  );
}
