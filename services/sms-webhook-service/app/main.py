from fastapi import FastAPI, Request
from fastapi.responses import Response
from twilio.twiml.messaging_response import MessagingResponse
import re
import os
import httpx

app = FastAPI(title="SMS Webhook Service")

# Get the verification service URL and ensure it has a protocol
VERIFICATION_SERVICE_URL = os.getenv(
    "VERIFICATION_SERVICE_URL",
    "http://verification-service:8001"
)
if not VERIFICATION_SERVICE_URL.startswith(("http://", "https://")):
    VERIFICATION_SERVICE_URL = "http://" + VERIFICATION_SERVICE_URL

@app.post("/sms")
async def handle_sms(request: Request):
    twilio_response = MessagingResponse()

    try:
        form_data = await request.form()
        from_number = form_data.get('From', 'unknown')
        body = form_data.get('Body', '')

        print(f"Received SMS from {from_number}: {body}")

        # Extract batch number
        match = re.search(r"batch\s*([A-Z0-9]+)", body, re.IGNORECASE)
        if not match:
            twilio_response.message("Please include 'batch <number>' in your message. Example: 'Check batch ABC123'")
            return Response(content=str(twilio_response), media_type="application/xml")

        batch_number = match.group(1)

        # Call verification service
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{VERIFICATION_SERVICE_URL}/verify",
                json={"batch_number": batch_number}
            )
            response.raise_for_status()
            data = response.json()

        status = data.get("status")
        if status == "authentic":
            reply = f"✅ Batch {batch_number} is AUTHENTIC. This medication is verified."
        elif status == "fake":
            reply = f"❌ Batch {batch_number} is FAKE. This medication is not verified."
        else:
            reply = f"⚠️ Could not verify batch {batch_number}. Please contact support."

        twilio_response.message(reply)

    except httpx.TimeoutException:
        twilio_response.message("⚠️ Verification service timed out. Please try again later.")
    except httpx.HTTPStatusError as e:
        print(f"Verification service error: {e}")
        twilio_response.message("⚠️ Verification service error. Please try again later.")
    except Exception as e:
        print(f"Unexpected error: {e}")
        twilio_response.message("⚠️ An internal error occurred. Please try again later.")

    return Response(content=str(twilio_response), media_type="application/xml")