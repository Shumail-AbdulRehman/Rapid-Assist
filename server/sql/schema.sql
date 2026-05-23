CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'provider')),
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  profile_picture TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  workshop_picture TEXT,
  cnic VARCHAR(30) NOT NULL,
  certificates TEXT,
  previous_work_history TEXT,
  reviews_summary TEXT,
  is_premium BOOLEAN DEFAULT FALSE,
  current_latitude NUMERIC(10, 7),
  current_longitude NUMERIC(10, 7),
  is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  base_price NUMERIC(10, 2) NOT NULL,
  extra_per_km NUMERIC(10, 2) NOT NULL DEFAULT 150
);

CREATE TABLE IF NOT EXISTS service_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id),
  description TEXT NOT NULL,
  vehicle_number VARCHAR(40) NOT NULL,
  current_latitude NUMERIC(10, 7) NOT NULL,
  current_longitude NUMERIC(10, 7) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'offered', 'accepted', 'in_progress', 'completed', 'cancelled')),
  accepted_offer_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offers (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price NUMERIC(10, 2) NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  message TEXT,
  distance_km NUMERIC(10, 2) NOT NULL,
  extra_distance_charge NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_accepted_offer'
  ) THEN
    ALTER TABLE service_requests
      ADD CONSTRAINT fk_accepted_offer
      FOREIGN KEY (accepted_offer_id) REFERENCES offers(id);
  END IF;
END $$;

INSERT INTO services (name, base_price, extra_per_km)
VALUES
  ('Car Towing Service', 2500, 200),
  ('Fuel Delivery', 1500, 150),
  ('Mechanic Service', 2000, 180)
ON CONFLICT (name) DO NOTHING;
