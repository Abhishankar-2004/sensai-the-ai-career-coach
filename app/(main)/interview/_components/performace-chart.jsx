"use client";

import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
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
  Award,
  Target,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function PerformanceChart({ assessments, mockInterviews = [] }) {
  const [chartData, setChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [activeTab, setActiveTab] = useState("trend");
  const [timeRange, setTimeRange] = useState("all");
  const [dataType, setDataType] = useState("assessments"); // "assessments" or "interviews"
  const [stats, setStats] = useState({
    average: 0,
    highest: 0,
    lowest: 0,
    total: 0,
    improvement: 0,
    categories: {}
  });

  useEffect(() => {
    const currentData = dataType === "assessments" ? assessments : mockInterviews;
    
    if (currentData && currentData.length > 0) {
      let scores, formattedData, categories = {};
      
      if (dataType === "assessments") {
        // Handle quiz assessments
        scores = currentData.map(a => a.quizScore);
        
        // Group by category for assessments
        currentData.forEach(assessment => {
          const assessmentCategories = assessment.categories || [];
          assessmentCategories.forEach(category => {
            if (!categories[category]) {
              categories[category] = { count: 0, total: 0, average: 0 };
            }
            categories[category].count++;
            categories[category].total += assessment.quizScore;
            categories[category].average = categories[category].total / categories[category].count;
          });
        });
        
        formattedData = currentData.map((assessment) => ({
          date: format(new Date(assessment.createdAt), "MMM dd"),
          fullDate: new Date(assessment.createdAt),
          score: assessment.quizScore,
          categories: assessment.categories || [],
          improvementTip: assessment.improvementTip,
          type: 'assessment'
        }));
      } else {
        // Handle mock interviews
        scores = currentData
          .filter(interview => interview.overallScore !== null && interview.overallScore !== undefined)
          .map(interview => interview.overallScore * 10); // Convert to percentage scale
        
        // Group by category for mock interviews
        currentData.forEach(interview => {
          if (interview.categoryBreakdown) {
            Object.entries(interview.categoryBreakdown).forEach(([category, data]) => {
              if (!categories[category]) {
                categories[category] = { count: 0, total: 0, average: 0, interviews: 0 };
              }
              categories[category].count += data.count;
              categories[category].interviews++;
              // For interviews, we'll use the percentage as a weight
              categories[category].total += data.percentage;
              categories[category].average = categories[category].total / categories[category].interviews;
            });
          }
        });
        
        formattedData = currentData.map((interview) => ({
          date: format(new Date(interview.createdAt), "MMM dd"),
          fullDate: new Date(interview.createdAt),
          score: interview.overallScore ? interview.overallScore * 10 : 0,
          categories: interview.categoryBreakdown ? Object.keys(interview.categoryBreakdown) : [],
          jobTitle: interview.jobTitle,
          type: 'interview'
        }));
      }
      
      if (scores.length > 0) {
        const average = scores.reduce((a, b) => a + b, 0) / scores.length;
        const highest = Math.max(...scores);
        const lowest = Math.min(...scores);
        
        // Calculate improvement
        let improvement = 0;
        if (scores.length >= 2) {
          improvement = scores[scores.length - 1] - scores[0];
        }
        
        setStats({
          average,
          highest,
          lowest,
          total: currentData.length,
          improvement,
          categories
        });
        
        setChartData(formattedData);
        
        // Format category data for pie chart
        const categoryChartData = Object.entries(categories).map(([name, data]) => ({
          name,
          value: data.average,
          count: data.count,
          interviews: data.interviews || 0
        }));
        
        setCategoryData(categoryChartData);
      }
    } else {
      // Reset data when no data is available
      setStats({ average: 0, highest: 0, lowest: 0, total: 0, improvement: 0, categories: {} });
      setChartData([]);
      setCategoryData([]);
    }
  }, [assessments, mockInterviews, dataType]);

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
      const data = payload[0]?.payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} className="text-xs flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="font-medium">{entry.name}:</span> {entry.value}%
            </p>
          ))}
          {data?.type === 'interview' && data?.jobTitle && (
            <p className="text-xs text-muted-foreground mt-1">
              Role: {data.jobTitle}
            </p>
          )}
          {data?.type === 'interview' && data?.categories?.length > 0 && (
            <div className="mt-1">
              <p className="text-xs font-medium">Categories:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.categories.map((cat, idx) => (
                  <span key={idx} className="text-xs bg-primary/10 text-primary px-1 rounded capitalize">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
          {data?.improvementTip && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs font-medium text-primary">Improvement Tip:</p>
              <p className="text-xs">{data.improvementTip}</p>
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
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Data Type Toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Badge 
                variant={dataType === "assessments" ? "default" : "outline"} 
                className="cursor-pointer px-3 py-1"
                onClick={() => setDataType("assessments")}
              >
                Quiz Assessments
              </Badge>
              <Badge 
                variant={dataType === "interviews" ? "default" : "outline"} 
                className="cursor-pointer px-3 py-1"
                onClick={() => setDataType("interviews")}
              >
                Mock Interviews
              </Badge>
            </div>
            
            {/* Time Range Filter */}
            <div className="flex flex-wrap gap-1">
              <Badge 
                variant={timeRange === "all" ? "default" : "outline"} 
                className="cursor-pointer text-xs"
                onClick={() => setTimeRange("all")}
              >
                All Time
              </Badge>
              <Badge 
                variant={timeRange === "3months" ? "default" : "outline"} 
                className="cursor-pointer text-xs"
                onClick={() => setTimeRange("3months")}
              >
                3M
              </Badge>
              <Badge 
                variant={timeRange === "month" ? "default" : "outline"} 
                className="cursor-pointer text-xs"
                onClick={() => setTimeRange("month")}
              >
                1M
              </Badge>
              <Badge 
                variant={timeRange === "week" ? "default" : "outline"} 
                className="cursor-pointer text-xs"
                onClick={() => setTimeRange("week")}
              >
                1W
              </Badge>
            </div>
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
                {Object.keys(stats.categories).length > 0 ? (
                  Object.keys(stats.categories).map(category => (
                    <Badge key={category} variant="secondary">
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No categories available</p>
                )}
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
              {categoryData.length > 0 ? (
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
                      label={({ name, percent }) => `${name.charAt(0).toUpperCase() + name.slice(1)}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg p-2 shadow-md">
                              <p className="font-medium capitalize">{payload[0].name}</p>
                              <p className="text-sm">
                                {dataType === "assessments" ? "Avg Score" : "Avg Weight"}: {payload[0].value.toFixed(1)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {dataType === "assessments" 
                                  ? `${data.count} questions in ${data.interviews || 0} assessments`
                                  : `${data.count} questions in ${data.interviews} interviews`
                                }
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
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <PieChartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No category data available</p>
                    <p className="text-sm text-muted-foreground">Complete some assessments to see category breakdown</p>
                  </div>
                </div>
              )}
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
