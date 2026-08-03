-- SafeNova AI - Supabase PostgreSQL Schema Setup

-- 1. DROP TABLES IF THEY EXIST (for clean initialization)
DROP TABLE IF EXISTS evidence CASCADE;
DROP TABLE IF EXISTS location_logs CASCADE;
DROP TABLE IF EXISTS emergency_sessions CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS crime_incidents CASCADE;
DROP TABLE IF EXISTS safe_zones CASCADE;

-- 2. CREATE TABLES

-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- 'user', 'guardian', 'admin'
    tracking_code VARCHAR(50) UNIQUE,
    battery_level INTEGER DEFAULT 100,
    is_emergency BOOLEAN DEFAULT FALSE,
    medical_notes TEXT,
    blood_group VARCHAR(10),
    custom_wake_word VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tracking ON users(tracking_code);

-- Emergency Contacts Table
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(50),
    notify_sms BOOLEAN DEFAULT TRUE,
    notify_whatsapp BOOLEAN DEFAULT FALSE,
    notify_email BOOLEAN DEFAULT TRUE,
    notify_call BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);

-- Emergency Sessions Table
CREATE TABLE emergency_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    active BOOLEAN DEFAULT TRUE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    tracking_code VARCHAR(50) NOT NULL,
    emergency_type VARCHAR(100) DEFAULT 'unknown', -- 'voice_activation', 'manual', 'fall_detected'
    last_lat DOUBLE PRECISION,
    last_lng DOUBLE PRECISION,
    last_address TEXT,
    battery INTEGER DEFAULT 100,
    signal_status VARCHAR(50) DEFAULT 'Good'
);

CREATE INDEX idx_sessions_tracking ON emergency_sessions(tracking_code);
CREATE INDEX idx_sessions_user_id ON emergency_sessions(user_id);

-- Geolocation Log Table
CREATE TABLE location_logs (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES emergency_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION DEFAULT 0.0,
    direction DOUBLE PRECISION DEFAULT 0.0,
    battery INTEGER DEFAULT 100,
    accuracy DOUBLE PRECISION DEFAULT 10.0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_location_session_id ON location_logs(session_id);

-- Encrypted Evidence Table
CREATE TABLE evidence (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES emergency_sessions(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'audio', 'image_front', 'image_rear', 'video'
    filepath TEXT NOT NULL,
    location_lat DOUBLE PRECISION,
    location_lng DOUBLE PRECISION,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evidence_session_id ON evidence(session_id);

-- Crime Incidents (Heatmap Overlay)
CREATE TABLE crime_incidents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    severity VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safe Zones Table
CREATE TABLE safe_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'police', 'hospital', 'shelter'
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone VARCHAR(50)
);


-- 3. SEED INITIAL MOCK DATA (Police, Hospitals, Crime Zones)

-- Seed Safe Zones
INSERT INTO safe_zones (name, type, address, latitude, longitude, phone) VALUES
('Metro Police HQ', 'police', 'Cubbon Park Road, Bangalore', 12.9716, 77.5946, '+1-555-0199'),
('Central Circle Police Station', 'police', 'MG Road Cross, Bangalore', 12.9805, 77.6020, '+1-555-0122'),
('North Precinct Command', 'police', 'Malleshwaram, Bangalore', 12.9602, 77.5732, '+1-555-0177'),
('City General Hospital', 'hospital', 'Richmond Town, Bangalore', 12.9750, 77.5890, '+1-555-0211'),
('St. Luke Emergency Care', 'hospital', 'Indiranagar, Bangalore', 12.9650, 77.6110, '+1-555-0244');

-- Seed Mock Crime Incidents (Heatmap vectors)
INSERT INTO crime_incidents (title, description, latitude, longitude, severity) VALUES
('Industrial Yard Dark Alley', 'Poorly illuminated corridor with low pedestrian flow.', 12.9850, 77.5990, 'high'),
('Old Abandoned Subway', 'Inactive underpass corridor with high frequency of reported thefts.', 12.9550, 77.5820, 'high'),
('Highway Underpass Corridor', 'Low light conditions at night, frequent vandalism reported.', 12.9680, 77.6050, 'medium');
