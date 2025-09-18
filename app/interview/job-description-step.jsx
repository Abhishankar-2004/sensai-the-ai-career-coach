"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export const defaultQuestionCategories = ["technical", "behavioral", "situational"];

export function JobDescriptionStep({ onJobDescriptionReady }) {
  const [jobDescription, setJobDescription] = useState("");

  const [isParsing, setIsParsing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState(defaultQuestionCategories);
  const [roleType, setRoleType] = useState("");

  // Analyze job description for suggested categories
  const analyzeJobDescription = async (text) => {
    if (!text || text.trim().length < 100) return; // Skip analysis for very short descriptions
    
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
        setSelectedTypes(suggestedNames);
      }
    } catch (error) {
      console.error("Error analyzing job description:", error);
      // Keep default categories if analysis fails
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Debounced analysis when job description changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (jobDescription.trim().length > 100) {
        analyzeJobDescription(jobDescription);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timer);
  }, [jobDescription]);

  const handleFileChange = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setIsParsing(true);
    setJobDescription("");
    setSuggestedCategories([]);
    setRoleType("");

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const response = await fetch("/api/jd/parse", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to parse file. Please try another file.");
        setJobDescription("");
      } else {
        const extractedText = result.jobDescription || result.text || "";
        
        if (extractedText && extractedText.trim().length > 0) {
          setJobDescription(extractedText);
          // Analysis will be triggered by useEffect
        } else {
          alert("No text could be extracted from the file. Please try a different file or paste the text manually.");
        }
        
        e.target.value = "";
      }
    } catch (err) {
      console.error("File parsing error:", err);
      alert("An unexpected error occurred. Please check the console for details.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleContinue = () => {
    if (jobDescription.trim()) {
      onJobDescriptionReady(jobDescription, selectedTypes);
    }
  };

  const handleCheckboxChange = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  // Get categories to display (suggested ones or default ones)
  const categoriesToShow = suggestedCategories.length > 0 
    ? suggestedCategories 
    : defaultQuestionCategories.map(cat => ({ 
        name: cat, 
        description: `${cat.charAt(0).toUpperCase() + cat.slice(1)} interview questions`,
        percentage: Math.round(100 / defaultQuestionCategories.length)
      }));

  // Check if continue should be enabled
  const canContinue = jobDescription.trim().length > 0 && selectedTypes.length > 0 && !isParsing && !isAnalyzing;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Paste or Upload Job Description</h2>
      <Textarea
        className="mb-4 min-h-[120px]"
        placeholder="Paste the job description here..."
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        disabled={isParsing}
      />
      <div className="mb-4">
        <Label className="block mb-2">Or upload a file:</Label>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileChange}
          disabled={isParsing}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Label>Question Categories:</Label>
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
        
        <div className="space-y-3">
          {categoriesToShow.map((category) => (
            <div key={category.name} className="flex items-start space-x-3 p-3 border rounded-lg">
              <Checkbox
                id={category.name}
                checked={selectedTypes.includes(category.name.toLowerCase())}
                onCheckedChange={() => handleCheckboxChange(category.name.toLowerCase())}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor={category.name} className="capitalize font-medium">
                    {category.name}
                  </Label>
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
            </div>
          ))}
        </div>
        
        {suggestedCategories.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Categories suggested based on job description analysis. You can modify the selection above.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Button 
          onClick={handleContinue} 
          disabled={!canContinue}
          className="w-full"
        >
          {isParsing ? "Processing..." : "Continue"}
        </Button>
        
      </div>
    </div>
  );
}

