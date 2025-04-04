import ResumeBuilder from "../_components/resume-builder";

export default function NewResumePage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-4xl font-bold gradient-title mb-6">Create New Resume</h1>
      <ResumeBuilder initialContent="" />
    </div>
  );
} 