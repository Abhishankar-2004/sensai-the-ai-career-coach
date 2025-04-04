"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect, useState } from "react";
import { format, subDays, isWithinInterval } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart as BarChartIcon, 
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Calendar,
  Award,
  Target,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function PerformanceChart({ assessments }) {
  const [chartData, setChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [activeTab, setActiveTab] = useState("trend");
  const [timeRange, setTimeRange] = useState("all");
  const [stats, setStats] = useState({
    average: 0,
    highest: 0,
    lowest: 0,
    total: 0,
    improvement: 0,
    categories: {}
  });

  useEffect(() => {
    if (assessments && assessments.length > 0) {
      // Calculate statistics
      const scores = assessments.map(a => a.quizScore);
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      const highest = Math.max(...scores);
      const lowest = Math.min(...scores);
      
      // Calculate improvement (comparing first and last assessment)
      let improvement = 0;
      if (assessments.length >= 2) {
        const firstScore = assessments[0].quizScore;
        const lastScore = assessments[assessments.length - 1].quizScore;
        improvement = lastScore - firstScore;
      }
      
      // Group by category
      const categories = {};
      assessments.forEach(assessment => {
        if (!categories[assessment.category]) {
          categories[assessment.category] = {
            count: 0,
            total: 0,
            average: 0
          };
        }
        categories[assessment.category].count++;
        categories[assessment.category].total += assessment.quizScore;
        categories[assessment.category].average = 
          categories[assessment.category].total / categories[assessment.category].count;
      });
      
      setStats({
        average,
        highest,
        lowest,
        total: assessments.length,
        improvement,
        categories
      });
      
      // Format data for charts
      const formattedData = assessments.map((assessment) => ({
        date: format(new Date(assessment.createdAt), "MMM dd"),
        fullDate: new Date(assessment.createdAt),
        score: assessment.quizScore,
        category: assessment.category,
        improvementTip: assessment.improvementTip
      }));
      
      setChartData(formattedData);
      
      // Format category data for pie chart
      const categoryChartData = Object.entries(categories).map(([name, data]) => ({
        name,
        value: data.average,
        count: data.count
      }));
      
      setCategoryData(categoryChartData);
    }
  }, [assessments]);

  // Filter data based on time range
  const getFilteredData = () => {
    if (timeRange === "all") return chartData;
    
    const today = new Date();
    let startDate;
    
    switch (timeRange) {
      case "week":
        startDate = subDays(today, 7);
        break;
      case "month":
        startDate = subDays(today, 30);
        break;
      case "3months":
        startDate = subDays(today, 90);
        break;
      default:
        return chartData;
    }
    
    return chartData.filter(item => 
      isWithinInterval(item.fullDate, { start: startDate, end: today })
    );
  };

  const filteredData = getFilteredData();
  
  // Custom tooltip for the performance chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} className="text-xs flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="font-medium">{entry.name}:</span> {entry.value}%
            </p>
          ))}
          {payload[0]?.payload.improvementTip && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-primary">Improvement Tip:</p>
              <p className="text-xs">{payload[0].payload.improvementTip}</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Colors for different categories
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="gradient-title text-3xl md:text-4xl">
              Performance Analytics
            </CardTitle>
            <CardDescription>Track your interview preparation progress</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge 
              variant={timeRange === "all" ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => setTimeRange("all")}
            >
              All Time
            </Badge>
            <Badge 
              variant={timeRange === "3months" ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => setTimeRange("3months")}
            >
              3 Months
            </Badge>
            <Badge 
              variant={timeRange === "month" ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => setTimeRange("month")}
            >
              1 Month
            </Badge>
            <Badge 
              variant={timeRange === "week" ? "default" : "outline"} 
              className="cursor-pointer"
              onClick={() => setTimeRange("week")}
            >
              1 Week
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.average.toFixed(1)}%</div>
              <Progress value={stats.average} className="mt-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Highest Score</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.highest.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total} assessments completed
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Improvement</CardTitle>
              {stats.improvement > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.improvement > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stats.improvement > 0 ? '+' : ''}{stats.improvement.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Since your first assessment
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.keys(stats.categories).map(category => (
                  <Badge key={category} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Chart Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="trend" className="flex items-center gap-1">
              <LineChartIcon className="h-3 w-3" />
              <span className="hidden sm:inline">Trend</span>
            </TabsTrigger>
            <TabsTrigger value="category" className="flex items-center gap-1">
              <PieChartIcon className="h-3 w-3" />
              <span className="hidden sm:inline">Categories</span>
            </TabsTrigger>
            <TabsTrigger value="distribution" className="flex items-center gap-1">
              <BarChartIcon className="h-3 w-3" />
              <span className="hidden sm:inline">Distribution</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="trend" className="mt-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={filteredData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="score" name="Score" fill="#8884d8" radius={[4, 4, 0, 0]}>
                    {filteredData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    name="Score Trend" 
                    stroke="#ff7300" 
                    strokeWidth={2} 
                    dot={{ r: 4 }} 
                    activeDot={{ r: 8 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="category" className="mt-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={150}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-md">
                            <p className="font-medium">{payload[0].name}</p>
                            <p className="text-sm">Score: {payload[0].value.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">
                              {payload[0].payload.count} assessments
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="distribution" className="mt-4">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="score" name="Score" fill="#8884d8">
                    {filteredData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.score >= 70 ? '#00C49F' : entry.score >= 50 ? '#FFBB28' : '#FF8042'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
