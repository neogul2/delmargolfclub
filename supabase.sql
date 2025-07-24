-- Storage 정책 및 기존 테이블 삭제
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Give users access to own folder" on storage.objects;

-- 먼저 storage objects 삭제
delete from storage.objects where bucket_id = 'game-photos';
-- 그 다음 bucket 삭제
delete from storage.buckets where id = 'game-photos';

-- 트리거 함수가 있다면 삭제
drop function if exists check_game_photos_limit() cascade;

drop table if exists game_photos;
drop table if exists scores;
drop table if exists team_players;
drop table if exists teams;
drop table if exists players;
drop table if exists games;

-- Storage 버킷 생성
insert into storage.buckets (id, name, public)
values ('game-photos', 'game-photos', true);

-- Storage 정책 설정
create policy "Public Access"
on storage.objects for all
using ( bucket_id = 'game-photos' )
with check ( bucket_id = 'game-photos' );

-- 기본 테이블 생성
create table games (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    date date not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table players (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table teams (
    id uuid primary key default gen_random_uuid(),
    game_id uuid references games(id) on delete cascade,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table team_players (
    id uuid primary key default gen_random_uuid(),
    team_id uuid references teams(id) on delete cascade,
    player_id uuid references players(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(team_id, player_id)
);

create table scores (
    id uuid primary key default gen_random_uuid(),
    game_id uuid references games(id) on delete cascade,
    team_id uuid references teams(id) on delete cascade,
    player_id uuid references players(id) on delete cascade,
    team_player_id uuid references team_players(id) on delete cascade,
    hole_number integer not null check (hole_number between 1 and 18),
    score integer not null check (score between -4 and 10),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(game_id, player_id, hole_number)
);

create table game_photos (
    id uuid primary key default gen_random_uuid(),
    game_id uuid references games(id) on delete cascade,
    photo_url text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table updown_scores (
    id uuid primary key default gen_random_uuid(),
    game_id uuid references games(id) on delete cascade,
    team_name text not null,
    score integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(game_id, team_name)
);

-- 게임당 사진 개수 제한을 위한 트리거 함수
create function check_game_photos_limit()
returns trigger as $$
begin
    if (
        select count(*)
        from game_photos
        where game_id = NEW.game_id
    ) >= 2 then
        raise exception '한 게임당 최대 2장의 사진만 업로드할 수 있습니다.';
    end if;
    return NEW;
end;
$$ language plpgsql;

-- 트리거 생성
create trigger enforce_game_photos_limit
    before insert on game_photos
    for each row
    execute function check_game_photos_limit();

-- RLS 정책 설정
alter table games enable row level security;
alter table players enable row level security;
alter table teams enable row level security;
alter table team_players enable row level security;
alter table scores enable row level security;
alter table game_photos enable row level security;
alter table updown_scores enable row level security;

-- RLS 정책 생성 (모든 사용자에게 모든 권한 부여)
create policy "Enable all" on games for all using (true) with check (true);
create policy "Enable all" on players for all using (true) with check (true);
create policy "Enable all" on teams for all using (true) with check (true);
create policy "Enable all" on team_players for all using (true) with check (true);
create policy "Enable all" on scores for all using (true) with check (true);
create policy "Enable all" on game_photos for all using (true) with check (true);
create policy "Enable all" on updown_scores for all using (true) with check (true);

-- 인덱스 생성
create index if not exists teams_game_id_idx on teams(game_id);
create index if not exists team_players_team_id_idx on team_players(team_id);
create index if not exists team_players_player_id_idx on team_players(player_id);
create index if not exists scores_game_id_idx on scores(game_id);
create index if not exists scores_team_id_idx on scores(team_id);
create index if not exists scores_player_id_idx on scores(player_id);
create index if not exists scores_team_player_id_idx on scores(team_player_id);
create index if not exists game_photos_game_id_idx on game_photos(game_id); 

create index if not exists updown_scores_game_id_idx on updown_scores(game_id);
create index if not exists updown_scores_team_name_idx on updown_scores(team_name);

-- 과거 경기 핸디 테이블
create table player_handicaps (
    id uuid primary key default gen_random_uuid(),
    player_name text not null,
    game_name text not null,
    game_date text not null,
    handicap integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(player_name, game_name, game_date)
);

-- RLS 정책
alter table player_handicaps enable row level security;
create policy "Enable all" on player_handicaps for all using (true) with check (true);

-- 인덱스
create index if not exists player_handicaps_player_name_idx on player_handicaps(player_name);
create index if not exists player_handicaps_game_name_idx on player_handicaps(game_name);
create index if not exists player_handicaps_game_date_idx on player_handicaps(game_date); 