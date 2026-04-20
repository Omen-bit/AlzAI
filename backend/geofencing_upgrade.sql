-- AlzAI Geofencing Logical Upgrade
-- This script enhances the spatial logic of the platform using PostGIS

-- 1. Upgrade geofences table to use PostGIS Geometry
ALTER TABLE geofences ADD COLUMN IF NOT EXISTS boundary_geom GEOMETRY(Polygon, 4326);

-- 2. Upgrade location_logs table to use PostGIS Geometry
ALTER TABLE location_logs ADD COLUMN IF NOT EXISTS location_geom GEOMETRY(Point, 4326);

-- 3. Function to sync JSONB coordinates to Geometry (for backward compatibility and ease of UI)
CREATE OR REPLACE FUNCTION sync_geofence_geometry()
RETURNS TRIGGER AS $$
BEGIN
    -- Convert JSONB array of {lat, lng} to PostGIS Polygon
    -- Expected JSONB: [{"lat": 1.2, "lng": 3.4}, ...]
    NEW.boundary_geom := ST_SetSRID(
        ST_MakePolygon(
            ST_MakeLine(
                ARRAY(
                    SELECT ST_MakePoint(
                        (elem->>'lng')::float, 
                        (elem->>'lat')::float
                    )
                    FROM jsonb_array_elements(NEW.polygon_coordinates) AS elem
                ) || ST_MakePoint(
                    (NEW.polygon_coordinates->0->>'lng')::float, 
                    (NEW.polygon_coordinates->0->>'lat')::float
                ) -- Close the polygon
            )
        ), 
        4326
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_geofence_geom ON geofences;
CREATE TRIGGER trg_sync_geofence_geom
BEFORE INSERT OR UPDATE OF polygon_coordinates ON geofences
FOR EACH ROW EXECUTE FUNCTION sync_geofence_geometry();

-- 4. Function to automatically check for breaches on location insert
CREATE OR REPLACE FUNCTION check_location_breach()
RETURNS TRIGGER AS $$
DECLARE
    active_fence GEOMETRY;
    is_inside BOOLEAN;
    patient_name TEXT;
BEGIN
    -- Set the point geometry
    NEW.location_geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    
    -- Find active geofence for this patient
    SELECT boundary_geom INTO active_fence 
    FROM geofences 
    WHERE patient_id = NEW.patient_id AND is_active = true 
    ORDER BY created_at DESC LIMIT 1;

    IF active_fence IS NOT NULL THEN
        is_inside := ST_Within(NEW.location_geom, active_fence);
        
        IF NOT is_inside THEN
            NEW.breach_status := 'breach';
            NEW.breached_at := NOW();
            
            -- Fetch patient name for the alert
            SELECT name INTO patient_name FROM patients WHERE id = NEW.patient_id;
            
            -- Insert into alert_logs
            INSERT INTO alert_logs (patient_id, type, severity, message)
            VALUES (
                NEW.patient_id, 
                'GEOFENCE_BREACH', 
                'CRITICAL', 
                patient_name || ' has left the safe zone! Current coordinates: ' || NEW.latitude || ', ' || NEW.longitude
            );
            
            -- Note: We could trigger a webhook here for Twilio
            -- Or use Supabase Edge Functions listening to alert_logs
        ELSE
            NEW.breach_status := 'inside';
            NEW.returned_at := NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_location_breach ON location_logs;
CREATE TRIGGER trg_check_location_breach
BEFORE INSERT ON location_logs
FOR EACH ROW EXECUTE FUNCTION check_location_breach();

-- 5. Index for spatial queries
CREATE INDEX IF NOT EXISTS idx_geofences_boundary ON geofences USING GIST(boundary_geom);
CREATE INDEX IF NOT EXISTS idx_location_logs_geom ON location_logs USING GIST(location_geom);

-- 6. Retroactive Breach Audit (Fix for existing locations)
CREATE OR REPLACE PROCEDURE audit_patient_breaches(pid UUID)
LANGUAGE plpgsql AS $$
DECLARE
    active_fence GEOMETRY;
BEGIN
    SELECT boundary_geom INTO active_fence FROM geofences WHERE patient_id = pid AND is_active = true LIMIT 1;
    
    IF active_fence IS NOT NULL THEN
        UPDATE location_logs 
        SET 
            breach_status = CASE 
                WHEN ST_Within(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), active_fence) THEN 'inside' 
                ELSE 'breach' 
            END,
            breached_at = CASE 
                WHEN NOT ST_Within(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), active_fence) THEN COALESCE(breached_at, NOW())
                ELSE NULL
            END
        WHERE patient_id = pid;
    END IF;
END;
$$;

-- Note: Run 'CALL audit_patient_breaches('YOUR_PATIENT_ID');' manually to refresh state.
