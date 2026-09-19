#!/usr/bin/env bash
# submodule-push.sh — 把每个 submodule 当前分支推到 origin
#
# 用法:
#   scripts/submodule-push.sh [--dry-run] [--submodule <path> ...] [--remote <name>]
#
# 行为:
#   - 默认遍历 .gitmodules 中所有 path
#   - 仅在子仓 ahead of origin/<branch> 时执行 push
#   - --dry-run 只打印将要执行的 git 命令
#   - --submodule 可指定只处理一个或多个子仓
#   - 远端尚无当前分支时自动使用 -u 建立 upstream
#   - 远端分支落后或分叉时跳过，避免非快进覆盖
#
# 注意: 推送是不可逆动作；建议加 --dry-run 预演后再正式执行

set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=0
REMOTE="origin"
SELECTED=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --submodule)
      [[ $# -ge 2 ]] || { echo "--submodule requires a path" >&2; exit 1; }
      SELECTED+=("$2")
      shift 2
      ;;
    --remote)
      [[ $# -ge 2 ]] || { echo "--remote requires a name" >&2; exit 1; }
      REMOTE="$2"
      shift 2
      ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
done

run() {
  if [[ "$DRY_RUN" == 1 ]]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

SUBMODULES=()
while IFS= read -r path; do
  SUBMODULES+=("$path")
done < <(git config --file .gitmodules --get-regexp '^submodule\..*\.path$' | awk '{print $2}')

if [[ ${#SELECTED[@]} -gt 0 ]]; then
  for selected in "${SELECTED[@]}"; do
    registered=0
    for path in "${SUBMODULES[@]}"; do
      [[ "$selected" == "$path" ]] && registered=1 && break
    done
    [[ "$registered" == 1 ]] || { echo "unknown submodule: $selected" >&2; exit 1; }
  done
  SUBMODULES=("${SELECTED[@]}")
fi

pushed=0
clean=0
skipped=0
for path in "${SUBMODULES[@]}"; do
  if [[ ! -d "$path" ]] || ! git -C "$path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[skip] $path is not an initialized Git worktree"
    skipped=$((skipped + 1))
    continue
  fi
  echo "==> $path"
  pushd "$path" >/dev/null

  branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  if [[ -z "$branch" ]]; then
    echo "  [warn] detached HEAD, skipping"
    skipped=$((skipped + 1))
    popd >/dev/null
    continue
  fi

  if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
    echo "  [warn] remote '$REMOTE' is not configured, skipping"
    skipped=$((skipped + 1))
    popd >/dev/null
    continue
  fi

  if ! git ls-remote --exit-code --heads "$REMOTE" "refs/heads/$branch" >/dev/null 2>&1; then
    echo "  [new branch] pushing $branch to $REMOTE with upstream"
    run git push -u "$REMOTE" "$branch"
    pushed=$((pushed + 1))
    popd >/dev/null
    continue
  fi

  if [[ "$DRY_RUN" == 1 ]]; then
    run git fetch "$REMOTE" "refs/heads/$branch:refs/remotes/$REMOTE/$branch"
    if ! git show-ref --verify --quiet "refs/remotes/$REMOTE/$branch"; then
      echo "  [dry-run] remote branch exists; push decision follows fetch"
      run git push "$REMOTE" "$branch"
      popd >/dev/null
      continue
    fi
  else
    git fetch --quiet "$REMOTE" "refs/heads/$branch:refs/remotes/$REMOTE/$branch"
  fi

  counts="$(git rev-list --left-right --count "$REMOTE/$branch...$branch")"
  behind="${counts%%[[:space:]]*}"
  ahead="${counts##*[[:space:]]}"
  if [[ "$behind" -gt 0 && "$ahead" -gt 0 ]]; then
    echo "  [warn] branch diverged (behind $behind, ahead $ahead), skipping"
    skipped=$((skipped + 1))
  elif [[ "$behind" -gt 0 ]]; then
    echo "  [behind $behind] nothing pushed; update the branch first"
    skipped=$((skipped + 1))
  elif [[ "$ahead" -gt 0 ]]; then
    echo "  [ahead $ahead] pushing $branch to $REMOTE"
    run git push "$REMOTE" "$branch"
    pushed=$((pushed + 1))
  else
    echo "  [clean] nothing to push"
    clean=$((clean + 1))
  fi

  popd >/dev/null
done

echo "[submodule-push] done: pushed=$pushed clean=$clean skipped=$skipped total=${#SUBMODULES[@]}"
