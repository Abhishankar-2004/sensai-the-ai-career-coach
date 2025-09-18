// Helper function to convert entries to markdown
export function entriesToMarkdown(entries, type) {
  if (!entries?.length) {
    console.log(`No entries found for ${type}`);
    return "";
  }

  console.log(`Converting ${entries.length} entries for ${type}:`, entries);

  return (
    `## ${type}\n\n` +
    entries
      .map((entry) => {
        // Handle different entry types with different field structures
        let title, organization, dateRange, description;
        
        if (type === "Education") {
          title = entry.degree || entry.title || "Degree";
          organization = entry.institution || entry.organization || "Institution";
          description = entry.description || "";
          // Add GPA if available
          if (entry.gpa) {
            description = `GPA: ${entry.gpa}\n\n${description}`;
          }
        } else if (type === "Projects") {
          title = entry.name || entry.title || "Project";
          organization = entry.role || entry.organization || "";
          description = entry.description || "";
          // Add technologies if available
          if (entry.technologies) {
            description = `Technologies: ${entry.technologies}\n\n${description}`;
          }
        } else {
          // Default for Work Experience
          title = entry.position || entry.title || "Position";
          organization = entry.company || entry.organization || "Company";
          description = entry.description || "";
        }
        
        // Handle date range
        if (entry.current) {
          dateRange = `${entry.startDate || "Start Date"} - Present`;
        } else {
          const startDate = entry.startDate || "Start Date";
          const endDate = entry.endDate || "End Date";
          dateRange = `${startDate} - ${endDate}`;
        }
        
        // Format the entry
        const organizationPart = organization ? ` @ ${organization}` : "";
        const header = `### ${title}${organizationPart}`;
        const dateLine = dateRange !== "Start Date - End Date" ? `*${dateRange}*` : "";
        
        return [header, dateLine, description].filter(Boolean).join("\n\n");
      })
      .join("\n\n")
  );
}
