from fastapi import FastAPI, Request
from fastapi.responses import Response
from twilio.twiml.messaging_response import MessagingResponse
import re
import os
import httpx

app = FastAPI(title="SMS Webhook Service")

VERIFICATION_SERVICE_URL = os.getenv(
    "VERIFICATION_SERVICE_URL",
    "http://verification-service:8001"
)


@app.post("/sms")
async def handle_sms(request: Request):
    # TwiML response object - we will always return this
    twilio_response = MessagingResponse()

    try:
        # 1. Parse form data from Twilio
        form_data = await request.form()
        from_number = form_data.get('From', 'unknown')
        body = form_data.get('Body', '')

        print(f"Received SMS from {from_number}: {body}")

        # 2. Extract batch number
        match = re.search(r"batch\s*([A-Z0-9]+)", body, re.IGNORECASE)
        if not match:
            twilio_response.message("Please include 'batch <number>' in your message. Example: 'Check batch ABC123'")
            return Response(content=str(twilio_response), media_type="application/xml")

        batch_number = match.group(1)

        # 3. Call verification service
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{VERIFICATION_SERVICE_URL}/verify",
                json={"batch_number": batch_number}
            )
            response.raise_for_status()
            data = response.json()

        # 4. Build the reply
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
        # Catch any other unexpected errors
        print(f"Unexpected error: {e}")
        twilio_response.message("⚠️ An internal error occurred. Please try again later.")

    # Always return XML
    return Response(content=str(twilio_response), media_type="application/xml")