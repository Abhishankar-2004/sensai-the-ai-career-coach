# Sensai - The AI Career Coach

A comprehensive career development platform powered by AI to help users build resumes, prepare for interviews, and create cover letters.

## Features

### Resume Builder
- Create and edit professional resumes with a user-friendly interface
- Upload existing resumes (PDF, DOC, DOCX) for AI-powered parsing
- AI-powered enhancement of resume sections (summary, skills, experience)
- Multiple resume templates to choose from
- Export resumes as PDF
- ATS (Applicant Tracking System) compatibility scoring

### Interview Preparation
- Practice with industry-specific interview questions
- Track performance with detailed analytics
- Get AI-powered feedback on your responses
- Prepare for technical and behavioral interviews

### AI Cover Letter Generator
- Create customized cover letters for job applications
- AI-powered content generation based on job descriptions
- Save and manage multiple cover letters

### Dashboard
- Industry insights and market trends
- Salary range information for different roles
- Job demand metrics and market outlook
- Personalized career recommendations

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **UI Components**: Shadcn UI, Radix UI
- **Authentication**: Clerk
- **Database**: Prisma with Neon DB
- **AI Integration**: Google Gemini API
- **PDF Processing**: pdf2json, mammoth
- **Charts**: Recharts
- **Form Handling**: React Hook Form, Zod validation

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Google Gemini API key
- A Clerk account for authentication
- A Neon DB account for the database

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sensai-ai-career-coach.git
   cd sensai-ai-career-coach
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   DATABASE_URL=your_neon_db_connection_string

   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key

   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Sign Up/Login**: Create an account or log in using Clerk authentication.
2. **Onboarding**: Complete the onboarding process to set your industry preferences.
3. **Dashboard**: View industry insights and career recommendations.
4. **Resume Builder**: Create, edit, and enhance your resume.
5. **Interview Prep**: Practice interview questions and track your performance.
6. **Cover Letters**: Generate customized cover letters for job applications.

## Rate Limiting

The application uses the Google Gemini API for AI-powered features. The free tier has a limit of 2 requests per minute per project per model. The application includes rate limiting to handle these constraints gracefully.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Shadcn UI](https://ui.shadcn.com/) for the beautiful UI components
- [Google Gemini](https://deepmind.google/technologies/gemini/) for the AI capabilities
- [Clerk](https://clerk.com/) for authentication
- [Neon DB](https://neon.tech/) for the serverless database
