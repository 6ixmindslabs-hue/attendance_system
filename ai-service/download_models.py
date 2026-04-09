import os
from insightface.app import FaceAnalysis

def download_models():
    model_name = os.environ.get("INSIGHTFACE_MODEL", "buffalo_s")
    print(f"Pre-downloading InsightFace model: {model_name}...")
    
    # Initialize app to trigger model download
    # Only load detection and recognition to keep it lean
    app = FaceAnalysis(
        name=model_name, 
        allowed_modules=['detection', 'recognition', 'landmark_2d_10g'],
        providers=["CPUExecutionProvider"]
    )
    # This call triggers the download
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("Model download complete!")

if __name__ == "__main__":
    download_models()
