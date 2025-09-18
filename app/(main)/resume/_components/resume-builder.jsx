"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  Edit,
  Loader2,
  Monitor,
  Save,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  Wand2,
  Upload,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import MDEditor from "@uiw/react-md-editor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { saveResume, generateResumeTemplate, deleteResume } from "@/actions/resume";
import { EntryForm } from "./entry-form";
import useFetch from "@/hooks/use-fetch";

import { entriesToMarkdown } from "@/app/lib/helper";
import { resumeSchema } from "@/app/lib/schema";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const templates = [
  { id: "modern", name: "Modern" },
  { id: "professional", name: "Professional" },
  { id: "minimal", name: "Minimal" },
  { id: "creative", name: "Creative" },
];

export default function ResumeBuilder({ initialContent }) {
  const [activeTab, setActiveTab] = useState("edit");
  const [previewContent, setPreviewContent] = useState(initialContent);
  const [resumeMode, setResumeMode] = useState("preview");
  const [atsScore, setAtsScore] = useState(null);
  const [atsFeedback, setAtsFeedback] = useState(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [isImprovingSummary, setIsImprovingSummary] = useState(false);
  const [isImprovingSkills, setIsImprovingSkills] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const fileInputRef = useRef(null);
  const [lastEnhancementTime, setLastEnhancementTime] = useState(0);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resumeSchema),
    defaultValues: {
      contactInfo: {},
      summary: "",
      skills: "",
      experience: [],
      education: [],
      projects: [],
    },
  });

  const {
    loading: isSaving,
    fn: saveResumeFn,
    data: saveResult,
    error: saveError,
  } = useFetch(saveResume);

  const {
    loading: isGeneratingTemplate,
    fn: generateTemplateFn,
    data: templateResult,
    error: templateError,
  } = useFetch(generateResumeTemplate);

  const {
    loading: isDeleting,
    fn: deleteResumeFn,
    error: deleteError,
  } = useFetch(deleteResume);

  // Watch form fields for preview updates
  const formValues = watch();

  const getContactMarkdown = useCallback(() => {
    const { contactInfo } = formValues;
    const parts = [];
    if (contactInfo.name) parts.push(`**${contactInfo.name}**`);
    if (contactInfo.email) parts.push(`📧 ${contactInfo.email}`);
    if (contactInfo.mobile) parts.push(`📱 ${contactInfo.mobile}`);
    if (contactInfo.linkedin) parts.push(`💼 [LinkedIn](${contactInfo.linkedin})`);
    if (contactInfo.twitter) parts.push(`🐦 [Twitter](${contactInfo.twitter})`);

    return parts.length > 0
      ? `## Contact Information\n\n${parts.join(" | ")}`
      : "";
  }, [formValues]);

  const getCombinedContent = useCallback(() => {
    const { summary, skills, experience, education, projects } = formValues;

    // Debug logging to see what data we have
    console.log("Form values for content generation:");
    console.log("- Education entries:", education?.length || 0, education);
    console.log("- Project entries:", projects?.length || 0, projects);
    console.log("- Experience entries:", experience?.length || 0);

    const sections = [
      getContactMarkdown(),
      summary && `## Professional Summary\n\n${summary}`,
      skills && `## Skills\n\n${skills}`,
      entriesToMarkdown(experience, "Work Experience"),
      entriesToMarkdown(education, "Education"),
      entriesToMarkdown(projects, "Projects"),
    ]
      .filter(Boolean);

    return sections.length > 0 ? sections.join("\n\n") : "Start building your resume by filling out the form or uploading an existing resume.";
  }, [formValues, getContactMarkdown]);

  useEffect(() => {
    if (initialContent) setActiveTab("preview");
  }, [initialContent]);

  // Update preview content when form values change
  useEffect(() => {
    if (activeTab === "edit") {
      const newContent = getCombinedContent();
      setPreviewContent(newContent ? newContent : initialContent);
    }
  }, [formValues, activeTab, initialContent, getCombinedContent]);

  // Handle save result
  useEffect(() => {
    if (saveResult && !isSaving) {
      toast.success("Resume saved successfully!");
      if (saveResult.atsScore) {
        setAtsScore(saveResult.atsScore);
        setAtsFeedback(JSON.parse(saveResult.feedback));
      }
    }
    if (saveError) {
      toast.error(saveError.message || "Failed to save resume");
    }
  }, [saveResult, saveError, isSaving]);

  // Handle template generation
  useEffect(() => {
    if (templateResult && !isGeneratingTemplate) {
      setPreviewContent(templateResult);
      toast.success("Template generated successfully!");
      setShowTemplateDialog(false);
    }
    if (templateError) {
      toast.error(templateError.message || "Failed to generate template");
    }
  }, [templateResult, templateError, isGeneratingTemplate]);

  // Handle delete result
  useEffect(() => {
    if (deleteError) {
      toast.error(deleteError.message || "Failed to delete resume");
    }
  }, [deleteError]);

  const [isGenerating, setIsGenerating] = useState(false);

  // Convert markdown to HTML for better PDF formatting
  const convertMarkdownToHTML = (markdown) => {
    if (!markdown) return '';

    return markdown
      // Convert headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')

      // Convert bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

      // Convert italic text
      .replace(/\*(.*?)\*/g, '<em>$1</em>')

      // Convert links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

      // Convert line breaks to proper HTML
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')

      // Wrap in paragraphs
      .replace(/^(.)/gm, '<p>$1')
      .replace(/(.*)$/gm, '$1</p>')

      // Clean up multiple paragraph tags
      .replace(/<\/p><p>/g, '</p>\n<p>')
      .replace(/<p><h([1-6])>/g, '<h$1>')
      .replace(/<\/h([1-6])><\/p>/g, '</h$1>')
      .replace(/<p><\/p>/g, '')

      // Fix empty paragraphs and clean up
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/<p><br><\/p>/g, '<br>')
      .trim();
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      // Use the browser's print functionality
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("Pop-up blocked. Please allow pop-ups for this site to generate PDF.");
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Resume</title>
            <style>
              body {
                font-family: 'Times New Roman', serif;
                line-height: 1.5;
                margin: 0;
                padding: 20px;
                max-width: 800px;
                margin: 0 auto;
                color: #333;
                background: white;
              }
              
              h1 {
                font-size: 24px;
                text-align: center;
                margin: 0 0 10px 0;
                color: #2c3e50;
                font-weight: bold;
              }
              
              h2 {
                font-size: 18px;
                color: #2c3e50;
                border-bottom: 2px solid #3498db;
                padding-bottom: 3px;
                margin: 20px 0 10px 0;
                font-weight: bold;
              }
              
              h3 {
                font-size: 16px;
                color: #2c3e50;
                margin: 15px 0 5px 0;
                font-weight: bold;
              }
              
              p {
                margin: 8px 0;
                text-align: justify;
              }
              
              strong {
                font-weight: bold;
                color: #2c3e50;
              }
              
              em {
                font-style: italic;
                color: #7f8c8d;
                font-size: 0.95em;
              }
              
              a {
                color: #3498db;
                text-decoration: none;
              }
              
              a:hover {
                text-decoration: underline;
              }
              
              br {
                line-height: 1.2;
              }
              
              /* Contact info styling */
              h2:first-of-type + p {
                text-align: center;
                font-size: 14px;
                margin-bottom: 20px;
                border-bottom: 1px solid #ecf0f1;
                padding-bottom: 15px;
              }
              
              @media print {
                body {
                  font-size: 11pt;
                  line-height: 1.4;
                  padding: 15px;
                }
                
                h1 {
                  font-size: 20pt;
                  margin-bottom: 8px;
                }
                
                h2 {
                  font-size: 14pt;
                  margin: 15px 0 8px 0;
                  page-break-after: avoid;
                }
                
                h3 {
                  font-size: 12pt;
                  margin: 12px 0 4px 0;
                  page-break-after: avoid;
                }
                
                p {
                  margin: 6px 0;
                  orphans: 2;
                  widows: 2;
                }
                
                .no-print {
                  display: none !important;
                }
                
                /* Avoid page breaks in the middle of sections */
                h2, h3 {
                  page-break-inside: avoid;
                }
                
                /* Keep related content together */
                h3 + p {
                  page-break-before: avoid;
                }
              }
            </style>
          </head>
          <body>
            <div class="no-print" style="text-align: center; margin-bottom: 20px;">
              <button onclick="window.print()" style="padding: 10px 20px; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Print / Save as PDF
              </button>
            </div>
            <div id="resume-content">
              ${convertMarkdownToHTML(previewContent)}
            </div>
            <script>
              // Auto-print after a short delay
              setTimeout(() => {
                window.print();
              }, 1000);
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();

      // Close the window after printing (or if user cancels)
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.close();
        }
      }, 5000);

      toast.success("PDF generation started. Use your browser's print dialog to save as PDF.");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async () => {
    console.log("Save button clicked - starting save process");

    try {
      // Get the current content from the form or preview
      let contentToSave = previewContent;
      console.log("Preview content length:", contentToSave?.length || 0);

      // If no preview content, generate it from form values
      if (!contentToSave || contentToSave.trim().length === 0) {
        console.log("No preview content, generating from form values");
        contentToSave = getCombinedContent();
        console.log("Generated content length:", contentToSave?.length || 0);
      }

      // If still no content, create a basic structure
      if (!contentToSave || contentToSave.trim().length === 0) {
        console.log("No content found, creating basic structure");
        contentToSave = "# Resume\n\nStart building your resume by filling out the form above.";
      }

      // Preserve proper formatting by keeping line breaks intact
      const formattedContent = contentToSave
        .replace(/\n\s*\n\s*\n/g, "\n\n") // Replace multiple line breaks with double line breaks
        .trim();

      console.log("Final content to save:", formattedContent.substring(0, 200) + "...");
      console.log("Calling saveResumeFn with content");

      toast.info("Saving resume...");
      await saveResumeFn(formattedContent);
      console.log("Save function completed");

    } catch (error) {
      console.error("Save error:", error);
      toast.error(`Failed to save resume: ${error.message}`);
    }
  };

  const handleTemplateSelect = async (template) => {
    await generateTemplateFn(template);
  };

  const improveWithAI = async ({ current, type }) => {
    try {
      // Check if we've enhanced recently (within the last minute)
      const now = Date.now();
      if (now - lastEnhancementTime < 60000) {
        const waitTime = Math.ceil((60000 - (now - lastEnhancementTime)) / 1000);
        toast.error(`Please wait ${waitTime} seconds before trying again.`);
        return null;
      }

      // Add a small delay to prevent rapid consecutive requests
      await new Promise(resolve => setTimeout(resolve, 500));

      const response = await fetch("/api/resume/enhance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: current,
          type: type,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle rate limiting specifically
        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please wait a minute before trying again.");
          throw new Error("Rate limit exceeded. Please wait a minute before trying again.");
        }

        throw new Error(errorText || "Failed to improve content");
      }

      const data = await response.json();

      // Update the last enhancement time
      setLastEnhancementTime(Date.now());

      return data.content;
    } catch (error) {
      console.error("AI improvement error:", error);
      throw error;
    }
  };

  const handleImproveSummary = async () => {
    if (!formValues.summary) {
      toast.error("Please enter a summary first");
      return;
    }

    setIsImprovingSummary(true);
    try {
      toast.info("Improving your summary... This may take a moment.");

      const improvedContent = await improveWithAI({
        current: formValues.summary,
        type: "summary"
      });

      if (improvedContent) {
        setValue("summary", improvedContent);
        toast.success("Summary improved successfully!");
      }
    } catch (error) {
      console.error("Error improving summary:", error);
      toast.error(error.message || "Failed to improve summary. Please try again.");
    } finally {
      setIsImprovingSummary(false);
    }
  };

  const handleImproveSkills = async () => {
    if (!formValues.skills) {
      toast.error("Please enter skills first");
      return;
    }

    setIsImprovingSkills(true);
    try {
      toast.info("Improving your skills section... This may take a moment.");

      const improvedContent = await improveWithAI({
        current: formValues.skills,
        type: "skills"
      });

      if (improvedContent) {
        setValue("skills", improvedContent);
        toast.success("Skills improved successfully!");
      }
    } catch (error) {
      console.error("Error improving skills:", error);
      toast.error(error.message || "Failed to improve skills. Please try again.");
    } finally {
      setIsImprovingSkills(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      toast.error("Please upload a PDF or Word document (.pdf, .doc, .docx)");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum size is 10MB.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setIsUploading(true);
    try {
      toast.info("Uploading and processing your resume... This may take a moment.");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.text();
        } catch (e) {
          errorData = "Failed to upload resume (unknown error)";
        }

        // Provide more specific error messages
        if (response.status === 400) {
          // Check if it's a PDF processing issue
          if (errorData && errorData.includes("image-based")) {
            toast.error("This PDF cannot be processed automatically. Please try uploading a Word document (.docx) instead, or manually fill out the form below.", {
              duration: 8000
            });
          } else {
            toast.error(errorData || "Invalid file format or content. Please check your file and try again.");
          }
        } else if (response.status === 413) {
          toast.error("File is too large. Please upload a smaller file.");
        } else if (response.status >= 500) {
          // Check if it's a PDF processing issue in server errors too
          if (errorData && (errorData.includes("PDF") || errorData.includes("image-based"))) {
            toast.error("PDF processing failed. Word documents (.docx) work more reliably. You can also fill out the form manually.", {
              duration: 8000
            });
          } else {
            toast.error("Server error. Please try again in a moment.");
          }
        } else {
          toast.error(errorData || "Failed to upload resume. Please try again.");
        }
        throw new Error(errorData || "Failed to upload resume");
      }

      const data = await response.json();

      // Update form values with extracted content
      if (data.content) {
        const { summary, skills, experience, education, projects, contactInfo } = data.content;

        // Use the form's setValue method to update values with proper triggering
        if (summary) setValue("summary", summary, { shouldDirty: true, shouldTouch: true });
        if (skills) setValue("skills", skills, { shouldDirty: true, shouldTouch: true });
        if (experience && experience.length > 0) setValue("experience", experience, { shouldDirty: true, shouldTouch: true });
        if (education && education.length > 0) setValue("education", education, { shouldDirty: true, shouldTouch: true });
        if (projects && projects.length > 0) setValue("projects", projects, { shouldDirty: true, shouldTouch: true });

        // Update contact info if available
        if (contactInfo && typeof contactInfo === 'object') {
          const currentContactInfo = formValues.contactInfo || {};
          const updatedContactInfo = {
            ...currentContactInfo,
            ...(contactInfo.name && { name: contactInfo.name }),
            ...(contactInfo.email && { email: contactInfo.email }),
            ...(contactInfo.mobile && { mobile: contactInfo.mobile }),
            ...(contactInfo.linkedin && { linkedin: contactInfo.linkedin }),
            ...(contactInfo.location && { location: contactInfo.location })
          };
          setValue("contactInfo", updatedContactInfo, { shouldDirty: true, shouldTouch: true });
          console.log("Updated contact info:", updatedContactInfo);
        }

        // Force update preview content after a short delay to ensure form values are updated
        setTimeout(() => {
          const newContent = getCombinedContent();
          setPreviewContent(newContent);
        }, 100);
      }

      toast.success("Resume uploaded and processed successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      // Don't show duplicate error messages
      if (!error.message.includes("Failed to upload resume")) {
        toast.error(error.message || "Failed to upload resume");
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleEnhanceResume = async () => {
    if (!formValues.summary && !formValues.skills && !formValues.experience?.length) {
      toast.error("Please add some content to your resume first");
      return;
    }

    setIsEnhancing(true);
    try {
      // Show a toast to inform the user that enhancement might take a while
      toast.info("Enhancing your resume... This may take a minute or two due to rate limits.");

      const response = await fetch("/api/resume/enhance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formValues),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to enhance resume");
      }

      const data = await response.json();

      // Update form values with enhanced content
      if (data.content) {
        const { summary, skills, experience, education, projects } = data.content;

        // Use the form's setValue method to update values with proper triggering
        if (summary) setValue("summary", summary, { shouldDirty: true, shouldTouch: true });
        if (skills) setValue("skills", skills, { shouldDirty: true, shouldTouch: true });
        if (experience && experience.length > 0) setValue("experience", experience, { shouldDirty: true, shouldTouch: true });
        if (education && education.length > 0) setValue("education", education, { shouldDirty: true, shouldTouch: true });
        if (projects && projects.length > 0) setValue("projects", projects, { shouldDirty: true, shouldTouch: true });

        // Force update preview content after a short delay to ensure form values are updated
        setTimeout(() => {
          const newContent = getCombinedContent();
          setPreviewContent(newContent);
        }, 100);
      }

      toast.success("Resume enhanced successfully!");
    } catch (error) {
      console.error("Enhancement error:", error);

      // Provide more specific error messages
      if (error.message.includes("429") || error.message.includes("Too Many Requests")) {
        toast.error("Rate limit exceeded. Please try again in a minute.");
      } else {
        toast.error(error.message || "Failed to enhance resume. Please try again later.");
      }
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteResumeFn();
      toast.success("Resume deleted successfully!");
      // Reset form to default values
      setValue("contactInfo", {});
      setValue("summary", "");
      setValue("skills", "");
      setValue("experience", []);
      setValue("education", []);
      setValue("projects", []);
      setPreviewContent("");
      setAtsScore(null);
      setAtsFeedback(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete resume");
    }
  };

  return (
    <div data-color-mode="light" className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-2">
        <h1 className="font-bold gradient-title text-5xl md:text-6xl">
          Resume Builder
        </h1>
        <div className="space-x-2">
          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Choose a Template</DialogTitle>
                <DialogDescription>
                  Select a template to start with a professional layout
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Button
                    key={template.id}
                    variant="outline"
                    className="h-24"
                    onClick={() => handleTemplateSelect(template.id)}
                    disabled={isGeneratingTemplate}
                  >
                    {isGeneratingTemplate ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      template.name
                    )}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="default"
            onClick={onSubmit}
            disabled={isSaving}
            className="mr-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Resume
              </>
            )}
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Print / Save as PDF
              </>
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeleting}>
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Resume
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Resume?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your resume.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {atsScore !== null && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ATS Score: {atsScore}
              {atsScore >= 80 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-yellow-500" />
              )}
            </CardTitle>
            <CardDescription>
              Your resume&apos;s compatibility with Applicant Tracking Systems
            </CardDescription>
          </CardHeader>
          {atsFeedback && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Strengths</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {atsFeedback.strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-green-600">
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Areas for Improvement</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {atsFeedback.improvements.map((improvement, index) => (
                      <li key={index} className="text-sm text-yellow-600">
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing Resume...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Resume (Word .docx recommended)
              </>
            )}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleEnhanceResume}
          disabled={isEnhancing}
          className="w-full"
        >
          {isEnhancing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enhancing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Enhance Entire Resume
            </>
          )}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="edit">Form</TabsTrigger>
          <TabsTrigger value="preview">Markdown</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    {...register("contactInfo.name")}
                    type="text"
                    placeholder="John Doe"
                    error={errors.contactInfo?.name}
                  />
                  {errors.contactInfo?.name && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    {...register("contactInfo.email")}
                    type="email"
                    placeholder="your@email.com"
                    error={errors.contactInfo?.email}
                  />
                  {errors.contactInfo?.email && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mobile Number</label>
                  <Input
                    {...register("contactInfo.mobile")}
                    type="tel"
                    placeholder="+1 234 567 8900"
                  />
                  {errors.contactInfo?.mobile && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.mobile.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">LinkedIn URL</label>
                  <Input
                    {...register("contactInfo.linkedin")}
                    type="url"
                    placeholder="https://linkedin.com/in/your-profile"
                  />
                  {errors.contactInfo?.linkedin && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.linkedin.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Twitter/X Profile
                  </label>
                  <Input
                    {...register("contactInfo.twitter")}
                    type="url"
                    placeholder="https://twitter.com/your-handle"
                  />
                  {errors.contactInfo?.twitter && (
                    <p className="text-sm text-red-500">
                      {errors.contactInfo.twitter.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Professional Summary Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Professional Summary</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleImproveSummary}
                  disabled={!formValues.summary || isImprovingSummary}
                  className="flex items-center gap-2"
                  title="Use AI to enhance your professional summary with industry-specific keywords and better phrasing"
                >
                  {isImprovingSummary ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Improving...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Improve with AI
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Write a compelling professional summary..."
                value={formValues.summary}
                onChange={(e) => setValue("summary", e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Skills Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Skills</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleImproveSkills}
                  disabled={!formValues.skills || isImprovingSkills}
                  className="flex items-center gap-2"
                  title="Use AI to enhance your skills list with industry-specific keywords and better organization"
                >
                  {isImprovingSkills ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Improving...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Improve with AI
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="List your key skills..."
                value={formValues.skills}
                onChange={(e) => setValue("skills", e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Experience */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Work Experience</h3>
              <Controller
                name="experience"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Experience"
                    entries={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.experience && (
                <p className="text-sm text-red-500">
                  {errors.experience.message}
                </p>
              )}
            </div>

            {/* Education */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Education</h3>
              <Controller
                name="education"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Education"
                    entries={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.education && (
                <p className="text-sm text-red-500">
                  {errors.education.message}
                </p>
              )}
            </div>

            {/* Projects */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Projects</h3>
              <Controller
                name="projects"
                control={control}
                render={({ field }) => (
                  <EntryForm
                    type="Project"
                    entries={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {errors.projects && (
                <p className="text-sm text-red-500">
                  {errors.projects.message}
                </p>
              )}
            </div>
          </form>
        </TabsContent>

        <TabsContent value="preview">
          {activeTab === "preview" && (
            <Button
              variant="link"
              type="button"
              className="mb-2"
              onClick={() =>
                setResumeMode(resumeMode === "preview" ? "edit" : "preview")
              }
            >
              {resumeMode === "preview" ? (
                <>
                  <Edit className="h-4 w-4" />
                  Edit Resume
                </>
              ) : (
                <>
                  <Monitor className="h-4 w-4" />
                  Show Preview
                </>
              )}
            </Button>
          )}

          {activeTab === "preview" && resumeMode !== "preview" && (
            <div className="flex p-3 gap-2 items-center border-2 border-yellow-600 text-yellow-600 rounded mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">
                You will lose edited markdown if you update the form data.
              </span>
            </div>
          )}
          <div className="border rounded-lg">
            <MDEditor
              value={previewContent}
              onChange={setPreviewContent}
              height={800}
              preview={resumeMode}
            />
          </div>
          <div className="hidden">
            <div id="resume-pdf">
              <MDEditor.Markdown
                source={previewContent}
                style={{
                  background: "white",
                  color: "black",
                }}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
