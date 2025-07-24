-- updown_scores 테이블 추가
create table updown_scores (
    id uuid primary key default gen_random_uuid(),
    game_id uuid references games(id) on delete cascade,
    team_name text not null,
    score integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(game_id, team_name)
);

-- RLS 정책 설정
alter table updown_scores enable row level security;
create policy "Enable all" on updown_scores for all using (true) with check (true);

-- 인덱스 생성
create index if not exists updown_scores_game_id_idx on updown_scores(game_id);
create index if not exists updown_scores_team_name_idx on updown_scores(team_name); 