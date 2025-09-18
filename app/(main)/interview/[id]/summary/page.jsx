import { getMockInterviewById } from "@/actions/interview";
import { InterviewSummary } from "@/interview-summary";
import { notFound } from "next/navigation";

export default async function InterviewSummaryPage({ params }) {
  try {
    const interview = await getMockInterviewById(params.id);
    
    if (!interview || interview.status !== 'completed') {
      notFound();
    }

    return <InterviewSummary interview={interview} />;
  } catch (error) {
    console.error("Error loading interview summary:", error);
    notFound();
  }
}