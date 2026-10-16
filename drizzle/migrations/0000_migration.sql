
create type public.app_role as enum ('admin','member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.has_access(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','member'))
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "read own roles or admin" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin grants roles" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin removes roles" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.user_preferences (
  user_id uuid primary key,
  cook_time text not null default 'hasta_20' check (cook_time in ('hasta_20','20_40','mas_40')),
  diet text not null default 'variada',
  diet_other text,
  meals text[] not null default array['almuerzo','cena'],
  avoid_ingredient_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;
alter table public.user_preferences enable row level security;
create policy "own prefs" on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "members read categories" on public.categories for select to authenticated using (public.has_access(auth.uid()));
create policy "admin write categories" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.diet_options (
  slug text primary key,
  name text not null,
  sort_order int not null default 0
);
grant select, insert, update, delete on public.diet_options to authenticated;
grant all on public.diet_options to service_role;
alter table public.diet_options enable row level security;
create policy "read diet options" on public.diet_options for select to authenticated using (true);
create policy "admin diet options" on public.diet_options for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text not null unique,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ingredients to authenticated;
grant all on public.ingredients to service_role;
alter table public.ingredients enable row level security;
create policy "members read ingredients" on public.ingredients for select to authenticated using (public.has_access(auth.uid()));
create policy "admin write ingredients" on public.ingredients for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  code int unique,
  name text not null,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  image_url text,
  cooking_method text,
  prep_minutes int check (prep_minutes is null or prep_minutes >= 0),
  prep_time_note text,
  servings int check (servings is null or servings > 0),
  meal_types text[] not null default '{}',
  diet_tags text[] not null default '{}',
  ingredients_verified boolean not null default false,
  steps text[] not null default '{}',
  tip text,
  source text,
  is_demo boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.recipes to authenticated;
grant all on public.recipes to service_role;
alter table public.recipes enable row level security;
create policy "members read published" on public.recipes for select to authenticated using ((published and public.has_access(auth.uid())) or public.has_role(auth.uid(),'admin'));
create policy "admin write recipes" on public.recipes for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  raw_text text not null,
  quantity numeric,
  unit text,
  optional boolean not null default false,
  sort_order int not null default 0
);
create index on public.recipe_ingredients(recipe_id);
grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant all on public.recipe_ingredients to service_role;
alter table public.recipe_ingredients enable row level security;
create policy "members read recipe ingredients" on public.recipe_ingredients for select to authenticated using (exists (select 1 from public.recipes r where r.id = recipe_id and ((r.published and public.has_access(auth.uid())) or public.has_role(auth.uid(),'admin'))));
create policy "admin write recipe ingredients" on public.recipe_ingredients for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.favorites (
  user_id uuid not null,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "own favorites" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_access(auth.uid()));

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  week_start date not null,
  is_current boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.meal_plans to authenticated;
grant all on public.meal_plans to service_role;
alter table public.meal_plans enable row level security;
create policy "own plans" on public.meal_plans for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_access(auth.uid()));

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans(id) on delete cascade,
  day_index int not null check (day_index between 0 and 6),
  meal_type text not null check (meal_type in ('desayuno','almuerzo','merienda','cena')),
  recipe_id uuid references public.recipes(id) on delete set null,
  unique (plan_id, day_index, meal_type)
);
grant select, insert, update, delete on public.meal_plan_items to authenticated;
grant all on public.meal_plan_items to service_role;
alter table public.meal_plan_items enable row level security;
create policy "own plan items" on public.meal_plan_items for all to authenticated
  using (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = auth.uid()));

create table public.shopping_checks (
  plan_id uuid not null references public.meal_plans(id) on delete cascade,
  item_key text not null,
  user_id uuid not null,
  checked_at timestamptz not null default now(),
  primary key (plan_id, item_key)
);
grant select, insert, delete on public.shopping_checks to authenticated;
grant all on public.shopping_checks to service_role;
alter table public.shopping_checks enable row level security;
create policy "own checks" on public.shopping_checks for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.meal_plans p where p.id = plan_id and p.user_id = auth.uid()));

create or replace function public.admin_list_users()
returns table (id uuid, email text, display_name text, created_at timestamptz, roles text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  return query select p.id, p.email, p.display_name, p.created_at,
    coalesce(array_agg(r.role::text) filter (where r.role is not null), '{}')
  from public.profiles p left join public.user_roles r on r.user_id = p.id
  group by p.id order by p.created_at desc;
end; $$;
grant execute on function public.admin_list_users() to authenticated;

create policy "admin upload recipe images" on storage.objects for insert to authenticated with check (bucket_id = 'recipe-images' and public.has_role(auth.uid(),'admin'));
create policy "admin update recipe images" on storage.objects for update to authenticated using (bucket_id = 'recipe-images' and public.has_role(auth.uid(),'admin'));
create policy "admin delete recipe images" on storage.objects for delete to authenticated using (bucket_id = 'recipe-images' and public.has_role(auth.uid(),'admin'));

insert into public.categories (slug, name, sort_order) values
 ('desayunos','Desayunos y meriendas',1),
 ('almuerzos','Almuerzos',2),
 ('cenas','Cenas',3),
 ('ensaladas-tazones','Ensaladas y tazones',4),
 ('colaciones','Snacks y colaciones',5),
 ('postres','Postres',6),
 ('salsas-aderezos','Salsas y aderezos',7);

insert into public.diet_options (slug, name, sort_order) values
 ('variada','Alimentación variada',1),
 ('vegetariana','Vegetariana',2),
 ('sin_carne_roja','Sin carne roja',3),
 ('otra','Otra preferencia',4);
