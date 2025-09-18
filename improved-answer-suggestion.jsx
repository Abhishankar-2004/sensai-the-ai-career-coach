"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Copy, CheckCircle, Lightbulb, Target } from "lucide-react";

import { getImprovedAnswerSuggestion } from "@/actions/interview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export function ImprovedAnswerSuggestion({ interviewId, questionIndex, currentAnswer }) {
  const [suggestion, setSuggestion] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const generateSuggestion = () => {
    startTransition(async () => {
      toast.loading("Generating improved answer suggestion...");
      try {
        const result = await getImprovedAnswerSuggestion({ interviewId, questionIndex });
        setSuggestion(result);
        toast.dismiss();
        toast.success("Improved answer generated!");
      } catch (error) {
        toast.dismiss();
        toast.error(error.message || "Failed to generate suggestion.");
      }
    });
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  if (!suggestion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Get AI-Powered Improvement Suggestions
          </CardTitle>
          <CardDescription>
            Get personalized suggestions to improve your answer based on the job requirements and expert feedback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateSuggestion} disabled={isPending} className="w-full">
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate Improved Answer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          AI-Powered Improvement Suggestions
        </CardTitle>
        <CardDescription>
          Here's how you can improve your answer to better match the job requirements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="improved-answer" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="improved-answer">Improved Answer</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
            <TabsTrigger value="keywords">Key Phrases</TabsTrigger>
          </TabsList>
          
          <TabsContent value="improved-answer" className="space-y-4">
            <div className="relative">
              <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-blue-500">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {suggestion.improvedAnswer}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(suggestion.improvedAnswer)}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                What was improved:
              </h4>
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                {suggestion.explanation}
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="tips" className="space-y-4">
            <div className="space-y-3">
              {suggestion.improvementTips?.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                  <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">{tip}</p>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="keywords" className="space-y-4">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                Key Phrases to Include
              </h4>
              <div className="flex flex-wrap gap-2">
                {suggestion.keyPhrases?.map((phrase, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                    {phrase}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                These phrases are commonly valued for this type of role and can strengthen your responses.
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={generateSuggestion} 
            disabled={isPending}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate New Suggestion
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}