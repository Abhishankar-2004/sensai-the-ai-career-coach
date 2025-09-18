import { notFound } from "next/navigation";
import { getMockInterviewById } from "@/actions/interview";
import { InterviewSummary } from "./_components/interview-summary";

export default async function InterviewSummaryPage({ params }) {
  let interview;
  try {
    interview = await getMockInterviewById(params.interviewId);
  } catch (error) {
    notFound();
  }

  // Redirect to the interview session if it's not completed yet
  if (interview.status !== 'completed') {
    notFound();
  }

  return (
    <div className="container mx-auto py-10">
      <InterviewSummary initialInterview={interview} />
    </div>
  );
}