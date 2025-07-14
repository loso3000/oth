module("luci.controller.api", package.seeall)
http = require "luci.http"
fs = require "nixio.fs"
uci = require "luci.model.uci".cursor()
json = require "luci.jsonc"
     
function index()
    entry({"api", "get"}, call("get_theme"), nil, 10)
    entry({"api", "set"}, call("set_theme"), nil, 20)
end

function get_theme()
    local kucat
    if fs.access("/etc/config/advancedplus") then
       kucat = "advancedplus"
       config_exists = true
    elseif fs.access("/etc/config/kucat") then
       kucat = "kucat"
       config_exists = true
    end
    if (config_exists) then
        local section = uci:get(kucat, "@basic[0]") or {}
        bgqs = uci:get(kucat, "@basic[0]", "bgqs") or '0'
    end
    local bgqs = section.bgqs or '0'
    http.prepare_content("application/json")
    http.write(json.stringify({
        success = true,
        config_section = kucat,
        bgqs = bgqs
    }))
end

function set_theme()
    local kucat
    if fs.access("/etc/config/advancedplus") then
       kucat = "advancedplus"
       config_exists = true
    elseif fs.access("/etc/config/kucat") then
       kucat = "kucat"
       config_exists = true
    end
    
    if (config_exists) then
       uci:set(kucat, "@basic[0]", "mode", http.formvalue("theme"))
       uci:commit(kucat)
       http.prepare_content("application/json")
       http.write_json({ success = true })
    else
       http.prepare_content("application/json")
       http.write_json({ success = flase })
    end
end