
create or replace function public.has_access(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _user_id is not null
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;
  -- Solo la primera cuenta con correo (no las entradas automáticas) queda como administradora.
  if coalesce(new.is_anonymous, false) = false and new.email is not null
     and not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
