#!/bin/bash
# Copyright (C) 2019-2026 sirpdboy
# Optimized speedtest script with reliable progress reporting

RESULT_FILE='/tmp/netspeedtest_result'
PROGRESS_FILE='/tmp/netspeedtest_progress'
LOG_FILE='/tmp/netspeedtest.log'
LOCK_FILE='/var/run/netspeedtest.lock'
PID_FILE='/var/run/netspeedtest.pid'
TIMEOUT=120

# 默认设置
PREFERRED_VERSION="auto"
SELECTED_SERVER="auto"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 更新进度
update_progress() {
    local stage="$1"
    local message="$2"
    local timestamp=$(date +%s)
    
    # 创建进度JSON - 确保格式正确
    cat > "$PROGRESS_FILE" <<EOF
{
    "stage": "$stage",
    "message": "$message",
    "timestamp": $timestamp
}
EOF
    # 确保文件被写入
    sync
    log "Progress: $stage - $message"
}

# 清理进度
cleanup_progress() {
    rm -f "$PROGRESS_FILE"
}

# 检查进程锁
check_running() {
    # 检查PID文件
    if [ -f "$PID_FILE" ]; then
        local old_pid=$(cat "$PID_FILE" 2>/dev/null)
        if kill -0 "$old_pid" 2>/dev/null; then
            log "Another speedtest is already running (PID: $old_pid)"
            echo "Testing" > "$RESULT_FILE"
            exit 1
        else
            rm -f "$PID_FILE"
        fi
    fi
    
    # 使用文件锁
    exec 200>"$LOCK_FILE"
    if ! flock -n 200; then
        log "Another speedtest is already running (flock)"
        echo "Testing" > "$RESULT_FILE"
        exit 1
    fi
    
    # 写入PID
    echo $$ > "$PID_FILE"
    log "PID $$ written to $PID_FILE"
}

# 清理函数
cleanup() {
    rm -f "$PID_FILE"
    # 不在这里清理进度文件，让前端有时间读取
    # 但会在最后清理
    flock -u 200 2>/dev/null
    exec 200>&-
    log "Cleanup completed"
}

trap cleanup EXIT INT TERM

# 检测可用的speedtest版本
detect_speedtest() {
    local preferred="$1"
    local available_versions=""
    
    log "Detecting speedtest versions (preferred: $preferred)..."
    update_progress "detect" "检测可用的测速版本..."
    
    # 检查Ookla官方版
    if [ -f '/usr/bin/ookla-speedtest' ] && [ -x '/usr/bin/ookla-speedtest' ]; then
        available_versions="ookla:/usr/bin/ookla-speedtest"
        log "Found Ookla version: /usr/bin/ookla-speedtest"
    fi
    
    # 检查Python版
    if [ -f '/usr/bin/speedtest' ] && [ -x '/usr/bin/speedtest' ]; then
        if [ -n "$available_versions" ]; then
            available_versions="$available_versions|python:/usr/bin/speedtest"
        else
            available_versions="python:/usr/bin/speedtest"
        fi
        log "Found Python version: /usr/bin/speedtest"
    fi
    
    # 如果没有找到任何版本
    if [ -z "$available_versions" ]; then
        log "No speedtest versions found"
        update_progress "error" "未找到测速版本"
        return 1
    fi
    
    # 如果指定了偏好版本
    if [ "$preferred" != "auto" ]; then
        IFS='|' read -ra versions <<< "$available_versions"
        for ver in "${versions[@]}"; do
            if [[ "$ver" == "$preferred:"* ]]; then
                echo "$ver"
                log "Selected preferred version: $ver"
                update_progress "selected" "已选择 $preferred 版本"
                return 0
            fi
        done
    fi
    
    # 默认返回第一个可用版本
    local first_version=$(echo "$available_versions" | cut -d'|' -f1)
    local version_name=$(echo "$first_version" | cut -d':' -f1)
    echo "$first_version"
    log "Selected first available version: $first_version"
    update_progress "selected" "已选择 $version_name 版本"
    return 0
}

# 运行Ookla版测试
run_ookla_test() {
    local speedtest_bin=$1
    local server_id=$2
    
    update_progress "preparing" "准备 Ookla 测速..."
    
    local cmd="$speedtest_bin --accept-gdpr --accept-license --progress=no"
    [ -n "$server_id" ] && [ "$server_id" != "auto" ] && cmd="$cmd --server-id=$server_id"
    
    log "Running Ookla test with command: $cmd"
    update_progress "testing" "Ookla 测速进行中..."
    
    # 使用临时文件存储输出
    local tmp_output=$(mktemp)
    
    if command -v timeout >/dev/null 2>&1; then
        timeout $TIMEOUT $cmd > "$tmp_output" 2>&1
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log "Error: Test timed out"
            update_progress "error" "测速超时"
            rm -f "$tmp_output"
            return 1
        fi
    else
        $cmd > "$tmp_output" 2>&1
    fi
    
    cat "$tmp_output"
    rm -f "$tmp_output"
    return 0
}

# 运行Python版测试
run_python_test() {
    local speedtest_bin=$1
    local server_id=$2
    
    update_progress "preparing" "准备 Python 测速..."
    
    local cmd="$speedtest_bin --share --simple"
    if [ -n "$server_id" ] && [ "$server_id" != "auto" ]; then
        cmd="$speedtest_bin --server $server_id --share --simple"
    fi
    
    log "Running Python test with command: $cmd"
    update_progress "testing" "Python 测速进行中（可能需要较长时间）..."
    
    local tmp_output=$(mktemp)
    
    if command -v timeout >/dev/null 2>&1; then
        timeout 90 $cmd > "$tmp_output" 2>&1
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log "Error: Python test timed out"
            update_progress "error" "测速超时，尝试备用服务器..."
            
            # 尝试使用常用服务器
            timeout 90 $speedtest_bin --server 59016 --share --simple > "$tmp_output" 2>&1
            if [ $? -eq 124 ]; then
                log "Error: Second attempt also timed out"
                update_progress "error" "再次超时"
                rm -f "$tmp_output"
                return 1
            fi
        fi
    else
        $cmd > "$tmp_output" 2>&1
    fi
    
    cat "$tmp_output"
    rm -f "$tmp_output"
    return 0
}

# 解析Python版结果
parse_python_result() {
    local result="$1"
    
    # 检查是否包含错误信息
    if echo "$result" | grep -q -i "error\|failed\|cannot\|timeout\|无法\|失败"; then
        log "Python test error detected"
        return 1
    fi
    
    # 提取分享链接
    local share_url=$(echo "$result" | grep -o 'http://www.speedtest.net/result/[0-9]*\.png' | head -1)
    if [ -n "$share_url" ]; then
        echo "$share_url"
        update_progress "complete" "测速完成（图片结果）"
        return 0
    fi
    
    # 提取速度数据
    local download=$(echo "$result" | grep -i "download" | head -1)
    local upload=$(echo "$result" | grep -i "upload" | head -1)
    local latency=$(echo "$result" | grep -i "latency" | head -1)
    
    if [ -n "$download" ] && [ -n "$upload" ]; then
        # 格式化输出
        {
            echo "$download"
            echo "$upload"
            [ -n "$latency" ] && echo "$latency"
        }
        update_progress "complete" "测速完成"
        return 0
    fi
    
    return 1
}

# 解析Ookla版结果
parse_ookla_result() {
    local result="$1"
    
    # 提取结果URL
    local result_url=$(echo "$result" | grep -i "result url" | awk '{print $NF}' | head -1)
    if [ -n "$result_url" ]; then
        echo "$result_url"
        update_progress "complete" "测速完成（图片结果）"
        return 0
    fi
    
    # 提取速度数据
    local download=$(echo "$result" | grep -i "download" | grep -o "[0-9.]\+ [Mk]bits" | head -1)
    local upload=$(echo "$result" | grep -i "upload" | grep -o "[0-9.]\+ [Mk]bits" | head -1)
    local latency=$(echo "$result" | grep -i "latency" | grep -o "[0-9.]\+ ms" | head -1)
    
    if [ -n "$download" ] && [ -n "$upload" ]; then
        {
            echo "Download: $download"
            echo "Upload: $upload"
            [ -n "$latency" ] && echo "Latency: $latency"
        }
        update_progress "complete" "测速完成"
        return 0
    fi
    
    return 1
}

# 主测试函数
main_test() {
    log "=== Speedtest started (PID: $$) ==="
    log "Preferred version: $PREFERRED_VERSION, Selected server: $SELECTED_SERVER"
    
    # 初始化状态
    echo "Testing" > "$RESULT_FILE"
    update_progress "start" "初始化测速..."
    
    # 检测可用的speedtest版本
    local version_info=$(detect_speedtest "$PREFERRED_VERSION")
    if [ -z "$version_info" ]; then
        log "Error: No speedtest version found"
        echo "Test failed" > "$RESULT_FILE"
        update_progress "failed" "未找到测速版本"
        exit 1
    fi
    
    local version_type=${version_info%:*}
    local speedtest_bin=${version_info#*:}
    log "Using $version_type version: $speedtest_bin"
    
    TEST_SUCCESS=0
    
    # 运行测试
    case $version_type in
        ookla)
            RUNTEST=$(run_ookla_test "$speedtest_bin" "$SELECTED_SERVER")
            ;;
        python)
            RUNTEST=$(run_python_test "$speedtest_bin" "$SELECTED_SERVER")
            ;;
    esac
    
    # 记录完整输出到日志
    echo "$RUNTEST" >> "$LOG_FILE"
    
    # 解析结果
    case $version_type in
        ookla) RESULT=$(parse_ookla_result "$RUNTEST") ;;
        python) RESULT=$(parse_python_result "$RUNTEST") ;;
    esac
    
    if [ -n "$RESULT" ]; then
        echo "$RESULT" > "$RESULT_FILE"
        TEST_SUCCESS=1
    fi
    
    # 如果失败，尝试自动选择
    if [ $TEST_SUCCESS -eq 0 ] && [ "$SELECTED_SERVER" != "auto" ]; then
        log "Test failed with selected server, trying automatic server selection"
        update_progress "retry" "测速失败，尝试自动选择服务器..."
        SELECTED_SERVER="auto"
        
        case $version_type in
            ookla)
                RUNTEST=$(run_ookla_test "$speedtest_bin" "auto")
                ;;
            python)
                RUNTEST=$(run_python_test "$speedtest_bin" "auto")
                ;;
        esac
        
        echo "$RUNTEST" >> "$LOG_FILE"
        
        case $version_type in
            ookla) RESULT=$(parse_ookla_result "$RUNTEST") ;;
            python) RESULT=$(parse_python_result "$RUNTEST") ;;
        esac
        
        if [ -n "$RESULT" ]; then
            echo "$RESULT" > "$RESULT_FILE"
            log "Test successful with automatic server selection"
            TEST_SUCCESS=1
        fi
    fi
    
    # 最终检查
    if [ $TEST_SUCCESS -eq 0 ]; then
        echo "Test failed" > "$RESULT_FILE"
        log "All tests failed"
        update_progress "failed" "所有测速尝试均失败"
    fi
    
    log "=== Speedtest completed (PID: $$) ==="
    echo "" >> "$LOG_FILE"
    
    # 等待一小段时间，确保前端能读取到结果文件
    sleep 2
    
    # 清理进度文件（测试完成后可以清理）
    cleanup_progress
}

# 显示帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --version VERSION          Preferred version (ookla/python/auto)"
    echo "  --help                      Show this help message"
}

# 命令行参数处理
while [ $# -gt 0 ]; do
    case "$1" in
        --version)
            if [ -n "$2" ]; then
                PREFERRED_VERSION="$2"
                shift 2
            else
                echo "Error: --version requires an argument"
                exit 1
            fi
            ;;
        --server)
            # 忽略server参数
            shift 2
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# 运行测试
check_running
main_test
exit 0
