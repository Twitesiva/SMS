-- School timetable migration
-- Safe to run multiple times where supported by IF EXISTS / IF NOT EXISTS.

create table if not exists categories (
  id bigserial primary key,
  name text not null unique check (name in ('Primary', 'Middle', 'Secondary')),
  created_at timestamptz not null default now()
);

insert into categories (name)
values ('Primary'), ('Middle'), ('Secondary')
on conflict (name) do nothing;

alter table if exists groups
  add column if not exists class_number integer,
  add column if not exists class_name text,
  add column if not exists school_level text;

update groups
set class_number = nullif(regexp_replace(coalesce(group_code::text, ''), '[^0-9]', '', 'g'), '')::int
where class_number is null;

update groups
set class_name = coalesce(class_name, group_name, 'Class ' || class_number::text)
where class_name is null;

update groups
set school_level = case
  when class_number between 1 and 5 then 'Primary'
  when class_number between 6 and 9 then 'Middle'
  when class_number between 10 and 12 then 'Secondary'
  else school_level
end
where school_level is null;

alter table if exists groups
  add constraint groups_class_number_ck check (class_number between 1 and 12);

alter table if exists groups
  add constraint groups_school_level_ck check (school_level in ('Primary', 'Middle', 'Secondary'));

create unique index if not exists ux_groups_class_number on groups (class_number);

alter table if exists courses
  add column if not exists section_name text,
  add column if not exists class_number integer,
  add column if not exists class_name text;

update courses
set section_name = coalesce(section_name, course_code)
where section_name is null;

update courses
set class_name = coalesce(class_name, group_name)
where class_name is null;

update courses c
set class_number = g.class_number
from groups g
where c.class_number is null and c.group_name = g.group_name;

alter table if exists courses
  add constraint courses_section_name_ck check (section_name in ('A','B','C','D','E','F'));

create unique index if not exists ux_courses_class_section
on courses (coalesce(class_number, -1), section_name)
where section_name is not null;

alter table if exists subjects
  add column if not exists subject_type text default 'core';

update subjects
set subject_type = 'core'
where subject_type is null;

alter table if exists subjects
  add constraint subjects_subject_type_ck check (subject_type in ('core', 'activity', 'language', 'skill'));

create table if not exists staff (
  id bigserial primary key,
  staff_id text not null unique,
  full_name text not null,
  gender text,
  date_of_birth date,
  aadhar_number text,
  phone_number text,
  email text,
  address text,
  designation text,
  qualification text,
  experience_years integer default 0,
  joining_date date,
  status text not null default 'ACTIVE',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into staff (
  staff_id, full_name, gender, date_of_birth, aadhar_number, phone_number, email, address,
  designation, qualification, experience_years, joining_date, status, image_url
)
select
  t.staff_id, t.full_name, t.gender, t.date_of_birth, t.aadhar_number, t.phone_number, t.email, t.address,
  t.designation, t.qualification, t.experience_years, t.joining_date, coalesce(t.status, 'ACTIVE'), t.image_url
from teachers t
where not exists (
  select 1 from staff s where s.staff_id = t.staff_id
);

create table if not exists staff_subjects (
  id bigserial primary key,
  staff_id bigint not null references staff(id) on delete cascade,
  subject_id bigint not null references subjects(subject_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_id, subject_id)
);

create table if not exists class_subjects (
  id bigserial primary key,
  class_id bigint not null references groups(group_id) on delete cascade,
  section_id bigint not null references courses(course_id) on delete cascade,
  term integer not null check (term in (1,2,3)),
  subject_id bigint not null references subjects(subject_id) on delete cascade,
  staff_id bigint not null references staff(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (class_id, section_id, term, subject_id)
);

create table if not exists periods (
  id bigserial primary key,
  class_band text not null check (class_band in ('1-9', '10-12')),
  period_number integer,
  period_type text not null check (period_type in ('class', 'break', 'lunch')),
  start_time time not null,
  end_time time not null,
  unique (class_band, period_number)
);

insert into periods (class_band, period_number, period_type, start_time, end_time)
values
('1-9', 1, 'class', '10:00', '10:40'),
('1-9', 2, 'class', '10:40', '11:20'),
('1-9', null, 'break', '11:20', '11:25'),
('1-9', 3, 'class', '11:25', '12:05'),
('1-9', 4, 'class', '12:05', '12:45'),
('1-9', null, 'lunch', '12:45', '13:10'),
('1-9', 5, 'class', '13:10', '13:50'),
('1-9', 6, 'class', '13:50', '14:30'),
('1-9', null, 'break', '14:30', '14:35'),
('1-9', 7, 'class', '14:35', '15:15'),
('1-9', 8, 'class', '15:15', '15:55'),
('10-12', 1, 'class', '10:00', '10:40'),
('10-12', 2, 'class', '10:40', '11:20'),
('10-12', null, 'break', '11:20', '11:25'),
('10-12', 3, 'class', '11:25', '12:05'),
('10-12', 4, 'class', '12:05', '12:45'),
('10-12', null, 'lunch', '12:45', '13:10'),
('10-12', 5, 'class', '13:10', '13:50'),
('10-12', 6, 'class', '13:50', '14:30')
on conflict do nothing;

create table if not exists timetable_sessions (
  id bigserial primary key,
  session_name text not null,
  academic_year text not null,
  term integer not null check (term in (1,2,3)),
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_name, academic_year, term)
);

create table if not exists timetable_session_classes (
  id bigserial primary key,
  session_id bigint not null references timetable_sessions(id) on delete cascade,
  class_id bigint not null references groups(group_id) on delete cascade,
  section_id bigint not null references courses(course_id) on delete cascade,
  term integer not null check (term in (1,2,3)),
  day_of_week text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  period_number integer,
  period_type text not null check (period_type in ('class', 'break', 'lunch')),
  start_time time,
  end_time time,
  subject_id bigint references subjects(subject_id) on delete set null,
  staff_id bigint references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, class_id, section_id, term, day_of_week, period_number, period_type)
);

create index if not exists idx_tsc_session_class_section on timetable_session_classes (session_id, class_id, section_id, term);
create index if not exists idx_tsc_staff_day_period on timetable_session_classes (staff_id, day_of_week, period_number);
create index if not exists idx_tsc_subject_day on timetable_session_classes (class_id, section_id, day_of_week, subject_id);
