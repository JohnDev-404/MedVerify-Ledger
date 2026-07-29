MedVerify Ledger
A Microservices-Based Pharmaceutical Verification System
📖 Overview
MedVerify Ledger is a microservices-based pharmaceutical verification system that allows patients to verify the authenticity of medication batches via the web or SMS. It provides a simple, accessible solution to combat counterfeit drugs – a global health crisis causing over 1 million deaths annually.

Live Demo: https://medverify-gateway.onrender.com

🎯 Features
✅ Batch Verification – Check if a medication batch is authentic or fake.

✅ Admin Dashboard – Full CRUD operations (add, edit, delete batches).

✅ SMS Webhook – Twilio-compatible SMS verification (simulated).

✅ Microservices Architecture – Independent, scalable services.

✅ Containerization – Dockerized services for consistency.

✅ Infrastructure as Code – render.yaml defines all services + database.

✅ Kubernetes Manifests – deployment.yaml, service.yaml, ingress.yaml, configmap.yaml, secret.yaml.

🏗️ Architecture
text
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Node.js)                      │
│            Routes: /api/verify, /api/admin/*, /api/sms         │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Verification │  │    Admin     │  │  SMS Webhook │
  │  Service     │  │   Service    │  │   Service    │
  │  (Python)    │  │  (Python)    │  │  (Python)    │
  └──────────────┘  └──────────────┘  └──────────────┘
          └───────────────────┼───────────────────┘
                              ▼
                  ┌─────────────────────┐
                  │  PostgreSQL (Render)│
                  │  - admin_batches   │
                  │  - verified_batches│
                  └─────────────────────┘
🛠️ Technology Stack
Component	Technology
Backend	Python 3.12, FastAPI, Node.js, Express
Frontend	HTML5, CSS3, JavaScript
Database	PostgreSQL, asyncpg
Containerization	Docker, Docker Compose
Orchestration	Kubernetes (Minikube)
Deployment	Render (PaaS)
HTTP Client	Axios
API Docs	Swagger UI / OpenAPI
📁 Project Structure
text
MedVerifyLedger/
├── README.md
├── render.yaml                    # Render Blueprint (IaC)
├── docker-compose.yaml            # Local Docker orchestration
├── k8s/                           # Kubernetes Manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   └── secret.yaml
└── services/
    ├── api-gateway/               # Node.js + Express Gateway
    │   ├── Dockerfile
    │   ├── server.js
    │   └── public/
    │       ├── index.html
    │       ├── admin.html
    │       └── login.html
    ├── verification-service/      # Python + FastAPI
    │   ├── Dockerfile
    │   ├── requirements.txt
    │   └── app/
    │       ├── main.py
    │       ├── models.py
    │       └── database.py
    ├── admin-service/             # Python + FastAPI
    │   ├── Dockerfile
    │   ├── requirements.txt
    │   └── app/
    │       ├── main.py
    │       ├── models.py
    │       └── database.py
    └── sms-webhook-service/       # Python + FastAPI
        ├── Dockerfile
        ├── requirements.txt
        └── app/
            └── main.py
🚀 Deployment
Render (Production)
The system is deployed on Render using render.yaml – an Infrastructure as Code blueprint.

Live URLs:

Gateway: https://medverify-gateway.onrender.com

Verification Service: https://medverify-verification.onrender.com

Admin Service: https://medverify-admin.onrender.com

SMS Service: https://medverify-sms.onrender.com

Local Development (Docker)
bash
# Build and start all services
docker-compose up --build

# Stop all containers
docker-compose down

# View logs
docker-compose logs -f api-gateway
Kubernetes (Local)
bash
# Start Minikube
minikube start

# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check status
kubectl get pods
kubectl get services
📡 API Documentation
Verification Service
Method	Endpoint	Description
POST	/verify	Check if a batch is authentic.
GET	/docs	Swagger UI documentation.
Example Request:

bash
curl -X POST https://medverify-verification.onrender.com/verify \
  -H "Content-Type: application/json" \
  -d '{"batch_number": "ABC123"}'
Example Response:

json
{"status": "authentic"}
Admin Service
Method	Endpoint	Description
POST	/batches	Add a new batch.
GET	/batches	List all batches.
PUT	/batches/{id}	Update a batch.
DELETE	/batches/{id}	Delete a batch.
Authentication: Requires api-key header.

Example Request:

bash
curl -X POST https://medverify-admin.onrender.com/batches \
  -H "api-key: :E4-Tz9CpVvqT:4" \
  -H "Content-Type: application/json" \
  -d '{"batch_number": "ABC123"}'
SMS Webhook Service
Method	Endpoint	Description
POST	/sms	Twilio-compatible SMS webhook.
Example Request:

bash
curl -X POST https://medverify-sms.onrender.com/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B1234567890" \
  -d "Body=Check%20batch%20ABC123"
🧪 Live Demo
Terminal Commands
bash
# 1. Health Check
curl -s https://medverify-gateway.onrender.com/health | jq .

# 2. Add a Batch
curl -X POST https://medverify-admin.onrender.com/batches \
  -H "api-key: :E4-Tz9CpVvqT:4" \
  -H "Content-Type: application/json" \
  -d '{"batch_number": "DEMO123"}'

# 3. Verify a Batch
curl -X POST https://medverify-gateway.onrender.com/api/verify \
  -H "Content-Type: application/json" \
  -d '{"batch_number": "DEMO123"}'

# 4. List Batches
curl -X GET https://medverify-gateway.onrender.com/api/admin/batches \
  -H "api-key: :E4-Tz9CpVvqT:4" | jq .

# 5. Update a Batch
curl -X PUT https://medverify-admin.onrender.com/batches/DEMO123 \
  -H "api-key: :E4-Tz9CpVvqT:4" \
  -H "Content-Type: application/json" \
  -d '{"new_batch_number": "DEMO456"}'

# 6. Delete a Batch
curl -X DELETE https://medverify-admin.onrender.com/batches/DEMO456 \
  -H "api-key: :E4-Tz9CpVvqT:4"

# 7. SMS Simulation
curl -X POST https://medverify-gateway.onrender.com/api/sms \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B234809991487" \
  -d "Body=Check%20batch%20ABC123"
⚠️ Common Issues & Solutions
Issue	Solution
ECONNRESET error	Fixed by replacing http-proxy-middleware with direct axios calls.
UndefinedTableError	Added CREATE TABLE IF NOT EXISTS on service startup.
429 Too Many Requests	Rate limiting on Render free tier – wait 30-60 seconds or reduce request frequency.
Admin page 401	Corrected API key to :E4-Tz9CpVvqT:4.
🔮 Future Improvements
Real SMS Integration – Complete Twilio A2P 10DLC registration.

User Authentication – Role-based access (patients, pharmacists, regulators).

Analytics Dashboard – Track verification requests and counterfeit trends.

Full Kubernetes Deployment – Migrate to EKS or GKE.

CI/CD Pipeline – Automated testing and deployment with GitHub Actions.

👨‍💻 Author
Name: John Olasupo

Project: MedVerify Ledger

Instructor: Wisdom Amaju

📝 License
This project was created for educational purposes as part of a Software Engineering course.

🙏 Acknowledgments
Wisdom Amaju – Instructor & Mentor

Render – For providing a free-tier deployment platform

FastAPI – For the powerful, async-first framework

Docker – For containerization

🔗 Links
Live Demo: https://medverify-gateway.onrender.com

GitHub Repository: https://github.com/JohnDev-404/MedVerify-Ledger

API Docs (Verification): https://medverify-verification.onrender.com/docs

API Docs (Admin): https://medverify-admin.onrender.com/docs

