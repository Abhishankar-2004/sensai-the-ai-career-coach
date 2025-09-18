"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation"; 
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lightbulb,
} from "lucide-react";

import { submitAnswerAndGetFeedback, completeMockInterview } from "@/actions/interview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FeedbackDisplay } from "./feedback-display";
import { AudioRecorder } from "./audio-recorder";

export function InterviewSession({ initialInterview }) {
  const router = useRouter();
  const [interview, setInterview] = useState(initialInterview);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(
    initialInterview.currentQuestion || 0
  );
  const [answer, setAnswer] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentQuestion = interview.questions[currentQuestionIndex];
  const currentResponse = interview.responses?.[currentQuestionIndex];
  const totalQuestions = interview.questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  const isQuestionAnswered = !!currentResponse?.feedback;

  useEffect(() => {
    setAnswer(interview.responses?.[currentQuestionIndex]?.userAnswer || "");
  }, [currentQuestionIndex, interview.responses]);

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleFinish = () => {
    startTransition(async () => {
      toast.loading("Finalizing your interview...");
      try {
        await completeMockInterview(interview.id);
        toast.dismiss();
        toast.success("Interview completed! Redirecting to summary...");
        router.push(`/interview/${interview.id}/summary`);
      } catch (error) {
        toast.dismiss();
        toast.error(error.message || "Failed to finalize interview.");
      }
    });
  };

  const handleAudioTranscription = async (blobUrl, blob) => {
    setIsTranscribing(true);
    toast.loading("Transcribing your audio...");

    const formData = new FormData();
    formData.append("audio", blob, "user-answer.webm");

    try {
      const response = await fetch("/api/interview/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to transcribe audio.");
      }

      const data = await response.json();
      setAnswer((prev) => (prev ? `${prev}\n${data.transcription}` : data.transcription));
      toast.dismiss();
      toast.success("Audio transcribed successfully!");
    } catch (error) {
      toast.dismiss();
      toast.error(error.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    if (!answer.trim()) {
      toast.warning("Please provide an answer before submitting.");
      return;
    }

    startTransition(async () => {
      toast.loading("Analyzing your answer...");
      try {
        const updatedInterview = await submitAnswerAndGetFeedback({
          interviewId: interview.id,
          questionIndex: currentQuestionIndex,
          answer: answer,
        });
        setInterview(updatedInterview);
        toast.dismiss();
        toast.success("Feedback generated successfully!");
      } catch (error) {
        toast.dismiss();
        toast.error(error.message || "Failed to submit answer.");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>
            Question {currentQuestionIndex + 1} / {totalQuestions}
          </CardTitle>
          <CardDescription className="flex items-center gap-2 pt-2">
            <Badge variant="outline" className="capitalize">
              {currentQuestion.type}
            </Badge>
            <span>For the role of {interview.jobTitle}</span>
          </CardDescription>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-lg font-semibold mb-2">
              {currentQuestion.question}
            </p>
            {currentQuestion.relevance && (
              <p className="text-sm text-muted-foreground italic mb-2">
                {currentQuestion.relevance}
              </p>
            )}
            {currentQuestion.skillsAssessed && currentQuestion.skillsAssessed.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-xs text-muted-foreground mr-2">Skills assessed:</span>
                {currentQuestion.skillsAssessed.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Textarea
            placeholder="Type your answer here..."
            className="min-h-[250px] text-base"
            value={answer}
            onChange={(e) => !isQuestionAnswered && setAnswer(e.target.value)}
            disabled={isPending || isQuestionAnswered || isTranscribing}
          />
          {!isQuestionAnswered && (
            <div className="mt-4">
              <AudioRecorder onStop={handleAudioTranscription} disabled={isPending || isTranscribing} />
            </div>
          )}
          {isQuestionAnswered && <FeedbackDisplay feedback={currentResponse.feedback} />}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0 || isPending}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
          </Button>
          {isQuestionAnswered ? (
            <Button
              onClick={currentQuestionIndex === totalQuestions - 1 ? handleFinish : handleNext}
              disabled={isPending}
            >
              {isPending && currentQuestionIndex === totalQuestions - 1 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {currentQuestionIndex === totalQuestions - 1 ? "Finish & Review" : "Next Question"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending || isTranscribing || !answer.trim()}>
              {isPending || isTranscribing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="mr-2 h-4 w-4" />
              )}
              Submit & Get Feedback
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}