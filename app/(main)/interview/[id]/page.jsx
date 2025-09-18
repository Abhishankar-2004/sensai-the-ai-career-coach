import { getMockInterviewById } from "@/actions/interview";
import { InterviewSession } from "@/interview-session";
import { notFound } from "next/navigation";

export default async function InterviewPage({ params }) {
  try {
    const interview = await getMockInterviewById(params.id);
    
    if (!interview) {
      notFound();
    }

    return <InterviewSession initialInterview={interview} />;
  } catch (error) {
    console.error("Error loading interview:", error);
    notFound();
  }
}