#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="api-dz"
DEFAULT_PORT="32874"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
STATE_DIR="${PROJECT_ROOT}/.deploy"
PID_FILE="${STATE_DIR}/app.pid"
PORT_FILE="${STATE_DIR}/app.port"
LOG_FILE="${STATE_DIR}/app.log"

info() { printf '\033[32m[INFO]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[WARN]\033[0m %s\n' "$*" >&2; }
err() { printf '\033[31m[ERROR]\033[0m %s\n' "$*" >&2; }
die() { err "$*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令: $1"
}

ensure_runtime_dir() {
  mkdir -p "$STATE_DIR"
  touch "$LOG_FILE"
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

service_pid() {
  [[ -f "$PID_FILE" ]] && trim "$(cat "$PID_FILE" 2>/dev/null || true)"
}

service_running() {
  local pid
  pid="$(service_pid || true)"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

cleanup_stale_state() {
  if ! service_running; then
    rm -f "$PID_FILE" "$PORT_FILE"
    return 1
  fi
  return 0
}

get_local_ip() {
  hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
}

prompt_text() {
  local label="$1"
  local default_value="$2"
  local answer
  read -r -p "${label} [${default_value}]: " answer
  answer="$(trim "$answer")"
  printf '%s' "${answer:-$default_value}"
}

prompt_secret() {
  local label="$1"
  local current_value="$2"
  local answer
  read -r -s -p "${label}${current_value:+ [回车保留当前值]}: " answer
  printf '\n'
  answer="$(trim "$answer")"
  if [[ -n "$answer" ]]; then
    printf '%s' "$answer"
  else
    printf '%s' "$current_value"
  fi
}

show_status() {
  local pid port
  pid="$(service_pid || true)"
  port="$(read_env_value PORT)"
  port="${port:-$DEFAULT_PORT}"
  echo ""
  echo "=================================================="
  echo -e "\033[32m${APP_NAME} 状态\033[0m"
  echo "--------------------------------------------------"
  if service_running; then
    echo -e "状态: \033[32m运行中\033[0m"
    echo -e "PID: \033[36m${pid}\033[0m"
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
  echo -e "进程 PID: \033[36m$(service_pid || true)\033[0m"
  echo -e "日志文件: \033[33m${LOG_FILE}\033[0m"
  echo "=================================================="
  echo ""
}

stop_service() {
  if ! service_running; then
    cleanup_stale_state || true
    warn "服务未运行。"
    return 0
  fi

  local pid
  pid="$(service_pid)"
  kill "$pid" >/dev/null 2>&1 || true

  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$PID_FILE" "$PORT_FILE"
      info "服务已停止。"
      return 0
    fi
    sleep 1
  done

  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$PID_FILE" "$PORT_FILE"
  info "服务已强制停止。"
}

start_service() {
  local port
  port="$(read_env_value PORT)"
  port="${port:-$DEFAULT_PORT}"

  if service_running; then
    warn "检测到已有进程，先停止旧服务。"
    stop_service
  fi

  ensure_runtime_dir

  info "启动生产服务..."
  (
    cd "$PROJECT_ROOT"
    nohup node server/index.mjs --production >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "$port" > "$PORT_FILE"
  )

  sleep 2
  if ! service_running; then
    err "服务启动失败，查看日志：$LOG_FILE"
    tail -n 50 "$LOG_FILE" || true
    return 1
  fi
}

deploy_service() {
  local current_port current_email current_password port email password public_origin

  ensure_runtime_dir
  require_cmd npm
  require_cmd node
  require_cmd awk
  require_cmd grep
  require_cmd tail
  require_cmd nohup
  require_cmd kill

  current_port="$(read_env_value PORT)"
  current_port="${current_port:-$DEFAULT_PORT}"
  current_email="$(read_env_value SUB2API_ADMIN_EMAIL)"
  current_password="$(read_env_value SUB2API_ADMIN_PASSWORD)"
  public_origin="$(read_env_value PUBLIC_ORIGIN)"

  echo ""
  echo "一键部署"
  echo "--------------------------------------------------"
  port="$(prompt_text 'PORT' "$current_port")"
  while ! is_valid_port "$port"; do
    warn "端口不合法，范围 1-65535。"
    port="$(prompt_text 'PORT' "$current_port")"
  done

  email="$(prompt_text 'SUB2API_ADMIN_EMAIL' "$current_email")"
  password="$(prompt_secret 'SUB2API_ADMIN_PASSWORD' "$current_password")"

  if [[ -z "$email" ]]; then
    die "管理员邮箱不能为空。"
  fi
  if [[ -z "$password" ]]; then
    die "管理员密码不能为空。"
  fi

  if [[ -z "$public_origin" || "$public_origin" == http://127.0.0.1:* || "$public_origin" == http://localhost:* ]]; then
    public_origin="http://127.0.0.1:${port}"
  fi

  set_env_value PORT "$port"
  set_env_value PUBLIC_ORIGIN "$public_origin"
  set_env_value SUB2API_ADMIN_EMAIL "$email"
  set_env_value SUB2API_ADMIN_PASSWORD "$password"

  info "安装依赖..."
  npm install

  info "构建前端..."
  npm run build

  start_service
  show_access
}

upgrade_service() {
  ensure_runtime_dir
  require_cmd npm
  require_cmd node
  require_cmd nohup
  require_cmd kill

  info "升级服务..."
  if service_running; then
    stop_service
  fi
  npm run build
  start_service
  show_access
}

restart_service() {
  stop_service
  start_service
  show_access
}

view_logs() {
  ensure_runtime_dir
  if [[ ! -f "$LOG_FILE" ]]; then
    warn "还没有日志。"
    return 0
  fi
  tail -n 120 "$LOG_FILE"
}

uninstall_service() {
  echo -e "\033[31m警告：这会停止服务并删除本地部署状态。\033[0m"
  read -r -p "确认卸载？(y/N): " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    return 0
  fi

  stop_service || true
  rm -rf "$STATE_DIR"
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

cd "$PROJECT_ROOT"
ensure_runtime_dir

[[ -f "$ENV_FILE" ]] || die "未找到 .env 文件。"

while true; do
  main_menu
  echo ""
  read -r -p "按回车返回菜单..." _
done
