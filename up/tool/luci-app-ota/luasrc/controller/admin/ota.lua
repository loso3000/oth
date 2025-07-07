--[[
LuCI - Lua Configuration Interface
Copyright 2021 jjm2473
Copyright 2024-2025 sirpdboy
]]--
require "luci.util"
module("luci.controller.admin.ota", package.seeall)

function index()
    if luci.sys.call("ota >/dev/null 2>&1") ~= 0 then
        return
    end

    entry({"admin", "system", "ota"}, post_on({ apply = "1" }, "action_ota"), _("OTA"), 69)
    entry({"admin", "system", "flash_progress"}, call("flash_progress")).leaf = true
    entry({"admin", "system", "start_flash"}, post("start_flash"))
    entry({"admin", "system", "ota", "check"}, post("action_check"))
    entry({"admin", "system", "ota", "download"}, post("action_download"))
    entry({"admin", "system", "ota", "progress"}, call("action_progress"))
    entry({"admin", "system", "ota", "cancel"}, post("action_cancel"))
end
local function ota_exec(cmd)
    local nixio = require "nixio"
    local os = require "os"
    local fs = require "nixio.fs"
    local rshift = nixio.bit.rshift

    local oflags = nixio.open_flags("wronly", "creat")
    local lock, code, msg = nixio.open("/var/lock/ota_api.lock", oflags)
    if not lock then
        return 255, "", "Open stdio lock failed: " .. msg
    end

    -- Acquire lock
    local stat, code, msg = lock:lock("tlock")
    if not stat then
        lock:close()
        return 255, "", "Lock stdio failed: " .. msg
    end

    local r = os.execute(cmd .. " >/var/log/ota.stdout 2>/var/log/ota.stderr")
    local e = fs.readfile("/var/log/ota.stderr")
    local o = fs.readfile("/var/log/ota.stdout")

    fs.unlink("/var/log/ota.stderr")
    fs.unlink("/var/log/ota.stdout")

    lock:lock("ulock")
    lock:close()

    e = e or ""
    if r == 256 and e == "" then
        e = "os.execute failed, is /var/log full or not existed?"
    end
    return rshift(r, 8), o or "", e or ""
end

local function image_supported(image)
    return (os.execute("sysupgrade -T %q >/dev/null" % image) == 0)
end

function fork_exec(command)
    local pid = nixio.fork()
    if pid > 0 then
        return
    elseif pid == 0 then
        nixio.chdir("/")
        local null = nixio.open("/dev/null", "w+")
        if null then
            nixio.dup(null, nixio.stderr)
            nixio.dup(null, nixio.stdout)
            nixio.dup(null, nixio.stdin)
            if null:fileno() > 2 then
                null:close()
            end
        end
        nixio.exec("/bin/sh", "-c", command)
    end
end

-- 异步启动刷机进程
function start_flash()
    local http = require "luci.http"
    local image_tmp = "/tmp/firmware.img"
    
    -- 清空日志文件
    os.execute("echo 'Starting flash process...' > /tmp/ezotaflash.log")
    os.execute("chmod 644 /tmp/ezotaflash.log")
    
    -- 获取参数
    local keep = (http.formvalue("keep") == "1") and "" or "-n"
    local bopkg = (http.formvalue("bopkg") == "1") and "" or "-k"
    local expsize = tonumber(http.formvalue("expsize")) or 0

    -- 在后台启动刷机进程
    if expsize > 0 then
        -- 分区扩展刷机模式
        local image_extractedpath = luci.sys.exec("head -n 1 /etc/partexppath | awk '{print $1}' 2>/dev/null")
        local image_extracteddev = luci.sys.exec("echo /dev/`head -n 1 /etc/partexppath | awk '{print $2}'` 2>/dev/null")
        local image_extracted = luci.sys.exec("echo `head -n 1 /etc/partexppath |awk  '{print $1}'`/image_extracted.img ") 

        if not image_extractedpath or image_extractedpath == "" or not image_extracteddev or image_extracteddev == "" then
            os.execute("echo 'Error: Could not determine expansion path or device' >> /tmp/ezotaflash.log")
            luci.http.status(500, "Configuration error")
            return
        end

        -- 清理旧文件并解压固件
        os.execute("echo 'Preparing extracted image...' >> /tmp/ezotaflash.log")
        if nixio.fs.access(image_extracted) then
	        os.execute("rm -rf " .. image_extracted) 
        end
        os.execute("gzip -dc " .. image_tmp .. " > " .. image_extracted .. " 2>>/tmp/ezotaflash.log")

        -- 验证固件
        if not image_supported(image_tmp) then
            os.execute("echo 'Error: Extracted image verification failed' >> /tmp/ezotaflash.log")
            luci.http.status(500, "Image verification failed")
            return
        end

        -- 处理分区扩展
        os.execute("echo 'Expanding partition...' >> /tmp/ezotaflash.log")
            local sizes = {0, 1024, 2048, 5120, 10240, 20480}  
	    os.execute("dd if=/dev/zero bs=1M count=" .. sizes[expsize + 1] .. " >> " .. image_extracted.. " >>/dev/null 2>&1 ")
            if os.execute("which sgdisk >/dev/null") ~= 0 then
                 os.execute("opkg update && opkg install sgdisk")
            end
	    
	    fork_exec("(sgdisk -e " .. image_extracted .. " >/dev/null 2>&1; true)")
	    fork_exec("(echo -e 'resizepart 2 -1\\nquit' | parted " .. image_extracted .. "  >/dev/null 2>&1; true)")
	    
            -- os.execute("echo -e 'resizepart 2 -1\\nquit' | parted " .. image_extracted .. " >/dev/null 2>&1")
	    -- fork_exec("(parted -s " .. image_extracted .. " resizepart 2 -1 >/dev/null 2>&1; true)")
	    
	    os.execute("echo 'Starting DD flash process...' >> /tmp/ezotaflash.log")


        -- 使用dd刷写镜像
	fork_exec("sleep 1;sync;sleep 1;dd if=%s of=%s bs=4k conv=fsync " %{ image_extractedpath,slist, image_extracted })


        os.execute("echo 'end...' >> /tmp/ezotaflash.log")


    else
        -- 标准sysupgrade模式
        local slist = {}
        if keep ~= "" then table.insert(slist, keep) end
        if bopkg ~= "" then table.insert(slist, bopkg) end
        slist = table.concat(slist, " ")

        os.execute("echo 'Starting sysupgrade process...' >> /tmp/ezotaflash.log;")

       fork_exec("sleep 1; killall dropbear uhttpd nginx; mount -o bind %s /tmp; sleep 1; sync; echo 'Running sysupgrade command...' >> /tmp/ezotaflash.log; /sbin/sysupgrade -p %s %q" %{ image_extractedpath,slist, image_extracted })

    end
    
    luci.http.status(200, "Flash started")
end

function action_ota()
    local http = require "luci.http"
    
    if http.formvalue("apply") == "1" then
        if not luci.dispatcher.test_post_security() then
            return
        end

        -- 立即返回响应页面
        luci.http.prepare_content("text/html")
        luci.http.write([[
<!DOCTYPE html>
<html>
<head>
    <title>]]..luci.i18n.translate("Firmware Upgrade")..[[</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <style>
    body { background:#6a7893; color:#fff; font-family:sans-serif; text-align:center; padding-top:50px; }
    .container { background:#272727; max-width:600px; margin:0 auto; padding:30px; border-radius:8px; }
    .spinner { margin:30px auto; width:50px; height:50px; border:5px solid rgba(255,255,255,0.3); 
               border-radius:50%; border-top-color:#fff; animation:spin 1s ease-in-out infinite; }
    .progress-container { width:100%; height:20px; background:#444; border-radius:10px; margin:15px 0; }
    .progress-bar { height:100%; background:#4CAF50; border-radius:10px; transition:width 0.3s; }
    .log-output { max-height:200px; overflow-y:auto; background:#222; padding:10px; border-radius:5px; 
                 margin-top:15px; font-family:monospace; font-size:12px; text-align:left; }
    .status-message { margin:15px 0; font-size:16px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1>]]..luci.i18n.translate("Firmware Upgrade")..[[</h1>
        <div class="status-message" id="status-message">]]..luci.i18n.translate("Initializing upgrade...")..[[</div>
        <div class="spinner"></div>
        <div class="progress-container"><div id="progress-bar" class="progress-bar" style="width:0%"></div></div>
        <pre id="log-output" class="log-output"></pre>
    </div>
    <script>
    const maxChecks = 300;
    let checkCount = 0;
    const targetIP = "]] .. ((http.formvalue("keep") == "1") and "192.168.1.1" or "192.168.10.1") .. [[";
    
    // 启动刷机流程
    function startFlash() {
        fetch('/cgi-bin/luci/admin/system/start_flash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                keep: ']] .. (http.formvalue("keep") or "0") .. [[',
                bopkg: ']] .. (http.formvalue("bopkg") or "0") .. [[',
                expsize: ']] .. (http.formvalue("expsize") or "0") .. [['
            })
        }).then(() => {
            document.getElementById("status-message").textContent = "]]..luci.i18n.translate("Flash process started...")..[[";
            checkProgress();
        }).catch(e => {
            document.getElementById("status-message").textContent = "]]..luci.i18n.translate("Failed to start flash process")..[[";
            console.error(e);
        });
    }
    
    // 检查进度
    function checkProgress() {
        fetch("/cgi-bin/luci/admin/system/flash_progress")
            .then(r => r.json())
            .then(data => {
                checkCount++;
                
                // 更新UI
                document.getElementById("progress-bar").style.width = data.progress + "%";
                document.getElementById("status-message").innerHTML = data.message;
                
                const logOutput = document.getElementById("log-output");
                logOutput.textContent = data.log;
                logOutput.scrollTop = logOutput.scrollHeight;
                
                // 处理完成状态
                if(data.status === "complete") {
                    attemptReconnect();
                    return;
                }
                
                // 处理失败或超时
                if(data.status === "failed" || checkCount >= maxChecks) {
                    if(checkCount >= maxChecks) {
                        document.getElementById("status-message").innerHTML += "<br><br>]]..luci.i18n.translate("Operation timed out")..[[";
                    }
                    return;
                }
                
                setTimeout(checkProgress, 1000);
            })
            .catch(e => {
                console.error(e);
                if(checkCount < maxChecks) {
                    setTimeout(checkProgress, 2000);
                }
            });
    }
    
    // 尝试重新连接
    function attemptReconnect() {
        let attempts = 0;
        const maxAttempts = 30;
        
        function tryConnect() {
            attempts++;
            fetch(`http://${targetIP}/cgi-bin/luci`, { mode: 'no-cors' })
                .then(() => window.location.href = `http://${targetIP}`)
                .catch(() => {
                    if(attempts < maxAttempts) {
                        setTimeout(tryConnect, 2000);
                    } else {
                        document.getElementById("status-message").innerHTML += "<br><br>]]..luci.i18n.translate("Please manually connect to")..[[ " + targetIP;
                    }
                });
        }
        
        setTimeout(tryConnect, 5000);
    }
    
    // 页面加载后立即启动刷机
    window.addEventListener('load', startFlash);
    </script>
</body>
</html>
        ]])
        luci.http.close()
        return
    else
        luci.template.render("admin_system/ota")
    end
end

function flash_progress()
    luci.http.prepare_content("application/json")
    
    local response = {
        status = "running",
        message = luci.i18n.translate("Preparing flash process..."),
        progress = 0,
        log = ""
    }
    
    if nixio.fs.access("/tmp/ezotaflash.log") then
        response.log = luci.sys.exec("cat /tmp/ezotaflash.log 2>/dev/null") or ""
        
        -- 状态检测逻辑
        if response.log:find("Rebooting system") then
            response.status = "complete"
            response.message = luci.i18n.translate("Upgrade complete! Rebooting...")
            response.progress = 100
        elseif response.log:find("Writing image to flash") then
            local percent = response.log:match("(%d+)%%") or 0
            response.progress = tonumber(percent)
            response.message = luci.i18n.translate("Writing image: ") .. percent .. "%"
        elseif response.log:find("error") then
            response.status = "failed"
            response.message = luci.i18n.translate("Upgrade failed! Check logs")
        end
    end
    
    luci.http.write_json(response)
end
 
function action_check()
    local r, o, e = ota_exec("ota check")
    local ret = {
        code = 500,
        msg = "Unknown"
    }
    if r == 0 or r == 1 or r == 2 then
        ret.code = r
        ret.msg = o
    else
        ret.code = 500
        ret.msg = e
    end
    luci.http.prepare_content("application/json")
    luci.http.write_json(ret)
end

function action_download()
    local r, o, e = ota_exec("ota download")
    local ret = {
        code = 500,
        msg = "Unknown"
    }
    if r == 0 then
        ret.code = 0
        ret.msg = ""
    else
        ret.code = 500
        ret.msg = e
    end
    luci.http.prepare_content("application/json")
    luci.http.write_json(ret)
end

function action_progress()
    local r, o, e = ota_exec("ota progress")
    local ret = {
        code = 500,
        msg = "Unknown"
    }
    if r == 0 then
        ret.code = 0
        ret.msg = "done"
    elseif r == 1 or r == 2 or r == 254 then
        ret.code = r
        ret.msg = o
    else
        ret.code = 500
        ret.msg = e
    end
    luci.http.prepare_content("application/json")
    luci.http.write_json(ret)
end

function action_cancel()
    local r, o, e = ota_exec("ota cancel")
    local ret = {
        code = 500,
        msg = "Unknown"
    }
    if r == 0 then
        ret.code = 0
        ret.msg = "ok"
    else
        ret.code = 500
        ret.msg = e
    end
    luci.http.prepare_content("application/json")
    luci.http.write_json(ret)
end 