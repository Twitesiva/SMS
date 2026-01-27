-- 1. Helper function to determine hostel preference from payments
CREATE OR REPLACE FUNCTION public.get_student_hostel_preference(p_student_id bigint)
RETURNS text AS $$
DECLARE
    v_preference text;
BEGIN
    -- Check for explicit AC mentions in payment records
    SELECT 
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM student_fee_payments 
                WHERE student_id = p_student_id 
                  AND payment_status = 'success'
                  AND fee_type ILIKE '%HOSTEL%'
                  AND (
                      fee_type ILIKE '%AC%' 
                      OR payment_type ILIKE '%AC%'
                      OR payment_mode ILIKE '%AC%' -- unlikely but possible
                  )
            ) THEN 'AC'
            WHEN EXISTS (
                SELECT 1 
                FROM student_fee_payments 
                WHERE student_id = p_student_id 
                  AND payment_status = 'success'
                  AND fee_type ILIKE '%HOSTEL%'
            ) THEN 'NON_AC'
            ELSE NULL
        END
    INTO v_preference;

    RETURN v_preference;
END;
$$ LANGUAGE plpgsql;

-- 2. View for Eligible Students
CREATE OR REPLACE VIEW public.v_hostel_payment_eligible_students AS
SELECT 
    s.id AS student_id,
    s.full_name,
    s.student_id AS hall_ticket_no, -- Assuming student_id is the unique identifier string
    s.gender,
    public.get_student_hostel_preference(s.id) AS hostel_type,
    true AS has_paid,
    MAX(p.created_at) AS last_payment_date
FROM students s
JOIN student_fee_payments p ON s.id = p.student_id
WHERE p.payment_status = 'success' 
  AND p.fee_type ILIKE '%HOSTEL%'
GROUP BY s.id, s.full_name, s.student_id, s.gender;

-- 3. Auto Allocate RPC
CREATE OR REPLACE FUNCTION public.allocate_hostel_for_paid_student(
    p_student_id bigint, 
    p_academic_year varchar
) 
RETURNS bigint AS $$
DECLARE
    v_hostel_type text;
    v_bed_id bigint;
    v_allocation_id bigint;
    v_student_gender text;
    v_block_gender text;
BEGIN
    -- 1. Get Hostel Type
    v_hostel_type := public.get_student_hostel_preference(p_student_id);
    
    IF v_hostel_type IS NULL THEN
        RAISE EXCEPTION 'Student has not paid hostel fees or payment record not found.';
    END IF;

    -- 2. Get Student Gender
    SELECT gender INTO v_student_gender FROM students WHERE id = p_student_id;
    IF v_student_gender IS NULL THEN
        RAISE EXCEPTION 'Student gender not found.';
    END IF;
    
    -- Normalize gender to match block convention (Boys/Girls)
    v_block_gender := CASE 
        WHEN lower(v_student_gender) LIKE 'm%' THEN 'BOYS' 
        ELSE 'GIRLS' 
    END;

    -- 3. Find Available Bed
    -- Use v_hostel_available_beds which presumably joins blocks, rooms, beds
    SELECT bed_id INTO v_bed_id
    FROM v_hostel_available_beds
    WHERE academic_year = p_academic_year
      AND room_type = v_hostel_type
      AND block_gender = v_block_gender
    ORDER BY block_name, floor_no, room_no, bed_no
    LIMIT 1;

    IF v_bed_id IS NULL THEN
        RAISE EXCEPTION 'No available % beds found for % in academic year %.', v_hostel_type, v_block_gender, p_academic_year;
    END IF;

    -- 4. Allocate using existing primitive logic (which likely handles update/insert)
    -- Assuming allocate_hostel_bed returns the allocation ID or void.
    -- If it's a void function, we need to select the ID afterwards.
    -- Let's try to call it.
    
    -- Note: We don't have the signature of allocate_hostel_bed confirmed, but usually it returns something or void.
    -- The prompt says "call allocate_hostel_bed(...)".
    
    PERFORM public.allocate_hostel_bed(p_student_id, v_bed_id, p_academic_year);

    -- Fetch the allocation ID to return
    SELECT id INTO v_allocation_id 
    FROM hostel_allocations 
    WHERE student_id = p_student_id 
      AND status = 'ACTIVE' 
      AND academic_year = p_academic_year;

    RETURN v_allocation_id;
END;
$$ LANGUAGE plpgsql;
