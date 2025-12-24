cd snapmind/backend
# Install dependencies (if not done)
pip install fastapi uvicorn requests python-dotenv supabase google-generativeai beautifulsoup4
# Run the server
uvicorn main:app --reload --port 8000


<!--  activate-->
.\venv\Scripts\activate