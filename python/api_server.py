# python/api_server.py
import io
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import pikepdf
import urllib.parse

app = FastAPI(title="PDF Unlock API (No Password Needed)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/unlock-pdf")
async def unlock_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="فایل باید با فرمت PDF باشد")

    try:
        contents = await file.read()
        pdf_stream = io.BytesIO(contents)

        pdf = pikepdf.open(pdf_stream)

        output_stream = io.BytesIO()
        pdf.save(output_stream)
        pdf.close()
        output_stream.seek(0)

        # encode نام فایل برای کاراکترهای فارسی (RFC 5987)
        encoded_filename = urllib.parse.quote(f"unlocked_{file.filename}")
        disposition = f"attachment; filename*=UTF-8''{encoded_filename}"

        return StreamingResponse(
            output_stream,
            media_type="application/pdf",
            headers={"Content-Disposition": disposition}
        )
    except pikepdf.PasswordError:
        raise HTTPException(status_code=401, detail="PDF دارای رمز عبور است (ابزار فقط فایل‌های بدون رمز یا رمز خالی را باز می‌کند)")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
