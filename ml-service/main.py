from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from model import detector

app = FastAPI(title="AI Misinformation Analyzer ML Service")

class AnalysisRequest(BaseModel):
    text: str

class AnalysisResponse(BaseModel):
    label: str
    confidence: float
    explanation: str

@app.post("/predict", response_model=AnalysisResponse)
async def predict(request: AnalysisRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    try:
        result = detector.predict(request.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
