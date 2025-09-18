"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { generateQuiz, saveQuizResult } from "@/actions/interview";

import QuizResult from "./quiz-result";
import useFetch from "@/hooks/use-fetch";
import { BarLoader } from "react-spinners";
import { Slider } from "@/components/ui/slider";

export default function Quiz({ jobDescription, questionTypes }) {
  console.log("Quiz component received questionTypes:", questionTypes);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [error, setError] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);

  const {
    loading: generatingQuiz,
    fn: generateQuizFn,
    data: quizData,
    error: quizError,
  } = useFetch(generateQuiz);

  const {
    loading: savingResult,
    fn: saveQuizResultFn,
    data: resultData,
    setData: setResultData,
    error: saveError,
  } = useFetch(saveQuizResult);

  useEffect(() => {
    if (quizData) {
      setAnswers(new Array(quizData.length).fill(null));
      setError(null);
    }
  }, [quizData]);

  useEffect(() => {
    if (quizError) {
      toast.error(quizError.message || "Failed to generate quiz");
      setError(quizError.message);
    }
  }, [quizError]);

  useEffect(() => {
    if (saveError) {
      toast.error(saveError.message || "Failed to save quiz results");
    }
  }, [saveError]);

  const handleAnswer = (answer) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answer;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestion < quizData.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowExplanation(false);
    } else {
      finishQuiz();
    }
  };

  const calculateScore = () => {
    let correct = 0;
    answers.forEach((answer, index) => {
      if (answer === quizData[index].correctAnswer) {
        correct++;
      }
    });
    return (correct / quizData.length) * 100;
  };

  const finishQuiz = async () => {
    const score = calculateScore();
    try {
      await saveQuizResultFn(quizData, answers, score, questionTypes);
      toast.success("Quiz completed!");
    } catch (error) {
      toast.error(error.message || "Failed to save quiz results");
    }
  };

  const startNewQuiz = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    setShowExplanation(false);
    setError(null);
    generateQuizFn(jobDescription, questionTypes, questionCount);
    setResultData(null);
  };

  if (generatingQuiz) {
    return (
      <Card className="mx-2">
        <CardHeader>
          <CardTitle>Generating Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-4">
            <BarLoader className="mt-4" width={"100%"} color="gray" />
            <p className="text-muted-foreground">Creating personalized questions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mx-2">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">{error}</p>
        </CardContent>
        <CardFooter>
          <Button onClick={startNewQuiz} className="w-full">
            Try Again
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Show results if quiz is completed
  if (resultData) {
    return (
      <div className="mx-2">
        <QuizResult result={resultData} onStartNew={startNewQuiz} />
      </div>
    );
  }

  if (!quizData) {
    return (
      <Card className="mx-2">
        <CardHeader>
          <CardTitle>Ready to test your knowledge?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This quiz can have between 5 and 20 questions specific to the job description.
            Take your time and choose the best answer for each question.
          </p>
          <div className="mt-6">
            <Label htmlFor="question-count" className="mb-2 block">
              Number of Questions: {questionCount}
            </Label>
            <Slider
              id="question-count"
              min={5}
              max={20}
              step={1}
              value={[questionCount]}
              onValueChange={(value) => setQuestionCount(value[0])}
              className="w-full"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => generateQuizFn(jobDescription, questionTypes, questionCount)}
            className="w-full"
            disabled={generatingQuiz}
          >
            {generatingQuiz ? "Generating..." : "Start Quiz"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const question = quizData[currentQuestion];

  return (
    <Card className="mx-2">
      <CardHeader>
        <CardTitle>
          Question {currentQuestion + 1} of {quizData.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg font-medium">{question.question}</p>
        <RadioGroup
          onValueChange={handleAnswer}
          value={answers[currentQuestion]}
          className="space-y-2"
        >
          {question.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <RadioGroupItem value={option} id={`option-${index}`} />
              <Label htmlFor={`option-${index}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>

        {showExplanation && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="font-medium">Explanation:</p>
            <p className="text-muted-foreground">{question.explanation}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {!showExplanation && (
          <Button
            onClick={() => setShowExplanation(true)}
            variant="outline"
            disabled={!answers[currentQuestion]}
          >
            Show Explanation
          </Button>
        )}
        <Button
          onClick={handleNext}
          disabled={!answers[currentQuestion] || savingResult}
          className="ml-auto"
        >
          {savingResult ? (
            <div className="flex items-center space-x-2">
              <BarLoader className="w-4 h-4" color="white" />
              <span>Saving...</span>
            </div>
          ) : (
            currentQuestion < quizData.length - 1
              ? "Next Question"
              : "Finish Quiz"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
