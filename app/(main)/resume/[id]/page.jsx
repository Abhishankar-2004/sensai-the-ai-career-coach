import { getResume } from "@/actions/resume";
import ResumeBuilder from "../_components/resume-builder";
import { notFound } from "next/navigation";

export default async function ResumeDetailPage() {
  const resume = await getResume();

  if (!resume) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-4xl font-bold gradient-title mb-6">My Resume</h1>
      <ResumeBuilder initialContent={resume.content} />
    </div>
  );
} 