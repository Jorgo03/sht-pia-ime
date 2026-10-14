#!/usr/bin/env bash
# Stop hook: the owner asked that every change reach GitHub, every time.
# Blocks Claude from finishing a turn while the working tree has uncommitted
# (non-ignored) changes or the branch has commits GitHub has not seen.
# Commits nothing itself: the commit message and the push stay deliberate.

input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
branch=$(git symbolic-ref --quiet --short HEAD) || exit 0   # detached HEAD: nothing to push

dirty=$(git status --porcelain --untracked-files=normal)
if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  unpushed=$(git rev-list --count '@{u}..HEAD')
else
  unpushed=$(git rev-list --count HEAD --not --remotes)
fi

[ -z "$dirty" ] && [ "$unpushed" = "0" ] && exit 0

problem=""
[ -n "$dirty" ] && problem="uncommitted changes ($(printf '%s\n' "$dirty" | wc -l | tr -d ' ') files)"
[ "$unpushed" != "0" ] && problem="${problem:+$problem and }$unpushed commit(s) not on GitHub"

# Already continued once for this: don't loop forever (e.g. offline). Tell the user instead.
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  printf '{"systemMessage":"Not on GitHub yet: %s on branch %s."}\n' "$problem" "$branch"
  exit 0
fi

printf '{"decision":"block","reason":"The owner wants every change pushed to GitHub. Branch %s has %s. Commit with a clear message (never commit .env files or secrets), then git push -u origin %s, then finish."}\n' "$branch" "$problem" "$branch"
