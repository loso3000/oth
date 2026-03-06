#!/bin/bash
# Copyright (C) 2019-2026 sirpdboy
# Dual-version speedtest script with version selection

RESULT_FILE='/tmp/netspeedtest_result'
LOG_FILE='/tmp/netspeedtest.log'
LOCK_FILE='/var/run/netspeedtest.lock'
PID_FILE='/var/run/netspeedtest.pid'
SERVER_LIST_FILE='/tmp/speedtest_servers.json'
TIMEOUT=60

# 默认设置
PREFERRED_VERSION="auto"
SELECTED_SERVER="auto"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# 检查进程锁
check_running() {
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
    
    exec 200>"$LOCK_FILE"
    if ! flock -n 200; then
        log "Another speedtest is already running (flock)"
        echo "Testing" > "$RESULT_FILE"
        exit 1
    fi
    
    echo $$ > "$PID_FILE"
}

# 清理函数
cleanup() {
    rm -f "$PID_FILE"
    flock -u 200 2>/dev/null
    exec 200>&-
}

trap cleanup EXIT INT TERM
# 检测可用的speedtest版本
detect_speedtest() {
    local preferred="$1"
    local available_versions=""
    
    log "Detecting speedtest versions (preferred: $preferred)..."
    
    # 检查Ookla官方版
    if [ -f '/usr/bin/ookla-speedtest' ] && [ -x '/usr/bin/ookla-speedtest' ]; then
        local version_output=$(/usr/bin/ookla-speedtest --version 2>&1)
        local version_info=""
        
        # 提取版本号
        if echo "$version_output" | grep -q "Ookla"; then
            # 提取版本号，格式如 "Speedtest by Ookla 1.2.0.84"
            version_info=$(echo "$version_output" | grep -o "Speedtest by Ookla [0-9]\+\.[0-9]\+\.[0-9]\+\.[0-9]\+" | head -1)
            if [ -z "$version_info" ]; then
                # 如果没找到完整格式，尝试只提取版本号
                version_info=$(echo "$version_output" | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+\.[0-9]\+" | head -1)
                if [ -n "$version_info" ]; then
                    version_info="Speedtest by Ookla $version_info"
                fi
            fi
            
            available_versions="ookla:/usr/bin/ookla-speedtest"
            if [ -n "$version_info" ]; then
                log "Found Ookla version: /usr/bin/ookla-speedtest ($version_info)"
            else
                log "Found Ookla version: /usr/bin/ookla-speedtest"
            fi

        fi
    fi
    
    # 检查Python版
    local python_bin=""
    local python_version=""
    local python_full_info=""
    
    # 查找Python版可执行文件
    if [ -f '/usr/bin/speedtest' ] && [ -x '/usr/bin/speedtest' ]; then
        python_bin="/usr/bin/speedtest"
    fi
    
    if [ -n "$python_bin" ]; then
        # 获取Python版版本信息
        local version_output=$($python_bin --version 2>&1)
        
        # 提取speedtest-cli版本号 (格式: speedtest-cli 2.1.3)
        python_version=$(echo "$version_output" | grep -o "speedtest-cli [0-9]\+\.[0-9]\+\.[0-9]\+" | head -1)
        
        # 提取Python版本信息
        python_full_info=$(echo "$version_output" | grep -o "Python [0-9]\+\.[0-9]\+\.[0-9]\+.*" | head -1)
        
        if [ -n "$available_versions" ]; then
            available_versions="$available_versions|python:$python_bin"
        else
            available_versions="python:$python_bin"
        fi
        
        if [ -n "$python_version" ]; then
            if [ -n "$python_full_info" ]; then
                log "Found Python version: $python_bin ($python_version, $python_full_info)"
            else
                log "Found Python version: $python_bin ($python_version)"
            fi
        else
            log "Found Python version: $python_bin"
        fi

    fi
    
    # 如果没有找到任何版本
    if [ -z "$available_versions" ]; then
        log "No speedtest versions found"
        return 1
    fi
    
    # 如果指定了偏好版本
    if [ "$preferred" != "auto" ]; then
        IFS='|' read -ra versions <<< "$available_versions"
        for ver in "${versions[@]}"; do
            if [[ "$ver" == "$preferred:"* ]]; then
                echo "$ver"
                log "Selected preferred version: $ver"
                return 0
            fi
        done
    fi
    
    # 默认返回第一个可用版本
    local first_version=$(echo "$available_versions" | cut -d'|' -f1)
    echo "$first_version"
    log "Selected first available version: $first_version"
    return 0
}


# 获取Ookla版服务器列表
get_ookla_servers() {
    local speedtest_bin=$1
    log "Fetching Ookla server list..."
    
    local server_list=$($speedtest_bin --servers --format=json 2>/dev/null)
    
    if [ -n "$server_list" ] && echo "$server_list" | grep -q "servers"; then
        echo "$server_list" > "$SERVER_LIST_FILE.ookla"
        # 转换为JSON数组格式
        if command -v jq >/dev/null 2>&1; then
            echo "$server_list" | jq -r '.servers[] | {id: .id, name: .name, country: .country, location: .location, sponsor: .sponsor} | @json' 2>/dev/null | jq -s '.'
        else
            # 如果没有jq，手动构建JSON
            echo -n "["
            local first=1
            echo "$server_list" | grep -o '"id":[0-9]*,"name":"[^"]*"[^}]*}' | while read -r line; do
                if [ $first -eq 1 ]; then
                    first=0
                else
                    echo -n ","
                fi
                echo -n "$line"
            done
            echo "]"
        fi
        return 0
    fi
    return 1
}

# 获取Python版服务器列表
get_python_servers() {
    local speedtest_bin=$1
    log "Fetching Python speedtest-cli server list..."
    
    local server_list=$($speedtest_bin --list 2>/dev/null | head -100)
    
    if [ -n "$server_list" ]; then
        echo -n "["
        local first=1
        # 解析Python版输出格式
        echo "$server_list" | while read -r line; do
            if [[ $line =~ ^([0-9]+)\)[[:space:]]+(.+)[[:space:]]+\((.+),\ (.+),\ (.+)\)[[:space:]]+\[([0-9]+\.[0-9]+)\ km\]$ ]]; then
                if [ $first -eq 1 ]; then
                    first=0
                else
                    echo -n ","
                fi
                local id="${BASH_REMATCH[1]}"
                local sponsor="${BASH_REMATCH[2]}"
                local city="${BASH_REMATCH[3]}"
                local country="${BASH_REMATCH[4]}"
                local distance="${BASH_REMATCH[6]}"
                echo -n "{\"id\":$id,\"sponsor\":\"$sponsor\",\"city\":\"$city\",\"country\":\"$country\",\"distance\":$distance}"
            fi
        done
        echo "]"
        return 0
    fi
    return 1
}

# 获取服务器列表（供Web界面使用）
get_server_list() {
    local all_servers="[]"
    local ookla_servers=""
    local python_servers=""
    
    # 获取Ookla版服务器
    if [ -f '/usr/bin/ookla-speedtest' ] && [ -x '/usr/bin/ookla-speedtest' ]; then
        ookla_servers=$(get_ookla_servers "/usr/bin/ookla-speedtest")
    fi
    
    # 获取Python版服务器
    local python_bin=""
    if [ -f '/usr/bin/speedtest' ] && [ -x '/usr/bin/speedtest' ]; then
        python_bin="/usr/bin/speedtest"
    fi
    
    if [ -n "$python_bin" ]; then
        python_servers=$(get_python_servers "$python_bin")
    fi
    
    # 合并服务器列表
    if command -v jq >/dev/null 2>&1; then
        if [ -n "$ookla_servers" ] && [ -n "$python_servers" ]; then
            echo "$ookla_servers" "$python_servers" | jq -s 'add'
        elif [ -n "$ookla_servers" ]; then
            echo "$ookla_servers"
        elif [ -n "$python_servers" ]; then
            echo "$python_servers"
        else
            echo "[]"
        fi
    else
        # 简单合并（可能不完整）
        echo "["
        if [ -n "$ookla_servers" ]; then
            echo "$ookla_servers" | sed 's/^\[//' | sed 's/\]$//'
        fi
        if [ -n "$python_servers" ] && [ -n "$ookla_servers" ]; then
            echo ","
        fi
        if [ -n "$python_servers" ]; then
            echo "$python_servers" | sed 's/^\[//' | sed 's/\]$//'
        fi
        echo "]"
    fi
}

# 运行Ookla版测试
run_ookla_test() {
    local speedtest_bin=$1
    local server_id=$2
    
    local cmd="$speedtest_bin --accept-gdpr --accept-license --progress=no"
    [ -n "$server_id" ] && [ "$server_id" != "auto" ] && cmd="$cmd --server-id=$server_id"
    
    if command -v timeout >/dev/null 2>&1; then
        RUNTEST=$(timeout $TIMEOUT $cmd 2>&1)
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log "Error: Test timed out"
            return 1
        fi
    else
        RUNTEST=$($cmd 2>&1)
    fi
    
    echo "$RUNTEST"
    return 0
}

run_python_test() {
    local speedtest_bin=$1
    local server_id=$2
    
    # 如果指定了服务器ID，使用它
    if [ -n "$server_id" ] && [ "$server_id" != "auto" ]; then
        local cmd="$speedtest_bin --server $server_id --share --simple"
    else
        # 否则尝试几个常用的稳定服务器
        local cmd="$speedtest_bin --share --simple"
    fi
    
    # 增加超时时间到90秒
    if command -v timeout >/dev/null 2>&1; then
        RUNTEST=$(timeout 90 $cmd 2>&1)
        local exit_code=$?
        if [ $exit_code -eq 124 ]; then
            log "Error: Python test timed out after 90 seconds"
            
            # 超时后尝试使用特定服务器
            log "Timeout occurred, trying with specific server 59016..."
            RUNTEST=$(timeout 90 $speedtest_bin --server 59016 --share --simple 2>&1)
            if [ $? -eq 124 ]; then
                log "Error: Second attempt also timed out"
                return 1
            fi
        fi
    else
        RUNTEST=$($cmd 2>&1)
    fi
    
    echo "$RUNTEST"
    return 0
}

# 解析Python版结果
parse_python_result() {
    local result="$1"
    
    # 检查是否包含错误信息
    if echo "$result" | grep -q -i "error\|failed\|cannot\|timeout"; then
        log "Python test error detected: $result"
        return 1
    fi
    
    # 提取分享链接
    local share_url=$(echo "$result" | grep -o 'http://www.speedtest.net/result/[0-9]*\.png' | head -1)
    if [ -n "$share_url" ]; then
        echo "$share_url"
        return 0
    fi
    
    # 提取速度数据
    local download=$(echo "$result" | grep -i "download" | grep -o '[0-9.]\+ [Mk]bit/s' | head -1)
    local upload=$(echo "$result" | grep -i "upload" | grep -o '[0-9.]\+ [Mk]bit/s' | head -1)
    local latency=$(echo "$result" | grep -i "latency" | grep -o '[0-9.]\+ ms' | head -1)
    
    if [ -n "$download" ] && [ -n "$upload" ]; then
        if [ -n "$latency" ]; then
            echo "Download: $download, Upload: $upload, Latency: $latency"
        else
            echo "Download: $download, Upload: $upload"
        fi
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
        return 0
    fi
    
    # 提取速度数据
    local download=$(echo "$result" | grep -i "download" | grep -o "[0-9.]\+ [Mk]bits" | head -1)
    local upload=$(echo "$result" | grep -i "upload" | grep -o "[0-9.]\+ [Mk]bits" | head -1)
    local latency=$(echo "$result" | grep -i "latency" | grep -o "[0-9.]\+ ms" | head -1)
    
    if [ -n "$download" ] && [ -n "$upload" ]; then
        if [ -n "$latency" ]; then
            echo "Download: $download, Upload: $upload, Latency: $latency"
        else
            echo "Download: $download, Upload: $upload"
        fi
        return 0
    fi
    
    return 1
}


# 主测试函数
main_test() {
    log "=== Speedtest started ==="
    log "Preferred version: $PREFERRED_VERSION, Selected server: $SELECTED_SERVER"
    
    # 检测可用的speedtest版本
    local version_info=$(detect_speedtest "$PREFERRED_VERSION")
    if [ -z "$version_info" ]; then
        log "Error: No speedtest version found"
        echo "Test failed" > "$RESULT_FILE"
        exit 1
    fi
    
    local version_type=${version_info%:*}
    local speedtest_bin=${version_info#*:}
    log "Using $version_type version: $speedtest_bin"
    
    echo "Testing" > "$RESULT_FILE"
    
    # 获取本地IP
    LOCAL_IP=$(curl -s -4 --connect-timeout 5 --max-time 10 http://ip.3322.net 2>/dev/null)
    [ -n "$LOCAL_IP" ] && log "Local IP: $LOCAL_IP"
    
    TEST_SUCCESS=0
    
    # 运行测试
    log "Starting speedtest..."
    case $version_type in
        ookla)
            RUNTEST=$(run_ookla_test "$speedtest_bin" "$SELECTED_SERVER")
            ;;
        python)
            RUNTEST=$(run_python_test "$speedtest_bin" "$SELECTED_SERVER")
            ;;
    esac
    
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
    fi
    
    log "=== Speedtest completed ==="
    echo "" >> "$LOG_FILE"
}

# 显示帮助信息
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --get-servers              Get list of available servers"
    echo "  --version VERSION          Preferred version (ookla/python/auto)"
    echo "  --server SERVER_ID         Server ID to test with"
    echo "  --help                      Show this help message"
}

# 命令行参数处理
while [ $# -gt 0 ]; do
    case "$1" in
        --get-servers)
            get_server_list
            exit 0
            ;;
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
            if [ -n "$2" ]; then
                SELECTED_SERVER="$2"
                shift 2
            else
                echo "Error: --server requires an argument"
                exit 1
            fi
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

# 如果没有参数，运行测试
check_running
main_test
exit 0