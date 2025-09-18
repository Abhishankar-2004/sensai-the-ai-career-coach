import { getAssessments, getMockInterviews } from "@/actions/interview";
import StatsCards from "./_components/stats-cards";
import PerformanceChart from "./_components/performace-chart";
import QuizList from "./_components/quiz-list";

export default async function InterviewPrepPage() {
  const [assessments, mockInterviews] = await Promise.all([
    getAssessments(),
    getMockInterviews()
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-6xl font-bold gradient-title">
          Interview Preparation
        </h1>
      </div>
      <div className="space-y-6">
        <StatsCards assessments={assessments} mockInterviews={mockInterviews} />
        <PerformanceChart assessments={assessments} mockInterviews={mockInterviews} />
        <QuizList assessments={assessments} />
      </div>
    </div>
  );
}
