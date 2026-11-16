# AI Resume Feedback: demo guide (story #18)

## Demo flow
1. Sign in as a job seeker and upload a PDF, DOC, or DOCX resume to the profile.
2. Choose a job posting from the profile page.
3. Click "Get AI Feedback".
4. The panel shows: resume score, job match score, strengths, gaps vs. the posting, suggested edits, ATS tips.

## Run it with your own configuration
1. Create a Gemini API key in Google AI Studio.
2. Set environment variables before starting the server:
   - `GEMINI_API_KEY` (required)
   - `GEMINI_MODEL` (optional; use a model that is on your free tier)
3. Use Node 18+ (`node -v`).
4. Run `npm install`, start the server, and open the profile page.

PDFs are sent to Gemini as PDF data. DOC and DOCX resumes have their text extracted on the server before it is sent to Gemini. Text extraction is limited to 100,000 characters and resume files to 10 MB.

Never commit the key. Use a local `.env` that is listed in `.gitignore`.

## Show the failure case
Start the server with a wrong or missing `GEMINI_API_KEY` and click the button. The panel should show a clear error message and the button should work again.

## Privacy note
Free tiers may use prompts for training. Use fake or your own resume data only.
