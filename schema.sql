-- ───────────────────────────────────────────────────────────
-- 우리집 저금통 · Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- 설계 원칙: 잔액(saved)은 따로 저장하지 않고 deposits(원장) 합계로 계산합니다.
-- ───────────────────────────────────────────────────────────

-- 아이
create table if not exists children (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  age         text,
  weekly_rate int  not null default 7000,   -- 한 주 평균 저금액(예상 달성 계산용)
  active_goal uuid,                          -- 지금 모으는 목표
  created_at  timestamptz default now()
);

-- 목표 (saved 컬럼 없음 = 원장 합계로 계산)
create table if not exists goals (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references children(id) on delete cascade,
  name       text not null,
  emoji      text default '🎯',
  color      text default '#2DB67D',
  image      text,                      -- 목표 사진 주소(Supabase Storage 공개 URL). 데모에선 data URL
  aspect     real default 1,            -- 사진 가로/세로 비율 (정확한 차오름 표시용)
  price      int  not null check (price > 0),
  sort       int  default 0,
  created_at timestamptz default now()
);

-- 입금 원장
create table if not exists deposits (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references children(id) on delete cascade,
  goal_id    uuid not null references goals(id)    on delete cascade,
  amount     int  not null check (amount > 0),
  type       text not null default 'coin',  -- 'bill'(지폐) | 'coin'(동전·용돈)
  serial     text,                          -- 지폐 일련번호 (동전은 null)
  created_at timestamptz default now()
);

-- ★ 이중 저축 차단: 같은 아이가 (같은 일련번호 + 같은 금액)을 두 번 못 넣게
--   금액까지 키에 넣어, 다른 권종에 우연히 같은 문자열이 잡혀도 막히지 않게 함
create unique index if not exists deposits_unique_serial
  on deposits (child_id, serial, amount) where serial is not null;

-- 잔액 계산 뷰 (선택)
create or replace view goal_balances as
  select g.id as goal_id, g.child_id, g.price,
         coalesce(sum(d.amount), 0) as saved
  from goals g
  left join deposits d on d.goal_id = g.id
  group by g.id;

-- ───────────────────────────────────────────────────────────
-- RLS (가정용 단일 기기 전제: 익명 키로 읽고 쓰기 허용)
-- 외부에 공개하는 앱이라면 Supabase Auth + 사용자별 정책으로 강화하세요.
-- ───────────────────────────────────────────────────────────
alter table children enable row level security;
alter table goals    enable row level security;
alter table deposits enable row level security;

create policy "family_all_children" on children for all using (true) with check (true);
create policy "family_all_goals"    on goals    for all using (true) with check (true);
create policy "family_all_deposits" on deposits for all using (true) with check (true);

-- ───────────────────────────────────────────────────────────
-- 시드 데이터 (두 아이) — 이름·나이는 나중에 앱 설정에서 바꾸세요
-- ───────────────────────────────────────────────────────────
do $$
declare c1 uuid; c2 uuid; g1 uuid; g3 uuid; g4 uuid;
begin
  insert into children(name, age, weekly_rate) values ('민준', '7살', 7000) returning id into c1;
  insert into children(name, age, weekly_rate) values ('서준', '10살', 12000) returning id into c2;

  insert into goals(child_id,name,emoji,color,price,sort) values (c1,'빨간 자전거','🚲','#E0564B',100000,0) returning id into g1;
  insert into goals(child_id,name,emoji,color,price,sort) values (c1,'게임기','🎮','#3F86C9',320000,1);
  insert into goals(child_id,name,emoji,color,price,sort) values (c1,'공룡 인형','🦖','#2DB67D',18000,2) returning id into g3;
  insert into goals(child_id,name,emoji,color,price,sort) values (c2,'축구화','⚽','#3F86C9',80000,0) returning id into g4;
  insert into goals(child_id,name,emoji,color,price,sort) values (c2,'드론','🚀','#9B6FD4',150000,1);

  update children set active_goal = g1 where id = c1;
  update children set active_goal = g4 where id = c2;

  insert into deposits(child_id,goal_id,amount,type,serial) values
    (c1,g1,50000,'bill','BX48273910A'),
    (c1,g1,10000,'bill','KD90112740C'),
    (c1,g1, 5000,'bill','TM55093218A'),
    (c2,g4,30000,'bill','PA33120945B');
end $$;

-- ───────────────────────────────────────────────────────────
-- 목표 사진 저장용 Storage 버킷 (공개 읽기)
-- ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('goal-images', 'goal-images', true)
on conflict (id) do nothing;

-- 가정용: 익명으로 읽기/올리기 허용 (외부 공개 앱이면 인증 기반으로 강화하세요)
create policy "goal_images_read"   on storage.objects for select using (bucket_id = 'goal-images');
create policy "goal_images_insert" on storage.objects for insert with check (bucket_id = 'goal-images');
create policy "goal_images_update" on storage.objects for update using (bucket_id = 'goal-images');
