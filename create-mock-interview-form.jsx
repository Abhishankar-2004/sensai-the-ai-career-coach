"use client";

import { useTransition, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

import { createMockInterview } from "@/actions/interview";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

const defaultQuestionTypes = [
  { id: "technical", label: "Technical" },
  { id: "behavioral", label: "Behavioral" },
  { id: "situational", label: "Situational" },
];

const formSchema = z.object({
  jobTitle: z.string().min(2, { message: "Job title must be at least 2 characters." }),
  companyName: z.string().optional(),
  jobDescription: z.string().min(50, { message: "Job description must be at least 50 characters." }),
  questionCount: z.number().min(3).max(15),
  questionTypes: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one question type.",
  }),
});

export function CreateMockInterviewForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [roleType, setRoleType] = useState("");
  const fileInputRef = useRef(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobTitle: "",
      companyName: "",
      jobDescription: "",
      questionCount: 5,
      questionTypes: ["technical", "behavioral"],
    },
  });

  // Analyze job description for suggested categories
  const analyzeJobDescription = async (text) => {
    if (!text || text.trim().length < 100) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/interview/analyze-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobDescription: text }),
      });

      if (response.ok) {
        const analysis = await response.json();
        setSuggestedCategories(analysis.suggestedCategories || []);
        setRoleType(analysis.roleType || "");
        
        // Auto-select the suggested categories
        const suggestedNames = analysis.suggestedCategories.map(cat => cat.name.toLowerCase());
        form.setValue("questionTypes", suggestedNames, { shouldValidate: true });
      }
    } catch (error) {
      console.error("Error analyzing job description:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Watch for changes in job description and analyze
  const jobDescription = form.watch("jobDescription");
  useEffect(() => {
    const timer = setTimeout(() => {
      if (jobDescription && jobDescription.trim().length > 100) {
        analyzeJobDescription(jobDescription);
      } else {
        setSuggestedCategories([]);
        setRoleType("");
      }
    }, 1500); // Wait 1.5 seconds after user stops typing

    return () => clearTimeout(timer);
  }, [jobDescription]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast.loading("Parsing your document...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/jd/parse", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to parse file.");
      }

      const data = await response.json();
      
      // Handle the API response format (returns jobDescription field)
      const extractedText = data.jobDescription || data.text || "";
      
      // Ensure the text has sufficient content
      if (extractedText && extractedText.trim().length >= 50) {
        form.setValue("jobDescription", extractedText.trim(), { shouldValidate: true, shouldDirty: true });
        // Trigger validation to update form state
        await form.trigger("jobDescription");
        // Analyze the job description for categories
        await analyzeJobDescription(extractedText.trim());
        toast.dismiss();
        toast.success("Job description populated and analyzed!");
      } else {
        toast.dismiss();
        toast.error("The uploaded file doesn't contain enough text. Please ensure the job description has at least 50 characters.");
      }
    } catch (error) {
      toast.dismiss();
      toast.error(error.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const onSubmit = (values) => {
    startTransition(async () => {
      toast.loading("Generating your custom interview...");
      try {
        const interview = await createMockInterview(values);
        toast.dismiss();
        toast.success("Mock interview created successfully!");
        router.push(`/interview/${interview.id}`);
      } catch (error) {
        toast.dismiss();
        toast.error(error.message || "Failed to create mock interview.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a New Mock Interview</CardTitle>
        <CardDescription>
          Provide a job description and we'll generate tailored interview questions for you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Senior Software Engineer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Google" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Job Description</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload File
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt"
                    />
                  </div>
                  <FormDescription>
                    Paste the job description below or upload a file (PDF, DOCX, TXT).
                  </FormDescription>
                  <FormControl>
                    <Textarea placeholder="Paste the job description here..." className="min-h-[200px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="questionCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Questions: {field.value}</FormLabel>
                  <FormControl>
                    <Slider min={3} max={15} step={1} value={[field.value]} onValueChange={(value) => field.onChange(value[0])} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="questionTypes"
              render={() => {
                const categoriesToShow = suggestedCategories.length > 0 
                  ? suggestedCategories 
                  : defaultQuestionTypes.map(cat => ({ 
                      name: cat.id, 
                      description: `${cat.label} interview questions`,
                      percentage: Math.round(100 / defaultQuestionTypes.length)
                    }));

                return (
                  <FormItem>
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel>Question Categories</FormLabel>
                        {isAnalyzing && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Analyzing...
                          </div>
                        )}
                        {roleType && (
                          <Badge variant="outline" className="text-xs">
                            {roleType}
                          </Badge>
                        )}
                      </div>
                      <FormDescription>
                        {suggestedCategories.length > 0 
                          ? "Categories suggested based on your job description. You can modify the selection below."
                          : "Select the types of questions you want to be asked."
                        }
                      </FormDescription>
                    </div>
                    <div className="space-y-3">
                      {categoriesToShow.map((category) => (
                        <FormField 
                          key={category.name} 
                          control={form.control} 
                          name="questionTypes" 
                          render={({ field }) => (
                            <FormItem className="flex items-start space-x-3 space-y-0 p-3 border rounded-lg">
                              <FormControl>
                                <Checkbox 
                                  checked={field.value?.includes(category.name.toLowerCase())} 
                                  onCheckedChange={(checked) => {
                                    const categoryName = category.name.toLowerCase();
                                    if (checked) {
                                      field.onChange([...field.value, categoryName]);
                                    } else {
                                      field.onChange(field.value?.filter((value) => value !== categoryName));
                                    }
                                  }}
                                  className="mt-1"
                                />
                              </FormControl>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                  <FormLabel className="capitalize font-medium">
                                    {category.name}
                                  </FormLabel>
                                  {category.percentage && (
                                    <Badge variant="secondary" className="text-xs">
                                      ~{category.percentage}%
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {category.description}
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <Button type="submit" disabled={isPending} className="w-full md:w-auto">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Generating..." : "Generate Interview"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}