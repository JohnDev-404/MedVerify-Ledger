CREATE TABLE IF NOT EXISTS verified_batches (
    id SERIAL PRIMARY KEY,
    batch_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
