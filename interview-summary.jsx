"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Edit, Loader2, Sparkles, Star } from "lucide-react";

import { submitAnswerAndGetFeedback } from "@/actions/interview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FeedbackDisplay } from "./feedback-display";
import { ImprovedAnswerSuggestion } from "./improved-answer-suggestion";

export function InterviewSummary({ initialInterview }) {
  const [interview, setInterview] = useState(initialInterview);
  const [editingIndex, setEditingIndex] = useState(null);
  const [revisedAnswer, setRevisedAnswer] = useState("");
  const [isPending, startTransition] = useTransition();

  const openEditDialog = (index) => {
    setEditingIndex(index);
    setRevisedAnswer(interview.responses[index]?.userAnswer || "");
  };

  const handleRevisionSubmit = () => {
    if (!revisedAnswer.trim()) {
      toast.warning("Please provide an answer.");
      return;
    }

    startTransition(async () => {
      toast.loading("Getting new feedback for your revised answer...");
      try {
        const updatedInterview = await submitAnswerAndGetFeedback({
          interviewId: interview.id,
          questionIndex: editingIndex,
          answer: revisedAnswer,
        });
        setInterview(updatedInterview);
        toast.dismiss();
        toast.success("Feedback updated successfully!");
        setEditingIndex(null); // Close dialog on success
      } catch (error) {
        toast.dismiss();
        toast.error(error.message || "Failed to get new feedback.");
      }
    });
  };

  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-8">
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Interview Summary</CardTitle>
          <CardDescription>
            Review your performance for the {interview.jobTitle} mock interview.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-background rounded-lg">
            <h3 className="text-xl font-semibold">Overall Score</h3>
            <div className={`flex items-center gap-2 text-3xl font-bold ${getScoreColor(interview.overallScore)}`}>
              <Star className="h-8 w-8 fill-current" />
              <span>{interview.overallScore} / 10</span>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-2">Overall Feedback</h4>
            <p className="text-muted-foreground p-4 bg-background rounded-lg">
              {interview.overallFeedback}
            </p>
          </div>
          
          {interview.categoryBreakdown && (
            <div>
              <h4 className="font-semibold text-lg mb-3">Question Categories Distribution</h4>
              <div className="space-y-3">
                {Object.entries(interview.categoryBreakdown).map(([category, data]) => (
                  <div key={category} className="p-4 bg-background rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize text-base">{category}</span>
                        <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                          {data.count} question{data.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-lg font-semibold text-primary">{data.percentage}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 mb-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${data.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {data.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mt-8">Detailed Breakdown</h2>
      <div className="space-y-6">
        {interview.questions.map((q, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle>Question {index + 1}</CardTitle>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full capitalize">
                      {q.type}
                    </span>
                  </div>
                  <CardDescription className="mt-1">{q.question}</CardDescription>
                  {q.relevance && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {q.relevance}
                    </p>
                  )}
                  {q.skillsAssessed && q.skillsAssessed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {q.skillsAssessed.map((skill, skillIndex) => (
                        <span key={skillIndex} className="px-1.5 py-0.5 text-xs bg-secondary text-secondary-foreground rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Dialog open={editingIndex === index} onOpenChange={(isOpen) => !isOpen && setEditingIndex(null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(index)}>
                      <Edit className="mr-2 h-4 w-4" /> Revise Answer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                      <DialogTitle>Revise Your Answer</DialogTitle>
                      <DialogDescription>
                        Improve your answer and get new, updated feedback from the AI.
                      </DialogDescription>
                      <p className="text-sm font-semibold pt-4">Question: "{q.question}"</p>
                    </DialogHeader>
                    <Textarea
                      value={revisedAnswer}
                      onChange={(e) => setRevisedAnswer(e.target.value)}
                      className="min-h-[200px] text-base"
                      placeholder="Write your revised answer here..."
                    />
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setEditingIndex(null)}>Cancel</Button>
                      <Button onClick={handleRevisionSubmit} disabled={isPending}>
                        {isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Get New Feedback
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {interview.responses[index]?.userAnswer ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Your Answer</h4>
                    <p className="text-muted-foreground p-4 bg-muted/50 rounded-lg whitespace-pre-wrap">
                      {interview.responses[index].userAnswer}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">AI Feedback</h4>
                    <FeedbackDisplay feedback={interview.responses[index].feedback} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 px-4 bg-muted rounded-lg">
                  <p className="text-muted-foreground">You did not answer this question.</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}