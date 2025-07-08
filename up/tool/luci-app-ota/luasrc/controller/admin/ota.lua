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

function action_ota()
    local image_tmp = "/tmp/firmware.img"
    local http = require "luci.http"
    local nixio = require "nixio"
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
        local slist = {}
        if keep ~= "" then table.insert(slist, keep) end
        if bopkg ~= "" then table.insert(slist, bopkg) end
        slist = table.concat(slist, " ")
    
        local expsize = tonumber(http.formvalue("expsize")) or 0
	
        -- 清空日志文件
        os.execute("echo 'Starting flash process...' > /etc/ezotaflash.log")
        os.execute("chmod 644 /etc/ezotaflash.log")
        luci.template.render("admin_system/ota_flashing", {
                  title = luci.i18n.translate("Flashing…"),
                  msg   = luci.i18n.translate("The system is flashing now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
                  addr = (#keep > 0) and "192.168.10.1" or nil
                  })
		  
        if expsize > 0 then
            local image_extractedpath = luci.sys.exec("head -n 1 /etc/partexppath | awk '{print $1}' 2>/dev/null")
            local image_extracteddev = luci.sys.exec("echo /dev/`head -n 1 /etc/partexppath | awk '{print $2}'` 2>/dev/null")
            local image_extracted = luci.sys.exec("echo `head -n 1 /etc/partexppath |awk  '{print $1}'`/image_extracted.img ") 

            if not image_extractedpath or image_extractedpath == "" or not image_extracteddev or image_extracteddev == "" then
                os.execute("echo 'Error: Could not determine expansion path or device' >> /etc/ezotaflash.log")
                return
            end

            -- 清理旧文件并解压固件
            os.execute("echo 'Preparing extracted image...' >> /etc/ezotaflash.log")
            if nixio.fs.access(image_extracted) then
	        os.execute("rm -rf " .. image_extracted) 
            end
            os.execute("gzip -dc " .. image_tmp .. " > " .. image_extracted) 


            -- 处理分区扩展
            os.execute("echo 'Expanding partition...' >> /etc/ezotaflash.log")
            local sizes = {0, 1024, 2048, 5120, 10240, 20480}  
	    os.execute("dd if=/dev/zero bs=1M count=" .. sizes[expsize + 1] .. " >> " .. image_extracted.. " >>/dev/null 2>&1 ")
            if os.execute("which sgdisk >/dev/null") ~= 0 then
                 os.execute("opkg update && opkg install sgdisk")
            end
	    
	    fork_exec("(sgdisk -e " .. image_extracted .. " >/dev/null 2>&1; true)")
	    fork_exec("(echo -e 'resizepart 2 -1\\nquit' | parted " .. image_extracted .. "  >/dev/null 2>&1; true)")
	    
	    os.execute("echo 'Starting DD flash process...' >> /etc/ezotaflash.log")


             local cmd = string.format(
               "sleep 2; killall dropbear uhttpd nginx;  sleep 1; sync; (dd if=%s of=%s bs=4k conv=fsync) && echo 'Rebooting system...' >> /etc/ezotaflash.log ",
	       image_extracted,
               image_extracteddev
            )
	    
            -- 执行升级
            -- fork_exec(cmd)

	    fork_exec("(dd if=" .. image_extracted .. "  of=" .. image_extracteddev .. " bs=4k conv=fsync >/dev/null 2>&1) && echo 'DD flash END' >> /etc/ezotaflash.log ")
	    os.execute("echo 'END' >> /etc/ezotaflash.log")

        else
	    os.execute("echo 'Starting sysupgrade process...' >> /etc/ezotaflash.log")
            fork_exec("sleep 1; killall dropbear uhttpd nginx; sleep 1; sync; (/sbin/sysupgrade %s %q ) && echo 'Sysupgrade END' >> /etc/ezotaflash.log " %{ slist, image_tmp })
        end

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

function fork_exec(command)
	local pid = nixio.fork()
	if pid > 0 then
		return
	elseif pid == 0 then
		-- change to root dir
		nixio.chdir("/")

		-- patch stdin, out, err to /dev/null
		local null = nixio.open("/dev/null", "w+")
		if null then
			nixio.dup(null, nixio.stderr)
			nixio.dup(null, nixio.stdout)
			nixio.dup(null, nixio.stdin)
			if null:fileno() > 2 then
				null:close()
			end
		end

		-- replace with target command
		nixio.exec("/bin/sh", "-c", command)
	end
end
