local m,s,o
local bypass="bypass"
local uci=luci.model.uci.cursor()

m=Map(bypass)
-- s=m:section(TypedSection,"server_subscribe")

-- s.anonymous = true
-- s:append(Template("bypass/node_add"))
s=m:section(TypedSection,"servers")
s.anonymous=true
s.addremove=true
s.template="cbi/tblsection"
-- s.sortable=true
s.extedit=luci.dispatcher.build_url("admin","services",bypass,"servers","%s")
function s.create(...)
	local sid=TypedSection.create(...)
	if sid then
		uci:set(bypass,sid,'switch_enable',1)
		luci.http.redirect(s.extedit%sid)
		return
	end
end
s.render = function(self, ...)
	Map.render(self, ...)
	if type(optimize_cbi_ui) == "function" then
		optimize_cbi_ui()
	end
end

o=s:option(DummyValue,"type",translate("Type"))
function o.cfgvalue(self, section)
	return m:get(section, "v2ray_protocol") or Value.cfgvalue(self, section) or translate("None")
end

o=s:option(DummyValue,"alias",translate("Alias"))
function o.cfgvalue(...)
	return Value.cfgvalue(...) or translate("None")
end

o=s:option(DummyValue,"server_port",translate("Server Port"))
function o.cfgvalue(...)
	return Value.cfgvalue(...) or "N/A"
end

o=s:option(DummyValue,"server_port",translate("Socket Connected"))
o.template="bypass/socket"
o.width="10%"
o.render = function(self, section, scope)
	self.transport = s:cfgvalue(section).transport
	if self.transport == 'ws' then
		self.ws_path = s:cfgvalue(section).ws_path
		self.tls = s:cfgvalue(section).tls
	end
	DummyValue.render(self, section, scope)
end

o=s:option(DummyValue,"server",translate("TCPing Latency"))
o.template="bypass/ping"
o.width="10%"

local global_server = uci:get_first('bypass', '@global[0]', 'global_server') 
o=s:option(Button,"apply_node",translate("Apply"))
o.inputstyle="apply"
o.render = function(self, section, scope)
	if section == global_server then
		self.title = translate("Reapply")
	else
		self.title = translate("Apply")
	end
	Button.render(self, section, scope)
end
o.write=function(self,section)
	uci:set(bypass,'@global[0]','global_server',section)
	uci:save("bypass")
	uci:commit(bypass)
	luci.http.redirect(luci.dispatcher.build_url("admin","services",bypass,"restart"))
end

o=s:option(Flag,"switch_enable",translate("Auto Switch"))
o.rmempty=false
function o.cfgvalue(...)
	return Value.cfgvalue(...) or 1
end

m:append(Template("bypass/server_list"))

return m
