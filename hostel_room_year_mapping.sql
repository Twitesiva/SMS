-- Adds block_id and floor_no to hostel_room_year_mapping and keeps them in sync with hostel_rooms.

create table if not exists public.hostel_room_year_mapping (
  id bigint generated always as identity primary key,
  room_id bigint not null,
  academic_year text not null,
  year_of_study integer not null,
  block_id bigint not null,
  floor_no integer not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

alter table public.hostel_room_year_mapping
  add column if not exists block_id bigint,
  add column if not exists floor_no integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'hostel_room_year_mapping_room_id_fkey') then
    alter table public.hostel_room_year_mapping
      add constraint hostel_room_year_mapping_room_id_fkey
        foreign key (room_id) references public.hostel_rooms(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'hostel_room_year_mapping_block_id_fkey') then
    alter table public.hostel_room_year_mapping
      add constraint hostel_room_year_mapping_block_id_fkey
        foreign key (block_id) references public.hostel_blocks(id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'hostel_room_year_mapping_academic_year_fkey') then
    alter table public.hostel_room_year_mapping
      add constraint hostel_room_year_mapping_academic_year_fkey
        foreign key (academic_year) references public.academic_year(academic_year);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'hostel_room_year_mapping_room_year_unique') then
    alter table public.hostel_room_year_mapping
      add constraint hostel_room_year_mapping_room_year_unique
        unique (room_id, academic_year, year_of_study);
  end if;
end $$;

update public.hostel_room_year_mapping as m
set block_id = r.block_id,
    floor_no = r.floor_no
from public.hostel_rooms as r
where m.room_id = r.id
  and (m.block_id is null or m.floor_no is null);

alter table public.hostel_room_year_mapping
  alter column block_id set not null,
  alter column floor_no set not null;

create or replace function public.sync_room_year_mapping_room_details()
returns trigger as $$
begin
  select block_id, floor_no
    into new.block_id, new.floor_no
  from public.hostel_rooms
  where id = new.room_id;

  if new.block_id is null or new.floor_no is null then
    raise exception 'Room % not found or missing block/floor', new.room_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_room_year_mapping_room_details
  on public.hostel_room_year_mapping;

create trigger trg_sync_room_year_mapping_room_details
before insert or update on public.hostel_room_year_mapping
for each row execute function public.sync_room_year_mapping_room_details();

create or replace function public.sync_room_year_mapping_from_room()
returns trigger as $$
begin
  update public.hostel_room_year_mapping
  set block_id = new.block_id,
      floor_no = new.floor_no
  where room_id = new.id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_room_year_mapping_from_room
  on public.hostel_rooms;

create trigger trg_sync_room_year_mapping_from_room
after update of block_id, floor_no on public.hostel_rooms
for each row execute function public.sync_room_year_mapping_from_room();
