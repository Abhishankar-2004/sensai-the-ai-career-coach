import { Star, CheckCircle, AlertCircle, Lightbulb } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function FeedbackDisplay({ feedback }) {
  if (!feedback) return null;

  const getScoreColor = (score) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <h3 className="text-lg font-semibold">Your Score</h3>
        <div className={`flex items-center gap-1 text-2xl font-bold ${getScoreColor(feedback.score)}`}>
          <Star className="h-6 w-6 fill-current" />
          <span>{feedback.score} / 10</span>
        </div>
      </div>

      <Accordion type="multiple" className="w-full" defaultValue={["strengths", "improvements", "detailed-feedback"]}>
        <AccordionItem value="strengths">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Strengths
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc list-inside space-y-1 pl-2">
              {feedback.strengths?.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="improvements">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Areas for Improvement
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <ul className="list-disc list-inside space-y-1 pl-2">
              {feedback.improvements?.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="detailed-feedback">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-500" />
              Detailed Feedback
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <p className="text-muted-foreground">{feedback.detailedFeedback}</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}