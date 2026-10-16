<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Buyers use anonymous auth (auto sign-in in `_authenticated` layout and `/`); `has_access()` is true for any signed-in user. Why: owner wants direct access without credentials.
- Admin rights only via `user_roles`; first non-anonymous account becomes admin (trigger). Why: roles must be server-verified.
- Planner and shopping list are pure functions in `src/lib/planner.ts` / `src/lib/shopping.ts` with tests. Why: rules are business-critical and testable.
- Recipe import format is the CSV defined in `src/lib/recipe-import.ts`; ebook recipes are upserted by `code`. Why: avoid duplicates on re-import.
