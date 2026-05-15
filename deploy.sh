#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="api-dz"
DEFAULT_PORT="32874"
DEFAULT_INSTALL_PATH="/opt/api-dz"
SOURCE_REPO_URL="${SOURCE_REPO_URL:-https://github.com/inimemail/apihu.git}"
SOURCE_REPO_BRANCH="${SOURCE_REPO_BRANCH:-main}"
SERVICE_NAME="api-dz"
CONTAINER_NAME="api-dz"
SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" >/dev/null 2>&1 && pwd || true)"
PROJECT_ROOT=""
REMOTE_INSTALL="0"
ENV_FILE="${PROJECT_ROOT}/.env"
STATE_DIR="${PROJECT_ROOT}/.deploy"
LOG_FILE="${STATE_DIR}/app.log"

info() { printf '\033[32m[INFO]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[WARN]\033[0m %s\n' "$*" >&2; }
err() { printf '\033[31m[ERROR]\033[0m %s\n' "$*" >&2; }
die() { err "$*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令: $1"
}

is_project_root() {
  [[ -n "${1:-}" && -f "$1/package.json" && -f "$1/server/index.mjs" ]]
}

resolve_project_root() {
  if is_project_root "$SCRIPT_DIR"; then
    PROJECT_ROOT="$SCRIPT_DIR"
    REMOTE_INSTALL="0"
    return
  fi

  if is_project_root "$PWD"; then
    PROJECT_ROOT="$PWD"
    REMOTE_INSTALL="0"
    return
  fi

  PROJECT_ROOT="${INSTALL_PATH:-$DEFAULT_INSTALL_PATH}"
  REMOTE_INSTALL="1"
}

refresh_paths() {
  ENV_FILE="${PROJECT_ROOT}/.env"
  STATE_DIR="${PROJECT_ROOT}/.deploy"
  LOG_FILE="${STATE_DIR}/app.log"
}

docker_compose_cmd() {
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi

  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi

  die "未检测到 Docker Compose，请先安装 docker compose 或 docker-compose。"
}

prepare_project_source() {
  if [[ "$REMOTE_INSTALL" != "1" ]] && is_project_root "$PROJECT_ROOT"; then
    return
  fi

  require_cmd git
  mkdir -p "$(dirname "$PROJECT_ROOT")"

  if [[ -d "$PROJECT_ROOT/.git" ]]; then
    info "更新源码: ${PROJECT_ROOT}"
    git -C "$PROJECT_ROOT" fetch --depth 1 origin "$SOURCE_REPO_BRANCH"
    git -C "$PROJECT_ROOT" checkout -f FETCH_HEAD
    return
  fi

  if [[ -e "$PROJECT_ROOT" ]] && directory_only_has_runtime_state "$PROJECT_ROOT"; then
    rm -rf "$PROJECT_ROOT"
  fi

  if [[ -e "$PROJECT_ROOT" && -n "$(ls -A "$PROJECT_ROOT" 2>/dev/null || true)" ]]; then
    die "安装目录已存在且不是 ${APP_NAME} 项目: ${PROJECT_ROOT}"
  fi

  info "克隆源码到 ${PROJECT_ROOT}"
  git clone --depth 1 --branch "$SOURCE_REPO_BRANCH" "$SOURCE_REPO_URL" "$PROJECT_ROOT"
}

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  if [[ ! -f "${PROJECT_ROOT}/.env.example" ]]; then
    die "未找到 .env，也未找到 .env.example。"
  fi

  cp "${PROJECT_ROOT}/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE" 2>/dev/null || true
  info "已从 .env.example 创建 .env"
}

ensure_runtime_dir() {
  mkdir -p "$STATE_DIR"
  touch "$LOG_FILE"
}

directory_only_has_runtime_state() {
  local dir="$1"
  [[ -d "${dir}/.deploy" ]] || return 1
  [[ -z "$(find "$dir" -mindepth 1 -maxdepth 1 ! -name .deploy -print -quit 2>/dev/null)" ]]
}

trim() {
  local value="$1"
  value="${value#${value%%[![:space:]]*}}"
  value="${value%${value##*[![:space:]]}}"
  printf '%s' "$value"
}

unquote_env_value() {
  local value="$1"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:-1}"
    value="${value//\\\\/\\}"
    value="${value//\\\"/\"}"
  fi
  printf '%s' "$value"
}

read_env_value() {
  local key="$1"
  local line value
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" 2>/dev/null | tail -n 1 || true)"
  value="${line#*=}"
  value="$(trim "${value//$'\r'/}")"
  unquote_env_value "$value"
}

is_valid_port() {
  [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

is_local_origin() {
  [[ "$1" =~ ^https?://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?/?$ ]]
}

quote_env_value() {
  local value="$1"
  if [[ -z "$value" ]]; then
    printf '""'
    return
  fi

  if [[ "$value" =~ ^[A-Za-z0-9_./:@%+-]+$ ]]; then
    printf '%s' "$value"
    return
  fi

  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"

  awk -v key="$key" -v value="$value" '
  function q(v) {
    if (v == "") return "\"\""
    if (v ~ /^[A-Za-z0-9_./:@%+-]+$/) return v
    gsub(/\\/,"\\\\",v)
    gsub(/"/,"\\\"",v)
    return "\"" v "\""
  }
  BEGIN { found = 0 }
  {
    if ($0 ~ "^[[:space:]]*" key "=") {
      match($0, /^[[:space:]]*/)
      prefix = substr($0, RSTART, RLENGTH)
      print prefix key "=" q(value)
      found = 1
    } else {
      print
    }
  }
  END {
    if (!found) print key "=" q(value)
  }
  ' "$ENV_FILE" > "$tmp"

  mv "$tmp" "$ENV_FILE"
}

unset_env_value() {
  local key="$1"
  local tmp
  tmp="$(mktemp)"
  awk -v key="$key" '$0 !~ "^[[:space:]]*" key "=" { print }' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

service_running() {
  docker ps --format '{{.Names}}' 2>/dev/null | grep -Fxq "$CONTAINER_NAME"
}

get_local_ip() {
  hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
}

prompt_text() {
  local label="$1"
  local default_value="$2"
  local answer
  if [[ -n "$default_value" ]]; then
    read -r -p "${label} [${default_value}]: " answer
  else
    read -r -p "${label}: " answer
  fi
  answer="$(trim "$answer")"
  printf '%s' "${answer:-$default_value}"
}

prompt_secret() {
  local label="$1"
  local current_value="$2"
  local answer
  read -r -p "${label}${current_value:+ [回车保留当前值]}: " answer
  answer="$(trim "$answer")"
  if [[ -n "$answer" ]]; then
    printf '%s' "$answer"
  else
    printf '%s' "$current_value"
  fi
}

write_admin_password_secret() {
  mkdir -p "$STATE_DIR"
  printf '%s' "$1" > "${STATE_DIR}/admin-password"
  chmod 600 "${STATE_DIR}/admin-password" 2>/dev/null || true
}

read_admin_password_secret() {
  if [[ -s "${STATE_DIR}/admin-password" ]]; then
    cat "${STATE_DIR}/admin-password"
  fi
}

ensure_admin_password_secret() {
  local password
  if [[ -s "${STATE_DIR}/admin-password" ]]; then
    unset_env_value SUB2API_ADMIN_PASSWORD
    return
  fi

  password="$(read_env_value SUB2API_ADMIN_PASSWORD)"
  if [[ -n "$password" ]]; then
    write_admin_password_secret "$password"
    unset_env_value SUB2API_ADMIN_PASSWORD
  fi
}

ensure_admin_config_interactive() {
  local email password
  email="$(read_env_value SUB2API_ADMIN_EMAIL)"
  password="$(read_admin_password_secret)"
  password="${password:-$(read_env_value SUB2API_ADMIN_PASSWORD)}"

  if [[ -z "$email" ]]; then
    email="$(prompt_text '后台账号' '')"
  fi
  if [[ -z "$password" ]]; then
    password="$(prompt_secret '后台密码' '')"
  fi

  if [[ -z "$email" ]]; then
    die "后台账号不能为空。"
  fi
  if [[ -z "$password" ]]; then
    die "后台密码不能为空。"
  fi

  set_env_value SUB2API_ADMIN_EMAIL "$email"
  unset_env_value SUB2API_ADMIN_PASSWORD
  write_admin_password_secret "$password"
}

verify_admin_config_files() {
  local email
  email="$(read_env_value SUB2API_ADMIN_EMAIL)"
  if [[ -z "$email" ]]; then
    die "后台账号没有写入 .env，请重新执行一键部署。"
  fi
  if [[ ! -s "${STATE_DIR}/admin-password" ]]; then
    die "后台密码文件不存在或为空: ${STATE_DIR}/admin-password"
  fi
}

prompt_admin_config() {
  local email password
  email="$(read_env_value SUB2API_ADMIN_EMAIL)"
  password="$(read_admin_password_secret)"
  password="${password:-$(read_env_value SUB2API_ADMIN_PASSWORD)}"

  email="$(prompt_text '后台账号' "$email")"
  password="$(prompt_secret '后台密码' "$password")"

  if [[ -z "$email" ]]; then
    die "后台账号不能为空。"
  fi
  if [[ -z "$password" ]]; then
    die "后台密码不能为空。"
  fi

  set_env_value SUB2API_ADMIN_EMAIL "$email"
  unset_env_value SUB2API_ADMIN_PASSWORD
  write_admin_password_secret "$password"
}

show_status() {
  local port
  port="$(read_env_value PORT)"
  port="${port:-$DEFAULT_PORT}"
  echo ""
  echo "=================================================="
  echo -e "\033[32m${APP_NAME} 状态\033[0m"
  echo "--------------------------------------------------"
  if service_running; then
    echo -e "状态: \033[32m运行中\033[0m"
    echo -e "容器: \033[36m${CONTAINER_NAME}\033[0m"
  else
    echo -e "状态: \033[33m未运行\033[0m"
  fi
  echo -e "本地访问: \033[36mhttp://$(get_local_ip):${port}\033[0m"
  echo -e "日志文件: \033[33m${LOG_FILE}\033[0m"
  echo "=================================================="
  echo ""
}

show_access() {
  local port public_origin
  port="$(read_env_value PORT)"
  port="${port:-$DEFAULT_PORT}"
  public_origin="$(read_env_value PUBLIC_ORIGIN)"
  public_origin="${public_origin:-http://127.0.0.1:${port}}"
  echo ""
  echo "=================================================="
  echo -e "\033[32m${APP_NAME} 部署完成\033[0m"
  echo "--------------------------------------------------"
  echo -e "本地访问: \033[36mhttp://$(get_local_ip):${port}\033[0m"
  echo -e "公网地址: \033[36m${public_origin}\033[0m"
  echo -e "容器名称: \033[36m${CONTAINER_NAME}\033[0m"
  echo -e "查看日志: \033[33mbash deploy.sh -> 6\033[0m"
  echo "=================================================="
  echo ""
}

stop_service() {
  if [[ ! -f "${PROJECT_ROOT}/docker-compose.yml" ]]; then
    warn "未找到 docker-compose.yml，服务可能尚未部署。"
    return 0
  fi

  (cd "$PROJECT_ROOT" && $(docker_compose_cmd) stop "$SERVICE_NAME" >/dev/null 2>&1) || true
  info "服务已停止。"
}

start_service() {
  local port
  if [[ ! -f "${PROJECT_ROOT}/docker-compose.yml" ]]; then
    warn "未找到 docker-compose.yml，服务可能尚未部署。"
    return 0
  fi

  port="$(read_env_value PORT)"
  port="${port:-$DEFAULT_PORT}"

  ensure_runtime_dir
  ensure_admin_password_secret
  ensure_admin_config_interactive
  verify_admin_config_files

  info "启动 Docker 服务..."
  (cd "$PROJECT_ROOT" && $(docker_compose_cmd) up -d --force-recreate --remove-orphans)

  sleep 2
  if ! service_running; then
    err "服务启动失败，最近日志如下："
    (cd "$PROJECT_ROOT" && $(docker_compose_cmd) logs --tail=80 "$SERVICE_NAME") || true
    return 1
  fi
  (cd "$PROJECT_ROOT" && $(docker_compose_cmd) logs --tail=40 "$SERVICE_NAME" | grep -F "[api-dz] admin email:" || true)
}

deploy_service() {
  local current_port current_email current_password port email password public_origin

  prepare_project_source
  refresh_paths
  ensure_env_file
  ensure_runtime_dir
  require_cmd docker
  require_cmd awk
  require_cmd grep
  require_cmd tail

  current_port="$(read_env_value PORT)"
  current_port="${current_port:-$DEFAULT_PORT}"
  current_email="$(read_env_value SUB2API_ADMIN_EMAIL)"
  current_password="$(read_admin_password_secret)"
  current_password="${current_password:-$(read_env_value SUB2API_ADMIN_PASSWORD)}"
  public_origin="$(read_env_value PUBLIC_ORIGIN)"

  echo ""
  echo "一键部署"
  echo "--------------------------------------------------"
  port="$(prompt_text '端口' "$current_port")"
  while ! is_valid_port "$port"; do
    warn "端口不合法，范围 1-65535。"
    port="$(prompt_text '端口' "$current_port")"
  done

  email="$(prompt_text '后台账号' "$current_email")"
  password="$(prompt_secret '后台密码' "$current_password")"

  if [[ -z "$email" ]]; then
    die "后台账号不能为空。"
  fi
  if [[ -z "$password" ]]; then
    die "后台密码不能为空。"
  fi

  if [[ -z "$public_origin" || "$public_origin" == http://127.0.0.1:* || "$public_origin" == http://localhost:* ]]; then
    public_origin="http://127.0.0.1:${port}"
  fi

  set_env_value PORT "$port"
  set_env_value PUBLIC_ORIGIN "$public_origin"
  set_env_value SUB2API_ADMIN_EMAIL "$email"
  unset_env_value SUB2API_ADMIN_PASSWORD
  write_admin_password_secret "$password"

  info "构建 Docker 镜像..."
  (cd "$PROJECT_ROOT" && $(docker_compose_cmd) build)
  start_service
  show_access
}

upgrade_service() {
  prepare_project_source
  refresh_paths
  ensure_env_file
  ensure_runtime_dir
  require_cmd docker

  info "升级服务..."
  prompt_admin_config
  (cd "$PROJECT_ROOT" && $(docker_compose_cmd) build)
  start_service
  show_access
}

restart_service() {
  stop_service
  start_service
  show_access
}

view_logs() {
  if [[ ! -f "${PROJECT_ROOT}/docker-compose.yml" ]]; then
    warn "未找到 docker-compose.yml，服务可能尚未部署。"
    return 0
  fi
  (cd "$PROJECT_ROOT" && $(docker_compose_cmd) logs --tail=160 "$SERVICE_NAME")
}

uninstall_service() {
  echo -e "\033[31m警告：这会停止服务并删除本地部署状态。\033[0m"
  read -r -p "确认卸载？(y/N): " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    return 0
  fi

  stop_service || true
  if [[ -f "${PROJECT_ROOT}/docker-compose.yml" ]]; then
    (cd "$PROJECT_ROOT" && $(docker_compose_cmd) down --remove-orphans) || true
  fi
  rm -rf "$STATE_DIR"
  if [[ "$PROJECT_ROOT" == "$DEFAULT_INSTALL_PATH" || -n "${INSTALL_PATH:-}" ]]; then
    rm -rf "$PROJECT_ROOT"
  fi
  info "已清理部署状态。"
}

main_menu() {
  clear
  echo "==================================================="
  echo "                 ${APP_NAME} 一键部署"
  echo "==================================================="
  echo -e " 运行目录: \033[36m${PROJECT_ROOT}\033[0m"
  if service_running; then
    echo -e " 部署状态: \033[32m运行中\033[0m"
  else
    echo -e " 部署状态: \033[33m未运行\033[0m"
  fi
  echo "---------------------------------------------------"
  echo "  1) 一键部署"
  echo "  2) 升级服务"
  echo "  3) 停止服务"
  echo "  4) 重启服务"
  echo "  5) 查看状态"
  echo "  6) 查看日志"
  echo "  7) 完全卸载"
  echo "  0) 退出"
  echo "==================================================="
  read -r -p "请选择 [0-7]: " choice

  case "$choice" in
    1) deploy_service ;;
    2) upgrade_service ;;
    3) stop_service ;;
    4) restart_service ;;
    5) show_status ;;
    6) view_logs ;;
    7) uninstall_service ;;
    0) exit 0 ;;
    *) warn "无效选择。" ;;
  esac
}

resolve_project_root
refresh_paths

while true; do
  main_menu
  echo ""
  read -r -p "按回车返回菜单..." _
done
