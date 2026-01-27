-- SEED DATA SCRIPT
-- Run this AFTER defining the tables (setup_database.sql).
-- This will populate your dashboard with demo data.

do $$
declare
    v_year_id bigint;
    v_group_sci_id bigint;
    v_group_comm_id bigint;
    v_course_bsc_id bigint;
    v_course_bcom_id bigint;
    v_cat_core_id bigint;
    v_student_id bigint;
    v_fee_id bigint;
begin
    -- 1. Academic Year
    insert into public.academic_year (academic_year, active) 
    values ('2025-2026', true);

    -- 2. Groups
    insert into public.groups (group_name, group_code, category) 
    values ('Science', 'SCI', 'UG') 
    returning group_id into v_group_sci_id;

    insert into public.groups (group_name, group_code, category) 
    values ('Commerce', 'COM', 'UG') 
    returning group_id into v_group_comm_id;

    -- 3. Courses
    insert into public.courses (course_name, course_code, group_id, group_name, no_of_semesters, duration_years)
    values ('B.Sc Computer Science', 'BSC-CS', v_group_sci_id, 'Science', 6, 3)
    returning course_id into v_course_bsc_id;

    insert into public.courses (course_name, course_code, group_id, group_name, no_of_semesters, duration_years)
    values ('B.Com General', 'BCOM-GEN', v_group_comm_id, 'Commerce', 6, 3)
    returning course_id into v_course_bcom_id;

    -- 4. Teachers
    insert into public.teachers (full_name, email, designation, status) values 
    ('Dr. Alan Turing', 'alan@college.edu', 'Senior Professor', 'ACTIVE'),
    ('Grace Hopper', 'grace@college.edu', 'HOD', 'ACTIVE'),
    ('Ada Lovelace', 'ada@college.edu', 'Assistant Professor', 'ACTIVE'),
    ('John von Neumann', 'john@college.edu', 'Lecturer', 'ACTIVE');

    -- 5. Students
    -- Student 1 (Science)
    insert into public.students (
        student_id, hall_ticket_no, full_name, gender, 
        group_id, course_id, group_name, course_name, 
        academic_year, current_semester, status, payment_status
    ) values (
        'STU001', 'HT2025001', 'Alice Johnson', 'Female',
        v_group_sci_id, v_course_bsc_id, 'Science', 'BSC-CS',
        '2025-2026', 1, 'ACTIVE', 'PAID'
    ) returning id into v_student_id;

    -- Student 2 (Science)
    insert into public.students (
        student_id, hall_ticket_no, full_name, gender, 
        group_id, course_id, group_name, course_name, 
        academic_year, current_semester, status, payment_status
    ) values (
        'STU002', 'HT2025002', 'Bob Smith', 'Male',
        v_group_sci_id, v_course_bsc_id, 'Science', 'BSC-CS',
        '2025-2026', 1, 'ACTIVE', 'PENDING'
    );

    -- Student 3 (Commerce)
    insert into public.students (
        student_id, hall_ticket_no, full_name, gender, 
        group_id, course_id, group_name, course_name, 
        academic_year, current_semester, status, payment_status
    ) values (
        'STU003', 'HT2025003', 'Charlie Brown', 'Male',
        v_group_comm_id, v_course_bcom_id, 'Commerce', 'BCOM-GEN',
        '2025-2026', 1, 'ACTIVE', 'PAID'
    );

    -- 6. Fee Structure (needed for payments)
    insert into public.fee_structure (academic_year, group_name, course_name, semester, fee_cat, amount)
    values ('2025-2026', 'Science', 'BSC-CS', 1, 'Tuition Fee', 25000)
    returning id into v_fee_id;

    -- 7. Fee Payments
    -- Payment for Student 1
    insert into public.student_fee_payments (student_id, payment_status, academic_fee_id, amount, method, reference)
    values ('STU001', 'success', v_fee_id, 25000, 'Online', 'TXN123456');
    
    -- Payment for Student 3
    insert into public.student_fee_payments (student_id, payment_status, academic_fee_id, amount, method, reference)
    values ('STU003', 'success', v_fee_id, 20000, 'Cash', 'REC987654');

end $$;
