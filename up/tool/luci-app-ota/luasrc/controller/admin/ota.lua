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


function get_file_size(path)
    local ok, nixio = pcall(require, "nixio")
    if ok and nixio then
        local stat = nixio.fs.stat(path)
        if stat then return stat.size end
    end
    return tonumber(luci.sys.exec("ls -l "..path.." | awk '{print $5}' 2>/dev/null")) or 0
end

function get_free_space(path)
    local free_kb = tonumber(luci.sys.exec(
        "df -k "..path.." 2>/dev/null | awk 'NR==2 {print $4}'"
    )) or 0
    return free_kb * 1024  -- Convert KB to bytes
end

function validate_partexp_file()
    if not nixio.fs.access("/etc/partexppath") then
        return nil, "/etc/partexppath not found"
    end
    
    local path = luci.sys.exec("head -n 1 /etc/partexppath 2>/dev/null | tr -d '\n'")
    if not path or path == "" then
        return nil, "Empty partexppath file"
    end
    
    if not path:match("^/") then
        return nil, "Invalid path format"
    end
    
    if not nixio.fs.stat(path) then
        return nil, "Target path not exist: "..path
    end
    
    return path
end

function safe_decompress(src, dst)
    -- Try gzip first
    if os.execute(string.format("gzip -t %q 2>/dev/null", src)) == 0 then
        return os.execute(string.format("gzip -dc %q > %q", src, dst)) == 0
    end
    
    -- Try xz if gzip fails
    if os.execute(string.format("xz -t %q 2>/dev/null", src)) == 0 then
        return os.execute(string.format("xz -dc %q > %q", src, dst)) == 0
    end
    
    -- Not compressed, just copy
    return os.execute(string.format("cp %q %q", src, dst)) == 0
end

function safe_resize_image(img_path, expand_size_mb)
    -- Expand image file
    if os.execute(string.format(
        "dd if=/dev/zero bs=1M count=%d >> %q 2>/dev/null",
        expand_size_mb, img_path
    )) ~= 0 then
        return false, "dd expansion failed"
    end
    
    -- Fix GPT table
    if os.execute(string.format("sgdisk -e %q 2>/dev/null", img_path)) ~= 0 then
        return false, "sgdisk failed"
    end
    
    -- Resize partition
    local ret = os.execute(string.format(
        'echo -e "resizepart 2 -1\\nquit" | parted %q',
        img_path
    ))
    
    return ret == 0, ret == 0 and nil or "parted resize failed"
end
function action_ota()
    local image_tmp = "/tmp/firmware.img"
    local http = require "luci.http"
    if http.formvalue("apply") == "1" then
        if not luci.dispatcher.test_post_security() then
            return
        end

    -- 验证固件文件
        if not image_supported(image_tmp) then
            luci.template.render("admin_system/ota", {image_invalid = true})
            return
        end

    -- 获取参数
        local keep = (http.formvalue("keep") == "1") and "" or "-n"
        local bopkg = (http.formvalue("bopkg") == "1") and "" or "-k"
        local expsize = tonumber(http.formvalue("expsize")) or 0

    -- 构建升级命令
        local cmd
        if expsize > 0 then
            local image_extractedpath = luci.sys.exec("head -n 1 /etc/partexppath |awk  '{print $1}' ")
            local image_extracteddev = luci.sys.exec("head -n 1 /etc/partexppath |awk  '{print $2}' ")
            if not image_extractedpath or image_extractedpath == "" then
                return
            end
	    if not image_extracteddev or image_extracteddev == "" then
                return
            end

            local image_extracted = image_extractedpath.."/image_extracted.img"
        
        -- 清理旧文件
            if nixio.fs.access(image_extracted) then
	        os.execute("rm -rf " .. image_extracted) 
            end
            os.execute("gzip -dc " .. image_tmp .. " > " .. image_extracted) 
        -- Verify image
            if not image_supported(image_extracted) then
                return
            end

        -- Handle expansion 
            local sizes = {0, 1024, 2048, 5120, 10240, 20480}  
	    os.execute("dd if=/dev/zero bs=1M count=" .. sizes[expsize + 1] .. " >> " .. image_extracted.. " 2>/dev/null")
            if os.execute("which sgdisk >/dev/null") ~= 0 then
                 os.execute("opkg update && opkg install gdisk")
            end
	    os.execute("sgdisk -e " .. image_extracted .. " 2>/dev/null")
            os.execute("echo -e resizepart 2 -1\\nquit | parted " .. image_extracted)
        
    
        luci.template.render("admin_system/ota_flashing", {
          title = luci.i18n.translate("Flashing…"),
          msg   = luci.i18n.translate("The system is flashing now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
          addr = (keep == "") and "192.168.10.1" or nil
        })
        fork_exec("sleep 1; killall dropbear uhttpd nginx;  sync; dd if=%s of=/dev/%s" %{ image_extracted,  image_extracteddev }  )
    else
    
        local slist = {}
        if keep ~= "" then table.insert(slist, keep) end
        if bopkg ~= "" then table.insert(slist, bopkg) end
        slist = table.concat(slist, " ")
    
        luci.template.render("admin_system/ota_flashing", {
          title = luci.i18n.translate("Flashing…"),
          msg   = luci.i18n.translate("The system is flashing now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
        addr = (keep == "") and "192.168.10.1" or nil
        })
        fork_exec("sleep 1; killall dropbear uhttpd nginx; sleep 1; sync; /sbin/sysupgrade %s %q" %{ slist, image_tmp } )
    end
    luci.sys.call(string.format(
                "logger -t ota_debug slist=%s",
                slist
    ))
    
  else
    luci.template.render("admin_system/ota")
  end
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
