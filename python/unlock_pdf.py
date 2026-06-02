import pikepdf
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/unlock-pdf")
async def unlock_pdf(file: UploadFile = File(...), password: str = Form(...)):
    try:
        contents = await file.read()
        pdf_stream = io.BytesIO(contents)
        pdf = pikepdf.open(pdf_stream, password=password)
        output_stream = io.BytesIO()
        pdf.save(output_stream)
        pdf.close()
        output_stream.seek(0)
        return StreamingResponse(
            output_stream,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=unlocked.pdf"}
        )
    except pikepdf._qpdf.PasswordError:
        return {"error": "رمز عبور اشتباه است"}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
