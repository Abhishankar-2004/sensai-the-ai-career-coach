@echo off
echo Renaming project folder from ai-career-coach-master to sensai-ai-career-coach
cd ..
ren "ai-career-coach-master" "sensai-ai-career-coach"
echo Done! The project folder has been renamed.
echo Please restart your development server with: cd sensai-ai-career-coach && npm run dev
pause 