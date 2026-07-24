CREATE TABLE label_requests (
    id SERIAL PRIMARY KEY,
    requester_did TEXT NOT NULL,
    requester_handle TEXT,
    target_did TEXT NOT NULL,
    target_handle TEXT NOT NULL,
    location_key VARCHAR(200) NOT NULL,
    location_name VARCHAR(300),
    request_type VARCHAR(10) NOT NULL CHECK (request_type IN ('add', 'remove')),
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    reviewed_at TIMESTAMP,
    reviewed_by TEXT,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_label_requests_status ON label_requests(status);
CREATE INDEX idx_label_requests_requester ON label_requests(requester_did);
CREATE INDEX idx_label_requests_target ON label_requests(target_did);
CREATE INDEX idx_label_requests_created ON label_requests(created_at DESC);
