---
title: Attendance AI Service
emoji: 🤖
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
app_port: 7860
---

# Attendance Management AI Service

This is the Face Recognition service for the Attendance Management System. It uses InsightFace for high-accuracy face detection and recognition.

## Deployment on Hugging Face Spaces

1. Create a new Space on [Hugging Face](https://huggingface.co/new-space).
2. Choose **Docker** as the SDK.
3. Select **Blank** as the template.
4. Upload all files from the `ai-service/` folder (or push this folder to the Space's repo).
5. Add the following **Secrets** in the Space Settings:
   - `SUPABASE_URL`: Your Supabase Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key.
6. The app will automatically build and start on port 7860.

## API Endpoints

- `GET /health`: Check service status.
- `POST /register`: Register face embeddings from images.
- `POST /recognize`: Recognize a student's face from a live image.
- `POST /refresh-cache`: Update the local recognition cache from Supabase.
